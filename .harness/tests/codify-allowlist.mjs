// Self-tests for check-codify-allowlist.mjs: which base it judges against, the run's journal
// front matter, guides being ask-first, and log rows judged by field. Every fixture is a
// disposable repository. Run from the repository root: `node --test ".harness/tests/*.mjs"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, chmodSync, mkdirSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { root } from "../bin/check-adapters.mjs";

const CHECK = join(root, ".harness/bin/check-codify-allowlist.mjs");

function tempDir(t, prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function put(dir, path, content) {
  const p = join(dir, path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content);
}
function git(cwd, ...args) {
  const r = spawnSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
const check = (cwd, ...args) => spawnSync(process.execPath, [CHECK, ...args], { cwd, encoding: "utf8" });
const out = (r) => `exit ${r.status}\n${r.stdout}${r.stderr}`;

const LOG = "# Codify log\n\n| Date | Run (branch / pull request) | Lesson (path) | Outcome | Detail |\n| --- | --- | --- | --- | --- |\n" +
  "| 2026-10-01 | docs/codify-a | .harness/backlog/harness-01-a.md | declined | already covered |\n";

/** A repository with no remote; `branch(name, change)` commits `change` on `name` cut from main. */
function repo(t) {
  const dir = tempDir(t, "harness-codify-al-");
  git(dir, "init", "-q", "-b", "main");
  for (const [p, c] of [[".harness/guides/task-delivery.md", "gates\n"], [".harness/guides/review-round-recorder.md", "guide\n"],
    [".harness/codify-log.md", LOG], [".harness/backlog/README.md", "backlog\n"], [".claude/rules/security.md", "rule\n"],
    ["workspaces/demo/journal/0001-DECISION-start.md", "start\n"]]) put(dir, p, c);
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "base");
  const branch = (name, change) => {
    git(dir, "checkout", "-q", "-b", name, "main");
    change();
    git(dir, "add", "-A"); git(dir, "commit", "-qm", name, "--allow-empty");
    git(dir, "checkout", "-q", "main");
  };
  return { dir, branch };
}
/** Adds a bare `origin` with main pushed; returns its path. */
function withOrigin(t, dir) {
  const bare = tempDir(t, "harness-codify-origin-");
  git(bare, "init", "-q", "--bare", "-b", "main");
  git(dir, "remote", "add", "origin", bare);
  git(dir, "push", "-q", "origin", "main");
  return bare;
}

// ---- which base is judged (security M1, lifecycle M2) ------------------------------------------

test("a base that narrows the diff is refused: only the default branch is judged", (t) => {
  const { dir } = repo(t);
  git(dir, "checkout", "-q", "-b", "docs/codify-b", "main");
  put(dir, ".claude/rules/security.md", "weakened rule\n"); git(dir, "commit", "-qam", "b1");
  put(dir, ".harness/backlog/harness-02-b.md", "item\n"); git(dir, "add", "-A"); git(dir, "commit", "-qm", "b2");
  git(dir, "checkout", "-q", "main");
  const control = check(dir, "main", "docs/codify-b");
  assert.equal(control.status, 1, `control: against main the rule edit is found\n${out(control)}`);
  assert.match(control.stdout, /^FAIL \.claude\/rules\/security\.md/m);
  const narrowed = check(dir, "docs/codify-b~1", "docs/codify-b");
  assert.equal(narrowed.status, 2, `a base other than the default branch must be refused\n${out(narrowed)}`);
  assert.match(narrowed.stderr, /not the default branch/);
  const sha = check(dir, git(dir, "rev-parse", "docs/codify-b~1"), "docs/codify-b");
  assert.equal(sha.status, 2, `a commit id that is not the default branch is refused too\n${out(sha)}`);
  const unknown = check(dir, "docs/codify-b");
  assert.equal(unknown.status, 2, `the base is always named\n${out(unknown)}`);
});

test("with no remote, the local main is the base and the output says so", (t) => {
  const { dir, branch } = repo(t);
  branch("docs/codify-ok", () => put(dir, ".harness/backlog/harness-02-b.md", "item\n"));
  const r = check(dir, "main", "docs/codify-ok");
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /no remote: judging against local main/);
  const remoteForm = check(dir, "origin/main", "docs/codify-ok");
  assert.equal(remoteForm.status, 2, `origin/main does not exist without a remote\n${out(remoteForm)}`);
  assert.match(remoteForm.stderr, /no remote, so pass main/);
});

