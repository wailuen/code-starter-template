---
name: doctor
description: "Environment health-check for this repo. Read-only: tool versions, git config, GitHub auth — all at once with remediation."
---

`/doctor` surfaces every environment issue at once, with an actionable fix per finding — so you
see the full picture before starting work, not one cryptic failure at a time.

## Steps

1. Run the checks below (read-only — this command never changes anything itself).
2. Present the results grouped by status, not buried in prose. For any failing check, state the
   fix in plain language (this repo has non-technical users — `.claude/rules/communication.md`):
   the next step the user takes must be something they can act on without a technical glossary.
3. If everything is clean, say so plainly and name what to do next (e.g. `/analyze` or `/todos`
   if no workspace exists yet).

## Checks

Read `.harness/guides/project-profile.md` first: its § Identity names the project's language(s)
and its § Commands and § Test infrastructure name the tools the project needs. Check those, plus
the always-required tools below.

| Check         | Command                                    | What it verifies |
| ------------- | ------------------------------------------- | ----------------- |
| Node.js       | `node --version`                            | Version 22 or newer (`.harness/README.md`) — always required, because the harness's own tools (`.harness/bin/*.mjs`) run on Node, whatever language the project itself uses |
| git           | `git --version`                             | Present (mandatory) |
| git identity  | `git config user.name && git config user.email` | Set, so commits carry real authorship |
| line endings  | `git config core.autocrlf`                  | Not `true` on a repo that expects LF — fighting normalization causes noisy diffs |
| GitHub CLI    | `gh --version && gh auth status`            | Present and authenticated — needed for `/deploy`, `/sweep`, PR workflow |
| GitHub `workflow` permission | `gh auth status` — read the `Token scopes:` line of the active account | Lists `workflow`. Without it GitHub refuses any push that adds or changes a file under `.github/workflows/`, so the first wave's automatic checks (CI) cannot be uploaded. A login that shows no scopes line (for example a token supplied through an environment variable) reports "could not check" rather than pass or fail |
| GitHub remote | `git remote get-url origin && gh repo view --json nameWithOwner` | The project has a GitHub repository to push to and open pull requests against |
| Project runtime(s) | the version command for each language/runtime in the profile's § Identity (e.g. `python3 --version`, `go version`, `node --version`) | Present, at the version the project expects |
| Project toolchain | the first word of each filled-in profile § Commands row (package manager, test runner, migration tool) — `command -v <tool>` | Installed and on the PATH |
| Test infrastructure | whatever the profile's § Test infrastructure says provisions throwaway services (e.g. `docker --version`) | Present, so Tier 2/3 tests can run |

Each check that depends on the project profile being filled in reports "N/A — profile not filled
in yet" (or "N/A — not scaffolded yet") rather than a failure while the relevant rows are still
`<unset>`. Never guess a runtime the profile does not name.

## Remediation phrasing

State each fix as an action the user can take, not a diagnostic term. Offer to do it for the
user first ("I can do this for you — say yes"), and give the official download page as the
fallback. Never ask a non-technical user to type a command themselves; if a step needs a
window only they can use (an installer, a password prompt, a browser sign-in), say so plainly
and tell them their password goes into that window, never into the chat. The checks stay
read-only: a fix runs only after the report, once the user has said yes to it.

- **Node missing/too old** → "Install Node.js 22 or newer (the JavaScript runtime the
  workflow's helper tools need) — get the current LTS version from nodejs.org."
- **A project runtime or tool missing** → name the tool, say in one line what it is for, and
  give the official install page — e.g. "Install Python 3.12 (the language this project is
  written in) from python.org."
- **git identity unset** → "Git doesn't yet know the name to put on your saved work. Tell me
  the name to use, and I'll set it with your GitHub private email address (it keeps your real
  email out of the project's history)." The agent then runs `git config user.name` and
  `git config user.email` with those values; the private address is
  `<id>+<login>@users.noreply.github.com`, with `id` and `login` from `gh api user`.
- **core.autocrlf=true on Windows** → "Windows' automatic line-ending conversion is on; it
  fights this repo's line-ending convention. Say yes and I'll turn it off for this project."
  The agent runs `git config core.autocrlf false`.
- **gh not authenticated** → "You're not logged in to GitHub yet. Say yes and I'll start the
  login: I show you a short one-time code and open a GitHub page; type the code there, then
  click Authorize." The agent runs `gh auth login --hostname github.com --git-protocol https
  --web --scopes workflow`, so the login includes the `workflow` permission from the start.
- **`workflow` permission missing** → "Your GitHub login can't upload the automatic checks
  (CI) yet. Say yes and I'll add that permission: I show you a one-time code and open a GitHub
  page; type the code there and click Authorize." The agent runs
  `gh auth refresh --hostname github.com --scopes workflow`.

## Notes

This is a lightweight, repo-local check — it has no relationship to any other project or
multi-repo setup (the harness ships none; see `.harness/README.md` § "Not included").
