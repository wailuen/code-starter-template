// Gate self-tests: the review-round budget, the convergence checker's evidence and identity
// checks, the adapter checker's write and drift guards, and the browser-walk edge cases.
// Every fixture is a disposable directory or Git repository; synthetic review reports and
// launch rows here are fixtures, not evidence that any agent ran.
// Run from the repository root: `node --test ".harness/tests/*.mjs"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, realpathSync, symlinkSync, unlinkSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { root, renderAdapters } from "../bin/check-adapters.mjs";
import { isSecuritySurface, template } from "../bin/check-redteam-convergence-receipt.mjs";

const require = createRequire(import.meta.url);
const stall = require("../lib/redteam-stall.cjs");
const { isAgentIdentity } = require("../lib/agent-identity.cjs");

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
const node = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: "utf8", ...opts });

// ---- symlink invocation -----------------------------------------------------------------------

test("adapter and task-contract CLIs still run their checks when invoked through a symlinked directory", (t) => {
  const dir = tempDir(t, "harness-symlink-");
  const install = join(dir, "real");
  for (const path of [".harness/bin/check-adapters.mjs", ".harness/manifest.json"]) put(install, path, readFileSync(join(root, path)));
  for (const [path, text] of Object.entries(renderAdapters({ codex: false }))) put(install, path, text);
  put(install, ".claude/commands/analyze.md", "drifted\n");
  const link = join(dir, "link");
  symlinkSync(install, link);
  const adapters = node([join(link, ".harness/bin/check-adapters.mjs")]);
  assert.equal(adapters.status, 1, `drift must be reported through the link: ${adapters.stdout}${adapters.stderr}`);
  assert.match(adapters.stderr, /Adapter drift: \.claude\/commands\/analyze\.md/);
  const repoLink = join(dir, "repo-link");
  symlinkSync(root, repoLink);
  put(dir, "bad.md", "# no contract\n");
  const contract = node([join(repoLink, ".harness/bin/check-task-contract.mjs"), join(dir, "bad.md")]);
  assert.equal(contract.status, 1, `an invalid contract must fail through the link: ${contract.stdout}${contract.stderr}`);
  assert.equal(JSON.parse(contract.stdout).ready, false);
});

// ---- adapter checker: stray files, traversal, symlinked targets, effort allowlist --------------

function adapterInstall(t, prefix) {
  const dir = tempDir(t, prefix);
  for (const path of [".harness/bin/check-adapters.mjs", ".harness/manifest.json"]) put(dir, path, readFileSync(join(root, path)));
  const invoke = (...args) => node([join(dir, ".harness/bin/check-adapters.mjs"), ...args]);
  return { dir, invoke };
}

test("stale generated Codex files are drift and --write removes them; the project's own skills are left alone", (t) => {
  const { dir, invoke } = adapterInstall(t, "harness-stray-");
  assert.equal(invoke("--write", "--codex").status, 0);
  assert.equal(invoke().status, 0);
  // Leftovers in the generator's EXACT template for their names (a removed phase and agent).
  const skill = readFileSync(join(dir, ".agents/skills/analyze/SKILL.md"), "utf8").replaceAll("analyze", "deploy");
  const toml = readFileSync(join(dir, ".codex/agents/harness-reviewer.toml"), "utf8").replace('name = "harness-reviewer"', 'name = "harness-old-reviewer"');
  put(dir, ".agents/skills/deploy/SKILL.md", skill);
  put(dir, ".codex/agents/harness-old-reviewer.toml", toml);
  put(dir, ".agents/skills/my-own/SKILL.md", "---\nname: my-own\n---\nThe project's own skill.\n");
  // A hand-written skill that cites the adapter is still the project's own.
  put(dir, ".agents/skills/release-notes/SKILL.md", "---\nname: release-notes\n---\nFollow the tool mapping in `.harness/adapters/codex.md`, then write release notes.\n");
  put(dir, ".codex/agents/harness-custom.toml", 'name = "harness-custom"\ndescription = "hand-written"\n');
  const drift = invoke();
  assert.equal(drift.status, 1, drift.stdout + drift.stderr);
  assert.match(drift.stderr, /Adapter drift: \.codex\/agents\/harness-old-reviewer\.toml/);
  assert.match(drift.stderr, /Adapter drift: \.agents\/skills\/deploy\/SKILL\.md/);
  for (const own of ["my-own", "release-notes"]) {
    assert.doesNotMatch(drift.stderr, new RegExp(`Adapter drift: \\.agents/skills/${own}`));
    assert.match(drift.stderr, new RegExp(`\\.agents/skills/${own}/SKILL\\.md is not generated by the harness`));
  }
  assert.match(drift.stderr, /\.codex\/agents\/harness-custom\.toml is not generated by the harness/);
  assert.equal(invoke("--codex-only").status, 1, "--codex-only sees stale Codex files too");
  assert.equal(invoke("--write").status, 0);
  assert.equal(existsSync(join(dir, ".codex/agents/harness-old-reviewer.toml")), false);
  assert.equal(existsSync(join(dir, ".agents/skills/deploy")), false);
  for (const own of [".agents/skills/my-own/SKILL.md", ".agents/skills/release-notes/SKILL.md", ".codex/agents/harness-custom.toml"])
    assert.equal(existsSync(join(dir, own)), true, `never delete a file the harness did not generate: ${own}`);
  assert.equal(invoke().status, 0);
});

test("--write refuses a symlinked target or stale file before writing or deleting anything", (t) => {
  const { dir, invoke } = adapterInstall(t, "harness-symlink-write-");
  const outside = tempDir(t, "harness-outside-");
  assert.equal(invoke("--write", "--codex").status, 0);
  // A symlinked stale generated file: refused, the link and its target stay.
  const skill = readFileSync(join(dir, ".agents/skills/analyze/SKILL.md"), "utf8").replaceAll("analyze", "deploy");
  put(outside, "stale.md", skill);
  mkdirSync(join(dir, ".agents/skills/deploy"));
  symlinkSync(join(outside, "stale.md"), join(dir, ".agents/skills/deploy/SKILL.md"));
  const stray = invoke("--write");
  assert.equal(stray.status, 1, stray.stdout + stray.stderr);
  assert.match(stray.stderr, /Refusing to write through a symlink: \.agents\/skills\/deploy\/SKILL\.md/);
  assert.equal(readFileSync(join(outside, "stale.md"), "utf8"), skill);
  rmSync(join(dir, ".agents/skills/deploy"), { recursive: true });
  // A symlinked adapter file: refused up front, so an earlier drifted file is NOT rewritten either.
  put(outside, "analyze.md", "outside\n");
  const first = Object.keys(renderAdapters({ codex: true }))[0];
  put(dir, first, "drifted\n");
  rmSync(join(dir, ".claude/commands/analyze.md"));
  symlinkSync(join(outside, "analyze.md"), join(dir, ".claude/commands/analyze.md"));
  const linked = invoke("--write");
  assert.equal(linked.status, 1, linked.stdout + linked.stderr);
  assert.match(linked.stderr, /Refusing to write through a symlink: \.claude\/commands\/analyze\.md/);
  assert.equal(readFileSync(join(outside, "analyze.md"), "utf8"), "outside\n");
  assert.equal(readFileSync(join(dir, first), "utf8"), "drifted\n", "nothing is written once any target is refused");
});

test("--write never writes outside the repository: phase names are validated and symlinked directories refused", (t) => {
  const { dir, invoke } = adapterInstall(t, "harness-traverse-");
  const outside = tempDir(t, "harness-outside-");
  const manifestPath = join(dir, ".harness/manifest.json");
  const pristine = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(pristine);
  manifest.phases[`../../../..${outside}/escape`] = "escape";
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const traversal = invoke("--write");
  assert.equal(traversal.status, 1, traversal.stdout + traversal.stderr);
  assert.match(traversal.stderr, /Invalid phase/);
  assert.equal(existsSync(join(outside, "escape.md")), false);
  writeFileSync(manifestPath, pristine);
  mkdirSync(join(dir, ".claude"), { recursive: true });
  symlinkSync(outside, join(dir, ".claude/commands"));
  const linked = invoke("--write");
  assert.equal(linked.status, 1, linked.stdout + linked.stderr);
  assert.match(linked.stderr, /Refusing to write/);
  assert.equal(existsSync(join(outside, "analyze.md")), false, "nothing lands in the symlink target");
});

