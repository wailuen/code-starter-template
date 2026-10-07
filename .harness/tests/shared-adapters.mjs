// Harness self-tests. Run from the repository root: `node --test ".harness/tests/*.mjs"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { renderAdapters, codexEnabled, root } from "../bin/check-adapters.mjs";
import { isSecuritySurface, liveLaunchIndex, GRANDFATHER_PIN } from "../bin/check-redteam-convergence-receipt.mjs";

const PHASES = ["analyze", "todos", "implement", "redteam", "debug", "fix", "codify", "learn"];
function tempDir(t, prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function git(cwd, args) {
  const r = spawnSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function copy(dir, path, text) {
  const target = resolve(dir, path);
  mkdirSync(resolve(target, ".."), { recursive: true });
  writeFileSync(target, text);
}

test("adapter CLI refuses missing, unreadable and drifted adapters, and --write repairs them", (t) => {
  const dir = tempDir(t, "harness-adapter-cli-");
  for (const path of [".harness/bin/check-adapters.mjs", ".harness/manifest.json"]) copy(dir, path, readFileSync(resolve(root, path), "utf8"));
  const adapters = renderAdapters({ codex: false });
  for (const [path, text] of Object.entries(adapters)) copy(dir, path, text);
  const invoke = (...args) => spawnSync(process.execPath, [resolve(dir, ".harness/bin/check-adapters.mjs"), ...args], { encoding: "utf8" });
  assert.equal(invoke().status, 0);
  const path = Object.keys(adapters)[0], target = resolve(dir, path);
  for (const mode of ["missing", "unreadable", "drifted"]) {
    rmSync(target, { recursive: true, force: true });
    if (mode === "unreadable") mkdirSync(target); // Reading a directory fails even as root.
    if (mode === "drifted") writeFileSync(target, "drifted adapter");
    const result = invoke();
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(`Adapter drift: ${path}`));
    rmSync(target, { recursive: true, force: true });
    if (mode !== "drifted") copy(dir, path, adapters[path]);
  }
  // The last mode left the file missing: --write must restore exactly the rendered text.
  assert.equal(invoke("--write").status, 0);
  assert.equal(readFileSync(target, "utf8"), adapters[path]);
  assert.equal(invoke().status, 0);
  assert.equal(invoke("--bogus").status, 2);
});

test("Codex adapters are checked only once enabled, and --write --codex enables them", (t) => {
  const dir = tempDir(t, "harness-adapter-codex-");
  for (const path of [".harness/bin/check-adapters.mjs", ".harness/manifest.json"]) copy(dir, path, readFileSync(resolve(root, path), "utf8"));
  for (const [path, text] of Object.entries(renderAdapters({ codex: false }))) copy(dir, path, text);
  const invoke = (...args) => spawnSync(process.execPath, [resolve(dir, ".harness/bin/check-adapters.mjs"), ...args], { encoding: "utf8" });
  assert.equal(codexEnabled(dir), false);
  assert.match(invoke().stdout, /Codex not enabled/);
  mkdirSync(resolve(dir, ".codex"));
  const drift = invoke();
  assert.equal(drift.status, 1, "an enabled-but-empty Codex adapter set must be reported");
  assert.ok(drift.stderr.includes("Adapter drift: .codex/agents/harness-reviewer.toml"));
  rmSync(resolve(dir, ".codex"), { recursive: true });
  assert.equal(invoke("--write", "--codex").status, 0);
  for (const path of Object.keys(renderAdapters({ codex: true }))) assert.ok(existsSync(resolve(dir, path)), path);
  assert.equal(invoke().status, 0);
});

test("phase names match across runtimes and generated Claude adapters are current", () => {
  const all = renderAdapters({ codex: true });
  for (const phase of PHASES) {
    assert.equal(all[`.agents/skills/${phase}/SKILL.md`].match(/^name: (.+)$/m)?.[1], phase);
    const claudeText = readFileSync(resolve(root, `.claude/commands/${phase}.md`), "utf8");
    assert.equal(claudeText, all[`.claude/commands/${phase}.md`], phase);
    assert.ok(readFileSync(resolve(root, `.harness/phases/${phase}.md`), "utf8").length > 100);
  }
  for (const role of Object.keys(JSON.parse(readFileSync(resolve(root, ".harness/manifest.json"), "utf8")).roles)) {
    assert.ok(existsSync(resolve(root, `.harness/roles/${role}.md`)), role);
  }
});

test("task contract CLI rejects an invalid contract (no silent success)", (t) => {
  const dir = tempDir(t, "harness-contract-");
  const file = join(dir, "invalid.md"); writeFileSync(file, "# No contract\n");
  const result = spawnSync(process.execPath, [resolve(root, ".harness/bin/check-task-contract.mjs"), file], { encoding: "utf8" });
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stdout).ready, false);
});

