#!/usr/bin/env node
/**
 * check-redteam-convergence-receipt.mjs — is this scope (a wave) actually CONVERGED, or merely
 * claimed to be? Invoked at `.harness/phases/redteam.md` § 4 (commit the receipt, then this refuses
 * or accepts it), `.harness/phases/implement.md` § 4 (the next wave does not start until exit 0),
 * `.claude/commands/ws.md` (`--todo` decides implemented-vs-CLOSED), and CI (`--sweep workspaces`: every
 * completed todo must be CLOSED unless grandfathered). CI runs `--sweep` on `main` ONLY (pushes to
 * `main` and pull requests INTO `main`): a todo or wave branch legitimately carries completed todos
 * that are not converged yet, so `--sweep` there is red by design.
 *
 * A REFUSED RECEIPT, before the wave merges: fix the paperwork and commit the corrected receipt
 * (and any missing artifact) for the SAME scope in a later commit on the wave branch; the check
 * judges the receipt as at its last commit there. Once merged into the integration branch a
 * receipt is immutable. A new scope (e.g. `wNNb`) is needed only when the acceptance list changed:
 * then run FRESH review rounds under it. Never copy round records or ledger rows between scopes:
 * a copied record is `round-records-invalid`.
 *
 * ONE EVIDENCE MODEL FOR EVERY ARTIFACT. Each artifact the receipt names — the receipt itself,
 * its launches ledger, its journal entry, the acceptance list, the covered todos — must be
 * git-TRACKED and COMMITTED, and is read from the commit that PINS it, never from the working
 * tree, whenever the question is "was this closed properly": todos and the acceptance list at
 * `verdict_head`; the receipt, its ledger rows, its round records and its journal at the
 * RECEIPT'S PIN — its last commit on the wave branch before the merge, or, once merged, the
 * content that landed on the integration branch (after which it is immutable). Consequences:
 * `/redteam` § 4 COMMITS the receipt and then runs this check; a staged-but-uncommitted
 * artifact is a named finding, never a silent skip; and routine later housekeeping (renumbering
 * a journal, editing a todo) cannot flip an already-closed task, because nothing is re-read
 * from the moving tree.
 *
 * TWO QUESTIONS, TWO MODES. `--scope` asks "is this convergence true RIGHT NOW" — every check
 * runs, including the CURRENCY arms: branch tip moved past the verdict, working tree dirty, the
 * checked-out-branch naming check, and "does each pinned artifact still match its pinned bytes
 * in the working tree". `--todo` and `--sweep` ask "was this todo ever PROPERLY closed" — they
 * judge each receipt AS OF its own commits (`historical`), skipping exactly those currency arms.
 * ANCHORING is never skipped: in every mode the verdict commit must be on the integration branch
 * or reachable from the invoking checkout's HEAD.
 *
 * THE WAVE WINDOW is recorded ONCE, in the receipt, as `wave_base` — the integration-branch
 * commit the wave started from — and never recomputed from a moving reference afterwards:
 *   - pre-merge (the verdict is not yet on the integration branch) it MUST equal
 *     `git merge-base <integration> <verdict_head>`, which is deterministic at that moment;
 *   - always: it must be a real commit, a strict ancestor of `verdict_head`, on the integration
 *     branch, and older than every covered todo's completion and the wave's own ledger;
 *   - the receipt must be committed while its verdict is still current — only bookkeeping paths
 *     may change between `verdict_head` and the receipt's commit. A receipt authored after
 *     other work landed on top of the verdict is refused (`receipt-postdates-surface-change`),
 *     which is also what stops a post-merge author choosing a shrunken window.
 * Because the window is a recorded, pinned fact rather than "the previous certified receipt",
 * two PARALLEL waves that forked from the same commit each keep their own window after both
 * merge — neither inherits the other's commits into its security derivation, and neither can
 * red the other. The security derivation, the ledger window and every "did this predate the
 * work" check all read the same `wave_base`.
 *
 * THE RECEIPT — `workspaces/<project>/04-validate/convergence-<scope>.json` plus its sibling
 * `convergence-<scope>.launches.jsonl` (the spawn-time dispatch-ledger rows for every counted
 * reviewer, copied verbatim from `.claude/learning/dispatch-reconcile/*.jsonl` and COMMITTED
 * WHEN THE REVIEWERS ARE DISPATCHED — `.harness/phases/redteam.md` § 1) — is the machine-checkable
 * twin of the DECISION journal entry a converged wave should record. `--template <scope>`
 * prints a skeleton. Field for field it encodes what this repo already says "converged" means
 * (cited, never restated — `specs-authority.md` Rule 9):
 *   - the receipt's `scope` equals its own filename; the two rounds with the HIGHEST `n` are
 *     both clean, consecutive, on the SAME `verdict_head`; every reviewer in a round names its
 *     `agent` and cites a DIFFERENT dispatch, and the two counted rounds cite DISJOINT dispatches
 *       → `.harness/phases/redteam.md` § 4; `.harness/rules/completion-criterion.md` MUST-3
 *   - each counted reviewer: `ran`, `evidence`, and a `launch_id` resolving to a `kind:"launch"`
 *     row in the ledger AS COMMITTED WITH THE RECEIPT, whose `subagent_type` matches and whose
 *     `ts` precedes `verdict_at`; a `security` (or debug-round `security-debug`) lens must resolve to a
 *     security-reviewer row (its agent name contains "security")
 *       → `.harness/rules/agent-delegation.md` § Quality gates; `.harness/rules/completion-criterion.md` MUST-3
 *   - each counted reviewer's `evidence` is the repository-root-relative path of the saved report
 *     (`workspaces/<p>/04-validate/<scope>-<lens>-r<n>.md`), a NON-EMPTY file tracked AT THE
 *     RECEIPT'S PIN — never free text
 *   - every round the receipt lists has its recorder input `04-validate/round-<scope>-<n>.json`
 *     committed at the receipt's commit, with the same `round`, `head`, reviewer lenses
 *     (`expected_reviewers` = the receipt's `lens` values), the same `evidence` per lens, and a
 *     verdict that agrees (receipt `clean` ⇔ every recorded verdict CLEAR); and no committed
 *     `round-<scope>-<m>.json` exists with an `m` above the receipt's last round — the receipt
 *     cannot stop counting before a later, unconverged round; the round records of this scope or
 *     branch start at round 1 with no gaps, and replaying them through the recorder decides
 *     whether the cap was hit (`cap-hit-understated` when the receipt says it was not)
 *       → `.harness/guides/task-delivery.md` § Review protocol and circuit breaker
 *   - `security_critical` explicit, and never LOWER than what `wave_base..verdict_head` implies.
 *     The surface is INCLUSION BY DEFAULT: EVERY changed path is surface except
 *       (a) bookkeeping: `.md` / `.json` / `.jsonl` (and `.gitkeep` / `.keep`) files under
 *           `workspaces/<p>/{04-validate,journal,todos}/`, the repository-root `.session-notes`,
 *           and `.md` / `.json` / `.jsonl` files under the root `.session-notes.d/` and
 *           `.wave-tracker.d/` — exact letter case; any other file type there is surface,
 *       (b) `.claude/learning/` (gitignored runtime state),
 *       (c) the root `README` / `LICENSE` / `LICENCE` / `CHANGELOG` / `COPYING` / `NOTICE` files,
 *           with no extension or `.md` / `.markdown` / `.txt` / `.rst` / `.adoc` (`README.sh` is surface), and
 *       (d) plain documentation and raster images by extension — `*.md`, `*.markdown`, `*.rst`,
 *           `*.adoc`, `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.webp`, `*.ico` — OUTSIDE `.claude/`,
 *           `.harness/`, `.github/`, `.agents/`, `.codex/` and `deploy/` (instructions an agent or
 *           a deploy follows are not plain documentation). `*.txt` and `*.svg` are surface.
 *     The tests that put a path ON the surface ignore letter case (`.Claude/rules/x.md`,
 *     `CLAUDE.MD`, `Agents.md`), because case-insensitive filesystems load them as the real thing.
 *     `AGENTS.md` / `CLAUDE.md` are surface wherever they sit. So a migration, a middleware file,
 *     `.gitignore`, `.env.example`, `infra/*.tf` or a new top-level directory is surface without
 *     anyone listing it: a new directory is security surface by default, not by omission
 *       → `.harness/rules/agent-delegation.md` § Quality gates
 *   - `cap_hit` explicit and false → `completion-criterion.md` MUST-4
 *   - `acceptance_list.path` a tracked regular file inside the workspace, first committed in a
 *     STRICT ancestor of `verdict_head`, unchanged at `verdict_head`, RELEVANT (it names the
 *     scope, or every covered todo's id), ratified by a party that is not the agent → MUST-1
 *   - each residual INCREMENTAL, accepted by a named human with the four defer conditions and a
 *     calendar backstop → MUST-6 + `product-completion-first.md` MUST-2
 *   - every covered todo by exact PATH, present at `verdict_head`, completed inside the window,
 *     its browser walk declared THERE with disposition `proceed`; a covering receipt covers a
 *     todo file only while that file's content is the blob it certified
 *       → `.harness/phases/implement.md` § 3a via `check-browser-walk-receipts.mjs`
 *   - `journal` a tracked, committed regular file under the workspace's `journal/`, committed no
 *     later than the receipt, whose content AT THE RECEIPT'S COMMIT names the scope
 *       → the workspace's DECISION journal entry for this scope
 *   - `launches` EXACTLY `04-validate/convergence-<scope>.launches.jsonl`, tracked, committed
 *     inside the window (first commit a strict descendant of `wave_base`), last changed in a
 *     strict ancestor of the receipt's commit; rows read from the receipt's commit. That
 *     is exactly what is proven: THIS wave's rows existed, as read, inside its window and before
 *     the receipt. It does NOT prove when reviewers actually ran — `verdict_at` vs row `ts` is the
 *     only timing check, and both are self-reported
 *   - the workspace's `04-validate/`, `journal/` and `todos/completed/` are real directories,
 *     never symlinks; a positional receipt path must live under this workspace's `04-validate/`
 *
 * RESIDUALS, stated rather than hidden:
 *   - CI is a DETECTOR, not a gate, unless the repository enables branch protection with this
 *     check required — without it nothing stops a merge over a red result. Repository setting —
 *     the user's to change; not codeable around.
 *   - A live session can still simply never run this. CI's `--sweep` catches an unbacked "done"
 *     at PR time; nothing here can force the party it constrains to invoke it mid-session.
 *   - GRANDFATHERING is pinned to a COMMIT (`grandfather_pin` in `.harness/manifest.json`, path + blob;
 *     null = nothing grandfathered), honoured by both
 *     `--sweep` and `--todo`. Editing a grandfathered todo re-opens it, with ONE allowance: a
 *     pre-gate todo may gain an appended `## Verification` section that declares the browser walk
 *     not applicable (an honest note) — never a walk receipt, and nothing else may change. The sweep cannot fail here until a todo is completed or
 *     edited AFTER the pin — a green run today is not evidence the sweep discriminates on this
 *     repo's history. A supplied `--grandfather-pin` may only NARROW; unverifiable ⇒ refused
 *     (fixtures opt in with `RCR_FIXTURE_REPO=1`, nothing else should).
 *   - The receipt and its ledger are written by the same session that dispatched the reviewers.
 *     Forging now takes two artifacts that agree, committed in order inside the window — not
 *     zero, not airtight. The live-ledger cross-check is ADVISORY and absent under CI (the live
 *     ledger is gitignored).
 *   - Identity denylist for `ratified_by` / `accepted_by` (`.harness/lib/agent-identity.cjs`,
 *     shared with the round recorder and the task-contract check: generic agent/model words, the
 *     `harness-` namespace, and every agent and role name in `.harness/manifest.json` and
 *     `.claude/agents/`) errs both ways — an invented human passes, "Ai Weiwei" or a human named
 *     Claude is refused. DEFERRED WORK, not a limitation of principle: a roster-backed check
 *     (not built into the harness) closes both. acceptor: PENDING —
 *     user decision (not self-accepted).
 *   - The round records and reports are written by the same session too; matching them closes an
 *     honest transcription slip (a NOT_CLEAR round copied as clean, a report that was never
 *     saved), not deliberate forging of every artifact at once.
 *   - Assessment cost: one assessment per receipt, no chaining; the CI job's per-suite cap and
 *     job timeout should carry stated, measured margins in the project's CI workflow.
 *
 * Exit: 0 converged/CLOSED · 1 findings · 2 usage · 3 UNRUN (workspace not resolvable).
 */