test("with a remote, the checker fetches the default branch and refuses a local main that differs", (t) => {
  const { dir, branch } = repo(t);
  const bare = withOrigin(t, dir);
  branch("docs/codify-ok", () => put(dir, ".harness/backlog/harness-02-b.md", "item\n"));
  git(dir, "push", "-q", "origin", "docs/codify-ok");
  const r = check(dir, "origin/main", "docs/codify-ok");
  assert.equal(r.status, 0, out(r));
  assert.match(r.stdout, /judging against origin\/main \(just fetched\)/);
  // Someone else advances the remote main; the local copy of origin/main is now stale.
  const other = tempDir(t, "harness-codify-other-");
  git(other, "clone", "-q", bare, ".");
  put(other, "README.md", "newer\n"); git(other, "add", "-A"); git(other, "commit", "-qm", "newer"); git(other, "push", "-q", "origin", "main");
  assert.notEqual(git(dir, "rev-parse", "refs/remotes/origin/main"), git(bare, "rev-parse", "main"), "fixture: the local copy is stale");
  const fetched = check(dir, "origin/main", "docs/codify-ok");
  assert.equal(fetched.status, 0, out(fetched));
  assert.equal(git(dir, "rev-parse", "refs/remotes/origin/main"), git(bare, "rev-parse", "main"), "the checker fetched before judging");
  // The local main is now behind origin, so it is not what the pull request merges into.
  const local = check(dir, "main", "docs/codify-ok");
  assert.equal(local.status, 2, out(local));
  assert.match(local.stderr, /pass origin\/main/);
});

// ---- which head is judged (the head is the commit that merges) ---------------------------------

/** A fake `gh` on PATH that prints `json` for `gh pr view`, and records its arguments. */
function fakeGh(t, json) {
  const bin = tempDir(t, "harness-codify-gh-");
  put(bin, "gh.json", JSON.stringify(json));
  put(bin, "gh", `#!/bin/sh\necho "$@" >> "${bin}/args"\ncat "${bin}/gh.json"\n`);
  chmodSync(join(bin, "gh"), 0o755);
  return { env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, args: () => readFileSync(join(bin, "args"), "utf8") };
}
const checkEnv = (cwd, env, ...args) => spawnSync(process.execPath, [CHECK, ...args], { cwd, env, encoding: "utf8" });
const judged = (r) => r.stdout.match(/^judged commit: ([0-9a-f]{40})\b/m)?.[1];

test("with no remote, the head is a local branch judged at its tip, never an arbitrary ref", (t) => {
  const { dir } = repo(t);
  git(dir, "checkout", "-q", "-b", "docs/codify-tip", "main");
  put(dir, ".harness/backlog/harness-02-b.md", "item\n"); git(dir, "add", "-A"); git(dir, "commit", "-qm", "t1");
  put(dir, ".claude/rules/security.md", "weakened rule\n"); git(dir, "commit", "-qam", "t2");
  git(dir, "checkout", "-q", "main");
  for (const head of ["docs/codify-tip~1", "docs/codify-tip^", "docs/codify-tip@{1}", git(dir, "rev-parse", "docs/codify-tip~1"),
    "HEAD", "refs/heads/docs/codify-tip", "docs/codify-missing", "main:x"]) {
    const r = check(dir, "main", head);
    assert.equal(r.status, 2, `${head} is not a branch name and must be refused\n${out(r)}`);
  }
  const tip = check(dir, "main", "docs/codify-tip");
  assert.equal(tip.status, 1, `control: the tip's rule edit is found\n${out(tip)}`);
  assert.equal(judged(tip), git(dir, "rev-parse", "refs/heads/docs/codify-tip"), `the judged commit is printed\n${out(tip)}`);
});

