# Project profile

The harness is stack-neutral. Rules, roles and phases never name a language, framework,
package manager or database; when they need a concrete command or path they point here.
Fill this file in once, at the start of a project (`/analyze` does it if it is still blank),
and keep it current. An agent that needs a value still marked `<unset>` asks the user or
derives it from the repository — it never guesses.

## Identity

| Key | Value | Notes |
| --- | --- | --- |
| Project name | `<unset>` | Used for the workspace directory name. |
| Workspace | `workspaces/<project>/` | Analysis, plans, todos, specs, journal and review evidence. |
| Primary language(s) | `<unset>` | e.g. TypeScript, Python, Go, Kotlin. |
| Application shape | `<unset>` | e.g. web app + API, CLI, library, mobile app, data pipeline. |
| Source roots | `<unset>` | e.g. `src/`, `app/`, `cmd/`, `web/`. |
| Test roots | `<unset>` | e.g. `tests/`, `__tests__/`, `*_test.go`. |
| UI framework and design system | `<unset>` | e.g. React + the project's component library; `n/a` with no user interface. |
| `delivery_mode` | `standard` | `standard` or `light` (`.harness/guides/task-delivery.md` § Light mode); `/analyze` recommends, and the user chooses before `/todos` plans the first wave. |

## Commands

Each command must exit 0 on success and non-zero on failure. Leave a row `n/a` (with a
reason) when the project genuinely has no such step.

| Purpose | Command | Notes |
| --- | --- | --- |
| Install dependencies | `<unset>` | |
| Lint | `<unset>` | |
| Type / static check | `<unset>` | |
| Unit tests (Tier 1) | `<unset>` | Fast, isolated, mocking allowed. |
| Integration tests (Tier 2) | `<unset>` | Real services (database, queue, cache) — see § Test infrastructure. |
| End-to-end tests (Tier 3) | `<unset>` | Real app driven like a user (e.g. a browser runner). |
| Local CI parity | `<unset>` | One command that runs everything CI runs except the production build. Must exit 0 before the first push of a branch. Before the project has any code, write `n/a — no code yet`; a documents-only branch then pushes without it and says so in the commit body. |
| Production build | `<unset>` | Reserved for `/deploy`. |
| Start the app locally | `<unset>` | Used by headed browser walk-throughs (`.harness/rules/e2e-god-mode.md`) and E2E. |
| Database migrate (dev) | `<unset>` | Only when the project has a database. |
| Database migrate (test) | `<unset>` | Must refuse to target anything but a throwaway test database. |
| Database migrate (production) | `<unset>` | Run only by `/deploy` Step 3 (owner: `backend-specialist`), with the user's confirmation of that deploy. |
| Dependency outdated check | `<unset>` | Lists dependencies with newer versions; `/sweep` Sweep 9. |
| Dependency security audit | `<unset>` | Lists dependencies with known security advisories; exits non-zero on any; `/sweep` Sweep 9. |

## Release

Only for a project that publishes versions; otherwise `n/a`. Used by
`guides/task-delivery.md` § Releases.

| Key | Value |
| --- | --- |
| Version source (single file holding the version) | `<unset>` |
| Changelog / release notes file | `<unset>` |
| Publish command (package registry, app store upload) | `<unset>` |

## Production

Where the product runs. `/analyze` recommends values with the stack; `/deploy --onboard`
confirms them with the user and writes the operational detail to `deploy/deployment-config.md`.
`n/a` for a project that is never deployed (a library, for example).

| Key | Value |
| --- | --- |
| Hosting platform and expected monthly cost | `<unset>` |
| Domain (address users type) | `<unset>` |
| Production database and its backups | `<unset>` |
| Who is alerted when production is down, and how | `<unset>` |
| `main_deploys_live` — can a merge into `main` change what is live? | `unknown` (set to `no` by `/deploy --onboard` once the host deploys only from the `production` branch; while `unknown` and the product may already be live — `.harness/rules/autonomous-execution.md` § What needs the user — every merge into `main` asks the user) |

## Test infrastructure

- **Tier 2/3 use real infrastructure.** Integration and end-to-end tests run against real
  services started for the test run — never against a shared development or production
  database, and never against mocks.
- **Throwaway, not shared.** Record here how a test run gets its own disposable instance
  (for example a container started and removed by the test command, or a per-run schema),
  and how leftovers are cleaned up if a run is interrupted.
- **Secrets for tests** come from environment variables (see § Configuration); never from
  committed files.

| Key | Value |
| --- | --- |
| How a test database/service is provisioned | `<unset>` |
| How orphaned test resources are cleaned up | `<unset>` |

## Configuration

| Key | Value |
| --- | --- |
| Config source | `.env` (git-ignored) with a committed `.env.example` listing every key without values |
| Secret store for deployed environments | `<unset>` |

## Mechanical checks

List any project-specific guard scripts here (secret scanning, forbidden-import checks,
dependency-boundary checks, generated-file drift). Rules and reviewers treat this table as
the inventory of what is enforced by tooling; anything not listed is enforced by review only.

| Check | Command | What a failure means |
| --- | --- | --- |
| Harness adapters match the manifest | `node .harness/bin/check-adapters.mjs` | A generated Claude/Codex adapter file drifted from `.harness/manifest.json`. |
| Harness self-tests | `node --test ".harness/tests/*.mjs"` | A harness tool regressed. |
| Secret scan | `<unset>` | A secret value is in the tree or in a saved review report; also run on reports before committing them (task-delivery § Review protocol and circuit breaker). |
