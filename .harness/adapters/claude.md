# Claude runtime adapter

Use the generated `/analyze`, `/prototype`, `/todos`, `/implement`, `/redteam`, `/debug`, `/fix`,
`/codify` and `/learn` commands (from `.harness/manifest.json`); the other `.claude/commands/` are
Claude-only helpers listed in `.harness/README.md`.
Their procedures and delivery roles live in `.harness/`; edit the shared files.
Resolve all paths from the repository root. Read the shared task-delivery guide, the
project profile (`.harness/guides/project-profile.md`) and the applicable shared rules before
execution. Claude Code loads `.claude/rules/*.md` itself; the six that are pointers to
`.harness/rules/` must be followed through to the shared file. Restart sessions after updating the harness. Keep the main-checkout
`.claude/learning/` directory: it is shared storage, not a Claude-only state partition.

## Agent dispatch mapping

The shared phase files (`.harness/phases/*.md`) and role briefs (`.harness/roles/*.md`)
describe review/implementation work by ROLE ("independent reviewer," "security reviewer,"
"the implementation specialist") because they're shared with Codex, which has its own native
subagent naming. For Claude Code, don't leave that mapping to inference — dispatch the named
agent explicitly via the Agent tool, using the `subagent_type` below:

| Role in phase/role prose                            | `subagent_type`            | Agent file |
| ----------------------------------------------------- | ---------------------------- | ---------- |
| independent / correctness reviewer                    | `reviewer`                   | `.claude/agents/quality/reviewer.md` |
| security reviewer / security-bearing review           | `security-reviewer`          | `.claude/agents/quality/security-reviewer.md` |
| analyst / failure-point analysis / requirements breakdown | `analyst`                 | `.claude/agents/analysis/analyst.md` |
| implementer — new behavior that is neither server-side nor UI (CLI, library, script, data job) | `tdd-implementer` | `.claude/agents/implementation/tdd-implementer.md` |
| implementer — fixing a build/type error only, no new behavior | `build-fix`           | `.claude/agents/implementation/build-fix.md` |
| implementer — server side: APIs, data access, migrations, auth, background jobs | `backend-specialist` | `.claude/agents/implementation/backend-specialist.md` |
| implementer — user interface: screens, components, client state, E2E walk-throughs | `frontend-specialist` | `.claude/agents/implementation/frontend-specialist.md` |
| todo status ("what's left in wave N", parked proposals) — read-only | `todo-manager` | `.claude/agents/management/todo-manager.md` |
| GitHub issue/PR filing, CI status, issue hygiene       | `gh-manager`                 | `.claude/agents/management/gh-manager.md` |
| documentation / cross-reference / terminology validator | `gold-standards-validator` | `.claude/agents/quality/gold-standards-validator.md` |
| test architecture, E2E generation, infra compliance    | `testing-specialist`         | `.claude/agents/testing/testing-specialist.md` |
| UI/UX design only (no product code): information architecture, AI-interaction UX, the `/prototype` pages | `uiux-designer` | `.claude/agents/design/uiux-designer.md` |

For a small task inside one of these lenses, doing it directly is usually faster than
delegating — dispatch a subagent for genuinely independent, sizeable work, not every review
comment (`.harness/rules/agent-delegation.md` § Ownership and delegation).

Use the stack specialists (backend, frontend) for implementation todos in their area and
`tdd-implementer` for work that fits neither. A project with a distinct specialty (a mobile
client, a data pipeline, an AI/model layer) adds its own agent file in the same thin shape —
frontmatter plus a pointer to `.harness/roles/implementer.md` and the project-specific context
it must read — and a row in the table above.

Where a phase or role brief calls for an agent that doesn't exist (`.harness/phases/analyze.md`
names a possible future `value-auditor`, for instance), use the closest agent above instead —
usually `analyst` for an analysis-shaped gap, `reviewer` or `gold-standards-validator` for a
compliance-shaped one — rather than dispatching a `subagent_type` that doesn't exist.

## Reviewer launch evidence

No Claude hook records reviewer launches by default (`.harness/README.md` § Not included).
When `/redteam` dispatches reviewers, record each dispatch's agent type and ID in the
committed evidence ledger yourself, exactly as `.harness/phases/redteam.md` describes. Never
invent a launch row for a dispatch that did not happen.

## Prototype design tool and browser

In `/prototype` (`.harness/phases/prototype.md` step 3), Claude Design may be used when its
tools are available in the session, to explore layouts and show them to the user. If the
session cannot reach it, tell the user they can type `/design-login` and finish the sign-in in
their browser, and carry on with the static pages meanwhile; never type the project's own
`/design` command for this, which only loads design principles. Whatever is explored there,
the approved design is the copy saved in `workspaces/<project>/prototype/`, which every later
phase reads.

For the screen check (step 5) before the project has an E2E runner, use a headed browser the
session can drive (the Playwright or Claude in Chrome tools when connected).

## External design tools

If the project keeps its designs in an external design tool with a sync command that only the
owner may start, track every owed sync, tell the owner in plain words which command to run and
what changed, and never call the sync tool outside that owner-started command. Record the
project's sync conventions in the workspace, not in this file.
