# One delivery harness, two native adapters

A stack-neutral delivery workflow for building any software project with Claude Code
(and, optionally, Codex). Edit shared procedures in `phases/`, delivery policy in `guides/`
and `rules/`, role briefs in `roles/`, and executable controls in `bin/` and `lib/`.
These are the single implementations used by both runtimes.

| Phase | Claude Code | Codex skill |
| --- | --- | --- |
| Analyze | `/analyze` | `$analyze` |
| Prototype every screen, for approval | `/prototype` | `$prototype` |
| Plan todos | `/todos` | `$todos` |
| Implement | `/implement` | `$implement` |
| Review | `/redteam` | `$redteam` |
| Reassess a stalled review | `/debug` | `$debug` |
| Fix a reported bug | `/fix` | `$fix` |
| Fold lessons into the harness | `/codify` | `$codify` |
| List lessons not yet folded in | `/learn` | `$learn` |

These are generated from `manifest.json`. Select the equivalent skill in the Codex app when
its UI uses skill selection rather than CLI syntax. Codex's native CLI/IDE skill marker is
`$`; use `$implement <todo>` or select `implement`.

Claude-only commands (`.claude/commands/`; in Codex, read the file and follow it directly —
`adapters/codex.md`):

| Command | Purpose |
| --- | --- |
| `/start` | Orientation for a new user. |
| `/ws` | Read-only workspace status. |
| `/wrapup` | Write `.session-notes` at the repository root for the next session. |
| `/sweep` | Repo-wide audit of outstanding work before calling a cycle done. |
| `/journal` | Create, list or search `workspaces/<project>/journal/` entries. |
| `/deploy` | Onboard, deploy, check drift, roll back, or decommission (`deploy/deployment-config.md`). |
| `/validate` | Check a change against the project's standards. |
| `/test` | Testing quick reference. |
| `/design` | UI/UX standards quick reference. |
| `/doctor` | Read-only environment health check. |
| `/worktree` | Create a sibling worktree for parallel work, with the PR-to-main loop. |
| `/autonomize` | Run autonomously inside the user's approved envelope. |

Workspace paths, branch names, the review-round budget and the release steps are defined once,
in `guides/task-delivery.md`.

## Starting a new project

1. Copy `.claude/`, `.harness/` and the `.gitignore` entries into the new repository (and
   `AGENTS.md` if you use Codex — then generate the Codex files with step 5). Keep `.claude/` even with Codex
   only: the tools in `bin/` and `lib/` load `.claude/hooks/lib/`.
2. Fill in `guides/project-profile.md` — language, source/test roots, and the commands for
   lint, type check, the three test tiers, local CI parity and build. `/analyze` proposes
   values once the stack is chosen; rules and roles read every concrete command from there.
3. Run `node .harness/bin/check-adapters.mjs` (adapters match the manifest) and
   `node --test ".harness/tests/*.mjs"` (harness self-tests). Both need Node.js 22+ and git
   2.31+ — the harness's own tooling is JavaScript regardless of the project's language.
4. Fill in the project line in `.claude/CLAUDE.md` (Claude Code loads it automatically, the
   same as a root `CLAUDE.md`) and, if you use Codex, in the root `AGENTS.md` (Codex only looks
   at the repository root). They are the session entry points: they point at this file, the
   project profile and the runtime adapter, and tell a new session to read `.session-notes`
   first. If the project already has its own root `CLAUDE.md` or `AGENTS.md`, merge the two
   instead of keeping both.
5. Optional — Codex: `node .harness/bin/check-adapters.mjs --write --codex` generates
   `.agents/skills/` and `.codex/agents/`; from then on the checker verifies them too. Read
   `adapters/codex.md` § Known limitations before relying on Codex for `/redteam`.
6. Optional — a project adopting the harness mid-life can set `grandfather_pin` in
   `manifest.json` to main's tip at adoption, so already-completed todos are not re-audited by
   `check-redteam-convergence-receipt.mjs --sweep workspaces`. Leave it `null` on a new project.

## Shared invariants

