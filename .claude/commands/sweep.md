---
name: sweep
description: "Comprehensive outstanding-work audit for this repo — workspaces, GitHub issues, redteam-vs-specs gaps, and process hygiene. End-of-cycle gate before /wrapup."
---

## Purpose

A `/sweep` is the structural defense against "I think we're done." Before declaring a session
converged or starting fresh work, surface every class of outstanding item: in-flight todos,
open GitHub issues, spec-vs-code gaps, stale workspace state, and process hygiene.

Distinct from `/redteam` (scopes to one workspace's spec compliance) — `/sweep` is repo-wide and
rolls every workspace's status into one view. The harness assumes a single, standalone project
(no sibling repos, no multi-repo roll-up — see `.harness/README.md` § "Not included").

## Execution Model

Runs every sweep below sequentially, accumulates findings into one management decision report
(§ Output). Every finding is CATEGORY-classified per `.claude/rules/product-completion-first.md`
(BUG / INVEST-NOW ISSUE / INCREMENTAL IMPROVEMENT — severity ranks, never gates fix-vs-defer):
BUG + INVEST-NOW → fix now (an INVEST-NOW judgment call is surfaced at the report's Decision
Points for direction); INCREMENTAL → the deferred-quality tracking list (where each kind of
follow-up goes: `.harness/rules/autonomous-execution.md` § Problems found along the way). You may fix a trivial
BUG inline (`.claude/rules/zero-tolerance.md` Rule 1: "if you found it, you own getting it fixed"), but every
finding still gets surfaced with its category and disposition — deferring a completion-blocking
finding as "incremental" is BLOCKED.

## Workflow

Run all 10 sweeps below. Aggregate findings into the management decision report (§ Output) —
each finding carries category, severity (rank only), disposition, and a pointer (file:line, PR#,
issue#).

### Sweep 1: Active todos across all workspaces

```bash
find workspaces/*/todos/active/ -name "*.md" 2>/dev/null
```

No workspace exists yet if this is empty — that's a clean result, not a finding. Once
workspaces exist: group by workspace and wave (the `wNN` in each `wNN-MM-<slug>.md`
filename; `todos/WAVE-SEQUENCE.md` gives the order). Also list open bug-fix records
(`workspaces/*/fixes/*.md` whose `Status:` is not `closed`) with their severity — an open S1
or S2 is a BUG in the immediate queue. Also list pending todo proposals
(`workspaces/*/todos/parked/*.md`) with a count and the oldest's age; flag each whose first line is
`Source: hotfix <fix-id>` as an open hotfix follow-up — that area shipped on an emergency review
and still needs its `/redteam` through `/todos`. Classify
each stale (>7d untouched) item into one of three dispositions (`.claude/rules/value-prioritization.md`
MUST-3+4) — never "stale" alone, never auto-close: **(a) still-wanted** (re-validate the
value-anchor, re-queue), **(b) abandon-with-user-gate** (recommend closure, surface to the user
— auto-closing as not-planned is BLOCKED), **(c) queued-with-value-rank** (alive, lower priority,
needs an explicit anchor). An item with no value-anchor at all surfaces as its own finding.

### Sweep 2: GitHub open issues

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
gh issue list --repo "$REPO" --state open --limit 50 \
  --json number,title,labels,createdAt,updatedAt,comments
```

Categorize: closeable (delivered code already merged, per `.claude/rules/git.md` § Discipline),
genuinely actionable, or stale. A stale issue routes through the same three-disposition
classification as Sweep 1 — age alone never closes it (`.claude/rules/value-prioritization.md` MUST-4).

### Sweep 3: Open PRs and stale branches

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
gh pr list --repo "$REPO" --state open --limit 50 \
  --json number,title,headRefName,isDraft,createdAt,statusCheckRollup
git branch --format='%(refname:short)'                            # unfiltered local enumeration
git for-each-ref --format='%(refname:short)' refs/remotes/origin  # unfiltered remote enumeration
git branch -r --no-merged origin/main 2>&1 | grep -v "HEAD ->"    # a RANKER on top of the above, not the source
```

Surface: drafts >7d old, PRs with a red required check (never merge over red — fix on the same
branch), remote branches with no open PR, local-only branches. Enumerate unfiltered first, then
use `--no-merged` only to rank — it hides anything tip-equal to `origin/main`, which is exactly
what an abandoned branch looks like once main catches up
(`.claude/rules/instrument-discipline.md` MUST-3(b): read the hits, not the tally).

### Sweep 4: Redteam gaps against specs

If no `workspaces/*/specs/_index.md` lists a spec file yet, record "N/A — no specs
authored yet" and move on. Otherwise: for each spec file, extract its literal acceptance
assertions (function signatures, API shapes, endpoints, security tests) and verify each against
the actual source with `grep`, the project's type/static check (project profile § Commands), or a quick syntax-tree check — the same protocol the analyst agent uses
for `/redteam` (`.harness/roles/analyst.md` § Spec-to-code traceability). Categorize each finding
as **Orphan** (spec section citing nothing that exists), **Drift** (code changed, spec didn't),
**Coverage gap** (code exists, no spec section covers it), or **Stub** (spec describes behavior
that isn't actually implemented — `.claude/rules/spec-accuracy.md`).

### Sweep 5: Workspace and worktree hygiene

```bash
find . -maxdepth 1 -name .session-notes -mtime +30        # stale session notes (repo root only)
git worktree list                                          # linked worktrees still checked out
```

Surface: `.session-notes` untouched >30 days (rewrite it with `/wrapup` or delete it). For worktrees: a tree with
no uncommitted changes and whose commits are already reachable from `origin/main` or a merged PR
is safe to remove (`git worktree remove <path>`) — removing the directory never deletes the
branch (`.claude/rules/worktree-isolation.md` Rule 8). A tree with real uncommitted work, or
commits on no remote and no merged PR, is a KEEP — name it and why, don't touch it.

### Sweep 6: Process hygiene

```bash
git status --short
git rev-list --left-right --count origin/main...HEAD 2>/dev/null
# search the project profile's source roots (§ Identity), not dependency/vendor directories
git grep -nE 'TODO|FIXME|HACK|XXX' -l -- <source roots> 2>/dev/null | head -20
```

Surface: uncommitted changes, branch ahead/behind `origin/main`, new stub markers in production
code (BLOCKED per `.claude/rules/zero-tolerance.md` Rule 2 — test files are exempt).

### Sweep 7: Release readiness

Once the project's version file (wherever the project keeps its single version source) carries a real version and there's at least one tag: determine what's
genuinely unreleased since the latest stable tag.

```bash
# plain vX.Y.Z tags only — excludes prerelease (-rc1) tags
LATEST=$(git tag --sort=-version:refname | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
[ -n "$LATEST" ] && git log --oneline "$LATEST"..HEAD -- <source roots> 2>/dev/null
```

No tags yet, or no version file: record "N/A — not yet publishing" and move on. The release
steps themselves are in `.harness/guides/task-delivery.md` § Releases. Flag
"unreleased work" only when the shippable-code diff is non-empty — a docs-only or `.claude/`-only
diff doesn't ship.

### Sweep 8: Deferred-quality revisit

The deferred-quality backlog is net-negative without this revisit — items deferred and never
revisited just decay (`.claude/rules/value-prioritization.md` Origin).

```bash
gh issue list --label deferred-quality --state open \
  --json number,title,body,labels,createdAt --limit 100
```

Group by revisit trigger (`after-milestone:<name>` | `on-demand`). Surface a "still wanted?" gate
for anything deferred two or more sweeps ago. Recommend a disposition per item — implement,
re-defer with a fresh value-anchor, or close with the user's sign-off — never auto-close.

### Sweep 9: Dependency and security updates

Run periodically — at least once a month on a project with users — even when nothing else is
outstanding. Run the project profile's "Dependency outdated check" and "Dependency security
audit" commands (`.harness/guides/project-profile.md` § Commands; a row still `<unset>` is
itself a finding), and check the platform's base-image or runtime notices. Note in the report
that the update check ran, with the date: `/ws` reads it to say when the next one is due.

Surface: dependencies with a known security advisory (a BUG when the vulnerable code path is
reachable, otherwise INVEST-NOW), runtimes or base images past end of support, certificates or
domains close to expiry, and major-version upgrades waiting. Updating a dependency is a normal
`/fix` (for an advisory) or a todo proposal (for an upgrade that changes behavior); removing or
downgrading one needs the user (`.harness/rules/autonomous-execution.md` § What needs the user).

### Sweep 10: Harness lessons and backlog

Classify lessons exactly as `.harness/phases/learn.md` step 1 does. Surface open lessons (the
next `/codify` folds them in), waiting ones as questions for the user, deferred ones whose
revisit condition is now met; list in-progress lessons (in an open codify pull request) with
that pull request, not as open.

## Output

Write the report to `workspaces/<project>/04-validate/sweep-<date>.md` (if a workspace is
active) or `SWEEP-<date>.md` at repo root, and commit it on a `docs/sweep-<date>` branch merged
by pull request (`.harness/guides/task-delivery.md` § Branches, pull requests and merging). `/sweep` is a management decision report, not a
status dump. It carries, in order:

1. **Completion status** — which milestones are complete and visible, each citing a durable receipt.
2. **Prioritized immediate queue** — open BUGs and INVEST-NOW items, value-ranked, each with its implication.
3. **Deferred-quality backlog** — INCREMENTAL items grouped by revisit trigger, each with a value-anchor.
4. **Decision points** — INVEST-NOW-vs-defer judgment calls, each with implications and honest
   pros/cons and a recommended disposition (`.claude/rules/recommendation-quality.md` MUST-1/2/3)
   — never a bare menu, never silently self-decided.
5. **Recommendation** — recommended next steps for the user to approve, with an estimate of
   how many autonomous work cycles the open queue needs
   (`.harness/rules/product-completion-first.md` MUST-4).

Each finding row: `[CATEGORY][SEVERITY][Sweep N] <title>` + location + disposition + evidence.
Before committing, scrub any local absolute path (`/Users/<you>/...`) from the report.

## Closure

Before reporting `/sweep` complete:

1. All 10 sweeps ran and their findings are accumulated (an empty result from a sweep whose
   precondition doesn't hold yet — no workspace, no specs, no tags — is a clean N/A, not skipped).
2. Trivial fixes applied inline are reclassified `FIXED` with the commit SHA in the row's
   Disposition column (not only in `git log`) — the SHA is what lets a later `/redteam` verify
   closure.
3. Non-trivial findings are filed where `.harness/rules/autonomous-execution.md` § Problems
   found along the way says for their kind — a `/fix` record, a todo proposal in
   `todos/parked/`, a harness backlog item, or a `deferred-quality` issue — never straight into
   `todos/active/`.
4. Report committed.
5. Optional: get the user's sign-off on the recommended next-session scope.

The report is the deliverable. Recommend the next step; the user decides.
