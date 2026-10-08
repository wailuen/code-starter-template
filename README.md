# code-starter-template

A starter template for building any software project with Claude Code (and optionally
Codex), in any language. It ships a delivery harness — phases, rules, agents, skills and a
few checking tools — that takes a project from requirements to a reviewed, deployed change.

**New to vibe coding? Start with the step-by-step tutorial:** [docs/tutorial.pdf](docs/tutorial.pdf)
(with drawings) or [docs/tutorial.md](docs/tutorial.md). It walks you from writing a PRD to a
live app, with the exact prompts to type at each step.

## Use it

1. Click **Use this template** on GitHub (or copy `.claude/`, `.harness/`, `AGENTS.md` and the
   `.gitignore` entries into an existing repository — merge with any `CLAUDE.md` / `AGENTS.md` /
   `.gitignore` it already has; `/analyze` then documents the existing system instead of
   researching a new product). Replace the copyright holder in `LICENSE` with yours, or swap
   in the licence your project uses.
2. Nothing to fill in by hand: `/analyze` proposes the values for
   `.harness/guides/project-profile.md` and the project line in `.claude/CLAUDE.md` and
   `AGENTS.md`, and writes them once you agree. (You can also fill them in yourself.)
3. Start Claude Code in the repository and run `/start`.

The harness's own tools need Node.js 22+, whatever language the project uses:

```bash
node .harness/bin/check-adapters.mjs      # generated command files match the manifest
node --test ".harness/tests/*.mjs"        # harness self-tests
```

## How the harness maps to the SDLC

Each software-development-lifecycle stage has one command that owns it. Everything a command
produces lives under `workspaces/<project>/` (deployment records under `deploy/`), so the next stage — and the next session — can
pick it up.

| SDLC stage | Command | What happens | What it leaves behind |
| --- | --- | --- | --- |
| Setup | `/start`, `/doctor` | Orientation; check git, GitHub login and the runtimes the project needs | — |
| Requirements and discovery | `/analyze` | Research the problem, users and constraints; challenge assumptions; red-team the analysis | `briefs/`, `01-analysis/`, `02-plans/`, `03-user-flows/` |
| Architecture and design | `/analyze`, `/design` | Choose the stack and where it will run (with monthly cost), record decisions, write the specs; UI/UX standards for screens | `docs/adr/`, `specs/`, the project profile filled in |
| Screen design | `/prototype` | Every screen of every PRD phase as clickable pages that fit phone, tablet and desktop; design questions, your change requests, then **your approval**; skipped for a product with no screens | `prototype/` with the screen list, design language and your approval |
| Planning | `/todos` | Break the work into waves of todos, each with an acceptance contract and the approved screens it builds; **stops for your approval**; the first wave also sets up CI | `todos/WAVE-SEQUENCE.md`, `todos/active/wNN-MM-<slug>.md`, a frozen acceptance list with your approval |
| Changing your mind | `/todos` | Drop, park or re-plan approved work; the change is recorded with your words | A journal decision, a new acceptance list |
| Implementation | `/implement` | Build one todo test-first on its own branch, with backend, frontend and test specialists | Code, tests, the todo moved to `todos/completed/` |
| Testing | `/implement`, `/test` | Unit, integration and end-to-end tests; integration and end-to-end run against real, throwaway infrastructure | Test results and walk-through receipts in the todo |
| Code and security review | `/redteam` | Independent reviewers (correctness, plus security when needed) review the finished wave until two rounds in a row are clean; then you try the wave yourself | Review reports, a convergence receipt and a preview in `04-validate/` |
| Stuck review | `/debug` | When reviews keep failing, step back, find the real cause and replan before spending more rounds | A decision record in `04-validate/` |
| Release | ask for a release | The AI recommends the version number; version bump, release notes, tag | A tagged version |
| Deployment and rollback | `/deploy` | First time: recommend hosting with its cost and set up health checks, alerts and backups with you. Then: deploy, prove users see the new version, check for drift (`--check`), roll back (`--rollback`) | `deploy/deployments/`, a journal entry |
| Operating | `/deploy`, `/ws` | Health checks and alerts tell the person you named when production is down; `/ws` shows undeployed changes and open incidents | Alerts set up at onboarding |
| Bug fixes and incidents | `/fix` | Record the bug with a severity (S1–S4), reproduce it with a failing test, fix the root cause, one independent review; an S1 first asks you whether to undo the last update | `fixes/<id>-<slug>.md` |
| Maintenance and housekeeping | `/sweep`, `/validate`, `/ws` | Audit outstanding work, dependency and security updates (run `/sweep` at least monthly), check standards, show status | A sweep report |
| Retiring the product | `/deploy --decommission` | Export the data you keep, take the service down, stop the costs — each step with your OK | A decommission record |
| Learning | `/journal`, `/learn`, `/codify` | Record decisions and discoveries; `/codify` folds lessons about the harness itself back into it automatically after each wave (including anything `/debug` traced to the harness), at `/wrapup`, and after a bug fix that taught something | `journal/`, harness updates by pull request |
| Session continuity | `/wrapup` | Save where things stand; the next session reads it first | `.session-notes` |

