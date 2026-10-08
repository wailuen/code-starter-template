"use strict";

// Retry control over COMPLETE review rounds. This does not certify convergence;
// check-redteam-convergence-receipt.mjs still owns that decision.
const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { assertStateDirContained, readFileHardened, writeFileHardened } = require("../../.claude/hooks/lib/state-io.js");
const { isAgentIdentity } = require("./agent-identity.cjs");
// FIRING_THRESHOLD bounds CONSECUTIVE non-clear rounds since the last reassessment
// and resets on every fresh decision record. TOTAL_ROUND_CAP bounds the branch's
// CUMULATIVE round count and never resets, because genuine decision records each
// legitimately reset the consecutive counter and a branch could otherwise run without
// end. Both gates apply; whichever fires first.
const FIRING_THRESHOLD = 4;
const TOTAL_ROUND_CAP = 3;
// An errored dispatch may be re-run this many times without spending budget; the
// next consecutive failure is charged like any round, so an instrument that keeps
// failing bleeds the branch into the cap instead of retrying forever.
const ERROR_RERUN_LIMIT = 2;
const STATE_FILE = "redteam-stall-state.json";
const nonempty = (s) => typeof s === "string" && s.trim().length > 0;

function normalizeRound(input) {
  if (!input || typeof input !== "object") throw new Error("Expected a complete review round");
  const { branch, round, head, expected_reviewers, reviewers, root_causes = [], replan, debug, escalation_accepts } = input;
  if (!nonempty(branch) || !/^[A-Za-z0-9_./-]+$/.test(branch)) throw new Error("branch must be a canonical branch name");
  if (!Number.isSafeInteger(round) || round < 1) throw new Error("round must be a positive integer");
  if (typeof head !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(head)) throw new Error("head must be a full commit SHA");
  if (!Array.isArray(expected_reviewers) || expected_reviewers.length === 0 ||
      !expected_reviewers.every(nonempty) || new Set(expected_reviewers).size !== expected_reviewers.length) {
    throw new Error("expected_reviewers must name unique reviewers before dispatch");
  }
  if (!Array.isArray(reviewers) || reviewers.length !== expected_reviewers.length ||
      new Set(reviewers.map((r) => r?.id)).size !== reviewers.length ||
      !reviewers.every((r) => r && expected_reviewers.includes(r.id) &&
        ["CLEAR", "NOT_CLEAR", "ERROR"].includes(r.verdict) && nonempty(r.evidence))) {
    throw new Error("Every expected reviewer must return one verdict and evidence; partial rounds cannot count");
  }
  if (!Array.isArray(root_causes) || !root_causes.every(nonempty)) throw new Error("root_causes must be an array of stable mechanism keys");
  const clean = reviewers.every((r) => r.verdict === "CLEAR");
  if (clean && root_causes.length) throw new Error("A clean round cannot carry open root causes");
  if (reviewers.some((r) => r.verdict === "NOT_CLEAR") && !root_causes.length) throw new Error("NOT_CLEAR requires root_causes for recurrence detection");
  if (replan !== undefined && !nonempty(replan)) throw new Error("replan must reference a decision record");
  const { replan_closes, replan_accepts } = input;
  if (replan_closes !== undefined) {
    if (!replan) throw new Error("replan_closes requires a replan decision record on the same round");
    if (!Array.isArray(replan_closes) || !replan_closes.every(nonempty)) throw new Error("replan_closes must be an array of root-cause keys");
  }
  if (replan_accepts !== undefined) {
    if (!replan) throw new Error("replan_accepts requires a replan decision record on the same round");
    if (!Array.isArray(replan_accepts) || !replan_accepts.every((a) => a && nonempty(a.key) && nonempty(a.acceptor))) {
      throw new Error("replan_accepts must be an array of {key, acceptor}");
    }
    // Accepting a recurring root cause is a human's call, like accepting an escalation.
    const agent = replan_accepts.find((a) => isAgentIdentity(a.acceptor) || expected_reviewers.includes(a.acceptor.trim()));
    if (agent) throw new Error(`replan_accepts acceptor must be a named human, not an agent role or reviewer lens (${agent.acceptor})`);
  }
  if (debug !== undefined && debug !== true) throw new Error("debug must be true when present; an ordinary round omits it");
  if (debug && !replan) throw new Error("A debug round must also cite a new decision record in replan; the flag alone is not a reassessment");
  if (escalation_accepts !== undefined) {
    if (!escalation_accepts || typeof escalation_accepts !== "object" || Array.isArray(escalation_accepts) ||
        !nonempty(escalation_accepts.acceptor) || !nonempty(escalation_accepts.record)) {
      throw new Error("escalation_accepts must be {acceptor, record}: the named human who accepted the escalation and their acceptance record");
    }
    const acceptor = escalation_accepts.acceptor.trim();
    // One denylist shared with the convergence checker and the task-contract check.
    if (isAgentIdentity(acceptor) || expected_reviewers.includes(acceptor)) {
      throw new Error(`escalation_accepts.acceptor must be a named human, not an agent role or reviewer lens (${acceptor})`);
    }
    if (replan !== undefined && escalation_accepts.record === replan) {
      throw new Error("escalation_accepts.record must be the human's own acceptance record, not the agent's replan decision record");
    }
  }
  return { branch, round, head, expected_reviewers: [...expected_reviewers].sort(),
    reviewers: reviewers.map(({ id, verdict, evidence }) => ({ id, verdict, evidence })).sort((a, b) => a.id.localeCompare(b.id)),
    root_causes: [...new Set(root_causes)].sort(), ...(replan ? { replan } : {}),
    ...(replan_closes ? { replan_closes: [...new Set(replan_closes)].sort() } : {}),
    ...(replan_accepts ? { replan_accepts: replan_accepts.map(({ key, acceptor }) => ({ key, acceptor })) } : {}),
    ...(debug ? { debug: true } : {}),
    ...(escalation_accepts ? { escalation_accepts: { acceptor: escalation_accepts.acceptor.trim(), record: escalation_accepts.record } } : {}) };
}