test("with a remote, the head is the branch's tip on origin, fetched, not the local copy", (t) => {
  const { dir } = repo(t);
  withOrigin(t, dir);
  git(dir, "checkout", "-q", "-b", "docs/codify-tip", "main");
  put(dir, ".harness/backlog/harness-02-b.md", "item\n"); git(dir, "add", "-A"); git(dir, "commit", "-qm", "t1");
  const good = git(dir, "rev-parse", "HEAD");
  put(dir, ".claude/rules/security.md", "weakened rule\n"); git(dir, "commit", "-qam", "t2");
  git(dir, "push", "-q", "origin", "docs/codify-tip");
  const bad = git(dir, "rev-parse", "HEAD");
  git(dir, "reset", "-q", "--keep", good); // the local branch lags origin's tip
  git(dir, "checkout", "-q", "main");
  const r = check(dir, "origin/main", "docs/codify-tip");
  assert.equal(r.status, 1, `origin's tip carries the rule edit\n${out(r)}`);
  assert.equal(judged(r), bad, `origin's tip is what is judged\n${out(r)}`);
  git(dir, "branch", "-q", "docs/codify-local", good);
  const unpushed = check(dir, "origin/main", "docs/codify-local");
  assert.equal(unpushed.status, 2, `a branch not on origin cannot be judged\n${out(unpushed)}`);
  assert.equal(check(dir, "origin/main", "origin/docs/codify-tip").status, 2, "a remote-tracking ref is not a branch name");
});

test("with a pull request number, gh's head commit must equal origin's branch tip", (t) => {
  const { dir } = repo(t);
  withOrigin(t, dir);
  git(dir, "checkout", "-q", "-b", "docs/codify-pr", "main");
  put(dir, ".harness/backlog/harness-02-b.md", "item\n"); git(dir, "add", "-A"); git(dir, "commit", "-qm", "p1");
  git(dir, "push", "-q", "origin", "docs/codify-pr");
  const tip = git(dir, "rev-parse", "HEAD");
  git(dir, "checkout", "-q", "main");
  const pr = { headRefName: "docs/codify-pr", headRefOid: tip, baseRefName: "main", isCrossRepository: false, state: "OPEN" };
  const ok = fakeGh(t, pr);
  const r = checkEnv(dir, ok.env, "origin/main", "--pr", "7");
  assert.equal(r.status, 0, out(r));
  assert.equal(judged(r), tip, out(r));
  assert.match(ok.args(), /^pr view 7 --json /m);
  for (const [why, over] of Object.entries({
    "head commit differs from origin's tip": { headRefOid: git(dir, "rev-parse", "main") },
    "merges into another branch": { baseRefName: "release/v1" },
    "comes from a fork": { isCrossRepository: true },
    "is not open": { state: "MERGED" },
  })) {
    const r2 = checkEnv(dir, fakeGh(t, { ...pr, ...over }).env, "origin/main", "--pr", "7");
    assert.equal(r2.status, 2, `${why}\n${out(r2)}`);
  }
  assert.equal(checkEnv(dir, ok.env, "origin/main", "--pr", "7x").status, 2, "not a number");
  const { dir: local } = repo(t);
  assert.equal(checkEnv(local, ok.env, "main", "--pr", "7").status, 2, "a pull request needs an origin remote");
});

