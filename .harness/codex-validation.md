# Codex validation and history

Current layout: eight core phase skills in `.agents/skills/` and 14 agent TOML
files together in `.codex/agents/`. Helper procedures are read directly from their
existing Claude command files. At the user's request, the 12 helper skill folders
and the task-only workspace/report tree were removed. Historical reports below
describe the earlier 20-skill snapshot; they do not claim review of this cleanup.

Cleanup validation: all 18 harness tests passed; the Codex adapter check passed;
105 protected file hashes remain unchanged.

No Claude files, shared phases, roles, rules or guides were changed.


---

## Historical record: 04-validate/codex-validation.md

# Codex-only harness validation — 2026-10-07

## Outcome and boundary

Generated 20 project skills and 14 custom-agent configurations. Each agent has explicit
model/effort settings and a real instruction source. The existing eight shared phase
names and Claude adapter bytes are unchanged. Codex-only generation writes only `.agents/`
and `.codex/`; no user-wide model, permission, hook-trust or concurrency setting changed.

The runtime supports project skill discovery. This installed client's collaboration tool
cannot select a named custom-agent type, so native custom-type dispatch and live wave
certification are NOT claimed. Generic role delegation is available with explicit model,
effort and instruction prompts. The shared security-specialist gate is preserved.

## Executed checks

From the source template:

```text
$ node .harness/bin/check-adapters.mjs --write --codex-only
[Wrote 20 .agents/skills/*/SKILL.md and 14 .codex/agents/harness-*.toml files]
Shared harness adapters match the manifest (Codex only; Claude Code untouched).

$ node .harness/bin/check-adapters.mjs --codex-only
Shared harness adapters match the manifest (Codex only; Claude Code untouched).

$ node .harness/bin/check-adapters.mjs
Shared harness adapters match the manifest (Claude Code + Codex).

$ node --test ".harness/tests/*.mjs"
ℹ tests 18
ℹ suites 0
ℹ pass 18
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

All commands exited 0. Disposition: generated installation is consistent; executable
controls passed the cases exercised. This does not prove live native dispatch.

The new `codex-adapters.mjs` tests include cold installation refusal, a deliberately drifted
Claude file preserved by Codex-only generation, absent Claude-directory preservation,
invalid model/effort metadata refusal before writes, and real Git fixtures driving task
readiness, two review rounds, committed receipts, merge and historical todo closure.
Negative receipt controls reject missing confirmation, mismatched identity and changed
reviewed commits. Synthetic fixture launches are explicitly labelled and confined to temp
repositories. They do not certify this implementation's real reviewers.

Python `tomllib` parsed all 14 generated TOML files. Manifest source references exist.
A pre-edit SHA256 inventory and independent reviewer comparison found no modifications to
`.claude/`, shared phases/rules/roles/guides or `.harness/adapters/claude.md` (105 files).
The existing shared test file also remains unchanged.

## Native client walk

Client: `codex-cli 0.160.1`. A separate stdio app-server was initialized using the installed
client's generated JSON-RPC schema, then called with `skills/list`, the isolated Git
snapshot as `cwds`, and `forceReload: true`.

```text
Initialize: OK
Native project skills: 20 ['analyze', 'autonomize', 'codify', 'debug', 'deploy', 'design', 'doctor', 'fix', 'implement', 'journal', 'learn', 'redteam', 'start', 'sweep', 'test', 'todos', 'validate', 'worktree', 'wrapup', 'ws']
Project skill errors: []
```

Disposition: project skills load through the real client. `config/read` did not expose
custom agents; that response alone was not treated as proof of unsupported dispatch.

A separate ephemeral, read-only CLI session was then asked to inspect its actual spawn
schema and dispatch one `harness-reviewer` only if a native custom-type selector existed.
Invocation used `codex --no-daemon -a never -C <snapshot> exec --ephemeral -s read-only
-m gpt-6.1-sol -c 'model_reasoning_effort="low"' --json <capability-probe-prompt>`.
It exited 0 with:

```text
NATIVE_CUSTOM_TYPE_UNAVAILABLE

Actual spawn parameters: `task_name`, `message`, `fork_turns`, `model`, `reasoning_effort`.