import {
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import { join, resolve, relative, isAbsolute, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assessTodoText } from "./check-browser-walk-receipts.mjs";
import { requireMainCheckout } from "../../.claude/hooks/lib/state-resolver.js";
import { isAgentIdentity as namesAnAgent } from "../lib/agent-identity.cjs";
import { advanceRound, scopeOfRecordPath } from "../lib/redteam-stall.cjs";

export const SCHEMA = "redteam-convergence-receipt/1";
export const GATING_HALF = "BUG+INVEST-NOW";
/**
 * Todos in the TREE at this commit (same content) pre-date the gate. Configured per project as
 * `grandfather_pin` in `.harness/manifest.json`: `null` (the default for a new project, where the
 * harness arrives before any todo) means nothing is grandfathered. A project that adopts the
 * harness mid-life sets it to main's tip at adoption time, in a reviewed commit.
 */
function readGrandfatherPin() {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL("../manifest.json", import.meta.url)), "utf8"),
  );
  const pin = manifest.grandfather_pin ?? null;
  if (pin !== null && !/^[0-9a-f]{40}$/.test(pin))
    throw new Error(".harness/manifest.json grandfather_pin must be null or a full 40-hex commit SHA");
  return pin;
}
export const GRANDFATHER_PIN = readGrandfatherPin();
const SHA_RE = /^[0-9a-f]{40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SCOPE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const TODO_ID_RE = /^([a-z]+[0-9]*-[0-9]+[a-z]?)/i;
const SECURITY_AGENT_RE = /security/i;
// The security lens, including its debug-round name (`<lens>-debug`).
const SECURITY_LENS_RE = /^security(?:-debug)?$/i;
// Anchored to the real bookkeeping LOCATIONS — the workspace's 04-validate/, journal/ and todos/,
// and the repository-root session files — AND to the file types bookkeeping is written in
// (.md, .json, .jsonl, plus .gitkeep/.keep). A same-named file or folder anywhere else
// (`src/.session-notes.d/x.ts`), or code dropped into a bookkeeping folder
// (`workspaces/p/04-validate/evil.ts`), is ordinary code, never bookkeeping. Exact case: a
// differently-cased spelling is NOT treated as bookkeeping.
const BOOKKEEPING_RE =
  /^(?:workspaces\/[^/]+\/(?:04-validate|journal|todos)\/(?:[^/]+\/)*(?:[^/]+\.(?:md|json|jsonl)|\.gitkeep|\.keep)|\.session-notes|\.(?:session-notes|wave-tracker)\.d\/(?:[^/]+\/)*[^/]+\.(?:md|json|jsonl))$/;
// Security surface: INCLUSION BY DEFAULT (see the header). Only these are NOT surface. The
// exclusions go by file type, never by name alone (`README.sh` is surface), and the tests that
// put a path BACK on the surface ignore letter case, because macOS and Windows checkouts do
// (`.Claude/rules/x.md` lands in `.claude/rules/`, `CLAUDE.MD` is `CLAUDE.md`).
const RUNTIME_STATE_RE = /^\.claude\/learning\//;
const ROOT_DOC_RE = /^(?:README|LICEN[CS]E|CHANGELOG|COPYING|NOTICE)(?:\.(?:md|markdown|txt|rst|adoc))?$/i;
const PLAIN_DOC_RE = /\.(?:md|markdown|rst|adoc|png|jpe?g|gif|webp|ico)$/i;
// Instructions an agent or a deploy follows live here; a Markdown file under them is not plain documentation.
const INSTRUCTION_DIR_RE = /^(?:\.claude|\.harness|\.github|\.agents|\.codex|deploy)\//i;
const AGENT_INSTRUCTION_FILE_RE = /(?:^|\/)(?:AGENTS|CLAUDE)\.md$/i;
export function isSecuritySurface(p) {
  if (RUNTIME_STATE_RE.test(p)) return false;
  if (AGENT_INSTRUCTION_FILE_RE.test(p) || INSTRUCTION_DIR_RE.test(p)) return true;
  if (BOOKKEEPING_RE.test(p) || ROOT_DOC_RE.test(p)) return false;
  return !PLAIN_DOC_RE.test(p);
}

// ---- primitives -------------------------------------------------------------------------------

function git(args, cwd) {
  try {
    // core.quotePath off: a non-ASCII workspace name is listed as written, not as "caf\303\251".
    return execFileSync("git", ["-c", "core.quotePath=false", "-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;
const canon = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
};
const isAgentIdentity = (v) => !nonEmpty(v) || namesAnAgent(v);
const rel = (root, p) => relative(root, p).split("\\").join("/");
const isAncestor = (a, b, repoRoot) =>
  git(["merge-base", "--is-ancestor", a, b], repoRoot) !== null;
const isStrictAncestor = (a, b, repoRoot) =>
  a !== b && isAncestor(a, b, repoRoot);
const isCommit = (sha, repoRoot) =>
  SHA_RE.test(sha) &&
  git(["cat-file", "-e", `${sha}^{commit}`], repoRoot) !== null;
const isTracked = (repoRoot, absPath) =>
  git(
    ["ls-files", "--error-unmatch", "--", rel(repoRoot, absPath)],
    repoRoot,
  ) !== null;
const blobAt = (repoRoot, sha, relPath) =>
  git(["rev-parse", "--verify", "--quiet", `${sha}:${relPath}`], repoRoot);
const showAt = (repoRoot, sha, relPath) =>
  git(["show", `${sha}:${relPath}`], repoRoot);
const blobNow = (repoRoot, absPath) =>
  git(["hash-object", "--", absPath], repoRoot);
const isRegularFile = (p) => {
  try {
    return lstatSync(p).isFile();
  } catch {
    return false;
  }
};
const isRealDir = (p) => {
  try {
    return lstatSync(p).isDirectory();
  } catch {
    return false;
  }
};
function firstAddCommit(repoRoot, relPath) {
  const out = git(
    ["log", "--no-renames", "--diff-filter=A", "--format=%H", "--", relPath],
    repoRoot,
  );
  if (!out) return null;
  const lines = out.split("\n").filter(Boolean);
  return lines[lines.length - 1] || null;
}
function lastChangeCommit(repoRoot, relPath) {
  return git(["log", "-1", "--format=%H", "--", relPath], repoRoot) || null;
}
/** Non-bookkeeping paths that differ between two commits (null when git could not diff). */
function surfaceMoved(repoRoot, a, b) {
  const out = git(["diff", "--name-only", a, b], repoRoot);
  if (out === null) return null;
  return out.split("\n").filter((p) => p && !BOOKKEEPING_RE.test(p));
}

/** A receipt-supplied relative path CONTAINED under `<workspaceDir>/<subdir>/` (both sides resolved). */
function contained(workspaceDir, subdir, p) {
  if (!nonEmpty(p) || isAbsolute(p)) return null;
  const norm = p.split("\\").join("/");
  if (norm.split("/").some((seg) => seg === "..")) return null;
  if (!norm.startsWith(`${subdir}/`)) return null;
  const base = canon(join(workspaceDir, subdir));
  const abs = join(workspaceDir, norm);
  if (!existsSync(abs)) return abs;
  const real = canon(abs);
  return real === base || real.startsWith(`${base}/`) ? real : null;
}

/** origin/HEAD → origin/main → local main. Never from a receipt. */
function resolveIntegration(repoRoot) {
  const head = git(
    ["symbolic-ref", "-q", "refs/remotes/origin/HEAD"],
    repoRoot,
  );
  if (head) {
    const sha = git(
      ["rev-parse", "--verify", "--quiet", `${head}^{commit}`],
      repoRoot,
    );
    if (sha) return { name: head.split("/").pop(), ref: head, sha };
  }
  for (const ref of ["refs/remotes/origin/main", "refs/heads/main"]) {
    const sha = git(
      ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
      repoRoot,
    );
    if (sha) return { name: "main", ref, sha };
  }
  return null;
}

function porcelainPaths(repoRoot) {
  let out;
  try {
    // NOT via git(): its trim() would eat the leading status column of " M path".
    out = execFileSync(
      "git",
      ["-c", "core.quotePath=false", "-C", repoRoot, "status", "--porcelain", "--untracked-files=all"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
  } catch {
    return null;
  }
  return out
    .split("\n")
    .filter((l) => l.length > 3)
    .map((l) => l.slice(3).trim())
    .map((p) => (p.includes(" -> ") ? p.split(" -> ").pop() : p))
    .map((p) => p.replace(/^"(.*)"$/, "$1"));
}

function parseLaunchRows(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (j && j.kind === "launch" && nonEmpty(j.launch_id)) rows.push(j);
    } catch {
      /* a malformed line is simply not a row */
    }
  }
  return rows;
}

/** null when the live ledger is absent OR carries no launch rows at all. */
export function liveLaunchIndex(repoRoot) {
  const target = requireMainCheckout(repoRoot);
  if (!target.ok) throw new Error(`Cannot resolve shared launch evidence: ${target.reason}`);
  const dir = join(target.repoDir, ".claude", "learning", "dispatch-reconcile");
  if (!existsSync(dir)) return null;
  const idx = new Map();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    try {
      for (const r of parseLaunchRows(readFileSync(join(dir, f), "utf8")))
        idx.set(r.launch_id, r);
    } catch {
      /* unreadable file: not indexed */
    }
  }
  return idx.size === 0 ? null : idx;
}

/** Every `convergence-*.json` in the workspace, parsed or not (a malformed one is reported, never dropped). */
export function listReceipts(workspaceDir) {
  const dir = join(workspaceDir, "04-validate");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^convergence-[A-Za-z0-9._-]+\.json$/.test(f))
    .sort()
    .map((f) => {
      const p = canon(join(dir, f));
      try {
        const parsed = JSON.parse(readFileSync(p, "utf8"));
        const ok = parsed && typeof parsed === "object";
        return {
          path: p,
          parsed: ok ? parsed : null,
          error: ok ? null : "not an object",
        };
      } catch (e) {
        return { path: p, parsed: null, error: e.message };
      }
    });
}

function todoRel(p) {
  if (!nonEmpty(p)) return null;
  const norm = p.trim().split("\\").join("/");
  if (isAbsolute(norm) || norm.split("/").some((s) => s === "..")) return null;
  if (!/^todos\/completed\/[^/]+\.md$/.test(norm)) return null;
  return norm;
}
export function todoIdOf(filename) {
  const m = basename(filename).match(TODO_ID_RE);
  return m ? m[1].toLowerCase() : null;
}

// ---- the checks ---------------------------------------------------------------------------------

/** The scope as a whole token: "w01" is named by "wave w01." but not by "w010" or "w01-02". */
export function namesScope(text, scope) {
  const escaped = scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9._-])${escaped}(?![A-Za-z0-9_-]|\\.[A-Za-z0-9])`).test(text);
}

function checkShape(c) {
  const { r, add, receiptPath } = c;
  if (!c.scope) add("incomplete:scope", "scope is missing or empty");
  else if (!SCOPE_RE.test(c.scope) || c.scope.includes(".."))
    add(
      "scope-invalid",
      `scope must match ${SCOPE_RE} and contain no "..": ${JSON.stringify(c.scope)}`,
    );
  else if (basename(receiptPath) !== `convergence-${c.scope}.json`)
    add(
      "scope-filename-mismatch",
      `scope ${JSON.stringify(c.scope)} does not match the receipt's filename ${basename(receiptPath)}`,
    );
  for (const f of [
    "branch",
    "wave_base",
    "verdict_head",
    "verdict_at",
    "journal",
    "launches",
  ])
    if (!nonEmpty(r[f])) add(`incomplete:${f}`, `${f} is missing or empty`);
  if (nonEmpty(r.verdict_at) && Number.isNaN(Date.parse(r.verdict_at)))
    add(
      "incomplete:verdict_at",
      `verdict_at is not an ISO timestamp: ${r.verdict_at}`,
    );
  if (
    !Array.isArray(r.todos) ||
    r.todos.length === 0 ||
    !r.todos.every(nonEmpty)
  )
    add(
      "incomplete:todos",
      "todos must be a non-empty array of workspace-relative todo paths (todos/completed/<file>.md)",
    );
  if (r.gating_half !== GATING_HALF)
    add(
      "incomplete:gating_half",
      `gating_half must be "${GATING_HALF}", got ${JSON.stringify(r.gating_half)}`,
    );
  if (!Array.isArray(r.rounds) || r.rounds.length === 0)
    add("incomplete:rounds", "rounds must be a non-empty array");
  else if (
    !r.rounds.every((x) => x && typeof x === "object" && Number.isInteger(x.n))
  )
    add("incomplete:rounds", "every round must be an object with an integer n");
  if (typeof r.cap_hit !== "boolean")
    add("incomplete:cap_hit", "cap_hit must be explicitly true or false");
  else if (r.cap_hit)
    add(
      "cap-stop-as-convergence",
      "cap_hit is true — a round-cap stop is abnormal termination, never convergence",
    );
  if (typeof r.security_critical !== "boolean")
    add(
      "incomplete:security_critical",
      "security_critical must be explicitly true or false",
    );
  if (!r.acceptance_list || typeof r.acceptance_list !== "object")
    add(
      "incomplete:acceptance_list",
      "acceptance_list {path, ratified_by} is required",
    );
  else if (isAgentIdentity(r.acceptance_list.ratified_by))
    add(
      "acceptance-self-authored",
      `acceptance_list.ratified_by must name a party that is not the agent, got ${JSON.stringify(r.acceptance_list.ratified_by)}`,
    );
  for (const d of ["04-validate", "journal", "todos/completed"])
    if (
      existsSync(join(c.workspaceDir, d)) &&
      !isRealDir(join(c.workspaceDir, d))
    )
      add(
        "workspace-dir-symlinked",
        `${d} must be a real directory, not a symlink — a symlinked boundary root moves the boundary`,
      );
}

