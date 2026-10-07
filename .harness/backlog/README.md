# Harness Backlog

Self-maintenance items for the harness itself — `.harness/` tooling, `.claude/` rules, skills,
agents and commands, review plumbing — as opposed to the product being built. This separation
exists so a harness fix discovered mid-review doesn't silently inflate the product's own todo
list with something the user never asked for.

## Filing an item

One file per item: `harness-NN-<slug>.md`, where `NN` is a flat, incrementing number — check
the highest existing number in this directory — on the current branch, on `main` and on every
unmerged local branch (`git ls-tree -r <branch> --name-only -- .harness/backlog/`) — before
assigning a new one. Do not reuse a
number, even after a file is resolved and removed.

Each file should state: what's wrong, why it matters, and (if known) the fix. No fixed
template beyond that — this is a lightweight backlog, not a spec.

## Referenced from

- `.harness/guides/task-delivery.md` § Harness backlog — `todos/` holds product scope only
- `.harness/roles/todo-manager.md` — flags a misfiled harness item found in `todos/`
- `.harness/phases/debug.md` § 3 — a stall whose mechanism lies in the harness
- `.harness/phases/learn.md` step 1 — every backlog item is a lesson until `.harness/codify-log.md` closes it
- `.harness/phases/codify.md` § Automatic runs — holds a waiting change when no pull request can be opened
- `.harness/rules/autonomous-execution.md` § Problems found along the way
