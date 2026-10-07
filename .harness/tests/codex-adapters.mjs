// Codex-only integration coverage. Synthetic launch records exist only in disposable
// Git fixtures; they are not evidence that a real model was dispatched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { root, renderAdapters } from '../bin/check-adapters.mjs';
import { template } from '../bin/check-redteam-convergence-receipt.mjs';

function temporary(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'codex-harness-fixture-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function put(dir, path, content) {
  const p = join(dir, path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content);
}
function run(dir, path, ...args) {
  return spawnSync(process.execPath, [join(root, path), ...args], { cwd: dir, encoding: 'utf8' });
}
function git(dir, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
function installation(t) {
  const dir = temporary(t);
  for (const path of ['.harness/bin/check-adapters.mjs', '.harness/manifest.json']) put(dir, path, readFileSync(join(root, path)));
  const invoke = (...args) => spawnSync(process.execPath, [join(dir, '.harness/bin/check-adapters.mjs'), ...args], { encoding: 'utf8' });
  return { dir, invoke };
}

test('explicit Codex check fails a cold install; Codex-only generation never touches Claude', t => {
  const { dir, invoke } = installation(t);
  for (const [p, content] of Object.entries(renderAdapters({ codex: false }))) put(dir, p, content);
  assert.equal(invoke().status, 0, 'Claude-only default remains valid');
  const missing = invoke('--codex');
  assert.equal(missing.status, 1, missing.stdout);
  assert.match(missing.stderr, /\.codex\/agents\/harness-reviewer\.toml/);
  const sentinel = '.claude/commands/analyze.md';
  put(dir, sentinel, 'Deliberately drifted Claude file; Codex must not repair this.\n');
  assert.equal(invoke('--write', '--codex-only').status, 0);
  assert.equal(readFileSync(join(dir, sentinel), 'utf8'), 'Deliberately drifted Claude file; Codex must not repair this.\n');
  assert.equal(invoke('--codex-only').status, 0);
  assert.equal(invoke('--codex').status, 1, 'combined checking still detects Claude drift');
  rmSync(join(dir, '.claude'), { recursive: true });
  assert.equal(invoke('--write', '--codex-only').status, 0);
  assert.equal(existsSync(join(dir, '.claude')), false, 'does not even create a Claude directory');
  rmSync(join(dir, '.codex/agents/harness-security-reviewer.toml'));
  assert.equal(invoke('--codex-only').status, 1, 'missing security role is not a pass');
});

test('core command wrappers and specialist routes have real sources and explicit settings', () => {
  const manifest = JSON.parse(readFileSync(join(root, '.harness/manifest.json')));
  const rendered = renderAdapters();
  assert.equal(Object.keys(rendered).filter(p => p.startsWith('.agents/')).length, 8);
  assert.equal(Object.keys(manifest.codex.agents).length, 14);
  for (const name of [...Object.keys(manifest.phases), ...Object.keys(manifest.codex.helpers)]) {
    const source = Object.hasOwn(manifest.phases, name) ? `.harness/phases/${name}.md` : `.claude/commands/${name}.md`;
    assert.ok(existsSync(join(root, source)), source);
    assert.ok(rendered[`.agents/skills/${name}/SKILL.md`].includes(source));
  }
  const policy = readFileSync(join(root, '.harness/adapters/codex.md'), 'utf8');
  for (const [role, settings] of Object.entries(manifest.codex.agents)) {
    assert.ok(existsSync(join(root, settings.instructions)), settings.instructions);
    const body = rendered[`.codex/agents/harness-${role}.toml`];
    // Generated TOML uses JSON-compatible basic strings; native parsing is a separate smoke check.
    for (const field of ['model', 'model_reasoning_effort', 'developer_instructions']) {
      const value = JSON.parse(body.match(new RegExp(`^${field} = (.+)$`, 'm'))[1]);
      assert.ok(value);
      if (field !== 'developer_instructions') assert.equal(value, settings[field]);
      else assert.ok(value.includes(settings.instructions));
    }
    assert.ok(policy.includes(`| harness-${role} | ${settings.model} | ${settings.model_reasoning_effort} |`), role);
  }
  assert.equal(manifest.codex.agents['security-reviewer'].model_reasoning_effort, 'high');
  assert.equal(manifest.codex.agents['debug-security-reviewer'].model_reasoning_effort, 'xhigh');
  assert.equal(manifest.codex.agents['todo-manager'].model, 'gpt-6-luna');
  assert.equal(manifest.codex.agents['frontend-specialist'].instructions, '.claude/agents/implementation/frontend-specialist.md');
});

test('invalid Codex metadata fails before generation; Claude-only rendering is independent', t => {
  const { dir, invoke } = installation(t);
  const manifest = JSON.parse(readFileSync(join(dir, '.harness/manifest.json')));
  delete manifest.codex.agents.reviewer.model_reasoning_effort;
  put(dir, '.harness/manifest.json', JSON.stringify(manifest));
  const bad = invoke('--write', '--codex-only');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Invalid Codex agent settings: reviewer/);
  assert.equal(existsSync(join(dir, '.agents')), false, 'validate before writing any adapter');
  assert.equal(invoke('--write').status, 0, 'disabled Codex metadata cannot break Claude generation');
});

