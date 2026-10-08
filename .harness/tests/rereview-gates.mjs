// Re-review gate tests: path classification counts both sides of a rename, the landing check
// covers every later merge of a wave's line, the light-mode setting is read strictly, a review
// report is bound to its lens and verdict, and the sweep does not hide completed todos.
// Every fixture is a disposable Git repository; synthetic review reports and launch rows here
// are fixtures, not evidence that any agent ran.
// Run from the repository root: `node --test ".harness/tests/*.mjs"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { root } from "../bin/check-adapters.mjs";
import { template } from "../bin/check-redteam-convergence-receipt.mjs";

const CHECKER = join(root, ".harness/bin/check-redteam-convergence-receipt.mjs");
const RECORDER = join(root, ".harness/bin/record-review-round.mjs");

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

// A converged wave w01 on feat/w01 (two clean rounds, both lenses), receipt committed on the
// branch. `beforeReceipt` may adjust the receipt or files just before the receipt commit.
function convergedWave(t, { mainFiles = {}, waveChange, beforeReceipt = () => {}, lateReport } = {}) {
  const dir = tempDir(t, "harness-rr-");
  const ws = "workspaces/demo", branch = "feat/w01";
  git(dir, "init", "-q", "-b", "main");
  put(dir, ".gitignore", ".claude/learning/\n");
  put(dir, `${ws}/04-validate/acceptance-w01.md`, "# Acceptance w01\nw01-01 A1: echo returns its input. Approved by Fixture Owner (synthetic).\n");
  for (const [p, c] of Object.entries(mainFiles)) put(dir, p, c);
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "plan w01");
  const base = git(dir, "rev-parse", "HEAD");
  git(dir, "checkout", "-qb", branch);
  if (waveChange) waveChange(dir);
  else put(dir, "src/echo.mjs", "export const echo = (v) => v;\n");
  put(dir, `${ws}/todos/completed/w01-01-echo.md`, "# w01-01\n\n## Verification\n\nBrowser walk: not applicable — command-line fixture.\n");
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "work");
  const head = git(dir, "rev-parse", "HEAD");
  const receipt = { ...template("w01"), project: "demo", branch, wave_base: base, verdict_head: head,
    verdict_at: "2026-10-07T02:00:00Z", todos: ["todos/completed/w01-01-echo.md"],
    acceptance_list: { path: "04-validate/acceptance-w01.md", ratified_by: "Fixture Owner" },
    journal: "journal/0001-DECISION-w01.md", rounds: [] };
  const launches = [];
  const ctx = { dir, ws, head, receipt, put: (p, c) => put(dir, p, c), commit: (m) => { git(dir, "add", "-A"); git(dir, "commit", "-qm", m); } };
  for (const n of [1, 2]) {
    const reviewers = ["correctness", "security"].map((lens) => {
      const agent = lens === "security" ? "harness-security-reviewer" : "harness-reviewer";
      const launch_id = `fixture-${n}-${lens}`;
      launches.push({ kind: "launch", launch_id, subagent_type: agent, ts: "2026-10-07T01:00:00Z" });
      const evidence = `${ws}/04-validate/w01-${lens}-r${n}.md`;
      if (lateReport !== evidence) put(dir, evidence, `Synthetic fixture report.\nVerdict: CLEAR\nCommit: ${head}\n`);
      return { agent, lens, ran: true, evidence, launch_id };
    });
    put(dir, `${ws}/04-validate/round-w01-${n}.json`, JSON.stringify({ branch, round: n, head, expected_reviewers: ["correctness", "security"],
      reviewers: reviewers.map((r) => ({ id: r.lens, verdict: "CLEAR", evidence: r.evidence })), root_causes: [] }));
    put(dir, `${ws}/${receipt.launches}`, launches.map((x) => JSON.stringify(x)).join("\n") + "\n");
    git(dir, "add", "-A"); git(dir, "commit", "-qm", `dispatch ${n}`);
    if (reviewers.some((r) => r.evidence === lateReport)) {
      put(dir, lateReport, `Synthetic fixture report.\nVerdict: CLEAR\nCommit: ${head}\n`);
      git(dir, "add", "-A"); git(dir, "commit", "-qm", `report for round ${n}, committed after its round record`);
    }
    receipt.rounds.push({ n, head, clean: true, new_gating_findings: 0, reviewers });
  }
  put(dir, `${ws}/${receipt.journal}`, "# w01 converged (synthetic fixture)\n");
  beforeReceipt(ctx);
  put(dir, `${ws}/04-validate/convergence-w01.json`, JSON.stringify(receipt));
  git(dir, "add", "-A"); git(dir, "commit", "-qm", "receipt");
  const check = (...args) => node([CHECKER, "--workspace", resolve(dir, ws), ...args], { cwd: dir });
  const sweep = () => node([CHECKER, "--sweep", join(dir, "workspaces")], { cwd: dir });
  return { ...ctx, base, branch, check, sweep };
}

