#!/usr/bin/env node
/**
 * check-codify-allowlist.mjs — may this automatic /codify pull request merge WITHOUT the user?
 * Run before the merge (`.harness/phases/codify.md` § Automatic runs); the reviewer still reviews.
 *
 *   node .harness/bin/check-codify-allowlist.mjs <base-ref> --pr <number>   (GitHub remote)
 *   node .harness/bin/check-codify-allowlist.mjs <base-ref> <branch>        (any remote, or none)
 *
 * The head is the commit that will merge, never a caller-chosen revision. `<branch>` must be a
 * plain branch name (`docs/codify-x`): a revision such as `x~1`, a commit id, `HEAD` or a full
 * ref name is refused (exit 2). It is judged at its tip:
 *   - with an `origin` remote: origin's copy, fetched first into `refs/remotes/origin/<branch>`;
 *     a branch not on origin is exit 2 (push it first);
 *   - with no remote at all: the local branch `refs/heads/<branch>`.
 * With `--pr <number>`, `gh pr view` supplies the pull request's head branch and head commit; the
 * pull request must be open, from this repository (not a fork) and into origin's default branch,
 * and its head commit must equal origin's fetched branch tip, or exit 2.
 * The output names the commit judged on a line `judged commit: <full sha> (...)`. Merge with
 * `gh pr merge <number> --merge --match-head-commit <that sha>`, so a push after the check makes
 * the merge fail instead of merging an unjudged commit.
 *
 * The base is always the branch the pull request merges into, never the caller's choice (a base
 * nearer the head would hide the head's earlier commits from the check). The check works it out:
 *   - with an `origin` remote: origin's default branch (`git ls-remote --symref origin HEAD`),
 *     fetched first into `refs/remotes/origin/<branch>`; an unreachable origin is exit 2;
 *   - with no remote at all: the local `main`, and the output says so;
 *   - remotes, but none named `origin`: exit 2.
 * `<base-ref>` (`origin/main`, or `main` with no remote) must resolve to that same commit, or the
 * run stops with exit 2 before judging anything.
 *
 * Judges every change between `git merge-base <base> <head>` and `<head>`. Exit 0 only when ALL of:
 *   - every changed path is on the allowlist:
 *       `.harness/backlog/*.md` (any depth) — added or modified;
 *       `.harness/codify-log.md` — rows appended only (see below);
 *       the run's own evidence, ADDED only: `.harness/reviews/codify-*.md`,
 *         `.harness/reviews/round-codify-*.json`, `workspaces/<p>/04-validate/codify-*.md`,
 *         `workspaces/<p>/04-validate/round-codify-*.json` and
 *         `workspaces/<p>/journal/<NNNN>-DECISION-*.md` whose front matter (between the opening
 *         and closing `---` lines) is plain unquoted `key: value` lines, each key once, with
 *         `author: agent` and no `human` or `co-authored` anywhere in it, and no second `---` or
 *         `...` line anywhere after it; the body is not otherwise read;
 *     `.harness/guides/**` is NOT on it: guides are instruction files (`.claude/rules/security.md`
 *     § Untrusted Content), so a guide change is ask-first;
 *   - nothing is deleted, renamed, copied, a symlink, a submodule, or changes mode (only plain
 *     `100644` files);
 *   - no changed path differs only in letter case from another path in the base or head tree:
 *     on a case-insensitive checkout (macOS, Windows) `README.MD` overwrites `README.md`;
 *   - `.harness/codify-log.md` at head is the base text plus appended table rows, judged cell by
 *     cell: a `YYYY-MM-DD` date; a run cell naming only branches and pull requests
 *     (`docs/codify-x`, `PR #7`); a lesson cell holding one lesson path
 *     (`workspaces/<p>/journal/*.md` or `.harness/backlog/*.md`, optionally in backticks) whose
 *     file name is never read for words; an outcome of `folded in`, `declined`, `deferred` or
 *     `awaiting user`; and a detail cell with no deciding word, no user's answer and no quoted
 *     speech — rows recording an answer are written only in a session where the user answered;
 *     and no row for a lesson whose latest base row is `awaiting user`.
 * Paths are compared exactly as written (core.quotePath off); the allowlist prefixes are
 * case-sensitive, so `.Harness/backlog/x.md` is not on it.
 *
 * Exit: 0 may merge without the user · 1 one or more findings (ask-first) · 2 usage or git error.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOG = ".harness/codify-log.md";
const OUTCOMES = new Set(["folded in", "declined", "deferred", "awaiting user"]);
// Any tense of an answering verb after "user"/"owner" ("approves", "confirms", "will approve",
// "approving"), so a row cannot read as the user's decision.
const USER_ANSWER_RE =
  /\bapproved by\b|\b(?:users?|owners?)(?:['’]s)?\b[^|]*\b(?:sa(?:id|ys?|ying)|answer\w*|approv\w*|confirm\w*|agree\w*|declin\w*|repl(?:y|ies|ied|ying)|wr(?:ote|ites?|iting)|cho(?:se|oses?|osing|ice)|decid\w*|decision|accept\w*|reject\w*|ok(?:ay)?'?d?|sign(?:s|ed)?[ -]?off|yes|no)\b/i;
// An automatic run's row never decides anything for anyone: no deciding word in the detail at
// all, whoever it names ("approved per the user", "you approved", "Jane approved" all read as consent).
const DECIDING_RE =
  /\b(?:approv\w*|confirm\w*|consent\w*|agree\w*|accept\w*|sign(?:s|ed)?[ -]?off|ok(?:ay)?|yes|decid\w*|decision|cho(?:se|ice)|reject\w*|authori[sz]\w*|green[ -]?light\w*|sa(?:id|ys)|told|asked|wants?|instruct\w*|request\w*)\b/i;
// Quoted speech in any quote style reads as someone's words: paired straight or curly quotes,
// guillemets and CJK corner brackets. A lone apostrophe ("doesn't") is fine.
const QUOTED_RE = /["“”«»「」『』]|(?:^|[\s(:])['‘][^'’]+['’](?=$|[\s).,;:!?])/;
const EDITABLE_RE = /^\.harness\/backlog\/(?:[^/]+\/)*[^/]+\.md$/;
const GUIDES_RE = /^\.harness\/guides\//i;
const EVIDENCE_RE =
  /^(?:\.harness\/reviews\/|workspaces\/[^/]+\/04-validate\/)(?:codify-[^/]+\.md|round-codify-[^/]+\.json)$|^workspaces\/[^/]+\/journal\/\d{4}-DECISION-[^/]+\.md$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// A lesson is a journal entry or a backlog item (`.harness/phases/learn.md` step 1).
const LESSON_RE = /^(?:workspaces\/[A-Za-z0-9._-]+\/journal\/|\.harness\/backlog\/)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.md$/;
// Run-cell tokens: a branch name (has a slash), `PR`, `#7`, or a separator.
const RUN_TOKEN_RE = /^(?:[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+|PR|#\d+|\/|,|;|—|-)$/;

function git(args, cwd) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

/** Parse `git diff --raw -z`: entries of {oldMode, newMode, status, paths}. */
function parseRaw(out) {
  const parts = out.split("\0");
  const entries = [];
  for (let i = 0; i < parts.length; ) {
    const meta = parts[i++];
    if (!meta) continue;
    const m = meta.match(/^:(\d{6}) (\d{6}) [0-9a-f]+ [0-9a-f]+ ([A-Z])(\d*)$/);
    if (!m) throw new Error(`unexpected git diff output: ${JSON.stringify(meta)}`);
    const status = m[3];
    const paths = [parts[i++]];
    if (status === "R" || status === "C") paths.push(parts[i++]);
    entries.push({ oldMode: m[1], newMode: m[2], status, paths });
  }
  return entries;
}