test("Codex reasoning effort outside the verified list is refused", (t) => {
  for (const effort of ["ultra", "max", "bogus"]) {
    const { dir, invoke } = adapterInstall(t, "harness-effort-");
    const manifest = JSON.parse(readFileSync(join(dir, ".harness/manifest.json"), "utf8"));
    manifest.codex.agents.reviewer.model_reasoning_effort = effort;
    writeFileSync(join(dir, ".harness/manifest.json"), JSON.stringify(manifest));
    const result = invoke("--write", "--codex-only");
    assert.equal(result.status, 1, effort);
    assert.match(result.stderr, /Invalid Codex agent settings: reviewer/, effort);
  }
});

// ---- browser-walk checker edge cases ----------------------------------------------------------

test("browser-walk checker: empty folder is UNRUN; fences, near-miss headings, hidden blocked walks and empty reasons fail", (t) => {
  const dir = tempDir(t, "harness-walk-edge-");
  const script = join(root, ".harness/bin/check-browser-walk-receipts.mjs");
  mkdirSync(join(dir, "empty"));
  const empty = node([script, join(dir, "empty")]);
  assert.equal(empty.status, 3, `an empty folder is not a pass: ${empty.stdout}`);
  assert.match(empty.stdout, /UNRUN/);
  const run = (name, text) => { put(dir, name, text); return node([script, join(dir, name)]); };
  const fields = "Steps: opened the page, saved\nObserved: saved row listed after reload\n";
  const honest = "# w01-01\n\n## Verification\n\nBrowser walk: not applicable — command-line tool, no screen.\n";
  assert.equal(run("honest.md", honest).status, 0, "control: an honest declaration passes");
  const cases = {
    "fenced.md": "# w01-02\n\n## Verification\n\n```md\nBrowser walk: not applicable — example only\n```\n",
    "near-miss.md": "# w01-03\n\n## Verification notes (planned)\n\nBrowser walk: not applicable — later\n",
    "two-sections.md": `${honest}\n## Verification\n\n### Browser walk receipt\n\n${fields}Disposition: blocked — save does nothing\n`,
    "later-blocked.md": `# w01-04\n\n## Verification\n\n### Browser walk receipt\n\n${fields}Disposition: proceed\n\n### Browser walk receipt\n\n${fields}Disposition: confused — no feedback\n`,
    "dot-reason.md": "# w01-05\n\n## Verification\n\nBrowser walk: not applicable — .\n",
    "one-word-reason.md": "# w01-06\n\n## Verification\n\nBrowser walk: not applicable — the\n",
    "indented-code.md": "# w01-07\n\n## Verification\n\n    Browser walk: not applicable — example inside an indented code block\n",
    // A fence closes only on the same character with at least the opening length.
    "fence-shorter-close.md": "# w01-08\n\n## Verification\n\n````md\n```\nBrowser walk: not applicable — still inside the outer example\n````\n",
    "fence-other-char.md": "# w01-09\n\n## Verification\n\n```md\n~~~\nBrowser walk: not applicable — still inside the backtick example\n```\n",
  };
  for (const [name, text] of Object.entries(cases)) {
    const result = run(name, text);
    assert.equal(result.status, 1, `${name}: ${result.stdout}`);
  }
});

// ---- security surface ------------------------------------------------------------------------

test("security surface is inclusion by default: only bookkeeping, runtime state and plain docs are excluded", () => {
  for (const path of [
    "middleware.ts", "prisma/schema.prisma", "supabase/migrations/001_policies.sql", "migrations/0005_drop_row_security.sql",
    "pages/api/admin.ts", "routes/admin.py", "config/cors.ts", "next.config.js", ".gitignore", "deploy/deployment-config.md",
    "infra/main.tf", ".env.example", "Dockerfile.prod", "public/logo.svg", "requirements-dev.txt", ".harness/guides/x.md",
    // A bookkeeping NAME outside the bookkeeping LOCATIONS is ordinary code.
    "src/.session-notes.ts", "src/auth/.session-notes.d/x.ts", "src/.wave-tracker.d/x.ts",
    // Letter case: a case-insensitive checkout loads these as the real instruction files.
    ".Claude/rules/evil.md", ".HARNESS/rules/x.md", "CLAUDE.MD", "agents.md", "Agents.md", "Deploy/deployment-config.md",
    // Exclusions go by file type, not by name or folder alone.
    "README.sh", "LICENSE.js", ".session-notes.d/x.js", ".wave-tracker.d/run.sh", "workspaces/p/journal/hook.js",
    "workspaces/p/04-validate/evil.ts", "src/allowlist.txt", "config/allowed-hosts.txt",
  ]) assert.equal(isSecuritySurface(path), true, path);
  for (const path of [
    "README.md", "LICENSE", "CHANGELOG.md", "docs/guide.md", "docs/diagram.png", "workspaces/demo/specs/overview.md",
    "workspaces/demo/04-validate/round-w01-1.json", "workspaces/demo/todos/completed/w01-01-x.md", ".session-notes",
    ".claude/learning/redteam-stall-state.json", "README", "Readme.md", "workspaces/demo/todos/active/.gitkeep",
    "workspaces/demo/04-validate/convergence-w01.launches.jsonl",
  ]) assert.equal(isSecuritySurface(path), false, path);
});

// ---- identity denylist -----------------------------------------------------------------------

test("one identity denylist refuses agent, model, role and harness names, and accepts a person's name", () => {
  for (const v of ["codex", "Codex agent", "Claude Opus", "gpt-6-sol", "gemini", "copilot", "reviewer", "security-reviewer",
    "harness-reviewer", "harness-anything", "implementer", "build-fix", "independent planning reviewer", "N/A", "user", ""]) {
    assert.equal(isAgentIdentity(v), true, v);
  }
  // Normalised before matching: lookalike letters, invisible characters, spacing, versions, vendors, roles.
  for (const v of ["Ｃｌａｕｄｅ", "Сlaude", "Cl\u200Baude", "C l a u d e", "claudeopus", "ClaudeCode", "GPT5", "GPT4o", "Sonnet4",
    "opus4.5", "o3", "Claude3", "Codex1", "ChatGPT", "OpenAI", "Anthropic", "noreply@anthropic.com", "dependabot[bot]",
    "reviewers", "reviewer2", "re\u200Bviewer", "noreply@example.com", "The user, via chat", "User (chat approval)", "Project owner", "requesting user", "the  user",
    "owner.", "me.", "I", "myself", "operator", "maintainer", "admin", "system"]) {
    assert.equal(isAgentIdentity(v), true, v);
  }
  // Whole values only: placeholders, lenses, pronouns, leetspeak, small capitals and more tools.
  for (const v of ["<the user's name>", "<name>", "{approver}", "[name]", "pending", "approver", "the approver", "you", "yourself",
    "correctness", "security", "security-debug", "Cl4ude", "ᴄʟᴀᴜᴅᴇ", "Ꮯlaude", "Cursor", "Devin", "Qwen", "User's approval",
    "Approved by user on 2026-10-07", "User via chat 2026-10-07", "user (yes)", "Owner: yes", "user 1", "owner, verbally",
    "Claude 3.5 Sonnet", "gpt-4o", "co-authored", "TBD", "C0dex Agent", "Approved by Jane Doe", "User (Jane Doe)"]) {
    assert.equal(isAgentIdentity(v), true, v);
  }
  // Real names that merely contain such a word pass.
  for (const v of ["Jane Doe", "Fixture Owner", "Fixture Owner (synthetic)", "Wai Luen", "Jane, owner", "Сергей Иванов",
    "Claude Monet", "Jean-Claude", "Claudette", "Tan Ai Ling", "Will Self", "Laurie Main", "Wim Bot", "Madison Nettles",
    "Eric Laudet", "王伟", "Siobhán O'Brien", "Mark Model"])
    assert.equal(isAgentIdentity(v), false, v);
});

