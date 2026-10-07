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
| Local CI parity | `<unset>` | One command that runs everything CI runs except the production build. Must exit 0 before the first push of a branch. |
| Production build | `<unset>` | Reserved for `/deploy`. |
| Start the app locally | `<unset>` | Used by headed browser walk-throughs (`.harness/rules/e2e-god-mode.md`) and E2E. |
| Database migrate (dev) | `<unset>` | Only when the project has a database. |
| Database migrate (test) | `<unset>` | Must refuse to target anything but a throwaway test database. |

## Release

Only for a project that publishes versions; otherwise `n/a`. Used by
`guides/task-delivery.md` § Releases.

| Key | Value |
| --- | --- |
| Version source (single file holding the version) | `<unset>` |
| Changelog / release notes file | `<unset>` |
| Publish command (package registry, app store upload) | `<unset>` |

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