function checkHead(c) {
  const { r, add, repoRoot } = c;
  if (!nonEmpty(r.verdict_head)) return;
  const sha = r.verdict_head.trim();
  if (!SHA_RE.test(sha))
    add(
      "head-unknown",
      `verdict_head must be a full 40-hex commit, got ${JSON.stringify(sha)}`,
    );
  else if (!isCommit(sha, repoRoot))
    add("head-unknown", `verdict_head ${sha} is not a commit in ${repoRoot}`);
  else c.vh = sha;
}

function checkCurrency(c) {
  const { r, add, repoRoot, vh, historical } = c;
  const integ = resolveIntegration(repoRoot);
  c.integ = integ;
  if (!integ) {
    add(
      "integration-unknown",
      "neither origin/HEAD, origin/main nor main resolves — the integration branch cannot be determined from this repo",
    );
    return;
  }
  if (nonEmpty(r.integration_ref) && r.integration_ref.trim() !== integ.name)
    add(
      "integration-ref-mismatch",
      `integration_ref ${JSON.stringify(r.integration_ref)} is not this repo's integration branch ${integ.name} — the field documents, it never selects`,
    );
  if (!vh) return;
  const staleAgainst = (tipSha, ref) => {
    const moved = surfaceMoved(repoRoot, vh, tipSha);
    if (moved === null)
      add("head-unverified", `could not diff ${vh.slice(0, 12)}..${ref}`);
    else if (moved.length)
      add(
        "stale-head",
        `${moved.length} non-bookkeeping path(s) changed on ${ref} since the verdict: ${moved.slice(0, 3).join(", ")}`,
      );
  };
  c.onIntegration = isAncestor(vh, integ.sha, repoRoot);
  if (c.onIntegration) {
    if (!historical) staleAgainst(integ.sha, integ.ref);
  } else if (historical) {
    const headSha = git(
      ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"],
      repoRoot,
    );
    if (!headSha || !isAncestor(vh, headSha, repoRoot))
      add(
        "verdict-not-anchored",
        `verdict_head ${vh.slice(0, 12)} is on neither ${integ.name} nor any branch reachable from this checkout — an unmerged or abandoned ref certifies nothing`,
      );
  } else {
    const cur = git(["symbolic-ref", "-q", "--short", "HEAD"], repoRoot);
    if (!cur)
      add(
        "verdict-not-on-integration",
        `verdict_head ${vh.slice(0, 12)} is not on ${integ.name} and this checkout is detached — run from the branch under review, or merge first`,
      );
    else {
      const curTip = git(
        ["rev-parse", "--verify", "--quiet", `refs/heads/${cur}^{commit}`],
        repoRoot,
      );
      if (!curTip || !isAncestor(vh, curTip, repoRoot))
        add(
          "head-not-on-branch",
          `verdict_head ${vh.slice(0, 12)} is on neither ${integ.name} nor the checked-out branch ${cur}`,
        );
      else {
        if (nonEmpty(r.branch) && r.branch.trim() !== cur)
          add(
            "branch-mismatch",
            `branch ${JSON.stringify(r.branch)} is not the checked-out branch ${cur} — the field documents, it never selects`,
          );
        staleAgainst(curTip, `refs/heads/${cur}`);
      }
    }
  }
  if (!historical) {
    const dirty = porcelainPaths(repoRoot);
    if (dirty === null)
      add("dirty-tree-unverified", `could not read git status in ${repoRoot}`);
    else {
      const moved = dirty.filter((p) => !BOOKKEEPING_RE.test(p));
      if (moved.length)
        add(
          "dirty-tree",
          `${moved.length} uncommitted/untracked non-bookkeeping path(s) in ${repoRoot}: ${moved.slice(0, 3).join(", ")}`,
        );
    }
  }
}