// A clean round only closes the loop if the reviewed head never moved: a round whose
// `head` differs from the previous round's restarts the clean count. `head` is the
// commit the reviewers checked out, not the branch tip, so committing the round's own
// record, report and ledger rows on top (bookkeeping) changes nothing as long as the next
// round's `head` stays the reviewed commit. A round can be clean and still not be "the
// second one" the convergence receipt needs; describeNext() says so out loud.
function describeNext({ action, cleanRounds, head, streakReset, capReached, reviewersSeen, debugRound, replanRequired, charged, consecutiveErrors }) {
  const shortHead = head.slice(0, 12);
  if (action === "VERIFY_CONVERGENCE_RECEIPT") {
    return `NEXT: run the convergence receipt check — two clean rounds confirmed on ${shortHead} with no changes between them.`;
  }
  if (action === "ESCALATE_TO_HUMAN") {
    return `NEXT: STOP. This branch has used its ${TOTAL_ROUND_CAP}-round budget and its single debug round (r${debugRound}) without converging. ` +
      "No further round can be recorded without a named human's acceptance: escalation_accepts {acceptor, record}, a NEW acceptance record for each round. " +
      "The human decides: accept the residual and close, split or abandon the branch, or authorize exactly one more round." +
      (replanRequired ? " REPLAN also fires, so that round must cite a new decision record in replan as well." : "");
  }
  if (action === "DEBUG_ROUND") {
    return `NEXT: the ${TOTAL_ROUND_CAP}-round cap is reached without convergence. Repair the findings, then the ONLY round this branch can still record is its single /debug round: ` +
      `debug: true, a new decision record in replan, and expected_reviewers never used on this branch, named <lens>-debug (e.g. correctness-debug, security-debug; already used: ${reviewersSeen.join(", ")}). ` +
      "Its same-head confirmation round, if it is clean, omits debug: true. " +
      "If that round does not converge, the branch escalates to a named human." +
      (replanRequired ? " REPLAN also fires; the decision record must address it." : "");
  }
  if (action === "REPLAN") {
    return "NEXT: run /debug architectural reassessment before another repair cycle.";
  }
  if (action === "REPAIR_ENVIRONMENT") {
    const budget = charged
      ? ` This errored round SPENT budget: ${consecutiveErrors} consecutive instrument failures on this dispatch is past the ${ERROR_RERUN_LIMIT} free re-runs, and no further re-run is admitted — repair the environment, then the ordinary gates apply.`
      : ` An errored round spends no round budget (${consecutiveErrors}/${ERROR_RERUN_LIMIT} free re-runs used), and its re-run may cite the same decision record.`;
    return `NEXT: fix the review environment/instrument error (an ERROR verdict cannot count as evidence); re-run this round — same expected_reviewers, same debug flag, same head ${shortHead} — once the tooling works.${budget}`;
  }
  if (action === "REVIEW") {
    const warning = streakReset
      ? ` WARNING: the reviewed code changed since the last clean round, so the clean-round counter just reset to ${cleanRounds}/2 — this round does NOT count as the confirmation.`
      : "";
    const cap = capReached
      ? ` The ${TOTAL_ROUND_CAP}-round cap is reached: a same-head confirmation is the ONLY ordinary round left; if the head moves, the next round needs the branch's debug round${debugRound == null ? "" : " (already used)"} or a named human's escalation_accepts.`
      : "";
    return `NEXT: dispatch round N+1 with head ${shortHead} UNCHANGED — the reviewers check out that same commit. A change to the reviewed code (a new head) resets cleanRounds to 0; committing this round's record, reports and ledger rows does not, as long as head stays ${shortHead}. Currently cleanRounds ${cleanRounds}/2. Only a standard-mode wave convergence (/redteam, scope wNN) needs this second clean round: a light-mode wave, a todo checkpoint, a /fix branch, a planning review, an analysis review or a codify review is done after one complete CLEAR round, so do not dispatch it there.${warning}${cap}`;
  }
  return `NEXT: repair the findings, then dispatch a fresh round against the new head. Currently cleanRounds ${cleanRounds}/2 (it stays at 0 until two consecutive clean rounds share one unchanged head).`;
}