test("the delivery-contract example in task-delivery.md, copied verbatim, is not ready until a real name is filled in", (t) => {
  const text = readFileSync(join(root, ".harness/guides/task-delivery.md"), "utf8");
  const example = text.slice(text.indexOf('"approved_by": "<the user\'s name>"') - 2000).match(/```json\n(\{[\s\S]*?"approved_by": "<the user's name>"[\s\S]*?\})\n```/);
  assert.ok(example, "task-delivery.md still carries the placeholder contract example");
  const dir = tempDir(t, "harness-contract-example-");
  const run = (json) => {
    put(dir, "todo.md", "# t\n\n## Delivery contract\n\n```json\n" + json + "\n```\n");
    return node([join(root, ".harness/bin/check-task-contract.mjs"), join(dir, "todo.md")]);
  };
  const verbatim = run(example[1]);
  assert.equal(verbatim.status, 1, verbatim.stdout);
  assert.match(verbatim.stdout, /approved_by must name the person/);
  assert.equal(run(example[1].replace("<the user's name>", "Jane Doe")).status, 0, "control: the example with a real name passes");
});

test("a delivery contract approved by an agent is not ready", (t) => {
  const dir = tempDir(t, "harness-contract-identity-");
  const contract = (approved_by) => ({
    approved_by, owned_paths: ["src/x.mjs"], acceptance: [{ id: "A1", scenario: "s", verify: "v" }], interfaces: ["x()"],
    dependencies: [], boundaries: { trusted: ["t"], untrusted: ["u"], excluded: ["e"] }, integration: "real",
    test_environment: { isolation: "none", command: "node x", ordinary_failures: ["f"] }, open_questions: [],
  });
  const check = (who) => {
    put(dir, "todo.md", "# t\n\n## Delivery contract\n\n```json\n" + JSON.stringify(contract(who)) + "\n```\n");
    return node([join(root, ".harness/bin/check-task-contract.mjs"), join(dir, "todo.md")]);
  };
  assert.equal(check("Jane Doe").status, 0, "control: a person's name is accepted");
  const pre = (who) => {
    put(dir, "todo.md", "# t\n\n## Delivery contract\n\n```json\n" + JSON.stringify(contract(who)) + "\n```\n");
    return node([join(root, ".harness/bin/check-task-contract.mjs"), "--pre-approval", join(dir, "todo.md")]);
  };
  assert.equal(pre("").status, 0, "before approval an empty approved_by is the only correct state");
  const early = pre("Jane Doe");
  assert.equal(early.status, 1, "an approval written before the user approved is refused");
  assert.match(early.stdout, /approved_by must stay empty until the user approves the plan/);
  assert.equal(check("").status, 1, "after approval the name is required");
  for (const who of ["codex", "harness-todo-manager", "independent planning reviewer or user"]) {
    const result = check(who);
    assert.equal(result.status, 1, who);
    assert.match(result.stdout, /approved_by must name the person/, who);
  }
});

// ---- round budget (pure) ---------------------------------------------------------------------

const H1 = "1".repeat(40), H2 = "2".repeat(40), H3 = "3".repeat(40);
function round(n, verdicts, extra = {}) {
  const ids = extra.ids ?? ["correctness", "security"];
  const reviewers = ids.map((id, i) => ({ id, verdict: verdicts[i] ?? verdicts[0], evidence: `r${n}-${id}.md` }));
  const clean = reviewers.every((r) => r.verdict === "CLEAR");
  const notClear = reviewers.some((r) => r.verdict === "NOT_CLEAR");
  const { ids: _ids, ...rest } = extra;
  return { branch: "feat/w01", round: n, head: H1, expected_reviewers: ids, reviewers,
    root_causes: notClear ? [`key-${n}`] : [], ...rest, ...(clean ? { root_causes: [] } : {}) };
}
function play(rounds) {
  let state; const out = [];
  for (const r of rounds) { const o = stall.advanceRound(state, r); state = o.nextState; out.push(o); }
  return { state, out };
}

test("three-round cap: the third non-clear round owes the debug round, then a named human", () => {
  const { state, out } = play([1, 2, 3].map((n) => round(n, ["NOT_CLEAR"], { head: [H1, H2, H3][n - 1] })));
  assert.deepEqual(out.map((o) => o.action), ["FIX", "FIX", "DEBUG_ROUND"]);
  assert.throws(() => stall.advanceRound(state, round(4, ["NOT_CLEAR"])), (e) => e.code === "DEBUG_ROUND");
  assert.throws(() => stall.advanceRound(state, round(4, ["NOT_CLEAR"], { debug: true, replan: "d1.md" })),
    /never used on this branch/, "the debug round needs fresh lenses");
  const debug = stall.advanceRound(state, round(4, ["NOT_CLEAR"], { debug: true, replan: "d1.md", ids: ["debug-correctness"] }));
  assert.equal(debug.action, "ESCALATE_TO_HUMAN");
  const next = round(5, ["NOT_CLEAR"], { ids: ["debug-correctness"] });
  assert.throws(() => stall.advanceRound(debug.nextState, next), (e) => e.code === "ESCALATE_TO_HUMAN");
  assert.throws(() => stall.advanceRound(debug.nextState, { ...next, escalation_accepts: { acceptor: "codex", record: "a5.md" } }),
    /must be a named human/, "an agent cannot accept the escalation");
  const accepted = stall.advanceRound(debug.nextState, { ...next, escalation_accepts: { acceptor: "Jane Doe", record: "a5.md" } });
  assert.equal(accepted.nextState.roundsRecorded, 5);
});

test("replan_accepts, like escalation_accepts, must name a person", () => {
  const r2 = (acceptor) => round(2, ["NOT_CLEAR"], { head: H2, root_causes: ["lost-update"], replan: "d2.md",
    replan_accepts: [{ key: "lost-update", acceptor }] });
  const first = stall.advanceRound(undefined, round(1, ["NOT_CLEAR"], { root_causes: ["lost-update"] }));
  assert.throws(() => stall.advanceRound(first.nextState, r2("claude")), /replan_accepts acceptor must be a named human/);
  assert.throws(() => stall.advanceRound(first.nextState, r2("security")), /replan_accepts acceptor must be a named human/);
  assert.equal(stall.advanceRound(first.nextState, r2("Jane Doe")).nextState.lastRound, 2);
});

test("recurrence fires REPLAN for a repeated root cause, even across a clean round", () => {
  const twice = play([round(1, ["NOT_CLEAR"], { root_causes: ["lost-update"] }),
    round(2, ["NOT_CLEAR"], { head: H2, root_causes: ["lost-update"] })]);
  assert.equal(twice.out[1].action, "REPLAN");
  const across = play([round(1, ["NOT_CLEAR"], { root_causes: ["lost-update"] }), round(2, ["CLEAR"], { head: H2 }),
    round(3, ["NOT_CLEAR"], { head: H3, root_causes: ["lost-update"] })]);
  assert.equal(across.state.replanRequired, true, "a clean round in between does not reset recurrence");
  const fresh = play([round(1, ["NOT_CLEAR"], { root_causes: ["lost-update"] }),
    round(2, ["NOT_CLEAR"], { head: H2, root_causes: ["other-cause"] })]);
  assert.equal(fresh.out[1].action, "FIX", "control: a new root cause does not fire");
});

test("four non-clear rounds since the last decision record require REPLAN, even on human-accepted rounds", () => {
  let { state } = play([1, 2, 3].map((n) => round(n, ["NOT_CLEAR"], { head: [H1, H2, H3][n - 1] })));
  const ids = ["debug-correctness"];
  state = stall.advanceRound(state, round(4, ["NOT_CLEAR"], { debug: true, replan: "d4.md", ids })).nextState;
  const acceptedRound = (n) => round(n, ["NOT_CLEAR"], { ids, escalation_accepts: { acceptor: "Jane Doe", record: `a${n}.md` } });
  for (const n of [5, 6]) state = stall.advanceRound(state, acceptedRound(n)).nextState;
  assert.equal(state.replanRequired, false, "three non-clear rounds since the decision record: not yet");
  state = stall.advanceRound(state, acceptedRound(7)).nextState;
  assert.equal(state.replanRequired, true, "the fourth fires");
  assert.throws(() => stall.advanceRound(state, acceptedRound(8)), (e) => e.code === "REPLAN");
});

