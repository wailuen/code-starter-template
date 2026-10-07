# Harness Backlog

Self-maintenance items for the harness itself — `.harness/` tooling, `.claude/` rules, skills,
agents and commands, review plumbing — as opposed to the product being built. This separation
exists so a harness fix discovered mid-review doesn't silently inflate the product's own todo
list with something the user never asked for.

## Filing an item

One file per item: `harness-NN-<slug>.md`, where `NN` is a flat, incrementing number — check
the highest existing number in this directory before assigning a new one. Do not reuse a
number, even after a file is resolved and removed.

Each file should state: what's wrong, why it matters, and (if known) the fix. No fixed
template beyond that — this is a lightweight backlog, not a spec.

## Referenced from

- `.harness/guides/task-delivery.md` § Harness backlog — `todos/` holds product scope only
- `.harness/roles/todo-manager.md` — flags a misfiled harness item found in `todos/`