## How to use it, day to day

1. **Set up once.** Create a repository from this template, run `/start`, then `/analyze`
   with a description of what you want to build. `/analyze` proposes the tech stack and fills
   in `.harness/guides/project-profile.md` once you agree. For a small personal project (a
   prototype or hobby with no real users' data or money) it suggests **light mode**: fewer
   review rounds and less paperwork, the same tests and the same questions to you; you pick
   the mode together with the stack (`.harness/guides/task-delivery.md` § Light mode).
2. **Design the screens.** Run `/prototype`. It asks about the look you want, then shows every
   screen of every phase as clickable pages you can try at phone, tablet and desktop size.
   Ask for changes until it is right, then approve it; planning and building follow it.
3. **Plan a wave.** Run `/todos`. Review the plan it shows you and approve it — nothing is
   built until you do. Approval freezes that wave's scope; changing your mind later is
   supported, but it means re-planning that part under a new name.
4. **Build.** Run `/implement` for each todo (or let it take the next one). Each todo is built
   test-first on its own branch and gets one independent review before it joins the wave.
5. **Review the wave.** Run `/redteam`. It repeats independent review until two rounds in a
   row are clean, shows you the result to try, then the wave merges into `main` by pull
   request. If review keeps failing, it routes to `/debug` instead of looping.
6. **Ship.** Run `/deploy`. The first time, it recommends where to host the product and what
   that costs, walks you through anything only you can do (an account, billing, a domain),
   and sets up health checks and alerts that reach you. Production runs a separate
   `production` branch, so once `/deploy` setup has checked your host, merging work into `main`
   never changes what users see; only `/deploy` does. Until then, don't connect a hosting
   service yourself — if one is already connected, say so, and every merge asks you first. If users are hurt, `/fix` asks first
   whether to undo the last update (`/deploy --rollback`), then fixes the cause.
7. **Repeat** steps 3–6 wave by wave.

Along the way:

- **A bug is reported** → `/fix`. Small, contained fixes skip the full planning cycle; a fix
  that turns out to need new behavior is converted into a todo proposal for `/todos`.
- **You notice something outside the current task** → it is fixed now only if small and
  related; otherwise it is recorded as a follow-up (a parked todo proposal, a `/fix` record,
  or a harness backlog item) — never dropped.
- **Ending a session** → `/wrapup`. **Starting one** → the next session reads the notes
  automatically; `/ws` shows where everything stands.
- **The harness learns as it goes.** Lessons are written to the journal as they happen, and
  `/codify` folds them into the harness's own rules and guides automatically — after each
  wave (including anything `/debug` traced to the harness), at `/wrapup`, and after a bug
  fix that taught something. Each update is independently reviewed by pull request. Only
  updates to reference guides and harness notes merge on their own; anything that changes the
  AI's rules, roles, skills, commands or what it may do without you waits for your OK. `/ws` shows what is waiting.

You decide at a few fixed points — plan approval, trying the result, deploying or undoing a
deploy, spending money, anything destructive or public, and questions only you can answer (the
full list: `.harness/rules/autonomous-execution.md` § What needs the user). Between those points
the agents proceed on their own and report what they did with evidence.

Every command is listed with one line in `.harness/README.md`, which also explains the
layout, the shared rules and what the harness deliberately does not include.

## Layout

- `docs/` — the beginner tutorial (`tutorial.pdf` to share, `tutorial.md` to read online). Both are built from `build_tutorial.py`: edit that file, then run `python3 docs/build_tutorial.py` (needs `pip install reportlab`).
- `.claude/` — Claude Code entry point (`CLAUDE.md`), rules, agents, skills and commands.
- `.harness/` — shared phases, roles, guides, rules and tools used by both Claude Code and Codex.
- `AGENTS.md` — Codex entry point. Codex users run
  `node .harness/bin/check-adapters.mjs --write --codex` once; it generates the Codex skill and
  agent files (`.agents/`, `.codex/`) from `.harness/manifest.json`. Claude-only users can delete
  `AGENTS.md`. Keep
  `.claude/` even with Codex only: the harness tools load code from it. A Codex client without
  native custom agents cannot pass `/redteam`'s security review gate; see
  `.harness/adapters/codex.md` § Known limitations.