test("partial rounds, gaps and an unchanged-head confirmation are judged exactly", () => {
  const partial = round(1, ["CLEAR"]);
  partial.reviewers = partial.reviewers.slice(0, 1);
  assert.throws(() => stall.advanceRound(undefined, partial), /partial rounds cannot count/);
  const first = stall.advanceRound(undefined, round(1, ["CLEAR"]));
  assert.throws(() => stall.advanceRound(first.nextState, round(3, ["CLEAR"])), /without gaps/);
  assert.equal(stall.advanceRound(first.nextState, round(2, ["CLEAR"])).action, "VERIFY_CONVERGENCE_RECEIPT");
  const moved = stall.advanceRound(first.nextState, round(2, ["CLEAR"], { head: H2 }));
  assert.equal(moved.action, "REVIEW", "a moved head restarts the clean count");
  const errors = play([round(1, ["ERROR"]), round(2, ["ERROR"]), round(3, ["ERROR"])]);
  assert.deepEqual(errors.out.map((o) => o.nextState.roundsRecorded), [0, 0, 1], "two free errored re-runs, the third is charged");
});

// ---- recorder CLI in a real repository -------------------------------------------------------

function recorderRepo(t, { ws = "workspaces/demo" } = {}) {
  const repo = tempDir(t, "harness-recorder-");
  git(repo, "init", "-q", "-b", "main");
  put(repo, ".gitignore", ".claude/learning/\n");
  git(repo, "add", "-A"); git(repo, "commit", "-qm", "base");
  git(repo, "checkout", "-qb", "feat/w01");
  const heads = [];
  for (let n = 1; n <= 4; n++) {
    put(repo, `src/v${n}.txt`, `${n}\n`);
    for (const id of ["correctness", "security"]) put(repo, `${ws}/04-validate/w01-${id}-r${n}.md`, "Verdict: NOT_CLEAR\n");
    git(repo, "add", "-A"); git(repo, "commit", "-qm", `work ${n}`);
    heads.push(git(repo, "rev-parse", "HEAD"));
  }
  // `scope` names the record file (round-<scope>-<n>.json); the recorder counts by scope or branch.
  const record = (n, verdict, extra = {}, scope = "w01") => {
    const file = `${ws}/04-validate/round-${scope}-${n}.json`;
    const reviewers = ["correctness", "security"].map((id) => ({ id, verdict, evidence: `${ws}/04-validate/w01-${id}-r${n}.md` }));
    put(repo, file, JSON.stringify({ branch: "feat/w01", round: n, head: heads[n - 1], expected_reviewers: ["correctness", "security"],
      reviewers, root_causes: verdict === "NOT_CLEAR" ? [`cause-${n}`] : [], ...extra }));
    return node([join(root, ".harness/bin/record-review-round.mjs"), file], { cwd: repo });
  };
  return { repo, heads, record };
}

test("recorder exit codes: refused branch/head is 1, DEBUG_ROUND is 2, VERIFY_CONVERGENCE_RECEIPT is 0", (t) => {
  const { repo, heads, record } = recorderRepo(t);
  const wrongBranch = record(1, "CLEAR", { branch: "feat/renamed" });
  assert.equal(wrongBranch.status, 1, wrongBranch.stdout);
  assert.match(wrongBranch.stderr, /not a branch of this repository/);
  git(repo, "branch", "other", "main");
  const offBranch = record(1, "CLEAR", { branch: "other" });
  assert.equal(offBranch.status, 1, offBranch.stdout);
  assert.match(offBranch.stderr, /is not a commit on branch other/);
  const first = record(1, "CLEAR");
  assert.equal(first.status, 0, first.stderr);
  const second = record(2, "CLEAR", { head: heads[0] });
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /VERIFY_CONVERGENCE_RECEIPT/);
});

test("a deleted state file or a fresh clone rebuilds the spent budget from committed round records", (t) => {
  const { repo, record } = recorderRepo(t);
  for (const n of [1, 2]) { assert.equal(record(n, "NOT_CLEAR").status, 0); }
  const third = record(3, "NOT_CLEAR");
  assert.equal(third.status, 2, third.stdout + third.stderr);
  git(repo, "add", "-A"); git(repo, "commit", "-qm", "round records");
  rmSync(join(repo, ".claude/learning/redteam-stall-state.json"));
  const fourth = record(4, "NOT_CLEAR");
  assert.equal(fourth.status, 2, `the cap still holds after the state file is deleted: ${fourth.stdout}${fourth.stderr}`);
  assert.match(fourth.stderr, /single debug round/);
  // No state and no committed history: a later round is refused, never counted as a first round.
  const bare = recorderRepo(t);
  const orphan = bare.record(3, "NOT_CLEAR");
  assert.equal(orphan.status, 1, orphan.stdout + orphan.stderr);
  assert.match(orphan.stderr, /hold no rounds, so the first round is 1/);
});

test("deleting, editing or re-adding committed round records, or renaming the branch, never resets the budget", (t) => {
  const state = (repo) => join(repo, ".claude/learning/redteam-stall-state.json");
  const capped = () => {
    const fx = recorderRepo(t);
    for (const n of [1, 2]) assert.equal(fx.record(n, "NOT_CLEAR").status, 0);
    assert.equal(fx.record(3, "NOT_CLEAR").status, 2);
    git(fx.repo, "add", "-A"); git(fx.repo, "commit", "-qm", "round records");
    return fx;
  };
  // Deleted at the tip: the records as first added still count.
  const deleted = capped();
  git(deleted.repo, "rm", "-q", "-r", "workspaces/demo/04-validate/round-w01-1.json", "workspaces/demo/04-validate/round-w01-2.json",
    "workspaces/demo/04-validate/round-w01-3.json");
  git(deleted.repo, "commit", "-qm", "tidy");
  rmSync(state(deleted.repo));
  const restart = deleted.record(1, "NOT_CLEAR");
  assert.equal(restart.status, 1, restart.stdout + restart.stderr);
  assert.match(restart.stderr, /already hold rounds 1-3/);
  // Edited later (branch renamed in the record, JSON broken): the first-added content counts.
  const edited = capped();
  for (const n of [1, 2, 3]) put(edited.repo, `workspaces/demo/04-validate/round-w01-${n}.json`, '{"branch":"decoy"} //');
  git(edited.repo, "add", "-A"); git(edited.repo, "commit", "-qm", "edit");
  rmSync(state(edited.repo));
  const fourth = edited.record(4, "NOT_CLEAR");
  assert.equal(fourth.status, 2, fourth.stdout + fourth.stderr);
  assert.match(fourth.stderr, /single debug round/);
  // A new branch name at the same history inherits the spent rounds.
  git(edited.repo, "branch", "feat/w01-v2");
  const renamed = edited.record(1, "NOT_CLEAR", { branch: "feat/w01-v2" });
  assert.equal(renamed.status, 1, renamed.stdout + renamed.stderr);
  assert.match(renamed.stderr, /already hold rounds 1-3/);
});

test("rebuilding fails closed on a malformed record or two different records for one round", (t) => {
  const malformed = recorderRepo(t);
  assert.equal(malformed.record(1, "NOT_CLEAR").status, 0);
  put(malformed.repo, "workspaces/demo/04-validate/round-w01-5.json", "{");
  git(malformed.repo, "add", "-A"); git(malformed.repo, "commit", "-qm", "records");
  rmSync(join(malformed.repo, ".claude/learning/redteam-stall-state.json"));
  const broken = malformed.record(2, "NOT_CLEAR");
  assert.equal(broken.status, 1, broken.stdout + broken.stderr);
  assert.match(broken.stderr, /round-w01-5\.json as added in [0-9a-f]{12} is not a complete round record/);
  const dupe = recorderRepo(t);
  assert.equal(dupe.record(1, "NOT_CLEAR").status, 0);
  git(dupe.repo, "add", "-A"); git(dupe.repo, "commit", "-qm", "round 1");
  put(dupe.repo, "workspaces/demo/04-validate/round-w01b-1.json", JSON.stringify({ ...JSON.parse(readFileSync(join(dupe.repo,
    "workspaces/demo/04-validate/round-w01-1.json"), "utf8")), reviewers: ["correctness", "security"].map((id) => ({ id, verdict: "CLEAR",
    evidence: `workspaces/demo/04-validate/w01-${id}-r1.md` })), root_causes: [] }));
  git(dupe.repo, "add", "-A"); git(dupe.repo, "commit", "-qm", "second record for round 1");
  rmSync(join(dupe.repo, ".claude/learning/redteam-stall-state.json"));
  const twice = dupe.record(2, "NOT_CLEAR");
  assert.equal(twice.status, 1, twice.stdout + twice.stderr);
  assert.match(twice.stderr, /two different committed records claim round 1/);
});