- One approved task contract and todo store; implementation does not redefine acceptance.
- Complete review rounds, unchanged convergence receipt requirements, bounded retries.
- One main-checkout `.claude/learning/` state store for both tools and all worktrees, created
  on first use. Do not create a second `.codex/learning` or `.harness/learning` store.
- Integration and end-to-end tests run against throwaway real infrastructure provisioned per
  run, never shared development data (`guides/project-profile.md` § Test infrastructure).
- Never manufacture a reviewer launch record or treat a subagent finishing as a clean
  review verdict.

## Shared state

`.claude/hooks/lib/state-resolver.js` resolves the main checkout root from any worktree and
`state-io.js` reads/writes the review-round state with symlink-refusing I/O. They live under
`.claude/` for compatibility but serve both runtimes. `.claude/hooks/package.json` pins them
to CommonJS so a project-level `"type": "module"` cannot change how Node loads them.

## Tools

| Tool | Purpose |
| --- | --- |
| `bin/check-adapters.mjs` | Verifies (or with `--write`, regenerates) the generated Claude/Codex adapter files from `manifest.json`. Exit 0 match, 1 drift or invalid manifest, 2 usage. A stale generated Codex file (exactly the generator's template text) counts as drift and `--write` removes it; any other file there is left alone with a note. `--write` refuses to write outside the repository or through any symlink, before writing anything. |
| `bin/check-task-contract.mjs` | Validates a todo's `## Delivery contract` block before implementation, including that `approved_by` names a person. Exit 0 ready; 1 not ready, unreadable or usage. |
| `bin/record-review-round.mjs` + `lib/redteam-stall.cjs` | Records each complete review round of any scope (todo, wave, fix, plan, analysis, codify) and enforces the round budget / reassessment rules. |
| `bin/check-redteam-convergence-receipt.mjs` | Decides whether a scope converged (`--workspace workspaces/<project> --scope <scope>`), whether a todo is closed (`--workspace workspaces/<project> --todo <id>`), sweeps every completed todo (`--sweep workspaces`), and prints a receipt skeleton (`--template <scope>`). |
| `bin/check-codify-allowlist.mjs` | `<base-ref> <head-ref>`: exit 0 only if an automatic `/codify` change stays inside the allowlist (`phases/codify.md` § Automatic runs); 1 findings, 2 usage or git error. |
| `bin/check-browser-walk-receipts.mjs` | Checks a todo declares its browser walk (or why it does not apply). |
| `bin/check-prototype.mjs` | `[--require-approval] workspaces/<project>`: checks the clickable prototype's structure (every screen listed, linked and present; nothing loaded from the internet) and prints each PRD phase's content hash and approval status. With `--require-approval`, exit 0 only when every phase is approved for its current pages or held by the user, and the screen check passed or the user accepted it as owed. Exit 0 ok, 1 findings, 2 usage or no prototype folder. |

## Not included

The harness deliberately ships without the following; a project that needs one adds it and
records it in `guides/project-profile.md` § Mechanical checks:

- **Hooks.** No `.claude/settings.json` hooks or Codex hooks are configured, so no rule is
  enforced mechanically at tool-call time. Every rule's Enforcement section says what review
  has to catch instead. Reviewer launch rows in `.claude/learning/dispatch-reconcile/` are
  therefore not written automatically; the convergence checker treats a missing live ledger
  as advisory and relies on the committed ledger.
- **A database test runner.** How a throwaway test database or service is provisioned is
  stack-specific and lives in the project's own test tooling.
- **Multi-repo or upstream sync, telemetry, multi-operator coordination.** The harness assumes
  one repository and one operator at a time.

## Maintenance

Adapter metadata is in `manifest.json`. If it changes, regenerate with
`node .harness/bin/check-adapters.mjs --write` and review the diff. Do not edit generated
adapters to fork policy. Harness defects that are not product work go in `backlog/`.
Native tool mappings live in `adapters/`; runtime-specific features belong there, not in a
competing policy copy. Start fresh Claude and Codex sessions after updating the harness; in
Codex, review project trust with `/hooks` if the project adds hooks.

Codex interfaces were checked against the official references:
[skills](https://learn.chatgpt.com/docs/build-skills),
[subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[hooks and trust](https://learn.chatgpt.com/docs/hooks).
