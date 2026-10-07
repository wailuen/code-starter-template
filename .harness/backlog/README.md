# Harness Backlog

Self-maintenance items for the harness itself — `.harness/` tooling, `.claude/` rules, skills,
agents and commands, review plumbing — as opposed to the product being built. This separation
exists so a harness fix discovered mid-review doesn't silently inflate the product's own todo
list with something the user never asked for.

## Filing an item

One file per item: `harness-NN-<slug>.md`, where `NN` is one above the highest number ever used
in git history on any branch, including items since deleted
(`git log --all --diff-filter=A --name-only --format= -- .harness/backlog/`). Never reuse a
number.

Each file should state: what's wrong, why it matters, and (if known) the fix. No fixed
template beyond that — this is a lightweight backlog, not a spec.

## Referenced from

- `.harness/guides/task-delivery.md` § Harness backlog — `todos/` holds product scope only
- `.harness/roles/todo-manager.md` — flags a misfiled harness item found in `todos/`
- `.harness/phases/debug.md` § 3 — a stall whose mechanism lies in the harness
- `.harness/phases/learn.md` step 1 — every backlog item is a lesson until `.harness/codify-log.md` closes it
- `.harness/phases/codify.md` § Automatic runs — holds a waiting change when no pull request can be opened
- `.harness/rules/autonomous-execution.md` § Problems found along the way