const lessonKey = (cell) => cell.replace(/^`([^`]*)`$/, "$1");
const tableCells = (line) => line.trim().match(/^\|(.*)\|$/)?.[1].split("|").map((x) => x.trim());

// A front-matter line the check accepts: a plain lowercase key, one space, a plain value. No
// quoted or indented keys, no quoted, block, anchor, alias, tag or comment values, no escapes.
const FRONT_LINE_RE = /^([a-z][a-z0-9_-]*): ([^\s"'\\{}|>&*!%@`#][^\\]*)$/;

/**
 * Why the run's journal entry is not an agent's record, or null when it is. Reads front matter
 * only. The file holds exactly one front-matter block, first; every line in it is a plain
 * `key: value` line, each key once; `author` is exactly `agent`; no `human` or `co-authored`.
 */
export function journalAuthorProblem(text) {
  const lines = (text || "").split(/\r?\n/);
  if (lines[0] !== "---") return "the run's journal entry must open with front matter holding `author: agent`";
  const end = lines.indexOf("---", 1);
  if (end < 0) return "the run's journal entry has no closing `---`; its front matter must hold `author: agent`";
  if (lines.slice(end + 1).some((l) => /^(?:---|\.\.\.)\s*$/.test(l))) return "the run's journal entry has a second front-matter block or document marker (`---` or `...`); it has exactly one front matter, holding `author: agent`";
  const front = lines.slice(1, end);
  if (!front.length) return "the run's journal entry has empty front matter; it must hold `author: agent`";
  const keys = new Map();
  for (const l of front) {
    const m = l.match(FRONT_LINE_RE);
    if (!m) return `the run's journal entry front matter must be plain unquoted \`key: value\` lines (no quotes, escapes, indentation or comments); refused ${JSON.stringify(l.slice(0, 60))} — it must hold \`author: agent\``;
    if (keys.has(m[1])) return `the run's journal entry front matter repeats the key \`${m[1]}\`; it must have exactly one \`author: agent\``;
    keys.set(m[1], m[2].replace(/[ \t]+$/, ""));
  }
  if (keys.get("author") !== "agent") return "the run's journal entry must have exactly one `author:` key, `author: agent`, nothing else on that line";
  if (front.some((l) => /human|co-?authored/i.test(l))) return "the run's journal entry must have `author: agent` and no `human` or `co-authored` in its front matter";
  return null;
}