test("security surface covers harness, agent instructions and any ecosystem's manifests", () => {
  for (const path of [
    ".harness/bin/check-adapters.mjs", ".harness/guides/task-delivery.md", ".codex/agents/harness-reviewer.toml",
    ".agents/skills/debug/SKILL.md", "AGENTS.md", "CLAUDE.md", "docs/AGENTS.md", "workspaces/demo/todos/AGENTS.md",
    "package.json", "pyproject.toml", "go.mod", "Cargo.toml", "Dockerfile", "src/app.py", "cmd/server/main.go",
    "services/billing/auth/session.py", "internal/tokens/sign.go", "billing/tenant_scope.rb",
  ]) assert.equal(isSecuritySurface(path), true, path);
  for (const path of [".claude/learning/dispatch-reconcile/session.jsonl", "workspaces/demo/journal/result.md", "README.md", "docs/guide.md"]) {
    assert.equal(isSecuritySurface(path), false, path);
  }
});

test("review checkout reads the same main-checkout launch ledger", (t) => {
  const dir = tempDir(t, "harness-ledger-");
  const repo = join(dir, "repo"), wt = join(dir, "review"); mkdirSync(repo);
  git(repo, ["init", "-q"]); git(repo, ["commit", "--allow-empty", "-qm", "fixture"]);
  git(repo, ["worktree", "add", "-q", "--detach", wt, "HEAD"]);
  assert.equal(liveLaunchIndex(wt), null, "absent ledger is reported as absent, not as an empty pass");
  const sink = join(repo, ".claude/learning/dispatch-reconcile"); mkdirSync(sink, { recursive: true });
  const row = { kind: "launch", ts: new Date().toISOString(), session_id: "fixture-parent", launch_id: "fixture:parent:child", dispatch_name: "fixture-child", subagent_type: "reviewer" };
  writeFileSync(join(sink, "fixture-parent.jsonl"), JSON.stringify(row) + "\nnot json\n");
  assert.deepEqual(liveLaunchIndex(wt).get(row.launch_id), row);
});

test("no grandfather pin by default: completed todos are never silently exempt, and a supplied pin cannot widen from nothing", (t) => {
  assert.equal(GRANDFATHER_PIN, null, "a fresh template must not ship another project's commit as its pin");
  const repo = tempDir(t, "harness-sweep-");
  git(repo, ["init", "-q"]);
  const sweep = (...extra) => spawnSync(process.execPath, [resolve(root, ".harness/bin/check-redteam-convergence-receipt.mjs"), "--sweep", join(repo, "workspaces"), ...extra], { cwd: repo, encoding: "utf8" });
  copy(repo, "workspaces/demo/todos/active/.keep", "");
  git(repo, ["add", "-A"]); git(repo, ["commit", "-qm", "empty workspace"]);
  const empty = sweep();
  assert.equal(empty.status, 3, "no completed todos is UNRUN, never a pass: " + empty.stdout);
  copy(repo, "workspaces/demo/todos/completed/t01-01-example.md", "# t01-01 example\n");
  git(repo, ["add", "-A"]); git(repo, ["commit", "-qm", "completed todo"]);
  const unclosed = sweep();
  assert.equal(unclosed.status, 1, unclosed.stdout);
  assert.match(unclosed.stdout, /t01-01/);
  const widened = sweep("--grandfather-pin", git(repo, ["rev-parse", "HEAD"]));
  assert.equal(widened.status, 1, widened.stdout);
  assert.match(widened.stdout, /grandfather-pin-widening-refused/);
});

test("the review-round tracker loads and starts from an empty state", (t) => {
  const repo = tempDir(t, "harness-stall-");
  git(repo, ["init", "-q"]);
  const stall = spawnSync(process.execPath, ["-e", `const s = require(${JSON.stringify(resolve(root, ".harness/lib/redteam-stall.cjs"))}); console.log(typeof s.recordRound)`], { cwd: repo, encoding: "utf8" });
  assert.equal(stall.status, 0, stall.stderr);
  assert.equal(stall.stdout.trim(), "function");
  const usage = spawnSync(process.execPath, [resolve(root, ".harness/bin/record-review-round.mjs")], { cwd: repo, encoding: "utf8" });
  assert.notEqual(usage.status, 0, "missing round file must not pass");
  assert.match(usage.stderr + usage.stdout, /Usage/);
});

test("browser-walk checker fails an undeclared or double-declared todo and passes an honest not-applicable", (t) => {
  const dir = tempDir(t, "harness-walk-");
  const run = (name, text) => {
    writeFileSync(join(dir, name), text);
    return spawnSync(process.execPath, [resolve(root, ".harness/bin/check-browser-walk-receipts.mjs"), join(dir, name)], { encoding: "utf8" });
  };
  assert.equal(run("none.md", "# t01-01\n").status, 1);
  const na = "# t01-02\n\n## Verification\n\nBrowser walk: not applicable — CLI-only change, no screen.\n";
  assert.equal(run("na.md", na).status, 0);
  const both = na + "\n### Browser walk receipt\n\nSteps: opened page\nObserved: it loaded\nDisposition: proceed\n";
  assert.equal(run("both.md", both).status, 1, "a receipt AND a not-applicable line is never both");
});

