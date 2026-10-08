# <Project name>

<One line: what this project is and who it is for.>

This repository uses a shared delivery harness. Start here:

- `.harness/README.md` — how the harness works and every command.
- `.harness/guides/project-profile.md` — language, source/test roots and the exact commands
  for lint, tests, local CI parity and build. Never guess a command; read it there.
- `.harness/adapters/claude.md` — which agent to dispatch for each role.
- `.harness/guides/task-delivery.md` — workspace paths, branches, review rounds, releases.
  Phase commands read the sections they need; there is no need to read it all up front.

At the start of a session, read `.session-notes` at the repository root if it exists, then
run `/ws` for the workspace state.

Phases, in order: `/analyze` → `/prototype` → `/todos` → `/implement` → `/redteam` → `/codify`, with `/prototype`
skipped for a product with no screens, `/debug` for a stalled review loop, `/fix` for a reported bug, `/learn` for open lessons, and `/deploy`
to ship. `/codify` also runs on its own at set points (`.harness/phases/codify.md` § When it runs). End a session with `/wrapup`. New users: `/start`.