test("a branch that exists only on a remote gets a create-it-locally message", (t) => {
  const { repo, heads, record } = recorderRepo(t);
  git(repo, "update-ref", "refs/remotes/origin/feat/remote-only", heads[0]);
  const result = record(1, "CLEAR", { branch: "feat/remote-only" });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /exists only as origin\/feat\/remote-only; create the local branch first/);
});

// ---- convergence receipt: identities, security lens, evidence and round records -------------

// A converged wave w01 on branch feat/w01: two clean rounds, both lenses, receipt committed.
// `tweak` edits the receipt / records / files just before the receipt commit.
function wave(t, tweak = () => {}, { securityAgent = "harness-security-reviewer", lenses = ["correctness", "security"], preRounds = 0,
  preBranch, after, ws = "workspaces/demo", firstN } = {}) {
  const dir = tempDir(t, "harness-wave-"), branch = "feat/w01";
  git(dir, "init", "-q", "-b", "main");
  put(dir, ".gitignore", ".claude/learning/\n");
  put(dir, `${ws}/04-validate/acceptance-w01.md`, "# Acceptance w01\nw01-01 A1: echo returns its input. Approved by Fixture Owner (synthetic).\n");
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "acceptance");
  const base = git(dir, "rev-parse", "HEAD");
  git(dir, "checkout", "-qb", branch);
  put(dir, "src/echo.mjs", "export const echo = (v) => v;\n");
  put(dir, `${ws}/todos/completed/w01-01-echo.md`, "# w01-01\n\n## Verification\n\nBrowser walk: not applicable — command-line fixture.\n");
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "work");
  const head = git(dir, "rev-parse", "HEAD");
  const receipt = { ...template("w01"), project: "demo", branch, wave_base: base, verdict_head: head,
    verdict_at: "2026-10-07T02:00:00Z", todos: ["todos/completed/w01-01-echo.md"],
    acceptance_list: { path: "04-validate/acceptance-w01.md", ratified_by: "Fixture Owner" },
    journal: "journal/0001-DECISION-w01.md", rounds: [] };
  const launches = [];
  // Earlier NOT_CLEAR rounds on the branch, honestly recorded (distinct heads and root causes).
  for (let k = 1; k <= preRounds; k++) {
    for (const lens of lenses) put(dir, `${ws}/04-validate/w01-${lens}-r${k}.md`, "Synthetic fixture report.\nVerdict: NOT_CLEAR\n");
    put(dir, `${ws}/04-validate/round-w01-${k}.json`, JSON.stringify({ branch: preBranch ?? branch, round: k, head: String(k).repeat(40), expected_reviewers: lenses,
      reviewers: lenses.map((id) => ({ id, verdict: "NOT_CLEAR", evidence: `${ws}/04-validate/w01-${id}-r${k}.md` })), root_causes: [`cause-${k}`] }));
    git(dir, "add", "-A"); git(dir, "commit", "-qm", `earlier round ${k}`);
  }
  const first = firstN ?? preRounds + 1;
  for (let n = first; n <= first + 1; n++) {
    const reviewers = lenses.map((lens) => {
      const agent = /^security/.test(lens) ? securityAgent : "harness-reviewer";
      const launch_id = `fixture-${n}-${lens}`;
      launches.push({ kind: "launch", launch_id, subagent_type: agent, ts: "2026-10-07T01:00:00Z" });
      const evidence = `${ws}/04-validate/w01-${lens}-r${n}.md`;
      put(dir, evidence, `Synthetic fixture report.\nVerdict: CLEAR\nCommit: ${head}\n`);
      return { agent, lens, ran: true, evidence, launch_id };
    });
    put(dir, `${ws}/04-validate/round-w01-${n}.json`, JSON.stringify({ branch, round: n, head, expected_reviewers: lenses,
      reviewers: reviewers.map((r) => ({ id: r.lens, verdict: "CLEAR", evidence: r.evidence })), root_causes: [] }));
    put(dir, `${ws}/${receipt.launches}`, launches.map((x) => JSON.stringify(x)).join("\n") + "\n");
    git(dir, "add", "-A"); git(dir, "commit", "-qm", `dispatch ${n}`);
    receipt.rounds.push({ n, head, clean: true, new_gating_findings: 0, reviewers });
  }
  put(dir, `${ws}/${receipt.journal}`, "# w01 converged (synthetic fixture)\n");
  tweak({ dir, ws, receipt, head, put: (p, c) => put(dir, p, c), rm: (p) => unlinkSync(join(dir, p)) });
  put(dir, `${ws}/04-validate/convergence-w01.json`, JSON.stringify(receipt));
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "receipt");
  if (after) { after({ dir, ws, head, receipt, put: (p, c) => put(dir, p, c) }); }
  const check = (...args) => node([join(root, ".harness/bin/check-redteam-convergence-receipt.mjs"), "--workspace", resolve(dir, ws), ...args], { cwd: dir });
  return Object.assign(check("--scope", "w01"), { dir, ws, branch, receipt, check });
}

test("convergence receipt control: the honest fixture converges", (t) => {
  const ok = wave(t);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
});

test("a debug-round security lens (security-debug) satisfies the security lens", (t) => {
  const debug = wave(t, () => {}, { lenses: ["correctness-debug", "security-debug"] });
  assert.equal(debug.status, 0, debug.stdout + debug.stderr);
  const other = wave(t, () => {}, { lenses: ["correctness-debug", "style-debug"] });
  assert.equal(other.status, 1, "control: a non-security lens does not satisfy it");
  assert.match(other.stdout, /security-lens-missing/);
});

test("the cap is worked out from the committed round records, and copied records are refused", (t) => {
  const within = wave(t, () => {}, { preRounds: 1 });
  assert.equal(within.status, 0, `control: one earlier NOT_CLEAR round is within the cap: ${within.stdout}`);
  const blown = wave(t, () => {}, { preRounds: 4 });
  assert.equal(blown.status, 1, blown.stdout);
  assert.match(blown.stdout, /cap-hit-understated/);
  const copied = wave(t, ({ ws, dir, put: p }) => {
    p(`${ws}/04-validate/round-w01b-1.json`, readFileSync(join(dir, `${ws}/04-validate/round-w01-1.json`), "utf8"));
  });
  assert.equal(copied.status, 1, copied.stdout);
  assert.match(copied.stdout, /round-records-invalid — round 1 of feat\/w01 is recorded twice/);
});

test("--scope refuses a round recorded after the receipt, and a journal that only names a longer scope", (t) => {
  const later = wave(t, () => {}, { after: ({ dir, ws, head, put: p }) => {
    p(`${ws}/04-validate/round-w01-3.json`, JSON.stringify({ branch: "feat/w01", round: 3, head, expected_reviewers: ["correctness"],
      reviewers: [{ id: "correctness", verdict: "NOT_CLEAR", evidence: `${ws}/04-validate/w01-correctness-r2.md` }], root_causes: ["x"] }));
    git(dir, "add", "-A"); git(dir, "commit", "-qm", "a later review");
  } });
  assert.equal(later.status, 1, later.stdout);
  assert.match(later.stdout, /round-record-after-receipt — .*round-w01-3\.json was first committed in [0-9a-f]{12}, after the receipt/);
  const journal = wave(t, ({ ws, put: p }) => { p(`${ws}/journal/0001-DECISION-w01.md`, "# w010 notes\n"); });
  assert.equal(journal.status, 1, journal.stdout);
  assert.match(journal.stdout, /journal-does-not-cite-scope/);
});