test("manifest phases are exactly the documented set, and fix/codify/learn are generated for both runtimes", () => {
  const manifest = JSON.parse(readFileSync(resolve(root, ".harness/manifest.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.phases).sort(), [...PHASES].sort());
  const all = renderAdapters({ codex: true });
  for (const phase of ["fix", "codify", "learn"]) {
    const claudePath = resolve(root, `.claude/commands/${phase}.md`);
    assert.ok(existsSync(claudePath), `${phase} Claude command is generated`);
    assert.match(readFileSync(claudePath, "utf8"), new RegExp(`\\.harness/phases/${phase}\\.md`));
    assert.ok(all[`.agents/skills/${phase}/SKILL.md`], `${phase} Codex skill is rendered`);
  }
});

// The JSON examples the guides tell agents to copy must be accepted by the real recorder.
function documentedRound(file, marker) {
  const text = readFileSync(resolve(root, file), "utf8");
  const at = text.indexOf(marker);
  assert.ok(at >= 0, `${file} still contains the marker ${JSON.stringify(marker)}`);
  const block = text.slice(at).match(/```json\n([\s\S]*?)\n```/);
  assert.ok(block, `${file} has a JSON example after the marker`);
  return block[1];
}
for (const [file, marker] of [
  [".harness/guides/task-delivery.md", "Example (use the real branch"],
  [".harness/phases/fix.md", "record the round"],
]) {
  test(`the round example in ${file} passes the recorder; the audit's "04-validate/<file>" spelling is refused`, (t) => {
    const repo = tempDir(t, "harness-round-doc-");
    git(repo, ["init", "-q"]); git(repo, ["commit", "--allow-empty", "-qm", "base"]);
    const sample = JSON.parse(documentedRound(file, marker).replaceAll("<project>", "demo"));
    git(repo, ["checkout", "-q", "-b", sample.branch]);
    for (const r of sample.reviewers) copy(repo, r.evidence, `Verdict: ${r.verdict}\n`);
    git(repo, ["add", "-A"]); git(repo, ["commit", "-qm", "evidence"]);
    const head = git(repo, ["rev-parse", "HEAD"]);
    const record = (round, name) => {
      copy(repo, `workspaces/demo/04-validate/${name}`, JSON.stringify({ ...round, head }));
      return spawnSync(process.execPath, [resolve(root, ".harness/bin/record-review-round.mjs"), `workspaces/demo/04-validate/${name}`], { cwd: repo, encoding: "utf8" });
    };
    const ok = record(sample, "round-doc-1.json");
    assert.equal(ok.status, 0, ok.stderr + ok.stdout);
    if (sample.reviewers.every((r) => r.verdict === "CLEAR")) {
      assert.match(ok.stdout, /a todo checkpoint, a \/fix branch, a planning review, an analysis review or a codify review is done after one complete CLEAR round/, "a one-round checkpoint is told not to dispatch a second round");
      assert.doesNotMatch(ok.stdout, /including this round's own record commit/, "bookkeeping commits do not reset the clean count; the NEXT line must not say they do");
    }
    const relative = { ...sample, round: 2, reviewers: sample.reviewers.map((r) => ({ ...r, evidence: r.evidence.replace("workspaces/demo/", "") })) };
    const refused = record(relative, "round-doc-2.json");
    assert.equal(refused.status, 1, refused.stdout);
    assert.match(refused.stderr, /Evidence file is missing or empty/);
  });
}

test("browser-walk receipt counts only as a ### subsection of ## Verification with a proceed disposition", (t) => {
  const dir = tempDir(t, "harness-walk-placement-");
  const run = (name, text) => {
    writeFileSync(join(dir, name), text);
    return spawnSync(process.execPath, [resolve(root, ".harness/bin/check-browser-walk-receipts.mjs"), join(dir, name)], { encoding: "utf8" });
  };
  const fields = "Steps: opened the invite page, sent an invite, reloaded\nObserved: the invite is listed after reload\n";
  assert.equal(run("ok.md", `# w01-01\n\n## Verification\n\n### Browser walk receipt\n\n${fields}Disposition: proceed\n`).status, 0);
  assert.equal(run("level2.md", `# w01-02\n\n## Verification\n\nTests pass.\n\n## Browser walk receipt\n\n${fields}Disposition: proceed\n`).status, 1);
  assert.equal(run("blocked.md", `# w01-03\n\n## Verification\n\n### Browser walk receipt\n\n${fields}Disposition: blocked — save button does nothing\n`).status, 1);
});