// Recurrence is judged by key, so a class resurfacing under a differently-worded key
// would slip past it. Print the branch's full known-root-cause history on every record
// so an author cannot mint a fresh key for a class the branch has already named
// without seeing it listed.
function formatKeyHistory(keyHistory, closedBy, accepted) {
  const keys = Object.keys(keyHistory).sort();
  if (!keys.length) return "Known root causes on this branch: none yet.";
  const parts = keys.map((key) => {
    const rounds = keyHistory[key].map((n) => `r${n}`).join(",");
    const tag = key in closedBy ? ` [closed by ${closedBy[key]}]` : key in accepted ? ` [accepted by ${accepted[key]}]` : "";
    return `${key} (${rounds})${tag}`;
  });
  return `Known root causes on this branch: ${parts.join(", ")}.`;
}

function formatBudget({ roundsRecorded, debugRound, acceptancesConsumed }) {
  const debug = debugRound == null ? "available" : `used (r${debugRound})`;
  const acceptances = acceptancesConsumed.length ? acceptancesConsumed.join(", ") : "none";
  return `Rounds recorded on this branch: ${roundsRecorded} (cap ${TOTAL_ROUND_CAP}); debug round: ${debug}; human acceptances: ${acceptances}.`;
}

// State written before the cumulative cap existed carries none of its fields.
// Seed conservatively: the orchestrator's own round number as the count (exact for
// a branch that started at round 1, an over-count otherwise — which errs toward
// blocking, never toward runaway), the last round's lens set and decision record
// as the only history that state ever kept, plus whatever the CLI recovered from
// the branch's earlier round files on disk (legacySeed), which knows more.
function budgetBefore(previous, legacySeed = {}) {
  if (!previous) return { roundsRecorded: 0, reviewersSeen: [], debugRound: null, acceptancesConsumed: [], replansConsumed: {} };
  let replansConsumed = previous.replansConsumed;
  if (!replansConsumed) {
    replansConsumed = Object.create(null);
    for (const path of Object.values(previous.closedBy || {})) replansConsumed[path] = previous.lastRound;
    if (previous.lastRoundRecord?.replan) replansConsumed[previous.lastRoundRecord.replan] = previous.lastRound;
    for (const [path, n] of Object.entries(legacySeed.replansConsumed || {})) {
      if (nonempty(path) && Number.isSafeInteger(n) && n >= 1) replansConsumed[path] = n;
    }
  }
  const reviewersSeen = previous.reviewersSeen ?? [...new Set([
    ...(Array.isArray(legacySeed.reviewersSeen) ? legacySeed.reviewersSeen.filter(nonempty) : []),
    ...(previous.lastRoundRecord?.expected_reviewers || [])])].sort();
  return { roundsRecorded: previous.roundsRecorded ?? previous.lastRound, reviewersSeen,
    debugRound: previous.debugRound ?? null, acceptancesConsumed: previous.acceptancesConsumed ?? [], replansConsumed };
}