test("convergence receipt refuses agent identities as acceptors and a relabelled security lens", (t) => {
  for (const who of ["codex", "security-reviewer", "harness-reviewer", "independent planning reviewer"]) {
    const result = wave(t, ({ receipt }) => { receipt.acceptance_list.ratified_by = who; });
    assert.equal(result.status, 1, who);
    assert.match(result.stdout, /acceptance-self-authored/, who);
  }
  const residual = wave(t, ({ receipt }) => {
    receipt.residuals = [{ finding: "x", category: "INCREMENTAL", accepted_by: "harness-security-reviewer", blocking_safety_note: "n",
      value_anchor: "v", full_fix_criteria: "c", revisit_trigger: "r", backstop: "2026-12-31" }];
  });
  assert.equal(residual.status, 1);
  assert.match(residual.stdout, /residual-unaccepted/);
  const relabelled = wave(t, () => {}, { securityAgent: "harness-reviewer" });
  assert.equal(relabelled.status, 1, relabelled.stdout);
  assert.match(relabelled.stdout, /security-lens-not-specialist/);
});

test("convergence receipt ties every round to a saved report and a matching committed round record", (t) => {
  const cases = [
    ["free-text evidence", ({ receipt }) => { receipt.rounds[1].reviewers[0].evidence = "trust me"; }, /reviewer-evidence-not-a-report/],
    ["evidence never saved", ({ receipt, ws }) => { receipt.rounds[1].reviewers[0].evidence = `${ws}/04-validate/w01-correctness-r9.md`; }, /reviewer-evidence-missing/],
    ["evidence is a directory", ({ ws, receipt, put: p }) => {
      p(`${ws}/04-validate/reports/w01-correctness-r2.md`, "Verdict: CLEAR\n");
      receipt.rounds[1].reviewers[0].evidence = `${ws}/04-validate/reports`;
    }, /reviewer-evidence-missing/],
    ["evidence saved empty", ({ ws, put: p }) => { p(`${ws}/04-validate/w01-security-r2.md`, ""); }, /reviewer-evidence-missing/],
    ["round record missing", ({ ws, rm }) => { rm(`${ws}/04-validate/round-w01-1.json`); }, /round-record-missing/],
    ["record says NOT_CLEAR", ({ ws, put: p, head }) => {
      p(`${ws}/04-validate/round-w01-2.json`, JSON.stringify({ branch: "feat/w01", round: 2, head, expected_reviewers: ["correctness", "security"],
        reviewers: [{ id: "correctness", verdict: "NOT_CLEAR", evidence: `${ws}/04-validate/w01-correctness-r2.md` },
          { id: "security", verdict: "CLEAR", evidence: `${ws}/04-validate/w01-security-r2.md` }], root_causes: ["x"] }));
    }, /round-record-mismatch/],
    ...[
      ["record head differs", (rec, receipt) => { rec.head = receipt.wave_base; }],
      ["record lists an extra lens", (rec) => { rec.expected_reviewers.push("performance"); }],
      ["record cites another report", (rec, receipt, ws) => { rec.reviewers[0].evidence = `${ws}/04-validate/w01-correctness-r1.md`; }],
      ["record's round number differs", (rec) => { rec.round = 3; }],
      ["record names another branch", (rec) => { rec.branch = "elsewhere"; }],
    ].map(([label, edit]) => [label, ({ ws, receipt, dir, put: p }) => {
      const file = `${ws}/04-validate/round-w01-2.json`;
      const rec = JSON.parse(readFileSync(join(dir, file), "utf8"));
      edit(rec, receipt, ws);
      p(file, JSON.stringify(rec));
    }, /round-record-mismatch/]),
    ["later round left out", ({ ws, put: p, head }) => {
      p(`${ws}/04-validate/round-w01-3.json`, JSON.stringify({ branch: "feat/w01", round: 3, head, expected_reviewers: ["correctness"],
        reviewers: [{ id: "correctness", verdict: "NOT_CLEAR", evidence: `${ws}/04-validate/w01-correctness-r2.md` }], root_causes: ["x"] }));
    }, /round-record-after-receipt/],
  ];
  for (const [label, tweak, expected] of cases) {
    const result = wave(t, tweak);
    assert.equal(result.status, 1, `${label}: ${result.stdout}`);
    assert.match(result.stdout, expected, label);
  }
});

// ---- round 3: counting by scope or branch, receipt pin, non-ASCII paths, codify allowlist -------

test("after one CLEAR round the recorder says only a standard-mode wave needs a second clean round", (t) => {
  const { record } = recorderRepo(t);
  const first = record(1, "CLEAR");
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Only a standard-mode wave convergence \(\/redteam, scope wNN\) needs this second clean round/);
  assert.match(first.stdout, /a light-mode wave, a todo checkpoint, a \/fix branch, a planning review, an analysis review or a codify review is done after one complete CLEAR round/);
});

test("the rebuilt count follows the scope or the branch: a todo branch cut from a wave branch starts at round 1", (t) => {
  const fx = recorderRepo(t);
  for (const n of [1, 2]) assert.equal(fx.record(n, "NOT_CLEAR").status, 0);
  git(fx.repo, "add", "-A"); git(fx.repo, "commit", "-qm", "wave rounds");
  git(fx.repo, "checkout", "-qb", "fix/w01-01");
  rmSync(join(fx.repo, ".claude/learning/redteam-stall-state.json"));
  const todo = fx.record(1, "NOT_CLEAR", { branch: "fix/w01-01" }, "w01-01");
  assert.equal(todo.status, 0, `another scope on another branch does not inherit: ${todo.stdout}${todo.stderr}`);
  rmSync(join(fx.repo, ".claude/learning/redteam-stall-state.json"));
  const sameScope = fx.record(1, "NOT_CLEAR", { branch: "fix/w01-01" }, "w01");
  assert.equal(sameScope.status, 1, "the same scope on a new branch does inherit");
  assert.match(sameScope.stderr, /already hold rounds 1-2/);
});

test("a light-mode wave round must include a security reviewer", (t) => {
  const fx = recorderRepo(t);
  put(fx.repo, ".harness/guides/project-profile.md", "| Key | Value |\n| --- | --- |\n| `delivery_mode` | `light` | light |\n");
  const noSecurity = fx.record(1, "CLEAR", { expected_reviewers: ["correctness"], reviewers: [{ id: "correctness", verdict: "CLEAR", evidence: "workspaces/demo/04-validate/w01-correctness-r1.md" }] });
  assert.equal(noSecurity.status, 1, noSecurity.stdout + noSecurity.stderr);
  assert.match(noSecurity.stderr, /light-mode wave round always includes a security reviewer/);
  const withSecurity = fx.record(1, "CLEAR");
  assert.equal(withSecurity.status, 0, withSecurity.stdout + withSecurity.stderr);
});

test("a rebuilt count must start at round 1", (t) => {
  const fx = recorderRepo(t);
  assert.equal(fx.record(1, "NOT_CLEAR").status, 0);
  assert.equal(fx.record(2, "NOT_CLEAR").status, 0);
  rmSync(join(fx.repo, "workspaces/demo/04-validate/round-w01-1.json"));
  git(fx.repo, "add", "-A"); git(fx.repo, "commit", "-qm", "only round 2 committed");
  rmSync(join(fx.repo, ".claude/learning/redteam-stall-state.json"));
  const third = fx.record(3, "NOT_CLEAR");
  assert.equal(third.status, 1, third.stdout + third.stderr);
  assert.match(third.stderr, /the earliest committed record is round 2, not round 1/);
});