The tool has no custom agent type selector. No agent was dispatched, and no files or settings were modified.
```

The capability probe was repeated with invocation-only `--enable multi_agent_v2`; the
same five parameters and absence of a custom-type selector were reported. No feature
flag was persisted. Disposition: native custom-type certification blocked by this client.
A task label is not an agent type; neither probe claimed an effective child model.
See `.harness/backlog/harness-01-codex-native-dispatch.md` for the follow-up criterion.

## Independent review

Pinned review snapshot: `c7111dae8fd44c83c8c8e124289ea6c113f67e26`, in a separate temporary
Git repository with two sibling detached review worktrees. This SHA is NOT a commit in
the user's source repository. Each reviewer verified its assigned root and revision.

Actual dispatches were `collaboration.spawn_agent` tasks:

- `/root/codex_correctness_review`: correctness, requested `gpt-6.1-sol` / `high`, fresh context.
- `/root/codex_security_review`: security, requested `gpt-6.1-sol` / `high`, fresh context.

Both returned CLEAR within their assigned artifact/control scope. Their verbatim reports
are `codify-codex-parity-correctness-r1.md` and `codify-codex-parity-security-r1.md`.
The security reviewer additionally broke the Claude exclusion in a disposable copy and
observed the preservation test fail, and verified that matching generic `worker` identities
in both security receipt and ledger are refused with `security-lens-not-specialist`.

`record-review-round.mjs` recorded their complete round in the review snapshot and exited 0
with one clean round. Codify needs one round, not wave convergence. The source of the round
and actual requested settings are recorded in `codex-review-provenance.json`; these are
generic collaboration reviews, never labelled native custom-type dispatches.

## Source Git state

The initial audit saw no usable Git repository. By implementation verification, the source
had an unborn `main` and its original template files already staged, with no commit history.
Those staged baseline files were not committed or reset. This task's changes are left in
the working tree; pinned review and receipt exercises used the separate Git snapshot.


---

## Historical record: 04-validate/codify-codex-parity-correctness-r1.md

## Review Report — Codex adapters, round 1, commit c7111dae8fd44c83c8c8e124289ea6c113f67e26, lens: correctness

Verdict: CLEAR

### Findings

None within the assigned artifact and executable-control scope.

### Checked and clean

- First action verified the assigned checkout’s resolved path, Git root, and pinned HEAD.
- `node .harness/bin/check-adapters.mjs --codex` and `--codex-only` both exited 0.
- `node --test ".harness/tests/*.mjs"`: 18 passed, 0 failed.
- Independent fresh-copy installation walk:
  - `--codex` before installation exited 1: `Adapter drift: .agents/skills/analyze/SKILL.md`.
  - `--write --codex-only` exited 0 and generated exactly 20 skills and 14 agents.
  - Subsequent `--codex-only` exited 0.
  - SHA256 inventory of Claude files remained unchanged.
- Pre-edit baseline inventory comparison checked 104 files under `.claude/` and shared phases/rules/roles/guides; zero changes.
- All 14 generated agent files parsed successfully with Python 3.13 `tomllib`. Each carries explicit model, effort, and instructions.
- Manifest routes retain existing specialist instruction sources. Agent settings agree with the adapter routing table.
- Disposable Git fixtures exercise contract readiness, review recording, convergence, merge, and todo closure. Negative controls reject missing confirming rounds, mismatched launch identity, and changed reviewed commits.
- Reviewed checkout remained clean. All mutations occurred in disposable fixtures or copies.

### Code Example Validation

- Tested: 3 documented installation/verification commands; passing: 3; failing: 0.

This is a generic correctness review. It does not certify native custom-agent discovery, effective model settings, or live dispatch. Synthetic fixture launches verify receipt controls only; the adapter states that limitation explicitly.


---

## Historical record: 04-validate/codify-codex-parity-security-r1.md

## Security Review — Codex adapters, commit c7111dae8fd44c83c8c8e124289ea6c113f67e26, lens: security

Verdict: CLEAR

### Findings

None within the accepted scope and declared trust boundary.

### Passed checks

- Verified the assigned checkout’s resolved path, Git root and pinned HEAD before review. Checkout remains unchanged.
- `node .harness/bin/check-adapters.mjs --codex-only` passed; all 18 harness tests passed.
- Codex-only generation preserves deliberately drifted Claude files and creates no Claude directory. In a disposable copy, removing the Claude exclusion made the preservation test fail.
- In a disposable fixture, matching `worker` identities in both the security receipt and launch ledger were rejected with `security-lens-not-specialist`. Generic fallback cannot satisfy the specialist gate merely by assigning a security lens.
- All 14 generated agent TOML files parsed with Python 3.14 `tomllib`. Models and reasoning settings are explicit; no permission or global setting overrides appear.
- Adapter instructions preserve fresh independent review contexts, pinned checkout checks, explicit working directories and disposable mutation probes.
- Review evidence policy prohibits fabricated dispatches, reports, timestamps and approval. Synthetic test evidence is explicitly labelled and confined to disposable repositories.
- Generator filesystem writes remain repository-local. Helpers read existing Claude instruction bodies through the Codex mapping.

This report comes from a generic collaboration agent assigned the security lens. It is independent review evidence, **not native `harness-security-reviewer` dispatch certification**. Native runtime discovery and dispatch were not exercised.


---

## Historical record: 04-validate/codex-review-provenance.json

```json
{
  "scope": "codify-codex-parity",
  "reviewed_snapshot_commit": "c7111dae8fd44c83c8c8e124289ea6c113f67e26",
  "snapshot_is_source_repository_commit": false,
  "round_recorded_in_disposable_snapshot": {
    "branch": "docs/codify-codex-parity",
    "round": 1,
    "head": "c7111dae8fd44c83c8c8e124289ea6c113f67e26",
    "expected_reviewers": [
      "correctness",
      "security"
    ],
    "reviewers": [
      {
        "id": "correctness",
        "verdict": "CLEAR",
        "evidence": "workspaces/code-template/04-validate/codify-codex-parity-correctness-r1.md"
      },
      {
        "id": "security",
        "verdict": "CLEAR",
        "evidence": "workspaces/code-template/04-validate/codify-codex-parity-security-r1.md"
      }
    ],
    "root_causes": []
  },
  "dispatches": [
    {
      "tool": "collaboration.spawn_agent",
      "task_name": "/root/codex_correctness_review",
      "assigned_lens": "correctness",
      "requested_model": "gpt-6.1-sol",
      "requested_reasoning_effort": "high",
      "fork_turns": "none",
      "effective_settings": "not independently exposed"
    },
    {
      "tool": "collaboration.spawn_agent",
      "task_name": "/root/codex_security_review",
      "assigned_lens": "security",
      "requested_model": "gpt-6.1-sol",
      "requested_reasoning_effort": "high",
      "fork_turns": "none",
      "effective_settings": "not independently exposed"
    }
  ],
  "native_custom_type_certified": false
}
```


---

## Historical record: 04-validate/codex-preservation.json

```json
{
  "protected_file_count": 105,
  "all_unchanged": true,
  "sha256_before_and_after": {
    ".claude/CLAUDE.md": "3f91890fdff229c180f6345cd7c1273fd508b1f679e2d9cf87ec96f292238d73",
    ".harness/roles/reviewer.md": "d01fec3c9c92953be2dd949975aed378bb30260504dd0b1fa0f45eea4ab6f1b1",
    ".harness/roles/security-reviewer.md": "7b9ebd72d4343bcdb883da38d25ae1672c93a27fbc454a7069e0c2873b35be21",
    ".harness/roles/analyst.md": "06edc8924058dc1d1f87a0bbe91edc02734d62695e33daec7cb3c2d523f54a49",
    ".harness/roles/todo-manager.md": "0c2d3e90a6831b7089c0471173e4c0383600f81c1ae168c38f4d95f847dc6499",
    ".harness/roles/implementer.md": "3b827b6ca953e8b604c5ca0b971cb7bcfbe969354406730d9aefc13f120ce61d",
    ".harness/adapters/claude.md": "62f72dd75d2d5b6956c95918d4f47efc216d641e087f73c718a1f148fb731727",
    ".harness/guides/task-delivery.md": "30a3fa8ba208131c2ab793549fb04af766ff9ef1dcb342b9a689b6260ce1daea",
    ".harness/guides/review-round-recorder.md": "09f7181f7c90f4403bc0598aad82b8b4d57ea0fef65c233104bd4b9f46e5fbae",
    ".harness/guides/project-profile.md": "2e7d238dfc9d40fe0603b95dddd8662adb547645ae2e946508aa410f3628dd58",
    ".harness/rules/redteam-stall-debug.md": "a041b52d889da1aa476152c3552171e6054d8262aa6c6851ccf963dfdab50957",
    ".harness/rules/autonomous-execution.md": "ef6f74fa6813afff85b087a83061d0eac48f3a86acd4e9f94148ca46289a03e9",
    ".harness/rules/e2e-god-mode.md": "b808ae6f1cec63598c7b8135fa20f1aba12694e82d6618e8d65eccc6f46b5a78",
    ".harness/rules/product-completion-first.md": "a0fe7f04887580bb12a215d577db59f0f2389d4b148822f9a74929df62bae9a3",
    ".harness/rules/completion-criterion.md": "d04693a690a3ac3f4130aaba13ebccb47f4a0baaed5b5d9ff5202519b087a455",
    ".harness/rules/agents.md": "50bcee615dcf467f25a9c154ff9476ea6536a5567abb8ab0bf6a4f2e1e1c9e48",
    ".harness/phases/redteam.md": "69ce0e6a72d6bf0d2961d95ef9cd876cf2ac41681e09e17e08f6a6bfd06aaba8",
    ".harness/phases/debug.md": "70884a380abc7d178422fd9ddedb96dbbab50f4c59387bd89f681cb31e4f83e5",
    ".harness/phases/fix.md": "0797e3fbc5cb30af7e82ecc736e1a82f263209e24325af3a4a1dc7e326c975f5",
    ".harness/phases/implement.md": "d250afd56ae122f7f4fdb3273994cf3f734317d0c72bbee9a3536d3ce1999c64",
    ".harness/phases/learn.md": "d802f03953297ff7ec916a6697f68b03196e0dfa0ec8104d46be352f8bac54a5",
    ".harness/phases/analyze.md": "aa5367f2db61e085f70d796f1ea1316de02da0cc100b291e0a5185bf6b9a6d9f",
    ".harness/phases/codify.md": "51ae648a8e48851adfc02821e0a179b9c2d2774dc09ddff56e126b4de4ac6a50",
    ".harness/phases/todos.md": "0b18cb536c5a4f03de0af42ea3f38fb7827d5764705e3624de966cebde3e3996",
    ".claude/hooks/package.json": "a0217baa03b80de218502b369e5e4c8fc709cdf0d90378ac20c10c7275c0d67e",
    ".claude/rules/communication.md": "0325c437496fb92e308c04f923d1c82516968b5e7836e2152ff2f5afc28216aa",
    ".claude/rules/redteam-stall-debug.md": "fead6aa674a245e8282fdf9c5563aea074cc2bbdf9cca1272815fa2dae818b8e",
    ".claude/rules/autonomous-execution.md": "3be221d76d0975f4befc9c490c83d794b966f901d62e3d64a6d9ec91e7ed35d9",
    ".claude/rules/user-flow-validation.md": "7d9d46ae3a33aa4b4298939fa488797cb194ebb1ce7529ab775154ca0adf78ef",
    ".claude/rules/e2e-god-mode.md": "17d3c37f49ae7cdde25d9c4231cbdda40109738816666433d1dfe1e8efb44cf9",
    ".claude/rules/instrument-discipline.md": "229b5cf4fa2390cd6893c67042bfedf334c85ee839c518ceb3acc34df9df4024",
    ".claude/rules/specs-authority.md": "89f2ae81d029fec58a1c589f8f89e4cd2b9fc14668f70fc938cfc93a1ece33d6",
    ".claude/rules/time-pressure-discipline.md": "80f58e8cb82a9888c8c23264d62df833e73b14aaa42c3c2815e995ee4738da5d",
    ".claude/rules/product-completion-first.md": "e65a31cde4d819bbb421a2d8d1276a68cf907c07190005ef69d93f98bb0cab5a",
    ".claude/rules/value-prioritization.md": "23f3ae11a2d5b43ea5fe2c61ef3a3865bbd40936481c8fbfd3ca426a0423a1d3",
    ".claude/rules/completion-criterion.md": "d2f0fb823cd27e9b2b0fae29d369d81fea0983768fee20413e868c0f28b620ea",
    ".claude/rules/evidence-first-claims.md": "67d7902387bd6328c8a6026cfc54e51b8e71fc9a2f0cabc1ff6e870fb3cd3706",
    ".claude/rules/symbol-anchored-citations.md": "4c7f5df0dbfcec71217a51cd6e6191ccfef27af160fc22ef01897fd1f2b2cd71",
    ".claude/rules/journal.md": "0d49886a1c22efcbb0e4f258ef9247fa69accd5e3d1ddae68ffe154407ab7723",
    ".claude/rules/worktree-isolation.md": "0e9efeddb9554bc97afb8af3824764f583446d069c24adf12f44c369298de212",
    ".claude/rules/zero-tolerance.md": "f9d305a25de02fc668e09e737b5c7adffd60c9fba943b6d83af21c5b1b449ad7",
    ".claude/rules/verify-resource-existence.md": "7d6e3200d4fefef2ed3439d4c4b241bdb972217cf7d0ec329eba3a5f08b46039",
    ".claude/rules/git.md": "31e84ffb69299b5bf42eb6617e5d5ee8595d1eac55c0a60dd21edc5c88a85d80",
    ".claude/rules/recommendation-quality.md": "6e8d0d26f6d4c8050941cbc60eaeb50da4a08b5873c88ad6dce348f5d5be7f00",
    ".claude/rules/agents.md": "817e0a7a8852d30146ea93b3498e795289811f52d468b4d8ca68f4c021e1eee8",
    ".claude/rules/spec-accuracy.md": "ef4da936d65af9b613d78340027b1707cf1bfcecf6cba1fee6d87b45965ccab5",
    ".claude/rules/security.md": "24738e483859da84733396a45e9c287acdf6717643a0184478ee5bcd5bf03d8e",
    ".claude/commands/redteam.md": "c94335339393781384431107b4e6786f4119f8b2e4dc0fe0323eeb858377c96f",
    ".claude/commands/debug.md": "1831c1e0a3fae3bea8503cb43d381fe1c94c42fae9b6856ad1e31d76c77a50bf",
    ".claude/commands/fix.md": "83989bd00494de9ad807dbc86dfbf6127563fa559ba1a59067fb5557bb772a41",
    ".claude/commands/worktree.md": "124e56f13f713ded0a945cd684a008188c23caf5d157c6fca7170826a00f95ea",
    ".claude/commands/sweep.md": "00dd254407a4496098d3226fd1194ab57a9877b70634abe6cb6a104c552c4e4c",
    ".claude/commands/implement.md": "ba0125c523e3cc1ad3a39b926f1b5e64f6621467ab0bbd03065a1e12fe546ba2",
    ".claude/commands/learn.md": "86e779ff80b161e1d8763d5f924ad737d4372a23079f12daeda7dbaa45029350",
    ".claude/commands/validate.md": "70be18c3f1d067048d8aa5b13f88def02db3d6f28e60241360824edf8d916196",
    ".claude/commands/ws.md": "2a59edf1e4506607747b3ce218a4e74eadffe83a08044eb3eb5e75dabf69ebe8",
    ".claude/commands/doctor.md": "c73a6d7ea51ad45196ddc1f2b865d4309e8d9cd58bfc6a4d2e6c4b05cdb78ce5",
    ".claude/commands/analyze.md": "f71ce4d08d6ef3776e40cfc946119c4e08327612d7bad8512df1e80c7e9d742f",
    ".claude/commands/deploy.md": "393caf2f5cded00ea986eb0c94b40bd32aafd2857079ee89c0918fddbff1cae4",
    ".claude/commands/journal.md": "3daebe8c6d00b8a9e6f1615e209c29cfa33e0a7dac6e8be745eae86872ea9954",
    ".claude/commands/codify.md": "8252b7308cc97e6d67e2b5ca9c4b2e679b3943d54fe868dfceb83af21c49bb25",
    ".claude/commands/todos.md": "8de00a323a696fae7f8c3ae59360d4261509a59860ff2198beddcc8d39c94fba",
    ".claude/commands/wrapup.md": "b5e748dcea5cc844d99a908c0148fec7c176a92ea55382c27912c9fac65e4422",
    ".claude/commands/design.md": "550710d421e6c47f7d79dfb0a13a2ea519d5a6ef0b12facd3b19f5ff0a24922b",
    ".claude/commands/start.md": "354eabc88d482c633fdf2fa4f32895d5e17986137a72a4083ff30cecc728db13",
    ".claude/commands/test.md": "7bc379aff11734aea4cdfda572aa854bf2274645a021439c3ceb0a7051a7843a",
    ".claude/commands/autonomize.md": "3336358dbdb3528e6bdab23545f0a83f6fe7dcd24c68aac83ae4e0e340bfe513",
    ".claude/skills/16-validation-patterns/orphan-audit-playbook.md": "1b7c395b7a3e6da190d45676d06941c6be0606aa6cebf60f4dfe020e07e124cd",
    ".claude/skills/16-validation-patterns/SKILL.md": "79aaf6dbe3cdf9d381a29fa3a2fa39570c01cce0832e90a847614db1873ab6ed",
    ".claude/skills/16-validation-patterns/type-relaxation-sweep.md": "07fc8c68e68ba15de7eeb06a1ebb24de11848d6c1d775eb420c1c7ae5e7529fd",
    ".claude/skills/18-security-patterns/multi-site-parameter-plumbing.md": "d51da2c9c9ca2a81eecf2f412ac52dc2832e56c1880b2ab21ee34b5ce5ce6e5f",
    ".claude/skills/18-security-patterns/SKILL.md": "9295398dc752418ff577bcbb0d2b7ec32286f7d2fbcf59afba71daa3ea8f07db",
    ".claude/skills/10-deployment-git/deployment-cloud.md": "08eaac2aed92a98ec2bbbe17f6183531e56aa9cfc0601c033586a225ee4f2b5d",
    ".claude/skills/10-deployment-git/application-deployment.md": "d92bd44758c4e0364e5576cde0633a175b740ef5e7a4db8e6e3253b15a399981",
    ".claude/skills/10-deployment-git/SKILL.md": "8c6c9b3077e84fc55f8fb44aa1f91939caa8fffd83a8a3b815b75690ca3d52e3",
    ".claude/skills/25-ai-interaction-patterns/ai-interaction-patterns.md": "5dce87ec87381f1abfd0920490fef0dba7f490896531cfb49dfe3a523630f757",
    ".claude/skills/25-ai-interaction-patterns/SKILL.md": "6b658fdde097fe829a84102678945d603e723f7c572306d8072ad0cc07118efb",
    ".claude/skills/17-gold-standards/documentation-validation-patterns.md": "26ac4c59e8d0a5c14f53772bd2509c7e1f3766b45731e3e1cb609571476e9a98",
    ".claude/skills/17-gold-standards/gold-documentation.md": "15e8cf696dc08ccc3511a858c903c96177841d90e784595872f12adc3950ed48",
    ".claude/skills/17-gold-standards/SKILL.md": "815bacaf2f499953d98bde2cd07f6ba357a2a340f8a3322fc34bbf9ead422bd3",
    ".claude/skills/12-testing-strategies/probe-driven-verification.md": "4ebe44051a3df8d2220b7e76e8f5710182cb9753e3526db6ceef1368aa807c4b",
    ".claude/skills/12-testing-strategies/impossibility-surface.md": "3b61ec8e41a8a7c227036173a81f98c4a12679ea58caaf334a7c787f1084979b",
    ".claude/skills/12-testing-strategies/SKILL.md": "40e12be65e537586d8e76775379500e39aa97e286588a859c00aa63c087e5a48",
    ".claude/skills/12-testing-strategies/oidc-offline-crypto-test-vectors.md": "bb7b945d47c08feb8e3d6c9a77f79d0ca6753d3de6ed5035c7c92e49e4ed4512",
    ".claude/skills/test-skip-discipline/SKILL.md": "3e418ef8514b3f8cc339ff9989f56e5051f4da425dba99d87d101a804caad896",
    ".claude/skills/36-claude-managed-agents/SKILL.md": "af804ca8864f88c768dbfe3bffc4ae8fcf0b1957ed90f7748820cca48e5c4092",
    ".claude/skills/23-uiux-design-principles/ux-writing.md": "155010949d026c3ff9f67e186cdfa5db6bdabd3886a8f8e439f0bf198d59d5a0",
    ".claude/skills/23-uiux-design-principles/design-principles.md": "ddaa70c84d55604b19859e4b14744debcc0edc28cc5cb509d8ada44a2f7275f7",
    ".claude/skills/23-uiux-design-principles/production-hardening.md": "26615eaf1868443f9cd62b2cffa9243ca72eeb188bcfd181ea0a60a4d004e1d4",
    ".claude/skills/23-uiux-design-principles/SKILL.md": "a9d4e8718d8c8692e78a9bd06b7d9aa04bf1be93bd5fe88fa5e63bed8a847ff0",
    ".claude/skills/23-uiux-design-principles/motion-design.md": "913acd8f78d425bc4782835c7ca31684aae3b3f177e30de7aac6f4c1bd9f0848",
    ".claude/hooks/lib/state-io.js": "44595bc7efddae903f3f3d9a2a20c69e7410f82596d4f131635a9182c7393f9e",
    ".claude/hooks/lib/state-resolver.js": "b9474fd3c5b5d87f396f5d6f14968faec4844b675a3bf66e76cecdd1cb315abe",
    ".claude/agents/design/uiux-designer.md": "2513693624e7a81906e9489a6f38ce39badeb49a1053fa7262f87c933f1652ea",
    ".claude/agents/analysis/analyst.md": "6991778ec768f454f6be79e0cc06c7c75d1c1164fbe61320756d19f15d3ade45",
    ".claude/agents/quality/gold-standards-validator.md": "fee67be931578427df709336c8de0510c32ac6fcbfde787c78c2f37a13119dca",
    ".claude/agents/quality/reviewer.md": "1402bf6ef16b9cd68e6ae621ccc894d8952f21b2a311fe60dc2a564c146b538b",
    ".claude/agents/quality/security-reviewer.md": "325487c1b0b80d17b313cc2212fdfa8053d77e55bdf528ac5de68f01493ef078",
    ".claude/agents/management/todo-manager.md": "e64014de4a9cab6e931fff28e9fe0521076764e4f6167e6ff0310417f2c0ee77",
    ".claude/agents/management/gh-manager.md": "17049e4608b2054124d280e08fda0dbcc8b52160b92d5995f00ab09327785057",
    ".claude/agents/testing/testing-specialist.md": "45558d2b0319bf433497c93586dd2383cb1c925b48210d200c57a6f17be504ce",
    ".claude/agents/implementation/tdd-implementer.md": "7dc12ffa3ab7ba0866b8185db2c6ea00d28033780c40f54f051b5746a6b583e0",
    ".claude/agents/implementation/build-fix.md": "d2d848d9a06218715b774f2743406bef700b5a0443392a6951414a22305debb8",
    ".claude/agents/implementation/frontend-specialist.md": "99bba7566ade7974cf720457865fefa5e281dfc300a91cc34564b2963450c23b",
    ".claude/agents/implementation/backend-specialist.md": "a0be04d2a24fdca0dbdd3c474a53850a2e8fb0e17d714b07c4666135993df42a"
  }
}
```


---

## Historical record: journal/0001-DECISION-codex-parity.md

---
type: DECISION
date: 2026-10-07
author: co-authored
project: code-template
topic: Codex parity without modifying Claude behavior
phase: codify
tags: [codex, adapters, agents, reasoning, isolation]
---

# Codex parity with a preserved Claude harness

The user's authorization was: "go ahead and update it without impacting claude code harness".
The implementation changes only the Codex adapter, Codex-only generator branches and
manifest.codex, plus generated Codex files and new tests/evidence. The manifest's existing
phases, roles and grandfather_pin retain their values; Claude-rendered adapters retain their
bytes. Shared phases/rules/roles/guides and all .claude files retain their pre-edit SHA256s.

Acceptance: native wrappers cover all 20 commands; 14 explicit role/model/effort configurations
include specialist instruction sources and debug variants; an explicit Codex check fails an
absent installation; Codex-only generation cannot write Claude adapters; independent review
and receipt controls remain intact. Actual client capability must be reported separately
from fixture coverage and generated configuration.

The chosen approach extends the existing generator's Codex path rather than introducing a
second renderer. A separate generator would isolate source files more strongly, but duplicate
phase metadata and drift behavior. --codex-only provides a tested write boundary while
preserving the existing Claude rendering path. Codex runtime interpretation of cold-start
specs lives only in .harness/adapters/codex.md § Cold-start specifications.

Model settings are task defaults in manifest.codex.agents, not benchmarked optimality claims.
Luna/high handles narrow bookkeeping and documentation checks; Sol/medium handles routine
implementation and design; Sol/high handles analysis and independent review; Sol/xhigh is
reserved for difficult debug review. Actual runtime availability must be checked.

See 04-validate/codex-validation.md for commands, observed outputs, actual independent
review identities, native runtime capability results and limitations. Synthetic launches in
Node tests are confined to disposable Git fixtures and never certify this change.