// ---- 1: a rename counts both of its paths ---------------------------------------------------

test("a rename after the receipt counts its old path too: --scope, the dirty-tree check and the sweep refuse it", (t) => {
  const moved = convergedWave(t);
  git(moved.dir, "mv", "src/echo.mjs", `${moved.ws}/journal/0002-NOTE-echo.md`);
  const staged = moved.check("--scope", "w01");
  assert.equal(staged.status, 1, `a staged rename out of the code is not a clean tree: ${staged.stdout}`);
  assert.match(staged.stdout, /dirty-tree — .*src\/echo\.mjs/);
  git(moved.dir, "commit", "-qm", "move");
  const scope = moved.check("--scope", "w01");
  assert.equal(scope.status, 1, scope.stdout);
  assert.match(scope.stdout, /stale-head — .*src\/echo\.mjs/);
  git(moved.dir, "checkout", "-q", "main"); git(moved.dir, "merge", "--no-ff", "-qm", "merge wave", moved.branch);
  const sweep = moved.sweep();
  assert.equal(sweep.status, 1, sweep.stdout);
  assert.match(sweep.stdout, /landed-content-not-reviewed — .*src\/echo\.mjs/);
  // Control: the honest wave merged as reviewed sweeps green.
  const honest = convergedWave(t);
  git(honest.dir, "checkout", "-q", "main"); git(honest.dir, "merge", "--no-ff", "-qm", "merge wave", honest.branch);
  assert.equal(honest.sweep().status, 0);
});

test("a wave that only renames a code file into bookkeeping is still security-critical", (t) => {
  const fx = convergedWave(t, {
    mainFiles: { "src/auth.mjs": "export const check = () => true;\n" },
    waveChange: (dir) => {
      mkdirSync(join(dir, "workspaces/demo/journal"), { recursive: true });
      git(dir, "mv", "src/auth.mjs", "workspaces/demo/journal/0002-NOTE-auth.md");
    },
    beforeReceipt: ({ receipt }) => { receipt.security_critical = false; },
  });
  const r = fx.check("--scope", "w01");
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /security-critical-understated — .*src\/auth\.mjs/);
});

// ---- 2: every later merge of the wave's line is judged --------------------------------------

