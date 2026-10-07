---
priority: 0
scope: baseline
---

# Git Workflow Rules

## Conventional Commits

Format: `type(scope): description`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

```
feat(auth): add OAuth2 support
fix(api): resolve rate limiting issue
```

**Why:** Non-conventional commits break automated changelog generation and make `git log --oneline` useless for release notes.

## Branch Naming

Format: `type/description` (e.g., `feat/add-auth`, `fix/api-timeout`). Branch types: `feat/`, `fix/`, `docs/`, and `release/v<X.Y.Z>`. An S1 fix uses an ordinary `fix/<id>-<slug>` branch (`.harness/phases/fix.md`).

Which branch each kind of work uses, what it is cut from and where it merges is defined once in `.harness/guides/task-delivery.md` § Branches, pull requests and merging. Follow that table; do not restate it elsewhere. Each branch has its own review-round budget there, which is why review kinds don't share a branch.

**Why:** Inconsistent branch names prevent CI pattern-matching rules and make `git branch --list` unreadable.

### Release-Prep PRs Use The `release/v*` Branch Convention

Open any PR whose diff is metadata-only — version anchors (the project's version manifest, e.g. `package.json`, `pyproject.toml`, `Cargo.toml`) and spec/doc version-line updates — from a branch named `release/v<X.Y.Z>`, not `feat/`, `fix/` or `chore/`. Work that is not metadata-only splits: code goes on `feat/`/`fix/`, release prep on its own `release/v*`.

```bash
# DO — git checkout -b release/v3.23.0 (auto-skips PR-gate matrix)
# DO NOT — git checkout -b feat/v3.23.0-release-prep (fires full matrix on metadata-only diff)
```

**Why:** PR-gate workflows can be configured to skip on a `release/` head ref, saving a full test-matrix run per release-prep PR; a project adopting this convention should add that skip to its CI.

### Pre-FIRST-Push CI Parity Discipline

Before the first `git push` that creates a remote branch, run the **Local CI parity** command recorded in `.harness/guides/project-profile.md` § Commands, and push only when it exits 0.

- A change touching the database or another real service (queue, cache, external API double) must also pass the profile's **Integration tests (Tier 2)** command, run against a throwaway instance provisioned for that run (project profile § Test infrastructure) — never the shared dev database.
- A change touching the database layer (a migration, the data-access module, or any schema/catalogue list) must also pass every database catalogue/migration check the profile lists under § Mechanical checks, both on this worktree's dev database after the dev migrate command and on a throwaway test database.
- The **Production build** command is excluded — production builds are reserved for `/deploy`. Checks the profile marks as CI-only stay in CI.
- If the profile still shows `<unset>` for Local CI parity, derive the command set from the CI workflow (or ask the user) and record it in the profile before pushing.
- A skipped check is acceptable only when it is genuinely inapplicable to the diff, or the user explicitly told you to skip it; record the skip and its reason in the commit body.

**Why:** CI minutes are paid for whether a run passes, fails or is cancelled — if CI cancels in-progress runs on a new push (e.g. GitHub Actions `concurrency: cancel-in-progress: true`), the cancelled run is still billed — so a push, CI failure, fix-up and re-push costs several times what a local pre-flight does.

## Branch Protection

Protected repos require PRs to main; GitHub rejects direct pushes. The workflow is: branch, commit, push, open a PR, then merge once its gate has passed. Which merges need the user's confirmation — including any use of `gh pr merge --admin`, which bypasses branch protection — is set by `.harness/rules/autonomous-execution.md` § What needs the user. Merge with a merge commit, never squash or rebase: the convergence receipt pins `verdict_head`, which must stay reachable from `main` (`.harness/guides/task-delivery.md` § Branches, pull requests and merging).

**Why:** Direct pushes bypass CI checks and code review, allowing broken or unreviewed code to reach the release branch.

## PR Description

The agent's system prompt provides the template. Always include a `## Related issues` section (e.g., `Fixes #123`).

**Why:** Without issue links, PRs become disconnected from their motivation, breaking traceability and preventing automatic issue closure on merge.

## Destructive Working-Tree Ops Verify A Clean Working Tree First

`git reset --hard <ref>`, `git clean -f[d]`, and `rm -rf` of untracked paths silently and irrecoverably destroy uncommitted work — unstaged modifications and untracked, non-ignored files have no reflog. Before running any of them, confirm `git status --porcelain` is empty. Prefer `git reset --keep <ref>` (aborts on a dirty tree) and `git clean -n` (preview). To set work aside, capture it to a patch file rather than `git stash -u`: the stash is a `.git`-scoped stack that any linked worktree can pop (`.claude/rules/worktree-isolation.md` Rule 9). No hook enforces this; a project that adds one should name it here.

```bash
# DO — git reset --keep origin/main; git clean -n (loud refusal / preview)
# DO NOT — git reset --hard origin/main; git clean -fd (wipes M + untracked; no reflog)
```

**Why:** Unlike a force-push, the loss is unrecoverable (no reflog); `--keep` and `clean -n` turn silent loss into a loud refusal or a preview.

## Rules

- Atomic commits: one logical change per commit, tests and implementation together.
- No direct push to main. No force push to any shared branch without the user's confirmation, and never to main.
- No secrets in commits (API keys, passwords, tokens, .env files).
- No large binaries (>10MB single file).
- Commit bodies answer **why**, not **what** (the diff shows what).

```
# DO — body explains why: "(BulkCreate silently swallowed per-row exceptions; alerting never fired.)"
# DO NOT — body restates the diff: "(Added logger.warning call in _handle_batch_error.)"
```

**Why:** Mixed commits are impossible to revert cleanly and leaked secrets require rotation everywhere; commit bodies explaining "why" are the cheapest institutional documentation.

## Discipline

- **Issue closure:** `gh issue close <N>` includes a commit SHA, PR number or merged-PR link in the comment; never close with no code reference. Closing an issue as won't-do (`--reason "not planned"`) needs the user's confirmation (`.harness/rules/autonomous-execution.md` § What needs the user).
- **Pre-commit hook bypass:** document any hook bypass (including `--no-verify`) in the commit body and record a follow-up (`.harness/rules/autonomous-execution.md` § Problems found along the way); never bypass silently.
- **Commit-message accuracy:** a commit body describes only changes actually present in the diff. If a message over-claimed (a refactor, deletion or side effect that isn't there), push a follow-up commit that delivers what it said — do not amend.

**Why:** Issues closed without code references break traceability, undocumented workarounds make every session rediscover the same fix, and over-claiming commit bodies poison `git log --grep`.

- **Check CI and merge as separate steps:** (1) read — pin the head SHA (`gh pr view <N> --json headRefOid`) and confirm every required check is `SUCCESS` on that SHA; (2) merge — only then run `gh pr merge <N> --merge`. Do not bundle them (`gh pr checks <N> && gh pr merge <N>`, or `--watch` then merge). If the repository has no required checks, a green `gh pr checks` proves nothing: run the profile's Local CI parity on the pinned head first and say so in the PR (`.harness/rules/autonomous-execution.md` § What needs the user).

```bash
# DO — READ pinned to head, THEN merge as a separate command
head=$(gh pr view <N> --json headRefOid -q .headRefOid)
gh pr checks <N>   # every REQUIRED check SUCCESS on $head?
gh pr merge <N> --merge
# DO NOT — bundle (watch may be green on the prior commit)
gh pr checks <N> --watch && gh pr merge <N> --merge
```

**Why:** A `--watch` returning green may have resolved against the prior commit's run while a newer duplicate on the current head is still pending or flaked red; separating the read (pinned to the head SHA) from the merge makes the gate verifiable.

## Enforcement

No hook checks the rules above automatically. Catching a violation depends on the agent applying the rule and on review. A project that adds a hook for any of them should name it here.