function delivery(t) {
  const dir = temporary(t), ws = 'workspaces/demo', branch = 'feat/w01-codex-fixture';
  git(dir, 'init', '-q', '-b', 'main');
  put(dir, '.gitignore', '.claude/learning/\n');
  put(dir, `${ws}/04-validate/acceptance-w01.md`, '# Fixture acceptance w01\nw01-01 A1: command returns its input. Ratified by Fixture Owner (synthetic).\n');
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'fixture acceptance');
  const base = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '-qb', branch);
  put(dir, 'src/echo.mjs', 'export const echo = value => value;\n');
  const contract = {
    approved_by: 'Fixture Owner (synthetic)', owned_paths: ['src/echo.mjs'],
    acceptance: [{ id: 'A1', scenario: 'echo preserves input', verify: 'fixture consumer assertion' }],
    interfaces: ['echo(value) returns value'], dependencies: [],
    boundaries: { trusted: ['local process'], untrusted: ['input string'], excluded: ['none: pure function'] },
    integration: 'real module imported by consumer', test_environment: { isolation: 'none', command: 'node consumer', ordinary_failures: ['empty string'] }, open_questions: [],
  };
  const todo = `${ws}/todos/completed/w01-01-echo.md`;
  put(dir, todo, '# w01-01 fixture\n\n## Delivery contract\n\n```json\n' + JSON.stringify(contract) + '\n```\n\n## Verification\n\nBrowser walk: not applicable — command-line fixture.\n');
  assert.equal(run(dir, '.harness/bin/check-task-contract.mjs', todo).status, 0);
  assert.equal(run(dir, '.harness/bin/check-browser-walk-receipts.mjs', todo).status, 0);
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'fixture implementation');
  const head = git(dir, 'rev-parse', 'HEAD');
  const receipt = { ...template('w01'), project: 'demo', branch, wave_base: base, verdict_head: head,
    verdict_at: '2026-10-07T02:00:00Z', todos: ['todos/completed/w01-01-echo.md'],
    acceptance_list: { path: '04-validate/acceptance-w01.md', ratified_by: 'Fixture Owner' },
    journal: 'journal/0001-DECISION-w01.md', rounds: [],
  };
  const launches = [];
  for (let n = 1; n <= 2; n++) {
    const reviewers = ['correctness', 'security'].map(lens => {
      const agent = lens === 'security' ? 'harness-security-reviewer' : 'harness-reviewer';
      const launch_id = `synthetic-fixture-${n}-${lens}`;
      launches.push({ kind: 'launch', launch_id, subagent_type: agent, ts: '2026-10-07T01:00:00Z' });
      const evidence = `${ws}/04-validate/w01-${lens}-r${n}.md`;
      put(dir, evidence, `Synthetic fixture only. No real agent dispatched.\nVerdict: CLEAR\nCommit: ${head}\n`);
      return { agent, lens, ran: true, evidence, launch_id };
    });
    put(dir, `${ws}/${receipt.launches}`, launches.map(x => JSON.stringify(x)).join('\n') + '\n');
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', `fixture dispatch ${n}`);
    const record = `${ws}/04-validate/round-w01-${n}.json`;
    put(dir, record, JSON.stringify({ branch, round: n, head, expected_reviewers: ['correctness', 'security'],
      reviewers: reviewers.map(r => ({ id: r.lens, verdict: 'CLEAR', evidence: r.evidence })), root_causes: [] }));
    const recorded = run(dir, '.harness/bin/record-review-round.mjs', record);
    assert.equal(recorded.status, 0, recorded.stderr + recorded.stdout);
    receipt.rounds.push({ n, head, clean: true, new_gating_findings: 0, reviewers });
  }
  put(dir, `${ws}/${receipt.journal}`, '# Synthetic fixture w01 convergence\nNot evidence of real agent execution.\n');
  const receiptPath = `${ws}/04-validate/convergence-w01.json`;
  put(dir, receiptPath, JSON.stringify(receipt));
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'fixture convergence receipt');
  const check = (...args) => run(dir, '.harness/bin/check-redteam-convergence-receipt.mjs', '--workspace', ws, ...args);
  return { dir, ws, branch, receiptPath, receipt, check };
}

test('Codex identities traverse contract, two rounds, convergence, merge and todo closure', t => {
  const { dir, branch, check } = delivery(t);
  let result = check('--scope', 'w01');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  git(dir, 'checkout', '-q', 'main'); git(dir, 'merge', '--no-ff', '-qm', 'fixture merge', branch);
  result = check('--todo', 'w01-01');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('Codex receipt cannot pass with missing round, mismatched identity or changed reviewed head', t => {
  const { dir, receiptPath, receipt, check } = delivery(t);
  for (const [label, mutate, expected] of [
    ['missing confirming round', r => r.rounds.pop(), /not-converged/],
    ['mismatched identity', r => { r.rounds[1].reviewers[1].agent = 'worker'; }, /reviewer-launch-unresolved/],
    ['changed head', r => { r.rounds[1].head = r.wave_base; }, /clean-rounds-span-a-mutation/],
  ]) {
    const broken = structuredClone(receipt); mutate(broken);
    put(dir, receiptPath, JSON.stringify(broken));
    const result = check('--scope', 'w01');
    assert.equal(result.status, 1, label + result.stdout);
    assert.match(result.stdout + result.stderr, expected, label);
  }
});