test("code that reaches main through a second merge of the same wave branch is refused; an honest later wave is not", (t) => {
  const twice = convergedWave(t);
  git(twice.dir, "checkout", "-q", "main"); git(twice.dir, "merge", "--no-ff", "-qm", "merge wave", twice.branch);
  assert.equal(twice.check("--todo", "w01-01").status, 0, "control: the first landing is clean");
  git(twice.dir, "checkout", "-q", twice.branch);
  put(twice.dir, "src/later.mjs", "export const later = 1;\n"); git(twice.dir, "add", "-A"); git(twice.dir, "commit", "-qm", "later work");
  git(twice.dir, "checkout", "-q", "main"); git(twice.dir, "merge", "--no-ff", "-qm", "merge wave again", twice.branch);
  const todo = twice.check("--todo", "w01-01");
  assert.equal(todo.status, 1, todo.stdout);
  assert.match(todo.stdout, /landed-content-not-reviewed — .*src\/later\.mjs/);
  assert.equal(twice.sweep().status, 1);

  // The same, with the unreviewed code on a side branch merged into the wave branch first.
  const side = convergedWave(t);
  git(side.dir, "checkout", "-q", "main"); git(side.dir, "merge", "--no-ff", "-qm", "merge wave", side.branch);
  git(side.dir, "checkout", "-q", "-b", "side", side.base);
  put(side.dir, "src/side.mjs", "export const side = 1;\n"); git(side.dir, "add", "-A"); git(side.dir, "commit", "-qm", "side work");
  git(side.dir, "checkout", "-q", side.branch); git(side.dir, "merge", "--no-ff", "-qm", "merge side", "side");
  git(side.dir, "checkout", "-q", "main"); git(side.dir, "merge", "--no-ff", "-qm", "merge wave again", side.branch);
  const s = side.check("--todo", "w01-01");
  assert.equal(s.status, 1, s.stdout);
  assert.match(s.stdout, /landed-content-not-reviewed — .*src\/side\.mjs/);

  // Controls: a bookkeeping-only follow-up merged again, and an honest later wave cut from main.
  const notes = convergedWave(t);
  git(notes.dir, "checkout", "-q", "main"); git(notes.dir, "merge", "--no-ff", "-qm", "merge wave", notes.branch);
  git(notes.dir, "checkout", "-q", notes.branch);
  put(notes.dir, `${notes.ws}/journal/0002-NOTE-after.md`, "# note\n"); git(notes.dir, "add", "-A"); git(notes.dir, "commit", "-qm", "note");
  git(notes.dir, "checkout", "-q", "main"); git(notes.dir, "merge", "--no-ff", "-qm", "merge note", notes.branch);
  const n = notes.check("--todo", "w01-01");
  assert.equal(n.status, 0, `bookkeeping merged again is fine: ${n.stdout}`);
  git(notes.dir, "checkout", "-q", "-b", "feat/w02", "main");
  put(notes.dir, "src/w02.mjs", "export const w02 = 1;\n"); git(notes.dir, "add", "-A"); git(notes.dir, "commit", "-qm", "w02 work");
  git(notes.dir, "checkout", "-q", "main"); git(notes.dir, "merge", "--no-ff", "-qm", "merge w02", "feat/w02");
  const w2 = notes.check("--todo", "w01-01");
  assert.equal(w2.status, 0, `an honest later wave cut from main does not reopen w01: ${w2.stdout}`);
});

// ---- 3: delivery_mode read strictly; every wave round needs the seat in light mode ----------

function recorderRepo(t) {
  const repo = tempDir(t, "harness-rr-recorder-");
  git(repo, "init", "-q", "-b", "main");
  put(repo, ".gitignore", ".claude/learning/\n");
  git(repo, "add", "-A"); git(repo, "commit", "-qm", "base");
  git(repo, "checkout", "-qb", "feat/w01");
  put(repo, "src/v1.txt", "1\n"); git(repo, "add", "-A"); git(repo, "commit", "-qm", "work");
  const head = git(repo, "rev-parse", "HEAD");
  const report = (name, text) => { put(repo, `workspaces/demo/04-validate/${name}`, text); git(repo, "add", "-A"); return `workspaces/demo/04-validate/${name}`; };
  // One CLEAR reviewer per lens by default; `reviewers` overrides.
  const record = ({ scope = "w01", branch = "feat/w01", lenses = ["correctness"], reviewers, n = 1 } = {}) => {
    const revs = reviewers ?? lenses.map((id) => ({ id, verdict: "CLEAR", evidence: report(`${scope}-${id}-r${n}.md`, `Verdict: CLEAR\nCommit: ${head}\n`) }));
    const file = `workspaces/demo/04-validate/round-${scope}-${n}.json`;
    const notClear = revs.some((r) => r.verdict === "NOT_CLEAR");
    put(repo, file, JSON.stringify({ branch, round: n, head, expected_reviewers: revs.map((r) => r.id), reviewers: revs, root_causes: notClear ? ["x"] : [] }));
    return node([RECORDER, file], { cwd: repo });
  };
  const profile = (text) => put(repo, ".harness/guides/project-profile.md", text);
  return { repo, head, report, record, profile };
}

