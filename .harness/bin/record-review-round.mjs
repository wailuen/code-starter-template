#!/usr/bin/env node
import { readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { dirname, join, resolve, basename, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { normalizeRound, recordRound, findCheckoutRoot, resolveCitation, scopeOfRecordPath } from "../lib/redteam-stall.cjs";
import { requireMainCheckout } from "../../.claude/hooks/lib/state-resolver.js";

// 2 = reassess before another round (REPLAN, or the cap's single debug round);
// 3 = stop, a named human must accept each further round.
const EXIT_CODES = { REPLAN: 2, DEBUG_ROUND: 2, ESCALATE_TO_HUMAN: 3 };
const nonempty = (s) => typeof s === "string" && s.trim().length > 0;

// State recorded before the round budget existed kept only the last round's lenses
// and decision record. The branch's earlier round files beside this one still say
// what was cited; recover it — under the same real-location keys the recorder
// stores — so a spent record cannot be re-cited on a debug round just because the
// state predates the cap. The recorder uses this only for a branch whose state
// lacks the budget fields.
function legacySeedFrom(file, round, cwd) {
  const dir = dirname(file);
  const ctx = { roots: [dir, cwd], checkoutRoot: findCheckoutRoot(dir), require: false };
  const replansConsumed = Object.create(null);
  const reviewersSeen = new Set();
  for (const name of readdirSync(dir)) {
    const candidate = join(dir, name);
    if (!/^round-.*\.json$/.test(name) || candidate === file) continue;
    let prior;
    // Only a regular file is read: a FIFO or device under this name would block the recorder.
    try { if (!lstatSync(candidate).isFile()) continue; prior = JSON.parse(readFileSync(candidate, "utf8")); } catch { continue; }
    if (!prior || typeof prior !== "object" || prior.branch !== round.branch ||
        !Number.isSafeInteger(prior.round) || prior.round < 1 || prior.round >= round.round) continue;
    if (nonempty(prior.replan)) {
      let key;
      try { key = resolveCitation(prior.replan, ctx); } catch { key = null; }
      if (key && !(Object.hasOwn(replansConsumed, key) && replansConsumed[key] <= prior.round)) replansConsumed[key] = prior.round;
    }
    if (Array.isArray(prior.expected_reviewers)) for (const id of prior.expected_reviewers) if (nonempty(id)) reviewersSeen.add(id);
  }
  return { replansConsumed, reviewersSeen: [...reviewersSeen].sort() };
}

// Every round record ever ADDED in the branch's history (all commits reachable from it), as
// first committed, oldest first. The recorder keeps only those of this scope or this branch
// (redteam-stall.cjs rebuildFromHistory). Paths are read with core.quotePath off, so a
// non-ASCII workspace name is matched as written.
const ROUND_RECORD_RE = /(?:^|\/)(?:04-validate|\.harness\/reviews)\/round-[^/]+\.json$/;
function committedRoundRecords(cwd, roundFile) {
  // Only records in the same folder as the round being recorded count: two projects in one
  // repository (workspaces/alpha, workspaces/beta) may use the same scope names.
  const top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  const sameDir = relative(realpathSync(top), realpathSync(dirname(roundFile))).split(sep).join("/");
  return (branch) => {
    const git = (args) => execFileSync("git", ["-c", "core.quotePath=false", ...args],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
    // The branch's own history plus the local `main`: a scope's round records can sit on a
    // record-only branch that already merged (a codify `-ask` review's records live on
    // `docs/codify-<slug>-ask-review`, never on the `-ask` branch). Records of other scopes and
    // branches on `main` are filtered out by rebuildFromHistory, so a todo branch still does not
    // inherit a wave's rounds.
    const refs = [`refs/heads/${branch}`];
    if (branch !== "main") {
      try { git(["rev-parse", "--verify", "--quiet", "refs/heads/main"]); refs.push("refs/heads/main"); } catch { /* no local main */ }
    }
    const log = git(["log", "--reverse", "--no-renames", "--diff-filter=A", "--format=%x00%H", "--name-only", ...refs]);
    const records = [];
    for (const chunk of log.split("\0").filter(Boolean)) {
      const [commit, ...paths] = chunk.split("\n").filter((l) => l.length);
      for (const path of paths) {
        if (ROUND_RECORD_RE.test(path) && path.slice(0, path.lastIndexOf("/")) === sameDir) records.push({ path, commit, text: git(["show", `${commit}:${path}`]) });
      }
    }
    return records;
  };
}

try {
  if (process.argv.length !== 3) throw new Error("Usage: record-review-round.mjs <round.json>");
  const file = resolve(process.argv[2]);
  const round = normalizeRound(JSON.parse(readFileSync(file, "utf8")));
  const target = requireMainCheckout(process.cwd());
  if (!target.ok) throw new Error(`Cannot resolve shared review state: ${target.reason}`);
  const cwd = process.cwd();
  // Light mode drops the convergence receipt, which is where the security seat was enforced, so
  // the recorder enforces it here: a light-mode wave round (scope wNN) always includes a security
  // lens (`security` or `security-debug`).
  const scope = scopeOfRecordPath(basename(file));
  if (scope && /^w\d+$/i.test(scope)) {
    let profile = "";
    try { profile = readFileSync(join(target.repoDir, ".harness/guides/project-profile.md"), "utf8"); } catch { /* no profile: standard */ }
    const light = /\|\s*`delivery_mode`\s*\|\s*`?light`?\s*\|/i.test(profile);
    if (light && !round.expected_reviewers.some((id) => /^security(?:-debug)?$/.test(id)))
      throw new Error(`round ${round.round} of light-mode wave ${scope} refused: a light-mode wave round always includes a security reviewer (expected_reviewers needs "security", or "security-debug" in a debug round)`);
  }
  const outcome = recordRound(target.repoDir, round, { roundDir: dirname(file), cwd, legacySeed: legacySeedFrom(file, round, cwd),
    history: committedRoundRecords(cwd, file), scope: scopeOfRecordPath(basename(file)) });
  console.log(JSON.stringify({ branch: round.branch, round: round.round, ...outcome }));
  if (outcome.next) console.log(outcome.next);
  process.exitCode = EXIT_CODES[outcome.action] ?? 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = EXIT_CODES[error.code] ?? 1;
}
