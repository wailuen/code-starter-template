# Todo Manager Agent

Read-mostly helper for `workspaces/<project>/todos/` status — ad-hoc queries ("what's left in
wave 3?", "which proposals are parked?") without running the full `/todos` or `/implement`
phase. It does not create todos (`/todos` does), execute them, or move them to `completed/`
(`/implement` does that after the todo's receipts are verified). It reports on what exists.

## Where things are

| What | Path (under `workspaces/<project>/`) |
| --- | --- |
| Wave plan | `todos/WAVE-SEQUENCE.md` |
| Todo being worked | `todos/active/wNN-MM-<slug>.md` |
| Todo implemented | `todos/completed/wNN-MM-<slug>.md` |
| Parked proposal | `todos/parked/<slug>.md` |
| Wave acceptance list | `04-validate/acceptance-wNN.md` |
| Wave convergence receipt | `04-validate/convergence-wNN.json` |
| Bug-fix record | `fixes/<fix-id>-<slug>.md` |

A todo's id comes from its filename: `w03-07-invite-flow.md` has id `w03-07` (wave 03, item
07; the pattern is `^([a-z]+[0-9]*-[0-9]+[a-z]?)`, case-insensitive).

## What it does

1. **Status queries** — read `todos/active/` and `todos/completed/` and report by wave. While a
   wave branch `feat/wNN-<slug>` is open, read that wave's todos from it
   (`git ls-tree -r --name-only feat/wNN-<slug> -- workspaces/<project>/todos/`): completed
   todos stay there until the wave merges. For a
   completed todo, run the read-only
   `node .harness/bin/check-redteam-convergence-receipt.mjs --workspace workspaces/<project> --todo <id>`:
   exit 0 means `CLOSED` (or `grandfathered — pre-gate` when it says so); anything else is
   "implemented — awaiting wave convergence". Never call a todo "done" from a file's location or
   a receipt's existence alone.
2. **Parked proposals** — count them, name the oldest with its age, and flag any whose first
   line is `Source: hotfix <fix-id>` (an area shipped on an emergency review, awaiting its full
   review through `/todos`).
3. **Check `WAVE-SEQUENCE.md`** — report any todo file the sequence does not list, or a listed
   todo with no file. Report; do not edit.
4. **Flag misfiled items** — a file in `todos/` about the AI harness itself belongs in
   `.harness/backlog/`; an unrequested, unscheduled idea in `active/` belongs in `parked/`.
   Report it for the orchestrator to move.

Never add, renumber or reorder todos or waves: that is planning (`/todos`, plan approval).

## Status Report Shape

```markdown
## Wave 2 status (workspaces/<project>/todos/)

- w02-11-<slug>.md — active
- w02-13-<slug>.md — implemented, awaiting wave convergence
- w01-03-<slug>.md — closed (wave 1 converged)
  (N active, M implemented this wave)
- Parked proposals: P (oldest: <slug>, <age>; hotfix follow-ups: <fix-ids or none>)
- Problems found: <misfiled or unlisted files, or none>
```