/** `wave_base`: recorded once, verified as a real window, never recomputed from a moving ref. */
function checkWindow(c) {
  const { r, add, repoRoot, vh, integ, receiptPin, wsRel } = c;
  c.base = null;
  if (!nonEmpty(r.wave_base) || !vh || !integ) return;
  const wb = r.wave_base.trim();
  if (!isCommit(wb, repoRoot))
    return add(
      "wave-base-unknown",
      `wave_base must be a full 40-hex commit in this repo, got ${JSON.stringify(wb)}`,
    );
  if (!isStrictAncestor(wb, vh, repoRoot))
    return add(
      "wave-base-not-ancestor",
      `wave_base ${wb.slice(0, 12)} is not a strict ancestor of verdict_head ${vh.slice(0, 12)}`,
    );
  if (!isAncestor(wb, integ.sha, repoRoot))
    return add(
      "wave-base-off-integration",
      `wave_base ${wb.slice(0, 12)} is not on the integration branch ${integ.name} — a wave starts from an integration commit`,
    );
  if (!c.onIntegration) {
    // Pre-merge the fork point is deterministic: the recorded base must BE it.
    const computed = git(["merge-base", integ.sha, vh], repoRoot);
    if (computed && computed !== wb)
      return add(
        "wave-base-mismatch",
        `wave_base ${wb.slice(0, 12)} is not git merge-base ${integ.ref} ${vh.slice(0, 12)} (= ${computed.slice(0, 12)}) — the window is recorded once, as the real fork point`,
      );
  }
  if (receiptPin) {
    // The receipt must be committed while its verdict is still current. This is also what stops
    // a post-merge author from choosing a shrunken window: after other work lands, no new receipt
    // for this verdict is accepted at all.
    const moved = surfaceMoved(repoRoot, vh, receiptPin);
    if (moved === null)
      add(
        "head-unverified",
        `could not diff ${vh.slice(0, 12)}..${receiptPin.slice(0, 12)}`,
      );
    else if (moved.length)
      add(
        "receipt-postdates-surface-change",
        `${moved.length} non-bookkeeping path(s) changed between the verdict and the receipt's commit ${receiptPin.slice(0, 12)}: ${moved.slice(0, 3).join(", ")} — a receipt must be committed while its verdict is current`,
      );
  }
  // Every covered todo was completed INSIDE the window: its first commit is not before the base.
  for (const entry of Array.isArray(r.todos) ? r.todos : []) {
    const p = todoRel(entry);
    if (!p) continue;
    const added = firstAddCommit(repoRoot, `${wsRel}/${p}`);
    if (added && !isAncestor(wb, added, repoRoot))
      add(
        "wave-base-after-todo-completion",
        `${p} was first completed in ${added.slice(0, 12)}, which is before wave_base ${wb.slice(0, 12)} — the window must contain the wave's own work`,
      );
  }
  c.base = wb;
}

function deriveSecurity(c) {
  const { r, add, repoRoot, vh, base } = c;
  c.securityCritical = r.security_critical === true;
  if (!vh || !base) return;
  const hits = (git(["diff", "--name-only", base, vh], repoRoot) || "")
    .split("\n")
    .filter((p) => p && isSecuritySurface(p));
  if (hits.length) {
    c.securityCritical = true;
    if (r.security_critical !== true)
      add(
        "security-critical-understated",
        `the wave (${base.slice(0, 12)}..${vh.slice(0, 12)}) touched the security surface (${hits.slice(0, 3).join(", ")}) but security_critical is ${JSON.stringify(r.security_critical)}`,
      );
  }
}

function checkArtifacts(c) {
  const {
    r,
    add,
    repoRoot,
    workspaceDir,
    vh,
    historical,
    base,
    receiptPin,
    scope,
  } = c;
  const todoIds = (Array.isArray(r.todos) ? r.todos : [])
    .map((t) => todoIdOf(t))
    .filter(Boolean);
  const mentionsScope = (text) =>
    (scope && namesScope(text, scope)) ||
    (todoIds.length > 0 &&
      todoIds.every((id) => text.toLowerCase().includes(id)));

  // acceptance list: tracked, committed strictly before the verdict, unchanged at the verdict, relevant
  if (r.acceptance_list && typeof r.acceptance_list === "object") {
    const ap = r.acceptance_list.path;
    if (!nonEmpty(ap))
      add(
        "incomplete:acceptance_list.path",
        "acceptance_list.path is required",
      );
    else {
      const norm = String(ap).split("\\").join("/");
      const abs =
        !isAbsolute(norm) && !norm.split("/").some((s) => s === "..")
          ? join(workspaceDir, norm)
          : null;
      const real = abs && existsSync(abs) ? canon(abs) : null;
      const inside =
        real && (real === workspaceDir || real.startsWith(`${workspaceDir}/`));
      if (!abs || !existsSync(abs))
        add(
          "acceptance-list-missing-file",
          `acceptance_list.path does not resolve inside the workspace: ${ap}`,
        );
      else if (!inside || !isRegularFile(real))
        add(
          "acceptance-list-invalid",
          `acceptance_list.path must be a regular file inside the workspace, got ${ap}`,
        );
      else if (!isTracked(repoRoot, real))
        add("acceptance-list-untracked", `${ap} is not tracked`);
      else if (vh) {
        const relP = rel(repoRoot, real);
        const added = firstAddCommit(repoRoot, relP);
        if (!added)
          add(
            "acceptance-list-uncommitted",
            `${ap} is staged but has never been committed`,
          );
        else if (!isStrictAncestor(added, vh, repoRoot))
          add(
            "acceptance-list-not-before-verdict",
            `${ap} was not committed in a strict ancestor of verdict_head — the acceptance list must predate the reviewed work (completion-criterion.md MUST-1)`,
          );
        else {
          const atAdd = blobAt(repoRoot, added, relP);
          const atVerdict = blobAt(repoRoot, vh, relP);
          if (!atVerdict || atVerdict !== atAdd)
            add(
              "acceptance-list-rewritten",
              `${ap} at verdict_head is not the content first committed in ${added.slice(0, 12)} — the list that predates the work is the one that governs`,
            );
          else {
            if (!historical && blobNow(repoRoot, real) !== atVerdict)
              add(
                "acceptance-list-rewritten",
                `${ap} in the working tree differs from the content certified at verdict_head`,
              );
            const text = showAt(repoRoot, vh, relP) || "";
            if (!mentionsScope(text))
              add(
                "acceptance-list-unrelated",
                `${ap} names neither scope "${scope}" nor every covered todo id (${todoIds.join(", ")}) — an unrelated file is not this wave's acceptance list`,
              );
          }
        }
      }
    }
  }

  // journal twin: tracked, committed no later than the receipt, content read AT the receipt's commit
  if (nonEmpty(r.journal)) {
    const jp = contained(workspaceDir, "journal", r.journal);
    if (!jp)
      add(
        "journal-outside-workspace",
        `journal must be a path under this workspace's journal/, got ${r.journal}`,
      );
    else {
      const relJ = `${rel(repoRoot, workspaceDir)}/${r.journal.trim().split("\\").join("/")}`;
      const jAdd = firstAddCommit(repoRoot, relJ);
      if (!jAdd) {
        if (!existsSync(jp))
          add("journal-missing", `journal entry not found: ${r.journal}`);
        else if (!isTracked(repoRoot, jp))
          add(
            "journal-untracked",
            `${r.journal} is not tracked — an uncommitted scratch file is not a durable receipt`,
          );
        else
          add(
            "journal-uncommitted",
            `${r.journal} is staged but has never been committed`,
          );
      } else if (receiptPin && !isAncestor(jAdd, receiptPin, repoRoot))
        add(
          "journal-postdate-receipt",
          `${r.journal} was first committed in ${jAdd.slice(0, 12)}, after the receipt's commit ${receiptPin.slice(0, 12)} — the journal entry must be committed together with (or before) the receipt. Before the merge: re-commit the receipt in the same commit as the journal entry (any edit to the receipt file, even a trailing newline, makes that commit the receipt's commit), then run --scope again`,
        );
      else {
        const pin = receiptPin || jAdd;
        const text = showAt(repoRoot, pin, relJ);
        if (text === null)
          add(
            "journal-missing",
            `${r.journal} is not in the tree at ${pin.slice(0, 12)}`,
          );
        else if (scope && !namesScope(text, scope))
          add(
            "journal-does-not-cite-scope",
            `${r.journal} @ ${pin.slice(0, 12)} never mentions scope "${scope}"`,
          );
        if (!historical) {
          if (!existsSync(jp) || !isRegularFile(jp))
            add(
              "journal-rewritten",
              `${r.journal} is missing from the working tree`,
            );
          else if (blobNow(repoRoot, jp) !== blobAt(repoRoot, pin, relJ))
            add(
              "journal-rewritten",
              `${r.journal} in the working tree differs from the content committed with the receipt`,
            );
        }
      }
    }
  }

  // launches ledger: THIS wave's, tracked, committed inside the window, before the receipt; rows read at the receipt's commit
  c.launchRows = null;
  if (nonEmpty(r.launches)) {
    const expected = scope
      ? `04-validate/convergence-${scope}.launches.jsonl`
      : null;
    const lp = contained(workspaceDir, "04-validate", r.launches);
    if (expected && r.launches.trim() !== expected)
      add(
        "launches-not-scope-bound",
        `launches must be exactly ${expected} — another wave's or a shared ledger is never evidence for this one, got ${r.launches}`,
      );
    else if (!lp)
      add(
        "launches-outside-workspace",
        `launches must be a path under this workspace's 04-validate/, got ${r.launches}`,
      );
    else {
      const relLp = `${rel(repoRoot, workspaceDir)}/${expected}`;
      const lAdd = firstAddCommit(repoRoot, relLp);
      const lLast = lastChangeCommit(repoRoot, relLp);
      if (!lAdd) {
        if (!existsSync(lp))
          add("launches-missing", `launches file not found: ${r.launches}`);
        else if (!isRegularFile(lp))
          add(
            "launches-outside-workspace",
            `launches must be a regular file, got ${r.launches}`,
          );
        else if (!isTracked(repoRoot, lp))
          add(
            "launches-untracked",
            `${r.launches} is not tracked — commit it when the reviewers are dispatched`,
          );
        else
          add(
            "launches-uncommitted",
            `${r.launches} is staged but has never been committed — the dispatch rows must be committed when the reviewers are dispatched, before any verdict`,
          );
      } else {
        if (base && !isStrictAncestor(base, lAdd, repoRoot))
          add(
            "launches-outside-window",
            `${r.launches} was first committed in ${lAdd.slice(0, 12)}, which is not after wave_base ${base.slice(0, 12)} — rows from before the wave started are not this wave's dispatches`,
          );
        if (receiptPin) {
          if (!isStrictAncestor(lLast, receiptPin, repoRoot))
            add(
              "launches-postdate-receipt",
              `${r.launches} was last changed in ${lLast.slice(0, 12)}, which is not a strict ancestor of the receipt's commit ${receiptPin.slice(0, 12)} — commit the dispatch rows at dispatch time, the receipt at convergence, and never rewrite the rows`,
            );
          const pinned = showAt(repoRoot, receiptPin, relLp);
          c.launchRows = pinned === null ? [] : parseLaunchRows(pinned);
          if (
            !historical &&
            existsSync(lp) &&
            blobNow(repoRoot, lp) !== blobAt(repoRoot, receiptPin, relLp)
          )
            add(
              "launches-rewritten-after-receipt",
              `${r.launches} in the working tree differs from the content committed with the receipt (${receiptPin.slice(0, 12)})`,
            );
        } else {
          c.launchRows = parseLaunchRows(showAt(repoRoot, lLast, relLp));
        }
      }
    }
  }
}