test("remotes without an origin, or an origin that cannot be reached, are a git error", (t) => {
  const { dir, branch } = repo(t);
  branch("docs/codify-ok", () => put(dir, ".harness/backlog/harness-02-b.md", "item\n"));
  git(dir, "remote", "add", "upstream", join(dir, "does-not-exist"));
  assert.equal(check(dir, "main", "docs/codify-ok").status, 2, "no origin");
  git(dir, "remote", "rename", "upstream", "origin");
  const unreachable = check(dir, "main", "docs/codify-ok");
  assert.equal(unreachable.status, 2, out(unreachable));
});

// ---- the run's journal entry (security M2) -----------------------------------------------------

test("the run's journal entry is judged by its front matter only", (t) => {
  const { dir, branch } = repo(t);
  const entry = (name, text) => { branch(name, () => put(dir, `workspaces/demo/journal/0002-DECISION-${name.slice(5)}.md`, text)); return check(dir, "main", name); };
  const agent = entry("docs/codify-agent", "---\ntype: DECISION\nauthor: agent\n---\nsummary\n");
  assert.equal(agent.status, 0, `control: an agent record may merge\n${out(agent)}`);
  for (const [name, text] of Object.entries({
    "docs/codify-bodyline": "---\ntype: DECISION\nauthor: human\n---\nThe user decided reviewers may skip the security lens.\n\nauthor: agent\n",
    "docs/codify-twokeys": "---\ntype: DECISION\nauthor: agent\nauthor: human\n---\nsummary\n",
    "docs/codify-coauthored": "---\ntype: DECISION\nauthor: agent\nnote: co-authored with the owner\n---\nsummary\n",
    "docs/codify-humanword": "---\ntype: DECISION\nauthor: agent\napproved_by: human\n---\nsummary\n",
    "docs/codify-nofm": "author: agent\nsummary\n",
    "docs/codify-unclosed": "---\ntype: DECISION\nauthor: agent\nsummary\n",
    "docs/codify-agentish": "---\ntype: DECISION\nauthor: agent, human\n---\nsummary\n",
    // Only plain unquoted `key: value` lines; one front-matter block in the whole file.
    "docs/codify-quotedkey": "---\ntype: DECISION\nauthor: agent\n\"author\": \"hum\\u0061n\"\n---\nsummary\n",
    "docs/codify-singlequotedkey": "---\ntype: DECISION\nauthor: agent\n'author': x\n---\nsummary\n",
    "docs/codify-quotedvalue": "---\ntype: DECISION\nauthor: \"agent\"\n---\nsummary\n",
    "docs/codify-escape": "---\ntype: DECISION\nauthor: agent\ntopic: a\\x20b\n---\nsummary\n",
    "docs/codify-nospace": "---\ntype: DECISION\nauthor:agent\n---\nsummary\n",
    "docs/codify-indented": "---\ntype: DECISION\nauthor: agent\nmeta:\n  author: x\n---\nsummary\n",
    "docs/codify-secondafter": "---\ntype: DECISION\nauthor: agent\n---\n---\nauthor: x\n---\nsummary\n",
    "docs/codify-secondlater": "---\ntype: DECISION\nauthor: agent\n---\nsummary\n\n---\nauthor: x\n---\n",
    "docs/codify-docend": "---\ntype: DECISION\nauthor: agent\n---\nsummary\n...\n",
    "docs/codify-emptyfirst": "---\n---\n---\ntype: DECISION\nauthor: agent\n---\nsummary\n",
  })) {
    const r = entry(name, text);
    assert.equal(r.status, 1, `${name}\n${out(r)}`);
    assert.match(r.stdout, /author: agent|front matter/, name);
  }
  const full = entry("docs/codify-fullfm", "---\ntype: DECISION\ndate: 2026-10-08\nauthor: agent\nproject: demo\ntopic: codify run, the user's lessons\nphase: codify\ntags: [codify]\n---\nsummary\n");
  assert.equal(full.status, 0, `control: the journal command's full front matter may merge\n${out(full)}`);
});