function checkLog(baseText, headText) {
  const problems = [];
  if (baseText === null) return ["the log does not exist at the base"];
  if (headText === null) return ["the log was deleted"];
  const base = baseText.endsWith("\n") || baseText === "" ? baseText : `${baseText}\n`;
  if (!headText.startsWith(base)) return ["existing text was changed — rows are appended, never rewritten or deleted"];
  // Lessons whose latest row at the base is "awaiting user" stay with the user.
  const latest = new Map();
  for (const line of base.split("\n")) {
    const c = tableCells(line);
    if (c && c.length === 5 && OUTCOMES.has(c[3].toLowerCase())) latest.set(lessonKey(c[2]), c[3].toLowerCase());
  }
  const awaiting = new Set([...latest].filter(([, o]) => o === "awaiting user").map(([k]) => k));
  for (const line of headText.slice(base.length).split("\n")) {
    if (!line.trim()) continue;
    const cells = tableCells(line);
    const row = JSON.stringify(line.slice(0, 80));
    if (!cells || cells.length !== 5) { problems.push(`appended line is not a five-cell table row: ${row}`); continue; }
    // Each cell is judged as the field it is. A lesson's file name (`0005-DECISION-request-ok.md`)
    // is a path, not words, so only the detail cell is read for deciding words.
    const [date, run, lessonCell, outcome, detail] = cells;
    const lesson = lessonKey(lessonCell);
    if (!DATE_RE.test(date)) problems.push(`row date ${JSON.stringify(date)} is not YYYY-MM-DD: ${row}`);
    if (!run || !run.split(/\s+/).every((tok) => RUN_TOKEN_RE.test(tok))) problems.push(`row run cell must name only branches and pull requests (docs/codify-x, PR #7): ${row}`);
    if (!LESSON_RE.test(lesson)) problems.push(`row lesson cell must be one lesson path (workspaces/<p>/journal/*.md or .harness/backlog/*.md): ${row}`);
    if (!OUTCOMES.has(outcome.toLowerCase())) problems.push(`row outcome ${JSON.stringify(outcome)} is not folded in / declined / deferred / awaiting user`);
    if (USER_ANSWER_RE.test(detail) || DECIDING_RE.test(detail) || QUOTED_RE.test(detail)) problems.push(`row records a decision or answer, which only a session where the user answered may write: ${row}`);
    if (awaiting.has(lesson)) problems.push(`${lesson} is waiting for the user's answer; only that answer may add a row for it`);
  }
  return problems;
}