function refuse(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// Past TOTAL_ROUND_CAP, a round is admitted only as (a) the same-head confirmation
// of an immediately preceding FIRST clean round — the closing half of convergence,
// admitted once, never a repair cycle; (b) the branch's single debug round; (c) a
// round a named human accepted, once (b) is spent; or (d) the same-shape re-run of
// a round whose instrument errored. Refusals here leave state untouched.
function admitRound(previous, round, budget, rerun) {
  const capReached = budget.roundsRecorded >= TOTAL_ROUND_CAP;
  const debugUsed = budget.debugRound != null;
  const sameHead = Boolean(previous) && previous.head === round.head;
  if (sameHead && previous.cleanRounds >= 2 &&
      JSON.stringify(previous.lastRoundRecord?.expected_reviewers) === JSON.stringify(round.expected_reviewers)) {
    throw new Error(`round ${round.round} refused: this branch converged on ${round.head.slice(0, 12)} at round ${previous.lastRound}; another round with the same lenses on the unchanged head reviews nothing — run the convergence receipt check`);
  }
  const confirmation = sameHead && previous.cleanRounds === 1;
  if (round.debug) {
    if (!capReached) throw new Error(`debug rounds are the exception past the ${TOTAL_ROUND_CAP}-round cap; round ${round.round} is within it — record an ordinary replan`);
    if (debugUsed) throw refuse(`this branch's single debug round was round ${budget.debugRound}; a second cannot be recorded — a named human must accept the escalation (escalation_accepts)`, "ESCALATE_TO_HUMAN");
    const reused = round.expected_reviewers.filter((id) => budget.reviewersSeen.includes(id));
    if (reused.length) throw new Error(`a debug round needs reviewers never used on this branch; already used: ${reused.join(", ")}`);
    if (round.escalation_accepts) throw new Error("escalation_accepts is not needed on the debug round; remove it");
    return;
  }
  if (round.escalation_accepts) {
    if (!capReached || !debugUsed) throw new Error("escalation_accepts is accepted only once the branch is escalated (past the cap with its debug round used)");
    if (budget.acceptancesConsumed.includes(round.escalation_accepts.record)) {
      throw new Error(`acceptance record ${round.escalation_accepts.record} was already consumed; each accepted round needs a new one`);
    }
    if (budget.reviewersSeen.includes(round.escalation_accepts.acceptor)) {
      throw new Error(`escalation_accepts.acceptor ${round.escalation_accepts.acceptor} is a reviewer lens on this branch, not a human`);
    }
    return;
  }
  if (capReached && !confirmation && !rerun) {
    if (debugUsed) {
      throw refuse(`round ${round.round} refused: this branch used its ${TOTAL_ROUND_CAP}-round budget and its debug round (r${budget.debugRound}); a named human must accept each further round (escalation_accepts {acceptor, record})`, "ESCALATE_TO_HUMAN");
    }
    throw refuse(`round ${round.round} refused: this branch used its ${TOTAL_ROUND_CAP}-round budget without converging; the next round must be its single debug round (debug: true, new replan, reviewers never used here: not ${budget.reviewersSeen.join(", ")})`, "DEBUG_ROUND");
  }
}

function advanceRound(previous, input, { legacySeed } = {}) {
  const round = normalizeRound(input);
  const fingerprint = createHash("sha256").update(JSON.stringify(round)).digest("hex");
  if (previous?.lastRound === round.round) {
    if (previous.fingerprint !== fingerprint) throw new Error("Conflicting result for an already recorded round");
    const budget = budgetBefore(previous, legacySeed);
    const next = `${describeNext({ action: previous.action, cleanRounds: previous.cleanRounds, head: previous.head, streakReset: false,
      capReached: budget.roundsRecorded >= TOTAL_ROUND_CAP, reviewersSeen: budget.reviewersSeen, debugRound: budget.debugRound, replanRequired: previous.replanRequired })}\n` +
      `${formatKeyHistory(previous.keyHistory || {}, previous.closedBy || {}, previous.accepted || {})}\n${formatBudget(budget)}`;
    return { nextState: previous, duplicate: true, action: previous.action, streakReset: false, next };
  }
  if (previous && round.round !== previous.lastRound + 1) throw new Error("Rounds must be recorded in order without gaps");
  const budget = budgetBefore(previous, legacySeed);
  const previousErrored = Boolean(previous?.lastRoundRecord?.reviewers?.some((r) => r.verdict === "ERROR"));
  const errorsBefore = previous?.consecutiveErrors ?? (previousErrored ? 1 : 0);
  // A round whose instrument errored is re-run, not repaired: the re-run is the same
  // dispatch again — same lenses, same debug flag (so an errored debug attempt cannot
  // be re-run unflagged and leave the allowance unspent) and the SAME head (a moved
  // head is a new round carrying whatever the re-run finds) — and may cite the
  // decision record the errored round already cited. At most ERROR_RERUN_LIMIT
  // re-runs are admitted this way; after that the ordinary gates apply.
  const rerun = previousErrored && errorsBefore <= ERROR_RERUN_LIMIT &&
    JSON.stringify(previous.lastRoundRecord.expected_reviewers) === JSON.stringify(round.expected_reviewers) &&
    Boolean(previous.lastRoundRecord.debug) === Boolean(round.debug) && previous.head === round.head;
  admitRound(previous, round, budget, rerun);
  if (previous?.lastRoundRecord && !round.replan &&
      JSON.stringify(previous.lastRoundRecord.expected_reviewers) !== JSON.stringify(round.expected_reviewers)) {
    throw new Error("Changing expected reviewers requires a recorded reassessment; do not drop a failing lens");
  }
  if (round.replan && Object.hasOwn(budget.replansConsumed, round.replan) && !(rerun && previous.lastRoundRecord.replan === round.replan)) {
    // A decision record is consumed by the round that first cites it. Re-citing
    // the SAME path on a later round would silently suppress recurrence detection
    // for that whole interval — refuse it instead.
    // Judged against the whole branch, not the adjacent round: a record spent
    // two rounds ago is no fresher, and the cap's debug round needs a NEW one.
    throw new Error(`replan ${round.replan} was already consumed by round ${budget.replansConsumed[round.replan]}; a new reassessment needs a new decision record`);
  }
  if (previous?.replanRequired && !round.replan) {
    const error = new Error("REPLAN required before another round; record the changed approach and reference it in replan");
    error.code = "REPLAN";
    throw error;
  }
  const clean = round.reviewers.every((r) => r.verdict === "CLEAR");
  const error = round.reviewers.some((r) => r.verdict === "ERROR");
  const closedBy = { ...(previous?.closedBy || {}) };
  const accepted = { ...(previous?.accepted || {}) };
  if (round.replan) {
    for (const key of round.replan_closes || []) closedBy[key] = round.replan;
    for (const { key, acceptor } of round.replan_accepts || []) accepted[key] = acceptor;
  }
  const keyHistoryBefore = previous?.keyHistory || {};
  // Recurrence is judged against the WHOLE branch history, not the adjacent
  // round: a class a clean round doesn't mention hasn't gone away, and a class
  // a decision record CLAIMED to close reappearing is the stronger signal, not
  // a weaker one. A key first named on the round that cites a fresh replan
  // seeds a new interval and does not itself fire.
  const repeated = !round.replan && round.root_causes.some((key) =>
    key in closedBy || ((keyHistoryBefore[key] || []).length > 0 && !(key in accepted)));
  const keyHistory = { ...keyHistoryBefore };
  if (!clean) for (const key of round.root_causes) keyHistory[key] = [...(keyHistoryBefore[key] || []), round.round];
  const consecutiveNotClear = clean ? 0 : (previous?.consecutiveNotClear || 0) + 1;
  const roundsSinceReplan = clean ? 0 : (round.replan ? 0 : previous?.roundsSinceReplan || 0) + 1;
  const sameHeadAsPrevious = previous?.head === round.head;
  const consecutiveErrors = error ? errorsBefore + 1 : 0;
  // The first ERROR_RERUN_LIMIT consecutive errored rounds are void: visible
  // (REPAIR_ENVIRONMENT) but spending nothing — no round counted, neither the debug
  // allowance nor an acceptance record consumed, no lens added, and the clean streak
  // left exactly as it was on an unchanged head (an errored round neither breaks a
  // streak nor restarts one, so CLEAN→ERROR→CLEAN cannot re-arm the confirmation).
  // The decision record it cited IS consumed, so only its same-shape re-run may cite
  // it again. From the next consecutive failure on, an errored round is charged
  // like any complete non-clean round.
  const voided = error && errorsBefore < ERROR_RERUN_LIMIT;
  const counted = !voided;
  const cleanRounds = clean ? (sameHeadAsPrevious ? previous.cleanRounds : 0) + 1
    : voided && sameHeadAsPrevious ? previous.cleanRounds : 0;
  const streakReset = clean && !sameHeadAsPrevious && (previous?.cleanRounds || 0) > 0;
  const replanRequired = !clean && (roundsSinceReplan >= FIRING_THRESHOLD || repeated);
  const roundsRecorded = budget.roundsRecorded + (counted ? 1 : 0);
  const reviewersSeen = counted ? [...new Set([...budget.reviewersSeen, ...round.expected_reviewers])].sort() : budget.reviewersSeen;
  const debugRound = counted && round.debug ? round.round : budget.debugRound;
  const acceptancesConsumed = counted && round.escalation_accepts
    ? [...budget.acceptancesConsumed, round.escalation_accepts.record] : budget.acceptancesConsumed;
  const replansConsumed = round.replan ? { ...budget.replansConsumed, [round.replan]: round.round } : budget.replansConsumed;
  const capReached = roundsRecorded >= TOTAL_ROUND_CAP;
  // A complete non-clean round at or past the cap owes the branch its debug round,
  // or — once that is spent — a human. Both subsume REPLAN: the debug round must
  // cite a decision record, and replanRequired still binds an accepted round.
  const capAction = capReached && !clean && !error ? (debugRound == null ? "DEBUG_ROUND" : "ESCALATE_TO_HUMAN") : null;
  const action = capAction ? capAction : replanRequired ? "REPLAN" : error ? "REPAIR_ENVIRONMENT" :
    cleanRounds >= 2 ? "VERIFY_CONVERGENCE_RECEIPT" : clean ? "REVIEW" : "FIX";
  const nextBudget = { roundsRecorded, reviewersSeen, debugRound, acceptancesConsumed, replansConsumed };
  const next = `${describeNext({ action, cleanRounds, head: round.head, streakReset, capReached, reviewersSeen, debugRound, replanRequired,
    charged: error && !voided, consecutiveErrors })}\n` +
    `${formatKeyHistory(keyHistory, closedBy, accepted)}\n${formatBudget(nextBudget)}`;
  return { duplicate: false, action, streakReset, next, nextState: { lastRound: round.round, head: round.head,
    fingerprint, consecutiveNotClear, roundsSinceReplan, cleanRounds, replanRequired, consecutiveErrors,
    rootCauses: round.root_causes, keyHistory, closedBy, accepted, action, lastRoundRecord: round, ...nextBudget } };
}

const toPosix = (p) => p.split(path.sep).join("/");

// The checkout a directory belongs to: the nearest ancestor holding `.git` (a
// directory in the main checkout, a file in a linked worktree). Falls back to
// the directory itself outside any checkout (fixtures).
function findCheckoutRoot(dir) {
  const start = path.resolve(dir);
  for (let d = start; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, ".git"))) return d;
    if (path.dirname(d) === d) return start;
  }
}