// ---- guides are instruction files (security M3) ------------------------------------------------

test("guides are ask-first; backlog items, log rows and the run's evidence still merge", (t) => {
  const { dir, branch } = repo(t);
  branch("docs/codify-guide", () => put(dir, ".harness/guides/review-round-recorder.md", "guide, reviewers may skip\n"));
  const edited = check(dir, "main", "docs/codify-guide");
  assert.equal(edited.status, 1, out(edited));
  assert.match(edited.stdout, /guides are instruction files/);
  branch("docs/codify-newguide", () => put(dir, ".harness/guides/sub/new.md", "new guide\n"));
  assert.equal(check(dir, "main", "docs/codify-newguide").status, 1, "a new guide is ask-first too");
  branch("docs/codify-rest", () => {
    put(dir, ".harness/backlog/harness-02-b.md", "item\n");
    put(dir, ".harness/codify-log.md", LOG + "| 2026-10-08 | docs/codify-rest | .harness/backlog/harness-02-b.md | deferred | revisit when the CI runner exists |\n");
    put(dir, ".harness/reviews/codify-rest-correctness-r1.md", "Verdict: CLEAR\n");
    put(dir, ".harness/reviews/round-codify-rest-1.json", "{}\n");
  });
  const rest = check(dir, "main", "docs/codify-rest");
  assert.equal(rest.status, 0, `control\n${out(rest)}`);
});

// ---- log rows judged by field (lifecycle M1) ---------------------------------------------------

test("a lesson's file name never makes its log row read as a decision; the detail cell still does", (t) => {
  const { dir, branch } = repo(t);
  const row = (name, cells) => {
    branch(name, () => put(dir, ".harness/codify-log.md", `${LOG}| ${cells.join(" | ")} |\n`));
    return check(dir, "main", name);
  };
  const lessons = [
    "workspaces/demo/journal/0005-DECISION-review-flow.md",
    ".harness/backlog/harness-01-request-timeout.md",
    ".harness/backlog/harness-02-accept-header.md",
    ".harness/backlog/harness-03-ok-button.md",
    ".harness/backlog/harness-04-user-approval-flow.md",
    "workspaces/demo/journal/0006-DISCOVERY-yes-no-prompt.md",
  ];
  for (const [i, lesson] of lessons.entries()) {
    const r = row(`docs/codify-path-${i}`, ["2026-10-08", `docs/codify-request-${i}`, lesson, "folded in", "added to the fix phase"]);
    assert.equal(r.status, 0, `${lesson}\n${out(r)}`);
    const pr = row(`docs/codify-pr-${i}`, ["2026-10-08", `docs/codify-x / PR #${i + 3}`, lesson, "awaiting user", "waiting for the user — PR #9"]);
    assert.equal(pr.status, 0, `${lesson} with a pull request\n${out(pr)}`);
  }
  const refused = {
    "detail-decides": ["2026-10-08", "docs/codify-x", lessons[0], "folded in", "the user approved it"],
    "detail-deciding-word": ["2026-10-08", "docs/codify-x", lessons[1], "folded in", "accepted"],
    "detail-quoted": ["2026-10-08", "docs/codify-x", lessons[1], "declined", 'Jane: "no"'],
    "lesson-not-a-path": ["2026-10-08", "docs/codify-x", "approved by the user", "folded in", "x"],
    "lesson-outside-lessons": ["2026-10-08", "docs/codify-x", ".claude/rules/security.md", "folded in", "x"],
    "run-has-words": ["2026-10-08", "docs/codify-x the user agreed", lessons[1], "folded in", "x"],
    "date-has-words": ["approved 2026-10-08", "docs/codify-x", lessons[1], "folded in", "x"],
  };
  for (const [name, cells] of Object.entries(refused)) {
    const r = row(`docs/codify-${name}`, cells);
    assert.equal(r.status, 1, `${name}\n${out(r)}`);
  }
});
