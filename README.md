# code-starter-template

A starter template for building any software project with Claude Code (and optionally
Codex), in any language. It ships a delivery harness — phases, rules, agents, skills and a
few checking tools — that takes a project from requirements to a reviewed, deployed change.

## Use it

1. Click **Use this template** on GitHub (or copy `.claude/`, `.harness/` and `AGENTS.md`
   into an existing repository — merge with any `CLAUDE.md` / `AGENTS.md` it already has).
2. Fill in `.harness/guides/project-profile.md` with the project's language and commands, and
   the project line in `.claude/CLAUDE.md`. `/analyze` proposes the profile values once the
   stack is chosen.
3. Start Claude Code in the repository and run `/start`.

The harness's own tools need Node.js 22+, whatever language the project uses:

```bash
node .harness/bin/check-adapters.mjs      # generated command files match the manifest
node --test ".harness/tests/*.mjs"        # harness self-tests
```

## Workflow

| Command | Purpose |
| --- | --- |
| `/analyze` | Requirements, architecture and the project profile |
| `/todos` | Plan into todos with acceptance contracts |
| `/implement` | Build a todo test-first |
| `/redteam` | Independent correctness and security review until converged |
| `/fix` | Fix a reported bug (hotfix path for production incidents) |
| `/deploy` | Ship, verify, roll back |
| `/codify`, `/learn` | Fold lessons back into the harness |
| `/wrapup` | Save session notes so the next session resumes cleanly |

Every command is listed with one line in `.harness/README.md`, which also explains the
layout, the shared rules and what the harness deliberately does not include.

## Layout

- `.claude/` — Claude Code entry point (`CLAUDE.md`), rules, agents, skills and commands.
- `.harness/` — shared phases, roles, guides, rules and tools used by both Claude Code and Codex.
- `AGENTS.md`, `.agents/`, `.codex/` — Codex entry point, phase skills and agent settings,
  generated from `.harness/manifest.json`. Delete them if you only use Claude Code.