/** @returns {{ findings: string[] }} */
export function checkCodifyAllowlist(base, head, cwd = process.cwd()) {
  const mergeBase = git(["merge-base", base, head], cwd).trim();
  const entries = parseRaw(git(["diff", "--raw", "-z", "-M", "-C", "--no-ext-diff", mergeBase, head], cwd));
  const tree = (ref) => git(["ls-tree", "-r", "-z", "--name-only", ref], cwd).split("\0").filter(Boolean);
  const all = [...new Set([...tree(mergeBase), ...tree(head)])];
  const byFold = new Map();
  for (const p of all) { const k = p.normalize("NFKC").toLowerCase(); byFold.set(k, [...(byFold.get(k) || []), p]); }
  const show = (ref, p) => { try { return git(["show", `${ref}:${p}`], cwd); } catch { return null; } };
  const findings = [];
  for (const { oldMode, newMode, status, paths } of entries) {
    const [p] = paths;
    const fail = (why) => findings.push(`${paths.join(" -> ")}: ${why}`);
    if (status === "D") { fail("deleted — deletions are ask-first"); continue; }
    if (status === "R" || status === "C") { fail(`${status === "R" ? "renamed" : "copied"} — renames and copies are ask-first`); continue; }
    if (status === "T" || (status === "M" && oldMode !== newMode)) { fail(`mode or type changed (${oldMode} -> ${newMode})`); continue; }
    if (newMode !== "100644") { fail(`not a plain file (mode ${newMode}: symlink, submodule or executable)`); continue; }
    // Lookalike letters (a long s, a ligature, a Cyrillic a) fold onto a protected name on some
    // filesystems; an automatic run only ever writes plain ASCII names.
    if (/[^\x20-\x7e]/.test(p)) { fail("file name has characters outside plain ASCII — ask-first"); continue; }
    const parts = p.split("/");
    const shadow = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"))
      .flatMap((d) => (byFold.get(d.normalize("NFKC").toLowerCase()) || []).filter((q) => q !== d && !all.some((x) => x.startsWith(`${q}/`))));
    if (shadow.length) { fail(`a folder in this path has the same name as the file ${shadow.join(", ")} on a case-insensitive disk`); continue; }
    const collisions = (byFold.get(p.normalize("NFKC").toLowerCase()) || []).filter((q) => q !== p);
    if (collisions.length) { fail(`differs only in letter case from ${collisions.join(", ")}`); continue; }
    if (GUIDES_RE.test(p)) { fail("guides are instruction files (`.claude/rules/security.md` § Untrusted Content) — ask-first"); continue; }
    if (p === LOG) {
      for (const why of checkLog(show(mergeBase, p), show(head, p))) fail(why);
      continue;
    }
    if (EDITABLE_RE.test(p)) { if (status !== "A" && status !== "M") fail(`status ${status}`); continue; }
    if (EVIDENCE_RE.test(p)) {
      if (status !== "A") { fail("the run's evidence is added, never edited"); continue; }
      // The run's journal summary is an agent's record, never a user decision.
      if (/\/journal\//.test(p)) { const why = journalAuthorProblem(show(head, p)); if (why) fail(why); }
      continue;
    }
    fail("not on the automatic-merge allowlist (ask-first)");
  }
  return { findings };
}

/**
 * The commit the pull request merges into: origin's default branch, fetched first, or the local
 * `main` when the repository has no remote at all. Never the caller's choice.
 * @returns {{ ref: string, label: string, branch: string, remote: boolean }}
 */
export function defaultBase(cwd = process.cwd()) {
  const remotes = git(["remote"], cwd).split("\n").map((r) => r.trim()).filter(Boolean);
  if (!remotes.length) {
    git(["rev-parse", "--verify", "--quiet", "refs/heads/main^{commit}"], cwd);
    return { ref: "refs/heads/main", label: "no remote: judging against local main", branch: "main", remote: false };
  }
  if (!remotes.includes("origin")) throw new Error(`remotes ${remotes.join(", ")} exist but none is named origin; the pull request's base is origin's default branch`);
  const symref = git(["ls-remote", "--symref", "origin", "HEAD"], cwd).match(/^ref: refs\/heads\/(\S+)\tHEAD$/m);
  if (!symref) throw new Error("could not read origin's default branch (git ls-remote --symref origin HEAD)");
  const branch = symref[1];
  git(["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`], cwd);
  return { ref: `refs/remotes/origin/${branch}`, label: `judging against origin/${branch} (just fetched)`, branch, remote: true };
}

/** A plain branch name: a valid `refs/heads/<name>`, not a revision, a full ref name or `HEAD`. */
function plainBranchName(name, cwd) {
  if (typeof name !== "string" || !name || name.startsWith("-") || name.startsWith("refs/") || name === "HEAD" || /[~^:@\\\s?*[]/.test(name)) return false;
  try { git(["check-ref-format", `refs/heads/${name}`], cwd); return true; } catch { return false; }
}

/**
 * The commit that will merge: the branch's tip on origin (fetched first) or, with no remote, the
 * local branch's tip. With a pull request, gh's head commit must equal origin's tip.
 * @returns {{ sha: string, label: string }}
 */
export function resolveHead(base, head, cwd = process.cwd()) {
  const commit = (ref) => git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], cwd).trim();
  let branch = head.branch;
  let pr = null;
  if (head.pr !== undefined) {
    if (!/^[1-9]\d*$/.test(head.pr)) throw new Error(`--pr needs a pull request number, got ${JSON.stringify(head.pr)}`);
    if (!base.remote) throw new Error("--pr needs an origin remote; with no remote, name the local branch instead");
    let out;
    try {
      out = execFileSync("gh", ["pr", "view", head.pr, "--json", "headRefName,headRefOid,baseRefName,isCrossRepository,state"],
        { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) { throw new Error(`gh pr view ${head.pr} failed: ${String(error.stderr || error.message).trim()}`); }
    pr = JSON.parse(out);
    if (pr.state !== "OPEN") throw new Error(`pull request #${head.pr} is ${pr.state}, not open`);
    if (pr.isCrossRepository !== false) throw new Error(`pull request #${head.pr} comes from another repository; only a branch on origin is judged`);
    if (pr.baseRefName !== base.branch) throw new Error(`pull request #${head.pr} merges into ${pr.baseRefName}, not origin's default branch ${base.branch}`);
    if (!/^[0-9a-f]{40}$/.test(pr.headRefOid || "")) throw new Error(`pull request #${head.pr} has no head commit id`);
    branch = pr.headRefName;
  }
  if (!plainBranchName(branch, cwd)) throw new Error(`${JSON.stringify(branch)} is not a plain branch name; name the branch itself (docs/codify-x), not a revision, commit id or ref`);
  if (!base.remote) {
    let sha;
    try { sha = commit(`refs/heads/${branch}`); } catch { throw new Error(`no local branch ${branch}`); }
    return { sha, label: `local branch ${branch}, no remote` };
  }
  try { git(["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`], cwd); }
  catch (error) { throw new Error(`branch ${branch} could not be fetched from origin (push it first): ${String(error.stderr || error.message).trim()}`); }
  const sha = commit(`refs/remotes/origin/${branch}`);
  if (pr && pr.headRefOid !== sha) throw new Error(`pull request #${head.pr} head ${pr.headRefOid.slice(0, 12)} is not origin/${branch} tip ${sha.slice(0, 12)}; re-run once they agree`);
  return { sha, label: pr ? `pull request #${head.pr}, origin/${branch} tip (just fetched)` : `origin/${branch} tip (just fetched)` };
}

const USAGE = "usage: check-codify-allowlist.mjs <base-ref> --pr <number>\n       check-codify-allowlist.mjs <base-ref> <branch>\n(<base-ref> must be origin's default branch, e.g. origin/main, or main when there is no remote; <branch> is a plain branch name, judged at its tip on origin, or locally when there is no remote)\nexit 0 may merge without the user · 1 findings (ask-first) · 2 usage or git error\n";

function main(argv) {
  let head;
  if (argv.length === 3 && argv[1] === "--pr" && !argv[0].startsWith("-")) head = { pr: argv[2] };
  else if (argv.length === 2 && !argv.some((a) => a.startsWith("-"))) head = { branch: argv[1] };
  else { process.stderr.write(USAGE); return 2; }
  const sha = (ref) => git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], process.cwd()).trim();
  let base;
  let judged;
  try {
    base = defaultBase();
    let given = null;
    try { given = sha(argv[0]); } catch { /* not a commit: refused below */ }
    const want = sha(base.ref);
    if (given !== want) {
      const hint = base.ref.startsWith("refs/heads/")
        ? "this repository has no remote, so pass main"
        : `pass ${base.ref.replace("refs/remotes/", "")}`;
      process.stderr.write(`base ${argv[0]} (${given ? given.slice(0, 12) : "not found"}) is not the default branch the pull request merges into (${want.slice(0, 12)}); ${hint}\n`);
      return 2;
    }
    judged = resolveHead(base, head);
  } catch (error) {
    process.stderr.write(`${String(error.stderr || error.message || "git error").trim()}\n`);
    return 2;
  }
  process.stdout.write(`${base.label}\n`);
  process.stdout.write(`judged commit: ${judged.sha} (${judged.label})\n`);
  let result;
  try { result = checkCodifyAllowlist(base.ref, judged.sha); }
  catch (error) { process.stderr.write(`${String(error.stderr || error.message).trim()}\n`); return 2; }
  for (const f of result.findings) process.stdout.write(`FAIL ${f}\n`);
  if (result.findings.length) {
    process.stdout.write(`codify allowlist: ${result.findings.length} finding(s) — this change is ask-first; do not merge it without the user\n`);
    return 1;
  }
  process.stdout.write("codify allowlist: every change is on the allowlist — may merge without the user after its CLEAR review\n");
  return 0;
}

const invokedPath = (() => { try { return process.argv[1] && realpathSync(process.argv[1]); } catch { return null; } })();
if (invokedPath && invokedPath === realpathSync(fileURLToPath(import.meta.url))) process.exit(main(process.argv.slice(2)));