// A cited file is identified by where it really is, relative to the checkout it
// lives in — never by how the citation was spelled. `./x`, `x/./x`, an absolute
// path and a symlink all name one file, and "consumed once" has to see one key.
// Both the file and the checkout root go through the same resolver, and a file
// outside the checkout is refused, so a record cannot live anywhere on disk.
function resolveCitation(cited, { roots, checkoutRoot, require = true }) {
  const candidates = [...new Set(roots.map((r) => path.resolve(r, cited)))];
  const found = candidates.find((p) => { try { return fs.statSync(p).isFile() && fs.statSync(p).size > 0; } catch { return false; } });
  if (!found) {
    if (require) throw new Error(`Evidence file is missing or empty: ${cited}`);
    return toPosix(path.relative(path.resolve(checkoutRoot), candidates[0]));
  }
  const rel = path.relative(fs.realpathSync(checkoutRoot), fs.realpathSync(found));
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Evidence must be a file inside the checkout, not ${cited}`);
  }
  return toPosix(rel);
}

// The round budget is keyed on `branch`, so the name must be a real branch of the
// repository the round is recorded from and the reviewed head a commit on it: a
// renamed string is not a new branch with a fresh budget. refs/heads is shared by
// every worktree of a repository, so this holds wherever the recorder runs.
function assertBranchAndHead(round, cwd) {
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try { git(["rev-parse", "--verify", "--quiet", `refs/heads/${round.branch}`]); }
  catch {
    // A branch that exists only on a remote is real but has no local ref to verify against.
    let remote = "";
    try { remote = git(["for-each-ref", "--format=%(refname:short)", `refs/remotes/*/${round.branch}`]).trim().split("\n")[0]; } catch { /* no remotes */ }
    if (remote) throw new Error(`branch ${round.branch} exists only as ${remote}; create the local branch first (git switch ${round.branch}), then record the round`);
    throw new Error(`branch ${round.branch} is not a branch of this repository; name the real branch under review`);
  }
  try { git(["merge-base", "--is-ancestor", round.head, `refs/heads/${round.branch}`]); }
  catch { throw new Error(`head ${round.head} is not a commit on branch ${round.branch}`); }
}

