#!/usr/bin/env node
/**
 * check-codify-allowlist.mjs — may this automatic /codify pull request merge WITHOUT the user?
 * Run before the merge (`.harness/phases/codify.md` § Automatic runs); the reviewer still reviews.
 *
 *   node .harness/bin/check-codify-allowlist.mjs <base-ref> <head-ref>
 *
 * Judges every change between `git merge-base <base> <head>` and `<head>`. Exit 0 only when ALL of:
 *   - every changed path is on the allowlist:
 *       `.harness/guides/*.md` (any depth) except `task-delivery.md` and `project-profile.md`
 *         — added or modified;
 *       `.harness/backlog/*.md` — added or modified;
 *       `.harness/codify-log.md` — rows appended only (see below);
 *       the run's own evidence, ADDED only: `.harness/reviews/codify-*.md`,
 *         `.harness/reviews/round-codify-*.json`, `workspaces/<p>/04-validate/codify-*.md`,
 *         `workspaces/<p>/04-validate/round-codify-*.json` and
 *         `workspaces/<p>/journal/<NNNN>-DECISION-*.md`;
 *   - nothing is deleted, renamed, copied, a symlink, a submodule, or changes mode (only plain
 *     `100644` files);
 *   - no changed path differs only in letter case from another path in the base or head tree, or
 *     from an excluded name: on a case-insensitive checkout (macOS, Windows) `Task-Delivery.md`
 *     overwrites `task-delivery.md`;
 *   - `.harness/codify-log.md` at head is the base text plus appended table rows, each with five
 *     cells and an outcome of `folded in`, `declined`, `deferred` or `awaiting user`, and none
 *     recording a user's answer (a row that mentions the user saying, approving, confirming,
 *     agreeing, declining, replying, choosing or answering) — those are written only in a session
 *     where the user answered, never by an automatic run.
 * Paths are compared exactly as written (core.quotePath off); the allowlist prefixes are
 * case-sensitive, so `.Harness/guides/x.md` is not on it.
 *
 * Exit: 0 may merge without the user · 1 one or more findings (ask-first) · 2 usage or git error.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXCLUDED_GUIDES = [".harness/guides/task-delivery.md", ".harness/guides/project-profile.md"];
const LOG = ".harness/codify-log.md";
const OUTCOMES = new Set(["folded in", "declined", "deferred", "awaiting user"]);
// Any tense of an answering verb after "user"/"owner" ("approves", "confirms", "will approve",
// "approving"), so a row cannot read as the user's decision.
const USER_ANSWER_RE =
  /\bapproved by\b|\b(?:users?|owners?)(?:['’]s)?\b[^|]*\b(?:sa(?:id|ys?|ying)|answer\w*|approv\w*|confirm\w*|agree\w*|declin\w*|repl(?:y|ies|ied|ying)|wr(?:ote|ites?|iting)|cho(?:se|oses?|osing|ice)|decid\w*|decision|accept\w*|reject\w*|ok(?:ay)?'?d?|sign(?:s|ed)?[ -]?off|yes|no)\b/i;
// An automatic run's row never decides anything for anyone: no deciding word in the row at all,
// whoever it names ("approved per the user", "you approved", "Jane approved" all read as consent).
const DECIDING_RE =
  /\b(?:approv\w*|confirm\w*|consent\w*|agree\w*|accept\w*|sign(?:s|ed)?[ -]?off|ok(?:ay)?|yes|decid\w*|decision|cho(?:se|ice)|reject\w*|authori[sz]\w*|green[ -]?light\w*)\b/i;
const EDITABLE_RE = /^\.harness\/(?:guides|backlog)\/(?:[^/]+\/)*[^/]+\.md$/;
const EVIDENCE_RE =
  /^(?:\.harness\/reviews\/|workspaces\/[^/]+\/04-validate\/)(?:codify-[^/]+\.md|round-codify-[^/]+\.json)$|^workspaces\/[^/]+\/journal\/\d{4}-DECISION-[^/]+\.md$/;

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

function checkLog(baseText, headText) {
  const problems = [];
  if (baseText === null) return ["the log does not exist at the base"];
  if (headText === null) return ["the log was deleted"];
  const base = baseText.endsWith("\n") || baseText === "" ? baseText : `${baseText}\n`;
  if (!headText.startsWith(base)) return ["existing text was changed — rows are appended, never rewritten or deleted"];
  // Lessons whose latest row at the base is "awaiting user" stay with the user.
  const latest = new Map();
  for (const line of base.split("\n")) {
    const c = line.trim().match(/^\|(.*)\|$/)?.[1].split("|").map((x) => x.trim());
    if (c && c.length === 5 && OUTCOMES.has(c[3].toLowerCase())) latest.set(c[2], c[3].toLowerCase());
  }
  const awaiting = new Set([...latest].filter(([, o]) => o === "awaiting user").map(([k]) => k));
  for (const line of headText.slice(base.length).split("\n")) {
    if (!line.trim()) continue;
    const cells = line.trim().match(/^\|(.*)\|$/)?.[1].split("|").map((x) => x.trim());
    if (!cells || cells.length !== 5) { problems.push(`appended line is not a five-cell table row: ${JSON.stringify(line.slice(0, 80))}`); continue; }
    if (!OUTCOMES.has(cells[3].toLowerCase())) problems.push(`row outcome ${JSON.stringify(cells[3])} is not folded in / declined / deferred / awaiting user`);
    if (USER_ANSWER_RE.test(line) || DECIDING_RE.test(`${cells[2]} ${cells[4]}`)) problems.push(`row records a decision or answer, which only a session where the user answered may write: ${JSON.stringify(line.slice(0, 80))}`);
    if (awaiting.has(cells[2])) problems.push(`${cells[2]} is waiting for the user's answer; only that answer may add a row for it`);
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
  for (const p of all) byFold.set(p.toLowerCase(), [...(byFold.get(p.toLowerCase()) || []), p]);
  const show = (ref, p) => { try { return git(["show", `${ref}:${p}`], cwd); } catch { return null; } };
  const findings = [];
  for (const { oldMode, newMode, status, paths } of entries) {
    const [p] = paths;
    const fail = (why) => findings.push(`${paths.join(" -> ")}: ${why}`);
    if (status === "D") { fail("deleted — deletions are ask-first"); continue; }
    if (status === "R" || status === "C") { fail(`${status === "R" ? "renamed" : "copied"} — renames and copies are ask-first`); continue; }
    if (status === "T" || (status === "M" && oldMode !== newMode)) { fail(`mode or type changed (${oldMode} -> ${newMode})`); continue; }
    if (newMode !== "100644") { fail(`not a plain file (mode ${newMode}: symlink, submodule or executable)`); continue; }
    const collisions = (byFold.get(p.toLowerCase()) || []).filter((q) => q !== p);
    if (collisions.length) { fail(`differs only in letter case from ${collisions.join(", ")}`); continue; }
    if (EXCLUDED_GUIDES.includes(p.toLowerCase())) { fail("task-delivery.md and project-profile.md are ask-first"); continue; }
    if (p === LOG) {
      for (const why of checkLog(show(mergeBase, p), show(head, p))) fail(why);
      continue;
    }
    if (EDITABLE_RE.test(p)) { if (status !== "A" && status !== "M") fail(`status ${status}`); continue; }
    if (EVIDENCE_RE.test(p)) {
      if (status !== "A") { fail("the run's evidence is added, never edited"); continue; }
      // The run's journal summary is an agent's record, never a user decision.
      if (/\/journal\//.test(p) && !/^author:\s*agent\s*$/m.test(show(head, p) || "")) fail("the run's journal entry must have `author: agent`");
      continue;
    }
    fail("not on the automatic-merge allowlist (ask-first)");
  }
  return { findings };
}

function main(argv) {
  if (argv.length !== 2 || argv.some((a) => a.startsWith("-"))) {
    process.stderr.write("usage: check-codify-allowlist.mjs <base-ref> <head-ref>\nexit 0 may merge without the user · 1 findings (ask-first) · 2 usage or git error\n");
    return 2;
  }
  let result;
  try { result = checkCodifyAllowlist(argv[0], argv[1]); }
  catch (error) { process.stderr.write(`${error.message.trim()}\n`); return 2; }
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