function checkRounds(c) {
  const { r, add, notes, repoRoot, vh, launchRows, securityCritical } = c;
  if (
    !Array.isArray(r.rounds) ||
    r.rounds.length === 0 ||
    !r.rounds.every((x) => x && Number.isInteger(x.n))
  )
    return;
  const sorted = [...r.rounds].sort((a, b) => a.n - b.n);
  const last = sorted[sorted.length - 1];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const isClean = (x) => x && x.clean === true && x.new_gating_findings === 0;
  if (!prev || !isClean(last) || !isClean(prev)) {
    const dirtyIdx = [...sorted].reverse().findIndex((x) => !isClean(x));
    add(
      "not-converged",
      `the two highest-numbered rounds must both be clean on the gating half; trailing clean rounds: ${dirtyIdx === -1 ? sorted.length : dirtyIdx} (need 2)`,
    );
    return;
  }
  if (last.n !== prev.n + 1)
    add(
      "not-converged",
      `the two clean rounds must be consecutive (got n=${prev.n} then n=${last.n})`,
    );
  if (!nonEmpty(last.head) || last.head !== prev.head)
    add(
      "clean-rounds-span-a-mutation",
      `both clean rounds must review the SAME commit (got ${prev.head} then ${last.head}) — a change resets the counter`,
    );
  else if (vh && last.head !== vh)
    add(
      "clean-rounds-span-a-mutation",
      `verdict_head ${vh} is not the commit the clean rounds reviewed (${last.head})`,
    );
  const revsOf = (x) =>
    Array.isArray(x.reviewers)
      ? x.reviewers.filter((v) => v && typeof v === "object")
      : [];
  const idsOf = (x) =>
    revsOf(x)
      .map((v) => v.launch_id)
      .filter(nonEmpty);
  const shared = [...new Set(idsOf(prev))].filter((id) =>
    idsOf(last).includes(id),
  );
  if (shared.length)
    add(
      "rounds-share-dispatch",
      `rounds ${prev.n} and ${last.n} cite the same dispatch(es) ${shared.slice(0, 3).join(", ")} — one dispatch counted twice is one round, not two`,
    );
  const live = liveLaunchIndex(repoRoot);
  if (live === null)
    notes.push(
      "live dispatch ledger (.claude/learning/dispatch-reconcile/) absent or empty in this checkout — the live cross-check is ADVISORY and does not run under CI; launch rows verified against the committed ledger only",
    );
  const verdictMs = Date.parse(r.verdict_at || "");
  for (const round of [prev, last]) {
    const revs = revsOf(round);
    if (revs.length === 0)
      add("reviewer-zero-evidence", `round ${round.n} lists no reviewers`);
    const within = idsOf(round);
    const dup = within.filter((id, i) => within.indexOf(id) !== i);
    if (dup.length)
      add(
        "round-shares-dispatch",
        `round ${round.n} cites dispatch ${[...new Set(dup)].slice(0, 3).join(", ")} more than once — one dispatch is one review, not one per lens`,
      );
    for (const v of revs) {
      const who = `round ${round.n}: ${v.agent || "?"}/${v.lens || "?"}`;
      if (!nonEmpty(v.agent))
        add(
          "reviewer-identity-missing",
          `${who} names no agent — the dispatched agent type is required so the ledger row can be matched`,
        );
      if (v.ran !== true || !nonEmpty(v.evidence))
        add(
          "reviewer-zero-evidence",
          `${who} has ran=${v.ran} evidence=${JSON.stringify(v.evidence || "")}`,
        );
      if (!nonEmpty(v.launch_id)) {
        add("reviewer-launch-unresolved", `${who} cites no launch_id`);
        continue;
      }
      const row = launchRows
        ? launchRows.find((x) => x.launch_id === v.launch_id)
        : null;
      if (!row) {
        add(
          "reviewer-launch-unresolved",
          `${who} launch_id ${v.launch_id} has no kind:"launch" row in the committed ledger`,
        );
        continue;
      }
      if (nonEmpty(v.agent) && row.subagent_type !== v.agent)
        add(
          "reviewer-launch-unresolved",
          `${who} launch_id ${v.launch_id} was spawned as ${row.subagent_type}, not ${v.agent}`,
        );
      if (
        SECURITY_LENS_RE.test(v.lens || "") &&
        !SECURITY_AGENT_RE.test(row.subagent_type || "")
      )
        add(
          "security-lens-not-specialist",
          `${who} launch_id ${v.launch_id} was spawned as ${row.subagent_type || "?"} — a security lens must be a security-reviewer dispatch (agent name containing "security"), not a relabelled reviewer`,
        );
      if (!Number.isNaN(verdictMs) && !(Date.parse(row.ts || "") < verdictMs))
        add(
          "reviewer-launch-unresolved",
          `${who} launch_id ${v.launch_id} ts ${row.ts} is not before verdict_at ${r.verdict_at}`,
        );
      if (live) {
        const l = live.get(v.launch_id);
        if (
          !l ||
          l.ts !== row.ts ||
          l.subagent_type !== row.subagent_type ||
          l.session_id !== row.session_id
        )
          add(
            "launch-row-not-live",
            `${who} launch_id ${v.launch_id} is not in this checkout's live dispatch ledger with the same ts/session/agent`,
          );
      }
    }
    if (
      securityCritical &&
      !revs.some((v) => SECURITY_LENS_RE.test(v.lens || "") && v.ran === true)
    )
      add(
        "security-lens-missing",
        `round ${round.n}: security-critical scope has no ran security-lens reviewer`,
      );
  }
}

/**
 * The receipt's rounds, tied to what the round recorder was given: each reviewer's `evidence` is a
 * saved, non-empty report, and each listed round has its committed `round-<scope>-<n>.json` that
 * says the same thing. Both are read at the receipt's pin, like the ledger.
 */
function checkRoundRecords(c) {
  const { r, add, repoRoot, wsRel, receiptPin, scope } = c;
  if (!receiptPin || !scope || !Array.isArray(r.rounds) || r.rounds.length === 0 ||
      !r.rounds.every((x) => x && typeof x === "object" && Number.isInteger(x.n)))
    return;
  const validateRel = `${wsRel}/04-validate/`;
  const reportPath = (ev) => {
    if (!nonEmpty(ev)) return null;
    const norm = ev.trim().split("\\").join("/");
    if (isAbsolute(norm) || norm.split("/").some((seg) => seg === ".." || seg === "." || seg === ""))
      return null;
    return norm.startsWith(validateRel) ? norm : null;
  };
  const revsOf = (x) =>
    Array.isArray(x.reviewers) ? x.reviewers.filter((v) => v && typeof v === "object") : [];
  for (const round of r.rounds) {
    for (const v of revsOf(round)) {
      const who = `round ${round.n}: ${v.agent || "?"}/${v.lens || "?"}`;
      const report = reportPath(v.evidence);
      if (!report)
        add(
          "reviewer-evidence-not-a-report",
          `${who} evidence must be the repository-root-relative path of the saved report under ${validateRel} (e.g. ${validateRel}${scope}-${v.lens || "<lens>"}-r${round.n}.md), got ${JSON.stringify(v.evidence ?? null)}`,
        );
      else if (
        git(["cat-file", "-t", `${receiptPin}:${report}`], repoRoot) !== "blob" ||
        !(Number(git(["cat-file", "-s", `${receiptPin}:${report}`], repoRoot)) > 0)
      )
        add(
          "reviewer-evidence-missing",
          `${who} evidence ${report} is not a committed, non-empty file at the receipt's commit ${receiptPin.slice(0, 12)}`,
        );
    }
    const recordRel = `${validateRel}round-${scope}-${round.n}.json`;
    const text = showAt(repoRoot, receiptPin, recordRel);
    if (text === null) {
      add(
        "round-record-missing",
        `round ${round.n}: ${recordRel} is not committed at the receipt's commit ${receiptPin.slice(0, 12)} — every round the receipt lists must be the round the recorder was given`,
      );
      continue;
    }
    let rec;
    try {
      rec = JSON.parse(text);
    } catch (e) {
      add("round-record-mismatch", `round ${round.n}: ${recordRel} is not valid JSON: ${e.message}`);
      continue;
    }
    const problems = [];
    if (!rec || typeof rec !== "object") rec = {};
    if (rec.round !== round.n) problems.push(`its round is ${JSON.stringify(rec.round)}`);
    if (nonEmpty(r.branch) && rec.branch !== r.branch.trim())
      problems.push(`its branch is ${JSON.stringify(rec.branch)}, the receipt's is ${JSON.stringify(r.branch)}`);
    if (rec.head !== round.head) problems.push(`its head is ${JSON.stringify(rec.head)}, the receipt's is ${JSON.stringify(round.head)}`);
    const recRevs = Array.isArray(rec.reviewers) ? rec.reviewers.filter((x) => x && typeof x === "object") : [];
    const lenses = revsOf(round).map((v) => v.lens).sort();
    const expected = Array.isArray(rec.expected_reviewers) ? [...rec.expected_reviewers].sort() : [];
    if (JSON.stringify(lenses) !== JSON.stringify(expected))
      problems.push(`its expected_reviewers ${JSON.stringify(expected)} are not the receipt's lenses ${JSON.stringify(lenses)}`);
    for (const v of revsOf(round)) {
      const rv = recRevs.find((x) => x.id === v.lens);
      if (!rv) problems.push(`no recorded verdict for lens ${JSON.stringify(v.lens)}`);
      else if (reportPath(v.evidence) && reportPath(rv.evidence) !== reportPath(v.evidence))
        problems.push(`lens ${v.lens} cites ${JSON.stringify(rv.evidence)} there, ${JSON.stringify(v.evidence)} here`);
    }
    const recordedClean = recRevs.length > 0 && recRevs.every((x) => x.verdict === "CLEAR");
    const receiptClean = round.clean === true && round.new_gating_findings === 0;
    if (recordedClean !== receiptClean)
      problems.push(`recorded verdicts ${recRevs.map((x) => `${x.id}=${x.verdict}`).join(", ") || "none"} but the receipt says clean=${round.clean}`);
    if (problems.length)
      add("round-record-mismatch", `round ${round.n}: ${recordRel} disagrees with the receipt — ${problems.join("; ")}`);
  }
  // A later round the receipt leaves out: the receipt stopped counting before the branch did.
  const lastN = Math.max(...r.rounds.map((x) => x.n));
  const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const scopeRecordRe = new RegExp(`^${escapeRe(validateRel)}round-${escapeRe(scope)}-(\\d+)\\.json$`);
  for (const p of (git(["ls-tree", "--name-only", receiptPin, "--", validateRel], repoRoot) || "").split("\n")) {
    const m = p.match(scopeRecordRe);
    if (m && Number(m[1]) > lastN)
      add(
        "round-record-after-receipt",
        `${p} records round ${m[1]}, after the receipt's last round ${lastN} — a receipt must count every recorded round of its scope`,
      );
  }
  // RIGHT NOW: a record of this scope committed (or left uncommitted) AFTER the receipt — any
  // number, a later NOT_CLEAR re-review included — means the receipt no longer tells the whole story.
  if (!c.historical) {
    const dir = join(c.workspaceDir, "04-validate");
    for (const name of existsSync(dir) ? readdirSync(dir) : []) {
      const relP = `${validateRel}${name}`;
      if (!scopeRecordRe.test(relP)) continue;
      const added = isTracked(repoRoot, join(dir, name)) ? firstAddCommit(repoRoot, relP) : null;
      const pinned = blobAt(repoRoot, receiptPin, relP);
      if (added && pinned && blobNow(repoRoot, join(dir, name)) !== pinned)
        add(
          "round-record-after-receipt",
          `${relP} changed after the receipt's commit ${receiptPin.slice(0, 12)} — a recorded round is never rewritten`,
        );
      else if (!added || !isAncestor(added, receiptPin, repoRoot))
        add(
          "round-record-after-receipt",
          `${relP} was ${added ? `first committed in ${added.slice(0, 12)}, after` : "not committed before"} the receipt's commit ${receiptPin.slice(0, 12)} — a round reviewed after the receipt reopens the scope`,
        );
    }
  }
  checkRoundBudget(c, validateRel);
}