test("a non-ASCII workspace name: the rebuild still finds the records and an honest receipt converges", (t) => {
  const fx = recorderRepo(t, { ws: "workspaces/café" });
  for (const n of [1, 2]) assert.equal(fx.record(n, "NOT_CLEAR").status, 0);
  assert.equal(fx.record(3, "NOT_CLEAR").status, 2);
  git(fx.repo, "add", "-A"); git(fx.repo, "commit", "-qm", "round records");
  rmSync(join(fx.repo, ".claude/learning/redteam-stall-state.json"));
  const again = fx.record(1, "NOT_CLEAR");
  assert.equal(again.status, 1, again.stdout + again.stderr);
  assert.match(again.stderr, /already hold rounds 1-3/);
  const receipt = wave(t, () => {}, { ws: "workspaces/café" });
  assert.equal(receipt.status, 0, receipt.stdout + receipt.stderr);
});

test("the checker counts by scope or branch from round 1: inherited failed rounds, missing early rounds and re-added records", (t) => {
  const inherited = wave(t, () => {}, { preRounds: 4, preBranch: "feat/w01-old" });
  assert.equal(inherited.status, 1, inherited.stdout);
  assert.match(inherited.stdout, /cap-hit-understated/);
  const missing = wave(t, ({ ws, rm }) => { rm(`${ws}/04-validate/round-w01-1.json`); }, { preRounds: 1 });
  assert.equal(missing.status, 0, `a record deleted later still counts as first added: ${missing.stdout}`);
  const startsLate = wave(t, ({ receipt, ws, dir, put: p, rm }) => {
    // Rounds 5 and 6 only: renumber the two clean records and the receipt, no rounds 1-4 anywhere.
    for (const [from, to] of [[1, 5], [2, 6]]) {
      const rec = JSON.parse(readFileSync(join(dir, `${ws}/04-validate/round-w01-${from}.json`), "utf8"));
      p(`${ws}/04-validate/round-w01-${to}.json`, JSON.stringify({ ...rec, round: to }));
      rm(`${ws}/04-validate/round-w01-${from}.json`);
    }
    receipt.rounds[0].n = 5; receipt.rounds[1].n = 6;
  });
  assert.equal(startsLate.status, 1, startsLate.stdout);
  assert.match(startsLate.stdout, /round-records-invalid — the recorded rounds of feat\/w01 skip from 2 to 5/, "renamed records still count as first added");
  const neverEarlier = wave(t, () => {}, { firstN: 5 });
  assert.equal(neverEarlier.status, 1, neverEarlier.stdout);
  assert.match(neverEarlier.stdout, /round-records-invalid — the recorded rounds of scope w01 \/ branch feat\/w01 start at round 5, not round 1/);
  // Deleted and re-added with different content before the receipt: refused as invalid history.
  const readded = wave(t, ({ dir, ws, put: p }) => {
    const file = `${ws}/04-validate/round-w01-1.json`;
    const rec = JSON.parse(readFileSync(join(dir, file), "utf8"));
    git(dir, "rm", "-q", file); git(dir, "commit", "-qm", "remove");
    p(file, JSON.stringify({ ...rec, root_causes: ["late"], reviewers: rec.reviewers.map((r) => ({ ...r, verdict: "NOT_CLEAR" })) }));
  });
  assert.equal(readded.status, 1, readded.stdout);
  assert.match(readded.stdout, /round-records-invalid — .*round-w01-1\.json was deleted and re-added with different content/);
  // Edited in place (same path, no delete) before the receipt: refused too.
  const edited = wave(t, ({ dir, ws, put: p }) => {
    const file = `${ws}/04-validate/round-w01-1.json`;
    const rec = JSON.parse(readFileSync(join(dir, file), "utf8"));
    p(file, JSON.stringify({ ...rec, note: "edited" }));
  });
  assert.equal(edited.status, 1, edited.stdout);
  assert.match(edited.stdout, /round-records-invalid — .*round-w01-1\.json was edited after it was first committed/);
  // Changed after the receipt: --scope reports it.
  const later = wave(t, () => {}, { after: ({ dir, ws }) => {
    const file = `${ws}/04-validate/round-w01-1.json`;
    const rec = JSON.parse(readFileSync(join(dir, file), "utf8"));
    put(dir, file, JSON.stringify({ ...rec, head: "9".repeat(40) }));
    git(dir, "add", "-A"); git(dir, "commit", "-qm", "rewrite a record");
  } });
  assert.equal(later.status, 1, later.stdout);
  assert.match(later.stdout, /round-record-after-receipt — .*round-w01-1\.json changed after the receipt/);
});

test("a journal entry committed after the receipt is refused with the recovery step, and the recovery passes", (t) => {
  const late = wave(t, ({ ws, rm }) => { rm(`${ws}/journal/0001-DECISION-w01.md`); }, { after: ({ dir, ws }) => {
    put(dir, `${ws}/journal/0001-DECISION-w01.md`, "# w01 converged (synthetic fixture)\n");
    git(dir, "add", "-A"); git(dir, "commit", "-qm", "journal entry after the receipt");
  } });
  assert.equal(late.status, 1, late.stdout);
  assert.match(late.stdout, /journal-postdate-receipt — .*re-commit the receipt in the same commit as the journal entry/);
  const path = join(late.dir, `${late.ws}/04-validate/convergence-w01.json`);
  writeFileSync(path, readFileSync(path, "utf8") + "\n");
  git(late.dir, "add", "-A"); git(late.dir, "commit", "-qm", "re-commit the receipt");
  const fixed = late.check("--scope", "w01");
  assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
});

test("before the merge a refused receipt is corrected in a later commit; after the merge it is immutable", (t) => {
  const refused = wave(t, ({ receipt }) => { receipt.acceptance_list.ratified_by = "codex"; });
  assert.equal(refused.status, 1);
  const { dir, ws, branch, receipt, check } = refused;
  const path = `${ws}/04-validate/convergence-w01.json`;
  put(dir, path, JSON.stringify({ ...receipt, acceptance_list: { ...receipt.acceptance_list, ratified_by: "Fixture Owner" } }));
  const uncommitted = check("--scope", "w01");
  assert.equal(uncommitted.status, 1, "an uncommitted correction is not judged");
  assert.match(uncommitted.stdout, /receipt-rewritten — .*uncommitted changes/);
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "correct the receipt");
  const corrected = check("--scope", "w01");
  assert.equal(corrected.status, 0, corrected.stdout + corrected.stderr);
  git(dir, "checkout", "-q", "main"); git(dir, "merge", "--no-ff", "-qm", "merge wave", branch);
  assert.equal(check("--todo", "w01-01").status, 0, "closed as merged");
  put(dir, path, JSON.stringify({ ...receipt, acceptance_list: { ...receipt.acceptance_list, ratified_by: "Someone Else" } }));
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "edit after merge");
  const edited = check("--scope", "w01");
  assert.equal(edited.status, 1, edited.stdout);
  assert.match(edited.stdout, /receipt-rewritten — .*immutable once merged/);
});

test("browser-walk not-applicable reasons: two words and eight letters", (t) => {
  const dir = tempDir(t, "harness-walk-reason-");
  const run = (reason) => {
    put(dir, "todo.md", `# w01-01\n\n## Verification\n\nBrowser walk: not applicable — ${reason}\n`);
    return node([join(root, ".harness/bin/check-browser-walk-receipts.mjs"), join(dir, "todo.md")]).status;
  };
  for (const weak of ["backend", "no UI", "CLI only", "infrastructure"]) assert.equal(run(weak), 1, weak);
  assert.equal(run("backend only"), 0, "control: a short real reason passes");
});

