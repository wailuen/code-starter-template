---
name: ws
description: "Show workspace status dashboard. Read-only."
---

Display the current workspace status. Do not modify any files.

1. List all directories under `workspaces/` (excluding `instructions/` and every directory whose name starts with `_`).

2. For the most recently modified workspace (or `$ARGUMENTS` if specified):
   - Show workspace name and path
   - Derive current phase from filesystem:
     - Has `01-analysis/` files -> Analysis done
     - Has `todos/active/` files -> Todos created
     - Has `todos/completed/` files -> Implementation in progress
     - Has `04-validate/` files -> Validation done
     - A `/codify` DECISION entry exists in `journal/` -> Codification done
   - Count files in `todos/active/` vs `todos/completed/`, and open records in `fixes/` (Status not `closed`)
   - Count pending todo proposals in `todos/parked/` and name the oldest with its age; flag every
     proposal whose first line is `Source: hotfix <fix-id>` (`!! HOTFIX FOLLOW-UP:`) — that area
     shipped on an emergency review and awaits its `/redteam` through `/todos`
   - A `completed/` todo is CLOSED only when `node .harness/bin/check-redteam-convergence-receipt.mjs --workspace workspaces/<project> --todo <id>` exits 0 — either a converged `/redteam` receipt covers it (`CLOSED`), or it was completed before the gate existed (`grandfathered — pre-gate`, shown as such, never as awaiting); otherwise show it as `implemented — awaiting convergence`, never "done"
   - List the 5 most recently modified files in the workspace
   - If `.session-notes` exists at the repository root, show its contents and age

### Missing-phase scan

Before reporting the summary, check for missing canonical phase dirs:

- `briefs/`, `01-analysis/`, `02-plans/`, `03-user-flows/`, `04-validate/`, `journal/`, `todos/active/`, `todos/completed/`

For each missing dir, emit a flagged warning at the TOP of the output (use
`!! MISSING:` prefix so it's visually loud in plain terminals):

```
!! MISSING: briefs/        — /analyze likely skipped; ask user for a brief
!! MISSING: 01-analysis/   — architecture work without /analyze; run it before /todos
!! MISSING: todos/active/  — /todos was skipped; halt and run it before /implement
```

Missing-phase dirs are NOT a failure — they are a signal that the
corresponding phase has not run yet. The flag is advisory.

### Journal

- Read the workspace's `journal/` directory
- Count total entries and entries by type
- Show the 3 most recent entries (number, type, date, topic)

3. Present as a compact summary.
