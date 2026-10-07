# <Project name>

<One line: what this project is and who it is for.>

This repository uses a shared delivery harness that Claude Code and Codex both follow.

1. Read `.harness/adapters/codex.md` first: how harness skills, subagents and Claude-only
   commands map to Codex.
2. Read and follow every `.harness/rules/*.md` and every `.claude/rules/*.md`. Codex does not
   load these automatically; they apply to every task. A `.claude/rules/` file that only
   points at `.harness/rules/<name>.md` means "follow that file".
3. Read `.session-notes` at the repository root if it exists — the previous session's handoff.
4. Read `.harness/guides/project-profile.md` for every concrete command (never guess one) and
   `.harness/guides/task-delivery.md` for workspace paths, branches and review rounds.

Phase skills, in order: `$analyze` → `$todos` → `$implement` → `$redteam` → `$codify`, with
`$debug` for a stalled review loop, `$fix` for a reported bug and `$learn` for open lessons.
`$codify` also runs on its own at set points (`.harness/phases/codify.md` § When it runs).
All commands are listed in `.harness/README.md`.