function codifyRepo(t) {
  const dir = tempDir(t, "harness-codify-");
  git(dir, "init", "-q", "-b", "main");
  const log = "# Codify log\n\n| Date | Run (branch / pull request) | Lesson (path) | Outcome | Detail |\n| --- | --- | --- | --- | --- |\n" +
    "| 2026-10-01 | docs/codify-a | .harness/backlog/harness-01-a.md | declined | already covered |\n";
  for (const [p, c] of [[".harness/guides/task-delivery.md", "gates\n"], [".harness/guides/project-profile.md", "commands\n"],
    [".harness/guides/other.md", "guide\n"], [".harness/codify-log.md", log], [".harness/backlog/README.md", "backlog\n"],
    ["workspaces/demo/journal/0001-DECISION-start.md", "start\n"], [".claude/skills/x/SKILL.md", "skill\n"]]) put(dir, p, c);
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "base");
  // `change` returning "staged" has staged its own index entries (a case-variant path cannot be
  // created through a case-insensitive filesystem, so those go in with git plumbing).
  const branch = (name, change) => {
    git(dir, "checkout", "-q", "-b", name, "main");
    if (change() !== "staged") git(dir, "add", "-A");
    git(dir, "commit", "-qm", name, "--allow-empty");
    // Forced: in this throwaway fixture a case-variant entry leaves the case-insensitive tree "modified".
    git(dir, "checkout", "-f", "-q", "main");
    return node([join(root, ".harness/bin/check-codify-allowlist.mjs"), "main", name], { cwd: dir });
  };
  const stageBlob = (path, content) => {
    const blob = spawnSync("git", ["hash-object", "-w", "--stdin"], { cwd: dir, input: content, encoding: "utf8" }).stdout.trim();
    git(dir, "update-index", "--add", "--cacheinfo", `100644,${blob},${path}`);
    return "staged";
  };
  return { dir, log, branch, stageBlob };
}

test("codify allowlist: allowlisted guide, backlog, appended log rows and evidence may merge without the user", (t) => {
  const { dir, log, branch } = codifyRepo(t);
  const ok = branch("docs/codify-ok", () => {
    put(dir, ".harness/guides/other.md", "guide, clearer\n");
    put(dir, ".harness/backlog/harness-02-b.md", "item\n");
    put(dir, ".harness/codify-log.md", log + "| 2026-10-08 | docs/codify-ok | .harness/backlog/harness-02-b.md | awaiting user | PR #7 |\n");
    put(dir, ".harness/reviews/codify-ok-correctness-r1.md", "Verdict: CLEAR\n");
    put(dir, ".harness/reviews/round-codify-ok-1.json", "{}\n");
    put(dir, "workspaces/demo/journal/0002-DECISION-codify-ok.md", "---\ntype: DECISION\nauthor: agent\n---\nsummary\n");
  });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
});

test("codify allowlist: the -ask-review record-only branch (review report, round record, held log row) may merge without the user", (t) => {
  const { dir, log, branch, stageBlob } = codifyRepo(t);
  const askReview = branch("docs/codify-x-ask-review", () => {
    put(dir, ".harness/reviews/codify-x-ask-correctness-r1.md", "Verdict: CLEAR\n");
    put(dir, ".harness/reviews/round-codify-x-ask-1.json", "{}\n");
    put(dir, ".harness/codify-log.md", log + "| 2026-10-08 | docs/codify-x-ask | .harness/backlog/harness-01-a.md | awaiting user | waiting for the user — PR #9 |\n");
  });
  assert.equal(askReview.status, 0, askReview.stdout + askReview.stderr);
  const wording = branch("docs/codify-y-ask-review", () => {
    put(dir, ".harness/codify-log.md", log + "| 2026-10-08 | docs/codify-y-ask | .harness/backlog/harness-01-a.md | awaiting user | needs the user's approval |\n");
  });
  assert.equal(wording.status, 1, "control: wording that reads as a user's answer is refused; say 'waiting for the user'");
  for (const phrase of ["the user approves it", "user confirms the change", "owner will accept"]) {
    const present = branch(`docs/codify-p${phrase.length}-ask-review`, () => {
      put(dir, ".harness/codify-log.md", log + `| 2026-10-08 | docs/codify-p-ask | .harness/backlog/harness-01-a.md | awaiting user | ${phrase} |\n`);
    });
    assert.equal(present.status, 1, `any tense of a deciding verb after "user"/"owner" is refused: ${phrase}`);
  }
  for (const phrase of ["approved per the user", "confirmed with the user", "you approved", "Jane approved"]) {
    const noSubject = branch(`docs/codify-q${phrase.length}-ask-review`, () => {
      put(dir, ".harness/codify-log.md", log + `| 2026-10-08 | docs/codify-q-ask | .harness/backlog/harness-01-a.md | folded in | ${phrase} |\n`);
    });
    assert.equal(noSubject.status, 1, `a deciding word is refused whoever it names: ${phrase}`);
  }
  const humanJournal = branch("docs/codify-h", () => {
    put(dir, "workspaces/demo/journal/0009-DECISION-codify-h.md", "---\ntype: DECISION\nauthor: human\n---\nsummary\n");
  });
  assert.equal(humanJournal.status, 1, "the run's journal entry must be author: agent");
  for (const name of ["taſk-delivery.md", "project-proﬁle.md", "guíde.md"]) {
    const lookalike = branch(`docs/codify-l${name.length}`, () => { put(dir, `.harness/guides/${name}`, "text\n"); });
    assert.equal(lookalike.status, 1, `non-ASCII names are ask-first: ${name}`);
  }
  const folder = branch("docs/codify-folder", () => stageBlob(".harness/guides/Project-Profile.md/notes.md", "text\n"));
  assert.equal(folder.status, 1, "a folder named like an existing file is ask-first");
  const quoted = branch("docs/codify-quoted", () => {
    put(dir, ".harness/codify-log.md", log + '| 2026-10-08 | docs/codify-q | .harness/backlog/harness-01-a.md | declined | Jane: "no" |\n');
  });
  assert.equal(quoted.status, 1, "quoted speech in a row reads as someone's answer");
  const strayJson = branch("docs/codify-z-ask-review", () => {
    put(dir, ".harness/reviews/notes.json", "{}\n");
  });
  assert.equal(strayJson.status, 1, "evidence must be named codify-*.md or round-codify-*.json; any other .json is ask-first");
  const strayRound = branch("docs/codify-w-ask-review", () => {
    put(dir, ".harness/reviews/round-other-1.json", "{}\n");
  });
  assert.equal(strayRound.status, 1, "a round record of another scope is not codify evidence");
});

test("codify allowlist refuses case collisions, excluded guides, renames, deletions, symlinks, modes, edited or user-answer log rows and other paths", (t) => {
  let fx;
  const cases = {
    "case-collision": () => fx.stageBlob(".harness/guides/Task-Delivery.md", "EVIL\n"),
    "case-collision-other": () => fx.stageBlob(".harness/guides/Other.md", "shadow\n"),
    "excluded-guide": () => put(fx.dir, ".harness/guides/task-delivery.md", "weaker gates\n"),
    "excluded-guide-new-case": () => fx.stageBlob(".harness/guides/PROJECT-PROFILE.md", "x\n"),
    "rename": () => git(fx.dir, "mv", ".harness/guides/other.md", ".harness/guides/renamed.md"),
    "deletion": () => git(fx.dir, "rm", "-q", ".harness/backlog/README.md"),
    "symlink": () => symlinkSync("other.md", join(fx.dir, ".harness/guides/link.md")),
    "mode": () => chmodSync(join(fx.dir, ".harness/guides/other.md"), 0o755),
    "edited-log-row": () => put(fx.dir, ".harness/codify-log.md", fx.log.replace("already covered", "covered")),
    "user-answer-row": () => put(fx.dir, ".harness/codify-log.md", fx.log + "| 2026-10-08 | docs/codify-x | .harness/backlog/harness-01-a.md | folded in | the user approved it on 2026-10-08 |\n"),
    "bad-outcome": () => put(fx.dir, ".harness/codify-log.md", fx.log + "| 2026-10-08 | docs/codify-x | x.md | accepted | x |\n"),
    "edited-evidence": () => put(fx.dir, "workspaces/demo/journal/0001-DECISION-start.md", "rewritten\n"),
    "skill": () => put(fx.dir, ".claude/skills/x/SKILL.md", "skill with a new tool grant\n"),
    "wrong-case-prefix": () => fx.stageBlob(".Harness/guides/new.md", "x\n"),
  };
  // A fresh repository per case: a case-variant entry in one case must not leak into the next.
  for (const [name, change] of Object.entries(cases)) {
    fx = codifyRepo(t);
    const result = fx.branch(`docs/codify-${name}`, change);
    assert.equal(result.status, 1, `${name}: ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /^FAIL /m, name);
  }
  assert.equal(node([join(root, ".harness/bin/check-codify-allowlist.mjs"), "main"], { cwd: fx.dir }).status, 2, "usage error");
});