test("delivery_mode: light in any honest spelling is light mode; a value that is neither standard nor light is an error", (t) => {
  for (const line of ['| delivery_mode | "light" |', "| `delivery_mode` | light (chosen by Jane, 2026-10-01) | notes |",
    "| delivery_mode | Light mode |", "delivery_mode: light  # chosen at /analyze", "Delivery mode = light", "- **Delivery mode:** `LIGHT`"]) {
    const fx = recorderRepo(t);
    fx.profile(`${line}\n`);
    const r = fx.record();
    assert.equal(r.status, 1, `${line}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /light-mode wave round always includes a security reviewer/, line);
  }
  for (const line of ["| delivery_mode | lite |", "delivery_mode: standard or light", "| `delivery_mode` | `<unset>` | |", "delivery_mode:"]) {
    const fx = recorderRepo(t);
    fx.profile(`${line}\n`);
    const r = fx.record();
    assert.equal(r.status, 1, `${line}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /delivery_mode .*must be exactly "standard" or "light"/, line);
  }
  for (const line of ['| delivery_mode | "standard" |', "delivery_mode: Standard  # default",
    readFileSync(join(root, ".harness/guides/project-profile.md"), "utf8").split("\n").find((l) => /`delivery_mode`/.test(l))]) {
    const fx = recorderRepo(t);
    fx.profile(`${line}\n`);
    const r = fx.record();
    assert.equal(r.status, 0, `control, standard: ${line}: ${r.stderr}`);
  }
});

test("a line that names the delivery mode but cannot be read is an error, never a silent standard", (t) => {
  for (const line of ["Delivery mode for this project: light", "The delivery_mode is light.", "1. delivery_mode: light",
    "| delivery mode (standard/light) | light |", "| `delivеry_mode` | light |", "delivery\u200b_mode: light", "delivery_mode\uff1alight"]) {
    const fx = recorderRepo(t);
    fx.profile(`${line}\n`);
    const r = fx.record();
    assert.equal(r.status, 1, `${JSON.stringify(line)}: ${r.stdout}${r.stderr}`);
  }
  const heading = recorderRepo(t);
  heading.profile("## delivery_mode: light\n");
  const h = heading.record();
  assert.equal(h.status, 1, "a heading that says light is light mode");
  assert.match(h.stderr, /light-mode wave round always includes a security reviewer/);
});