// A NEW round's evidence is a saved review report, not any file in the checkout: it lives in a
// workspace's `04-validate/` or in `.harness/reviews/` (directly, no subfolder), is tracked by git
// (`git add` it before recording; committing it with the round record is enough afterwards), and
// names the reviewed commit — the full head SHA or at least its first 12 characters. Single-CLEAR
// gates (a light-mode wave, a todo checkpoint, /fix, planning, analysis, codify) have no
// convergence receipt behind them, so this is where a report that never existed is caught.
// Records already committed are replayed as written (rebuildFromHistory), never re-judged.
const REPORT_PATH_RE = /^(?:workspaces\/[^/]+\/04-validate|\.harness\/reviews)\/[^/]+$/;
function assertReviewReports(round, checkoutRoot) {
  const short = round.head.slice(0, 12).toLowerCase();
  for (const r of round.reviewers) {
    const cited = r.evidence;
    if (!REPORT_PATH_RE.test(cited)) {
      throw new Error(`Evidence for ${r.id} must be a saved review report directly under workspaces/<project>/04-validate/ or .harness/reviews/, not ${cited}`);
    }
    try {
      execFileSync("git", ["-c", "core.quotePath=false", "ls-files", "--error-unmatch", "--", cited],
        { cwd: checkoutRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      throw new Error(`Evidence for ${r.id} (${cited}) is not tracked by git; git add the saved report, then record the round`);
    }
    const text = fs.readFileSync(path.join(checkoutRoot, cited), "utf8").toLowerCase();
    if (!text.includes(short)) {
      throw new Error(`Evidence for ${r.id} (${cited}) does not name the reviewed commit ${round.head.slice(0, 12)}; a report states the commit it reviewed (its full SHA or at least the first 12 characters)`);
    }
  }
}

function canonicalizeRound(round, ctx) {
  const reviewers = round.reviewers.map((r) => ({ ...r, evidence: resolveCitation(r.evidence, ctx) }));
  const replan = round.replan === undefined ? undefined : resolveCitation(round.replan, ctx);
  const escalation_accepts = round.escalation_accepts && { ...round.escalation_accepts, record: resolveCitation(round.escalation_accepts.record, ctx) };
  if (replan !== undefined && escalation_accepts && escalation_accepts.record === replan) {
    throw new Error("escalation_accepts.record must be the human's own acceptance record, not the agent's replan decision record");
  }
  return normalizeRound({ ...round, reviewers, ...(replan !== undefined ? { replan } : {}), ...(escalation_accepts ? { escalation_accepts } : {}) });
}

function stateDirectory(repoDir) {
  const dir = path.join(repoDir, ".claude", "learning");
  const check = assertStateDirContained(dir);
  if (!check.ok) throw new Error(check.reason);
  return dir;
}

function readState(repoDir) {
  if (!fs.existsSync(path.join(repoDir, ".claude", "learning"))) {
    return { version: 2, branches: Object.create(null) };
  }
  const dir = stateDirectory(repoDir);
  const read = readFileHardened(path.join(dir, STATE_FILE));
  if (!read.ok) {
    if (read.code === "ENOENT") return { version: 2, branches: Object.create(null) };
    throw new Error(`Cannot read review state: ${read.reason}`);
  }
  const parsed = JSON.parse(read.value.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || !parsed.branches || typeof parsed.branches !== "object" || Array.isArray(parsed.branches)) {
    throw new Error("Invalid review state; restore it rather than resetting the counter");
  }
  // Historical counts measured messages, not rounds. Preserve them for diagnosis,
  // but do not import them as round evidence. Never rewrite the old state on read.
  if (parsed.version === undefined) return { version: 2, branches: Object.create(null), legacyMessageCounts: parsed.branches };
  if (parsed.version !== 2) throw new Error("Unknown review-state version");
  const branches = Object.assign(Object.create(null), parsed.branches);
  const countOrAbsent = (n) => n === undefined || (Number.isSafeInteger(n) && n >= 0);
  const namesOrAbsent = (a) => a === undefined || (Array.isArray(a) && a.every(nonempty));
  const roundMapOrAbsent = (m) => m === undefined || (m && typeof m === "object" && !Array.isArray(m) &&
    Object.entries(m).every(([k, v]) => nonempty(k) && Number.isSafeInteger(v) && v >= 1));
  // The last round's record seeds the budget for pre-cap state and decides re-runs,
  // so its shape is validated like the fields derived from it.
  const recordOrAbsent = (r) => r === undefined || (r && typeof r === "object" && !Array.isArray(r) &&
    Array.isArray(r.expected_reviewers) && r.expected_reviewers.every(nonempty) &&
    Array.isArray(r.reviewers) && r.reviewers.every((x) => x && nonempty(x.id) && ["CLEAR", "NOT_CLEAR", "ERROR"].includes(x.verdict)) &&
    (r.replan === undefined || nonempty(r.replan)) && (r.debug === undefined || r.debug === true));
  for (const s of Object.values(branches)) {
    if (!s || ![s.lastRound, s.consecutiveNotClear, s.roundsSinceReplan, s.cleanRounds].every(
      (n) => Number.isSafeInteger(n) && n >= 0) || typeof s.replanRequired !== "boolean" ||
      !Array.isArray(s.rootCauses) || !nonempty(s.fingerprint)) throw new Error("Invalid branch review state");
    if (!recordOrAbsent(s.lastRoundRecord)) throw new Error("Invalid branch review state (last round record)");
    // Cap fields are optional (pre-cap state lacks them) but never malformed: a
    // string where reviewersSeen belongs would make includes() a substring test.
    if (!countOrAbsent(s.roundsRecorded) || !countOrAbsent(s.consecutiveErrors) || !namesOrAbsent(s.reviewersSeen) ||
      !namesOrAbsent(s.acceptancesConsumed) || !roundMapOrAbsent(s.replansConsumed) ||
      !(s.debugRound === undefined || s.debugRound === null || (Number.isSafeInteger(s.debugRound) && s.debugRound >= 1))) {
      throw new Error("Invalid branch review state (round budget fields)");
    }
  }
  return { ...parsed, branches };
}

function writeState(repoDir, state) {
  const dir = stateDirectory(repoDir);
  const tmp = path.join(dir, `${STATE_FILE}.${process.pid}.${randomUUID()}.tmp`);
  const written = writeFileHardened(tmp, JSON.stringify(state, null, 2));
  if (!written.ok) throw new Error(`Cannot write review state: ${written.reason}`);
  try { fs.renameSync(tmp, path.join(dir, STATE_FILE)); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}

// The scope a round record belongs to, from its file name `round-<scope>-<n>.json` (null if not that shape).
function scopeOfRecordPath(p) {
  const m = path.posix.basename(String(p)).match(/^round-(.+)-(\d+)\.json$/);
  return m ? m[1] : null;
}

// The state file is gitignored and local to one checkout. When it holds nothing for this
// branch (deleted, a fresh clone, another machine), the count is rebuilt by replaying, in
// round order, the committed round records that belong to this review: a record whose file
// names the SAME SCOPE, or whose `branch` is THIS BRANCH. So a branch renamed with its history
// keeps its count, while a todo branch cut from a wave branch does not inherit the wave's
// rounds; a new branch cut from `main` sees only rounds already merged there. `history` is a list
// of {path, commit, text}: every record ever added in the branch's history or on the local
// `main`, in the same folder as the round, as first committed (the CLI collects it), so deleting
// or editing a record later changes nothing.
//
// What this does NOT do: the budget is an aid against endless review loops, not a security
// control. Rewriting local history (a reset, a new branch from `main` under a new scope name)
// can still start a fresh count; rewriting history already needs the user
// (`.harness/rules/autonomous-execution.md` § What needs the user).
//
// Refused with nothing recorded: a record of this scope that does not parse or is not a
// complete round, two different records for one round number, counted records that do not
// start at round 1, and a new round that is not the next one after them.
function rebuildFromHistory(round, history, ctx, legacySeed, scope) {
  const fail = (why) => new Error(`Cannot rebuild the review count for ${round.branch} from its committed round records: ${why}. ` +
    `Restore .claude/learning/${STATE_FILE} if it was lost, or repair the records`);
  const byRound = new Map();
  for (const entry of history || []) {
    const entryScope = scopeOfRecordPath(entry.path);
    let parsed = null;
    try { parsed = JSON.parse(entry.text); } catch { /* judged below */ }
    const ours = (scope && entryScope === scope) || (parsed && typeof parsed === "object" && parsed.branch === round.branch);
    if (!ours) continue;
    let record;
    try { record = canonicalizeRound(normalizeRound(parsed), { ...ctx, require: false }); }
    catch (error) { throw fail(`${entry.path} as added in ${String(entry.commit).slice(0, 12)} is not a complete round record (${error.message})`); }
    const fingerprint = JSON.stringify(record);
    const seen = byRound.get(record.round);
    if (seen && seen.fingerprint !== fingerprint) throw fail(`two different committed records claim round ${record.round} (${seen.path}, ${entry.path})`);
    if (!seen) byRound.set(record.round, { record, fingerprint, path: entry.path });
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  if (rounds.length && rounds[0] !== 1) throw fail(`the earliest committed record is round ${rounds[0]}, not round 1`);
  let state;
  for (const n of rounds) {
    try { state = advanceRound(state, byRound.get(n).record, { legacySeed }).nextState; }
    catch (error) { throw fail(`round ${n}: ${error.message}`); }
  }
  const last = state ? state.lastRound : 0;
  if (round.round !== last + 1 && !(state && round.round === last && byRound.get(last).fingerprint === JSON.stringify(round))) {
    throw new Error(`round ${round.round} refused: there is no review state for ${round.branch} in this checkout, and the committed records of ` +
      `this scope or branch ${last ? `already hold rounds 1-${last} (deleted or edited records included), so the next round is ${last + 1}` : `hold no rounds, so the first round is 1`}. ` +
      `Restore .claude/learning/${STATE_FILE} if it was lost`);
  }
  return { state, replayed: rounds.length };
}

// Every entry point verifies the branch and head against git and resolves the cited
// files here, before any state is touched: a citation must name a non-empty file
// inside the checkout the round was recorded from (relative to the round file's
// directory or the working directory), and is stored under its real location.
// `options.history` (a function returning the branch's committed round records) lets a
// checkout with no state rebuild it; without it, only round 1 can start a branch.
function recordRound(repoDir, input, options = {}) {
  const roots = [options.roundDir, options.cwd].filter(Boolean);
  const ctx = { roots: roots.length ? roots : [repoDir], checkoutRoot: findCheckoutRoot(roots[0] || repoDir) };
  const normalized = normalizeRound(input);
  assertBranchAndHead(normalized, options.cwd || options.roundDir || repoDir);
  const round = canonicalizeRound(normalized, ctx);
  assertReviewReports(round, ctx.checkoutRoot);
  // The CLI/lead is the normal writer. The lock also prevents lost updates if two
  // leads overlap. Busy and stale locks are LOUD, never resets. Containment is checked
  // BEFORE the directory is created, so a symlinked `.claude` never gets a directory
  // made outside the repository first.
  stateDirectory(repoDir);
  fs.mkdirSync(path.join(repoDir, ".claude", "learning"), { recursive: true });
  const dir = stateDirectory(repoDir);
  const lock = path.join(dir, "redteam-round.lock");
  const claimed = writeFileHardened(lock, JSON.stringify({ pid: process.pid, branch: round.branch }));
  if (!claimed.ok) throw new Error("Review recorder is locked; retry after its writer exits. For a stale lock, verify its PID is dead before removing only redteam-round.lock.");
  try {
    const state = readState(repoDir);
    let previous = state.branches[round.branch];
    let rebuilt = null;
    if (!previous) {
      const history = typeof options.history === "function" ? options.history(round.branch) : [];
      const result = rebuildFromHistory(round, history, ctx, options.legacySeed, options.scope);
      previous = result.state;
      if (result.replayed) rebuilt = result.replayed;
    }
    const outcome = advanceRound(previous, round, options);
    if (!outcome.duplicate) {
      state.branches[round.branch] = outcome.nextState;
      writeState(repoDir, state);
    }
    if (rebuilt) outcome.next = `Review state for ${round.branch} was missing here; rebuilt from ${rebuilt} committed round record(s).\n${outcome.next}`;
    return outcome;
  } finally { fs.unlinkSync(lock); }
}

module.exports = { FIRING_THRESHOLD, TOTAL_ROUND_CAP, ERROR_RERUN_LIMIT, normalizeRound, advanceRound, readState, writeState,
  recordRound, findCheckoutRoot, resolveCitation, scopeOfRecordPath };