/**
 * The cap, worked out rather than taken from the receipt, with the recorder's own counting: every
 * round record ever ADDED to this workspace's 04-validate/ in the receipt commit's history whose
 * file names this scope or whose `branch` is the receipt's branch is replayed, oldest version
 * first, through the recorder's advanceRound. A round the recorder's cap, debug-round or
 * escalation gate would refuse means the cap was hit: `cap-hit-understated`. A record of this
 * scope that does not parse, two records for one round (a copied record included), a record
 * deleted and re-added with different content, counted rounds that do not start at round 1, or a
 * gap in the numbering is `round-records-invalid`.
 */
function checkRoundBudget(c, validateRel) {
  const { r, add, repoRoot, receiptPin } = c;
  if (!nonEmpty(r.branch)) return;
  const branch = r.branch.trim();
  const log = git(["log", "--reverse", "--no-renames", "--diff-filter=A", "--format=%x00%H", "--name-only", receiptPin, "--", validateRel], repoRoot);
  if (log === null) return add("round-records-invalid", `could not read the round records' history at ${receiptPin.slice(0, 12)}`);
  const byRound = new Map();
  const invalid = (detail) => add("round-records-invalid", detail);
  for (const chunk of log.split("\0").filter(Boolean)) {
    const [commit, ...paths] = chunk.split("\n").filter((l) => l.length);
    for (const p of paths) {
      if (!/\/round-[^/]+\.json$/.test(p)) continue;
      const sameScope = scopeOfRecordPath(p) === c.scope;
      let rec;
      try {
        rec = JSON.parse(showAt(repoRoot, commit, p) ?? "");
      } catch {
        if (sameScope) invalid(`${p} as first committed in ${commit.slice(0, 12)} is not valid JSON`);
        continue;
      }
      // The recorder's counting: a record of this scope, or of this branch.
      if (!rec || typeof rec !== "object" || !(sameScope || rec.branch === branch)) continue;
      if (!Number.isSafeInteger(rec.round) || rec.round < 1) {
        invalid(`${p} as first committed in ${commit.slice(0, 12)} has no valid round number`);
        continue;
      }
      const seen = byRound.get(rec.round);
      if (!seen) byRound.set(rec.round, { rec, path: p });
      else if (seen.path !== p)
        invalid(`round ${rec.round} of ${branch} is recorded twice (${seen.path}, ${p}) — a round is reviewed once; never copy a record into a new scope`);
      else if (JSON.stringify(seen.rec) !== JSON.stringify(rec))
        invalid(`${p} was deleted and re-added with different content — a recorded round is never rewritten`);
    }
  }
  // A record edited in place keeps its path, so the add-history above sees only its first
  // version: compare that with the version the receipt was judged at.
  for (const { rec, path: p } of byRound.values()) {
    let now = null;
    try { now = JSON.parse(showAt(repoRoot, receiptPin, p) ?? "null"); } catch { now = undefined; }
    if (now !== null && JSON.stringify(now) !== JSON.stringify(rec))
      invalid(`${p} was edited after it was first committed — a recorded round is never rewritten`);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  if (rounds.length && rounds[0] !== 1) {
    invalid(`the recorded rounds of scope ${c.scope} / branch ${branch} start at round ${rounds[0]}, not round 1 — every round the recorder admitted must stay committed`);
    return;
  }
  for (let i = 1; i < rounds.length; i++)
    if (rounds[i] !== rounds[i - 1] + 1) {
      invalid(`the recorded rounds of ${branch} skip from ${rounds[i - 1]} to ${rounds[i]} — every round the recorder admitted must stay committed`);
      return;
    }
  let state;
  for (const n of rounds) {
    try {
      state = advanceRound(state, byRound.get(n).rec).nextState;
    } catch (e) {
      if (e.code === "DEBUG_ROUND" || e.code === "ESCALATE_TO_HUMAN")
        add(
          "cap-hit-understated",
          `round ${n} of ${branch} (${byRound.get(n).path}) is past the round cap without its debug round or a named human's acceptance (${e.code}), yet cap_hit is ${JSON.stringify(r.cap_hit)} — the committed records show the cap was hit`,
        );
      else invalid(`round ${n} of ${branch} (${byRound.get(n).path}) is not a round the recorder admits: ${e.message}`);
      return;
    }
  }
}

function checkResiduals(c) {
  const { r, add } = c;
  (Array.isArray(r.residuals) ? r.residuals : []).forEach((x, i) => {
    if (!x || typeof x !== "object")
      return add("residual-unaccepted", `residual[${i}] is not an object`);
    const tag = `residual[${i}]${nonEmpty(x.finding) ? ` "${x.finding.slice(0, 40)}"` : ""}`;
    if (!/^INCREMENTAL$/i.test(x.category || ""))
      add(
        "residual-gating-half",
        `${tag}: category ${JSON.stringify(x.category)} — only INCREMENTAL may ship as a residual`,
      );
    if (isAgentIdentity(x.accepted_by))
      add(
        "residual-unaccepted",
        `${tag}: accepted_by must name a human distinct from the agent, got ${JSON.stringify(x.accepted_by)}`,
      );
    for (const f of [
      "blocking_safety_note",
      "value_anchor",
      "full_fix_criteria",
      "revisit_trigger",
    ])
      if (!nonEmpty(x[f]))
        add(
          "residual-unaccepted",
          `${tag}: ${f} is required (product-completion-first.md MUST-2)`,
        );
    if (!nonEmpty(x.backstop) || !DATE_RE.test(x.backstop.trim()))
      add(
        "residual-unaccepted",
        `${tag}: backstop must be a calendar date YYYY-MM-DD`,
      );
  });
}

function checkTodos(c) {
  const { r, add, repoRoot, workspaceDir, wsRel, vh, historical } = c;
  if (!Array.isArray(r.todos)) return;
  for (const entry of r.todos.filter(nonEmpty)) {
    const p = todoRel(entry);
    if (!p) {
      add(
        "incomplete:todos",
        `todo entry must be a workspace-relative todos/completed/<file>.md path, got ${JSON.stringify(entry)}`,
      );
      continue;
    }
    if (!vh) continue;
    const repoRel = `${wsRel}/${p}`;
    const atVerdict = blobAt(repoRoot, vh, repoRel);
    if (!atVerdict) {
      add(
        `todo-not-completed-at-verdict:${p}`,
        `${repoRel} is not in the tree at ${vh.slice(0, 12)}`,
      );
      continue;
    }
    const w = assessTodoText(showAt(repoRoot, vh, repoRel) || "");
    if (w.status === "walk-blocked")
      add(
        `todo-walk-blocked:${p}`,
        `${repoRel} @ ${vh.slice(0, 12)}: the browser walk found the flow broken (${w.detail}) — evidence it does NOT work, not evidence of done`,
      );
    else if (w.status !== "receipt" && w.status !== "not-applicable")
      add(
        `todo-walk-undeclared:${p}`,
        `${repoRel} @ ${vh.slice(0, 12)}: ${w.status} — ${w.detail}`,
      );
    if (!historical) {
      const now = existsSync(join(workspaceDir, p))
        ? blobNow(repoRoot, join(workspaceDir, p))
        : null;
      if (now !== atVerdict)
        add(
          `todo-changed-since-verdict:${p}`,
          `${repoRel} is not the content reviewed at ${vh.slice(0, 12)} (${now ? "rewritten" : "absent"})`,
        );
    }
  }
}

/**
 * Assess one receipt. `historical: true` judges it AS OF its own commits (see header) — the
 * receipt text itself is then read at its pin (receiptPinOf), never the working tree.
 * @returns {{findings: {id: string, detail: string}[], notes: string[], scope: string|null}}
 */
/**
 * The commit that PINS a receipt. Before its wave merges, a receipt refused for paperwork may be
 * corrected in a later commit on the wave branch, so it is judged as at its LAST commit on the
 * checked-out branch. Once it is on the integration branch it is immutable: it is judged as it was
 * when it first landed there (its last change reachable from that integration commit), and any
 * later change is `receipt-rewritten`.
 */
function receiptPinOf(repoRoot, relR) {
  const integ = resolveIntegration(repoRoot);
  if (integ) {
    const landings = git(["log", "--first-parent", "--no-renames", "--diff-filter=A", "--format=%H", integ.sha, "--", relR], repoRoot);
    const landed = landings ? landings.split("\n").filter(Boolean).pop() : null;
    if (landed) return { pin: lastChangeAt(repoRoot, landed, relR), merged: true };
  }
  return { pin: lastChangeAt(repoRoot, "HEAD", relR), merged: false };
}
const lastChangeAt = (repoRoot, ref, relPath) =>
  git(["log", "-1", "--format=%H", ref, "--", relPath], repoRoot) || null;

export function assessReceipt({
  receiptPath,
  workspaceDir,
  repoRoot,
  historical = false,
}) {
  workspaceDir = canon(workspaceDir);
  repoRoot = canon(repoRoot);
  receiptPath = canon(receiptPath);
  const findings = [];
  const notes = [];
  const add = (id, detail) => findings.push({ id, detail });
  if (!existsSync(receiptPath)) {
    add(
      "missing",
      `no receipt at ${receiptPath} — the scope has never been certified converged`,
    );
    return { findings, notes, scope: null };
  }
  const relR = rel(repoRoot, receiptPath);
  const tracked = isTracked(repoRoot, receiptPath);
  const { pin: receiptPin, merged } = tracked ? receiptPinOf(repoRoot, relR) : { pin: null, merged: false };
  const text =
    historical && receiptPin
      ? showAt(repoRoot, receiptPin, relR)
      : readFileSync(receiptPath, "utf8");
  let r;
  try {
    r = JSON.parse(text);
  } catch (e) {
    add("malformed", `not valid JSON: ${e.message}`);
    return { findings, notes, scope: null };
  }
  if (!r || typeof r !== "object" || r.schema !== SCHEMA) {
    add(
      "malformed",
      `schema must be "${SCHEMA}", got ${JSON.stringify(r && r.schema)}`,
    );
    return { findings, notes, scope: null };
  }
  if (!tracked)
    add(
      "receipt-untracked",
      `${relR} is not tracked — git add and commit it before checking`,
    );
  else if (!receiptPin)
    add(
      "receipt-uncommitted",
      `${relR} is staged but has never been committed — commit the receipt, then check it`,
    );
  else if (
    !historical &&
    blobNow(repoRoot, receiptPath) !== blobAt(repoRoot, receiptPin, relR)
  )
    add(
      "receipt-rewritten",
      merged
        ? `${relR} differs from the content merged into the integration branch (${receiptPin.slice(0, 12)}) — a receipt is immutable once merged`
        : `${relR} has uncommitted changes — before the merge a corrected receipt is judged once it is committed (last commit ${receiptPin.slice(0, 12)})`,
    );
  const c = {
    r,
    add,
    notes,
    receiptPath,
    workspaceDir,
    repoRoot,
    wsRel: rel(repoRoot, workspaceDir),
    historical,
    scope: nonEmpty(r.scope) ? r.scope.trim() : null,
    receiptPin,
    vh: null,
    integ: null,
    onIntegration: false,
    base: null,
    launchRows: null,
    securityCritical: false,
  };
  checkShape(c);
  checkHead(c);
  checkCurrency(c);
  checkWindow(c);
  deriveSecurity(c);
  checkArtifacts(c);
  checkRounds(c);
  checkRoundRecords(c);
  checkResiduals(c);
  checkTodos(c);
  return { findings, notes, scope: c.scope };
}

export function receiptPathFor(workspaceDir, scope) {
  return join(workspaceDir, "04-validate", `convergence-${scope}.json`);
}

export function template(scope) {
  return {
    schema: SCHEMA,
    scope,
    project: "<workspace name>",
    todos: ["todos/completed/<todo-file>.md"],
    branch: "<the branch checked out when the verdict was reached>",
    integration_ref: "main",
    wave_base:
      "<40-hex integration commit the wave started from — git merge-base main <verdict_head> before merging; recorded once>",
    verdict_head: "<40-hex commit the final two clean rounds reviewed>",
    verdict_at: "<ISO timestamp of the final clean verdict>",
    security_critical: true,
    gating_half: GATING_HALF,
    acceptance_list: {
      path: "<workspace-relative path to the ratified list — committed before the work, unchanged since, naming this scope or every covered todo>",
      ratified_by: "<the name of the person (the user) who approved the acceptance list — never an agent or reviewer>",
    },
    rounds: [1, 2].map((n) => ({
      n,
      head: "<40-hex — the same verdict_head in both counted rounds>",
      new_gating_findings: 0,
      clean: true,
      reviewers: [
        {
          agent: "reviewer",
          lens: "correctness",
          ran: true,
          evidence: `workspaces/<project>/04-validate/${scope}-correctness-r${n}.md`,
          launch_id:
            "<this round's own dispatch — one per reviewer, never reused>",
        },
        {
          agent: "security-reviewer",
          lens: "security",
          ran: true,
          evidence: `workspaces/<project>/04-validate/${scope}-security-r${n}.md`,
          launch_id: "<a security-reviewer dispatch of this round>",
        },
      ],
    })),
    cap_hit: false,
    residuals: [],
    launches: `04-validate/convergence-${scope}.launches.jsonl`,
    journal: "journal/<NNNN>-DECISION-<scope>-converged.md",
  };
}

// ---- CLOSED? (per todo FILE, historical) ---------------------------------------------------------

export function assessTodoFileClosed({ workspaceDir, repoRoot, todoPath }) {
  workspaceDir = canon(workspaceDir);
  repoRoot = canon(repoRoot);
  const all = listReceipts(workspaceDir);
  const malformed = all.filter((x) => !x.parsed);
  const covering = all.filter(
    (x) =>
      x.parsed &&
      Array.isArray(x.parsed.todos) &&
      x.parsed.todos.map(todoRel).includes(todoPath),
  );
  const results = covering.map((x) => {
    const res = assessReceipt({
      receiptPath: x.path,
      workspaceDir,
      repoRoot,
      historical: true,
    });
    const vh = nonEmpty(x.parsed.verdict_head)
      ? x.parsed.verdict_head.trim()
      : null;
    const abs = join(workspaceDir, todoPath);
    if (vh && SHA_RE.test(vh) && existsSync(abs)) {
      const certified = blobAt(
        repoRoot,
        vh,
        `${rel(repoRoot, workspaceDir)}/${todoPath}`,
      );
      if (certified && certified !== blobNow(repoRoot, abs))
        res.findings.push({
          id: `todo-changed-since-verdict:${todoPath}`,
          detail: `${todoPath} is not the content certified at ${vh.slice(0, 12)} — a rewritten or replaced todo is new work`,
        });
    }
    return { receiptPath: x.path, ...res };
  });
  const failing = results.filter((x) => x.findings.length > 0);
  let reason = null;
  if (malformed.length) reason = "receipt-malformed";
  else if (results.length === 0) reason = "no-covering-receipt";
  else if (failing.length) reason = "covering-receipt-fails";
  return { closed: reason === null, results, malformed, reason };
}

function todoFilesFor(workspaceDir, id) {
  const done = join(workspaceDir, "todos", "completed");
  if (!existsSync(done)) return [];
  return readdirSync(done)
    .filter((f) => f.endsWith(".md") && todoIdOf(f) === id.toLowerCase())
    .sort()
    .map((f) => `todos/completed/${f}`);
}

function grandfatheredMap(repoRoot, pin) {
  if (!isCommit(pin, repoRoot)) return null;
  const out = git(["ls-tree", "-r", pin, "--", "workspaces/"], repoRoot);
  const m = new Map();
  for (const line of (out || "").split("\n")) {
    const mm = line.match(/^\d+ blob ([0-9a-f]{40})\t(.+)$/);
    if (mm) m.set(mm[2], mm[1]);
  }
  return m;
}

/** The pin's tree, or null after printing why it was refused (unreachable, unverifiable, widening). */
function loadPin(repoRoot, pin, label) {
  if (pin === null) return new Map(); // No pin configured: nothing pre-dates the gate.
  if (GRANDFATHER_PIN === null) {
    process.stdout.write(
      `FAIL ${label}: grandfather-pin-widening-refused — no default pin is configured (.harness/manifest.json grandfather_pin is null), so ${pin.slice(0, 12)} would widen the exempt set from nothing; set the default pin in a reviewed commit instead\n`,
    );
    return null;
  }
  const gf = grandfatheredMap(repoRoot, pin);
  if (!gf) {
    process.stdout.write(
      `FAIL ${label}: grandfather-pin-unreachable — ${pin} is not a commit in ${repoRoot}; refusing to guess which todos pre-date the gate\n`,
    );
    return null;
  }
  if (pin !== GRANDFATHER_PIN) {
    if (!isCommit(GRANDFATHER_PIN, repoRoot)) {
      if (process.env.RCR_FIXTURE_REPO !== "1") {
        process.stdout.write(
          `FAIL ${label}: grandfather-pin-unverifiable — the default pin ${GRANDFATHER_PIN.slice(0, 12)} is not reachable here (shallow clone?), so ${pin.slice(0, 12)} cannot be shown to narrow; refusing (fetch full history, or drop --grandfather-pin)\n`,
        );
        return null;
      }
    } else if (!isAncestor(pin, GRANDFATHER_PIN, repoRoot)) {
      process.stdout.write(
        `FAIL ${label}: grandfather-pin-widening-refused — ${pin.slice(0, 12)} is not an ancestor of the default pin ${GRANDFATHER_PIN.slice(0, 12)}; a supplied pin may narrow the exempt set, never widen it\n`,
      );
      return null;
    }
  }
  return gf;
}

/**
 * A completed todo in the tree at the pin is exempt while its content is the pinned blob — or that
 * blob plus ONE appended `## Verification` section declaring the browser walk not applicable. A
 * pre-gate todo may gain the honest note; it may not gain a walk receipt, and nothing else may change.
 * @returns {"identical"|"annotated"|null}
 */
function grandfatherStatus(repoRoot, pinnedBlob, absPath) {
  if (!pinnedBlob || !existsSync(absPath)) return null;
  if (blobNow(repoRoot, absPath) === pinnedBlob) return "identical";
  let pinned;
  let current;
  try {
    pinned = execFileSync(
      "git",
      ["-C", repoRoot, "cat-file", "-p", pinnedBlob],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    current = readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
  if (!current.startsWith(pinned)) return null;
  const appended = current.slice(pinned.length);
  if (!/^\s*## Verification\s*\n/.test(appended)) return null;
  return assessTodoText(appended).status === "not-applicable"
    ? "annotated"
    : null;
}
const grandfatherLabel = (pin, status) =>
  `grandfathered — pre-gate (in the tree at ${pin.slice(0, 12)} ${status === "annotated" ? "plus an appended not-applicable verification note" : "with identical content"})`;

// ---- CLI ------------------------------------------------------------------------------------------

function usage() {
  return (
    "usage:\n" +
    "  check-redteam-convergence-receipt.mjs --workspace <dir> --scope <id>      # is this convergence true RIGHT NOW (all arms; commit the receipt first)\n" +
    "  check-redteam-convergence-receipt.mjs --workspace <dir> <receipt.json>    # assess an explicit receipt under this workspace's 04-validate/ (current mode)\n" +
    "  check-redteam-convergence-receipt.mjs --workspace <dir> --todo <id> [--grandfather-pin <sha>]   # was this todo ever properly CLOSED (historical; every covering receipt must pass), or pre-gate (in the tree at the pin)\n" +
    "  check-redteam-convergence-receipt.mjs --sweep <workspaces-root> [--grandfather-pin <sha>]   # CI: every completed todo CLOSED (historical), or in the tree at the pin\n" +
    "  check-redteam-convergence-receipt.mjs --template <id>                     # print a skeleton receipt\n" +
    "exit 0 converged/closed · 1 findings · 2 usage · 3 UNRUN (workspace not resolvable)\n"
  );
}

function printReceipt(label, receiptPath, res) {
  for (const n of res.notes) process.stdout.write(`note ${n}\n`);
  if (res.findings.length === 0) {
    process.stdout.write(`ok   ${label}: converged — ${receiptPath}\n`);
    return 0;
  }
  process.stdout.write(`FAIL ${label}: NOT converged — ${receiptPath}\n`);
  for (const f of res.findings)
    process.stdout.write(`     ${f.id} — ${f.detail}\n`);
  return 1;
}

function repoRootOf(dir) {
  return canon(
    git(["rev-parse", "--show-toplevel"], dir) || resolve(dir, "..", ".."),
  );
}

function printClosed(label, t) {
  for (const m of t.malformed)
    process.stdout.write(
      `FAIL ${label}: receipt-malformed — ${m.path}: ${m.error} — a receipt that cannot be read blocks every todo in this workspace until fixed\n`,
    );
  if (t.results.length === 0 && t.malformed.length === 0)
    process.stdout.write(
      `FAIL ${label}: no-covering-receipt — implemented at most, not CLOSED (no convergence receipt lists this file)\n`,
    );
  for (const x of t.results)
    printReceipt(`${label} via ${x.scope || "?"}`, x.receiptPath, x);
  if (t.reason === "covering-receipt-fails")
    process.stdout.write(
      `FAIL ${label}: covering-receipt-fails — every receipt that lists a todo must pass; one did not\n`,
    );
  if (t.closed)
    process.stdout.write(
      `ok   ${label}: CLOSED — ${t.results.map((x) => x.scope).join(", ")}\n`,
    );
  return t.closed ? 0 : 1;
}

function runTodo(workspaceDir, repoRoot, id, pin) {
  const files = todoFilesFor(workspaceDir, id);
  if (files.length === 0) {
    process.stdout.write(
      `FAIL todo ${id}: no-such-completed-todo — nothing in todos/completed/ carries that id\n`,
    );
    return 1;
  }
  const gf = loadPin(repoRoot, pin, `todo ${id}`);
  if (!gf) return 1;
  let code = 0;
  for (const f of files) {
    const abs = join(workspaceDir, f);
    const status = grandfatherStatus(repoRoot, gf.get(rel(repoRoot, abs)), abs);
    if (status) {
      process.stdout.write(
        `skip todo ${f}: ${grandfatherLabel(pin, status)}; not awaiting convergence\n`,
      );
      continue;
    }
    if (
      printClosed(
        `todo ${f}`,
        assessTodoFileClosed({ workspaceDir, repoRoot, todoPath: f }),
      ) !== 0
    )
      code = 1;
  }
  return code;
}

function runSweep(root, pin) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    process.stdout.write(
      `UNRUN: workspaces root not found: ${root} — this is NOT a pass\n`,
    );
    return 3;
  }
  const repoRoot = repoRootOf(root);
  const gf = loadPin(repoRoot, pin, "sweep");
  if (!gf) return 1;
  let todos = 0;
  let closed = 0;
  let grandfathered = 0;
  let failing = 0;
  let skippedDirs = 0;
  for (const w of readdirSync(root, { withFileTypes: true })) {
    const isLink = w.isSymbolicLink();
    if (
      isLink ||
      !w.isDirectory() ||
      w.name.startsWith("_") ||
      w.name === "instructions"
    ) {
      if (isLink || w.isDirectory()) {
        skippedDirs++;
        process.stdout.write(
          `skip ${w.name}/: not swept (${isLink ? "symlinked directory" : w.name.startsWith("_") ? "underscore-prefixed" : "instructions"})\n`,
        );
      }
      continue;
    }
    const workspaceDir = canon(join(root, w.name));
    const done = join(workspaceDir, "todos", "completed");
    if (!existsSync(done)) continue;
    for (const f of readdirSync(done)
      .filter((x) => x.endsWith(".md"))
      .sort()) {
      const todoPath = `todos/completed/${f}`;
      const id = todoIdOf(f);
      todos++;
      if (!id) {
        failing++;
        process.stdout.write(
          `FAIL ${w.name}/${f}: todo-id-unparseable — cannot tell which receipt should cover it\n`,
        );
        continue;
      }
      const pinnedBlob = gf.get(rel(repoRoot, join(done, f)));
      const status = grandfatherStatus(repoRoot, pinnedBlob, join(done, f));
      if (status) {
        grandfathered++;
        process.stdout.write(
          `skip ${w.name}/${id}: ${grandfatherLabel(pin, status)}\n`,
        );
        continue;
      }
      const rewritten = !!pinnedBlob;
      let t;
      try {
        t = assessTodoFileClosed({ workspaceDir, repoRoot, todoPath });
      } catch (e) {
        failing++;
        process.stdout.write(
          `FAIL ${w.name}/${todoPath}: checker-error — ${e.message} (this workspace is NOT closed; the sweep continues)\n`,
        );
        continue;
      }
      if (t.closed) {
        closed++;
        process.stdout.write(
          `ok   ${w.name}/${todoPath}: CLOSED — ${t.results.map((x) => x.scope).join(", ")}\n`,
        );
      } else {
        failing++;
        process.stdout.write(
          `FAIL ${w.name}/${todoPath}: implemented-not-closed — ${t.reason}${rewritten ? " (in the pin's tree but REWRITTEN since — a changed completed todo is new work)" : ""}\n`,
        );
        for (const m of t.malformed)
          process.stdout.write(
            `     receipt-malformed — ${m.path}: ${m.error}\n`,
          );
        for (const x of t.results)
          for (const fnd of x.findings)
            process.stdout.write(
              `     ${x.scope || "?"}: ${fnd.id} — ${fnd.detail}\n`,
            );
      }
    }
  }
  process.stdout.write(
    `convergence sweep: ${todos} completed todos — ${closed} closed, ${grandfathered} grandfathered, ${failing} not closed; ${skippedDirs} workspace dir(s) not swept\n`,
  );
  if (todos === 0) {
    process.stdout.write(
      "UNRUN: no completed todos found — this is NOT a pass\n",
    );
    return 3;
  }
  return failing ? 1 : 0;
}

export function main(argv) {
  const o = {
    workspace: null,
    scope: null,
    todo: null,
    template: null,
    receipt: null,
    sweep: null,
    pin: GRANDFATHER_PIN,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--workspace") o.workspace = next();
    else if (a === "--scope") o.scope = next();
    else if (a === "--todo") o.todo = next();
    else if (a === "--template") o.template = next();
    else if (a === "--sweep") o.sweep = next();
    else if (a === "--grandfather-pin") o.pin = String(next() || "");
    else if (a === "--help" || a === "-h")
      return (process.stdout.write(usage()), 2);
    else if (a.startsWith("--"))
      return (process.stderr.write(`unknown argument: ${a}\n${usage()}`), 2);
    else o.receipt = a;
  }
  if (o.template !== null) {
    if (!nonEmpty(o.template) || !SCOPE_RE.test(o.template))
      return (
        process.stderr.write(`--template needs a scope matching ${SCOPE_RE}\n`),
        2
      );
    process.stdout.write(JSON.stringify(template(o.template), null, 2) + "\n");
    return 0;
  }
  if (o.sweep !== null)
    return nonEmpty(o.sweep)
      ? runSweep(canon(resolve(o.sweep)), o.pin)
      : (process.stderr.write(usage()), 2);
  if (!nonEmpty(o.workspace)) return (process.stderr.write(usage()), 2);
  const workspaceDir = canon(resolve(o.workspace));
  if (!existsSync(workspaceDir) || !statSync(workspaceDir).isDirectory()) {
    process.stdout.write(
      `UNRUN: workspace not found: ${workspaceDir} — this is NOT a pass\n`,
    );
    return 3;
  }
  const repoRoot = repoRootOf(workspaceDir);
  if (nonEmpty(o.todo))
    return runTodo(workspaceDir, repoRoot, o.todo.trim(), o.pin);
  if (
    nonEmpty(o.scope) &&
    (!SCOPE_RE.test(o.scope) || o.scope.includes(".."))
  ) {
    process.stdout.write(
      `FAIL scope ${JSON.stringify(o.scope)}: scope-invalid — must match ${SCOPE_RE}\n`,
    );
    return 1;
  }
  let receiptPath = o.receipt
    ? canon(resolve(o.receipt))
    : nonEmpty(o.scope)
      ? receiptPathFor(workspaceDir, o.scope)
      : null;
  if (!receiptPath) return (process.stderr.write(usage()), 2);
  // A positional receipt must live under THIS workspace's 04-validate/ — the same file the
  // --todo/--sweep coverage would see — never a file elsewhere that evades that check.
  const validateDir = canon(join(workspaceDir, "04-validate"));
  if (
    o.receipt &&
    !(
      receiptPath.startsWith(`${validateDir}/`) &&
      basename(receiptPath).startsWith("convergence-")
    )
  ) {
    process.stdout.write(
      `FAIL receipt ${o.receipt}: receipt-outside-workspace — a receipt is assessed only from this workspace's 04-validate/convergence-*.json\n`,
    );
    return 1;
  }
  const res = assessReceipt({ receiptPath, workspaceDir, repoRoot });
  let code = printReceipt(
    `scope ${res.scope || o.scope || "?"}`,
    receiptPath,
    res,
  );
  for (const m of listReceipts(workspaceDir).filter(
    (x) => !x.parsed && x.path !== receiptPath,
  )) {
    process.stdout.write(
      `FAIL workspace: receipt-malformed — ${m.path}: ${m.error}\n`,
    );
    code = 1;
  }
  return code;
}

const isMain =
  !!process.argv[1] &&
  realpathSync(process.argv[1]) ===
    realpathSync(fileURLToPath(import.meta.url));
if (isMain) process.exit(main(process.argv.slice(2)));