test("in light mode a round on a wave branch, or under any wave-like scope, needs the security seat", (t) => {
  const light = "| `delivery_mode` | `light` | |\n";
  for (const scope of ["wave1", "w01-final", "W1", "final"]) {
    const fx = recorderRepo(t);
    fx.profile(light);
    const r = fx.record({ scope });
    assert.equal(r.status, 1, `${scope}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /light-mode wave round always includes a security reviewer/, scope);
  }
  const ok = recorderRepo(t);
  ok.profile(light);
  const seated = ok.record({ scope: "wave1", lenses: ["correctness", "security"] });
  assert.equal(seated.status, 0, `control: with the security lens: ${seated.stderr}`);
  const fix = recorderRepo(t);
  fix.profile(light);
  git(fix.repo, "branch", "fix/f001-typo");
  const f = fix.record({ scope: "f001", branch: "fix/f001-typo" });
  assert.equal(f.status, 0, `control: a /fix round is not a wave round: ${f.stderr}`);
});

test("the light-to-standard switch: a planning review on a docs/wNN-plan branch is not a wave round", (t) => {
  const light = "| `delivery_mode` | `light` | |\n";
  const fx = recorderRepo(t);
  fx.profile(light);
  git(fx.repo, "branch", "docs/w02-plan");
  const plan = fx.record({ scope: "w02-plan", branch: "docs/w02-plan" });
  assert.equal(plan.status, 0, `the switch's planning review needs one reviewer, as todos.md step 7 says: ${plan.stderr}`);
  const wave = recorderRepo(t);
  wave.profile(light);
  const disguised = wave.record({ scope: "w01-plan" });
  assert.equal(disguised.status, 1, "control: a -plan scope on the wave branch is still a wave round");
});

// ---- 5: a report is bound to its lens and its verdict ---------------------------------------

test("the recorder refuses a report without a matching Verdict line, one report for two lenses, and a round record as evidence", (t) => {
  const cases = [
    ["no verdict line", (fx) => [{ id: "correctness", verdict: "CLEAR", evidence: fx.report("w01-correctness-r1.md", `<!-- ${fx.head} -->\n`) }],
      /does not state its verdict/],
    ["verdict disagrees", (fx) => [{ id: "correctness", verdict: "CLEAR", evidence: fx.report("w01-correctness-r1.md", `Verdict: NOT_CLEAR\nCommit: ${fx.head}\n`) }],
      /says NOT_CLEAR, but the round records CLEAR/],
    ["two verdict lines", (fx) => [{ id: "correctness", verdict: "CLEAR", evidence: fx.report("w01-correctness-r1.md", `Verdict: CLEAR\nVerdict: NOT_CLEAR\n${fx.head}\n`) }],
      /says NOT_CLEAR, but the round records CLEAR/],
    ["one file for two lenses", (fx) => {
      const ev = fx.report("w01-both-r1.md", `Verdict: CLEAR\nCommit: ${fx.head}\n`);
      return [{ id: "correctness", verdict: "CLEAR", evidence: ev }, { id: "security", verdict: "CLEAR", evidence: ev }];
    }, /cite the same report/],
    ["the round record itself", (fx) => {
      const ev = fx.report("round-w01-1.json", `{"note":"Verdict: CLEAR ${fx.head}"}\n`);
      return [{ id: "correctness", verdict: "CLEAR", evidence: ev }];
    }, /round record is not a review report/],
  ];
  for (const [label, reviewers, expected] of cases) {
    const fx = recorderRepo(t);
    const r = fx.record({ reviewers: reviewers(fx) });
    assert.equal(r.status, 1, `${label}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, expected, label);
  }
  const fx = recorderRepo(t);
  const notClear = fx.record({ reviewers: [{ id: "correctness", verdict: "NOT_CLEAR", evidence: fx.report("w01-correctness-r1.md", `**Verdict:** NOT_CLEAR\nCommit: ${fx.head}\n`) }] });
  assert.equal(notClear.status, 0, `control: a matching NOT_CLEAR verdict in bold: ${notClear.stderr}`);
});

test("the convergence checker refuses a report whose verdict disagrees, a round-record citation, and a report missing from the commit that adds its round record", (t) => {
  const disagree = convergedWave(t, { beforeReceipt: ({ ws, head, put: p }) => p(`${ws}/04-validate/w01-security-r2.md`, `Verdict: NOT_CLEAR\nCommit: ${head}\n`) });
  const d = disagree.check("--scope", "w01");
  assert.equal(d.status, 1, d.stdout);
  assert.match(d.stdout, /reviewer-evidence-verdict-mismatch — .*w01-security-r2\.md/);
  const recordCited = convergedWave(t, { beforeReceipt: ({ ws, receipt }) => {
    receipt.rounds[1].reviewers[0].evidence = `${ws}/04-validate/round-w01-2.json`;
  } });
  const rc = recordCited.check("--scope", "w01");
  assert.equal(rc.status, 1, rc.stdout);
  assert.match(rc.stdout, /reviewer-evidence-not-a-report — .*round-w01-2\.json/);
  // The report was not in the commit that added its round record; it was committed later.
  const late = convergedWave(t, { lateReport: "workspaces/demo/04-validate/w01-correctness-r2.md" });
  const l = late.check("--scope", "w01");
  assert.equal(l.status, 1, l.stdout);
  assert.match(l.stdout, /reviewer-evidence-not-with-record — .*w01-correctness-r2\.md/);
});

// ---- 11: excluded workspace folders do not hide completed todos -----------------------------

test("the sweep fails when an excluded folder holds completed todos, unless the folder is allowlisted", (t) => {
  const fx = convergedWave(t);
  git(fx.dir, "checkout", "-q", "main"); git(fx.dir, "merge", "--no-ff", "-qm", "merge wave", fx.branch);
  assert.equal(fx.sweep().status, 0, "control: the honest wave sweeps green");
  for (const folder of ["_other", "instructions", "_archive"]) {
    put(fx.dir, `workspaces/${folder}/todos/completed/w09-01-x.md`, "# w09-01\n");
    const s = fx.sweep();
    assert.equal(s.status, 1, `${folder}: ${s.stdout}`);
    assert.match(s.stdout, new RegExp(`FAIL ${folder}/: excluded-folder-holds-todos`), folder);
    rmSync(join(fx.dir, `workspaces/${folder}`), { recursive: true, force: true });
  }
  put(fx.dir, "workspaces/_template/todos/completed/w00-01-example.md", "# example\n");
  const tpl = fx.sweep();
  assert.equal(tpl.status, 0, tpl.stdout);
  assert.match(tpl.stdout, /skip _template\/: not swept \(allowlisted\)/);
});
