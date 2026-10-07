---
name: ws
description: "Show workspace status dashboard. Read-only."
---

Display the current workspace status. Do not modify any files. Write for a user who may not be
technical: plain words, no file paths unless they help the user act.

## 1. Waiting for you — always first, even when no workspace exists

List every decision only the user can make, each as a question in the format in
`.claude/rules/communication.md` § Asking the user to decide. If there are none, say "Nothing is
waiting for you." Check each of these:

- **Plan awaiting approval** — a `docs/wNN-plan` branch (local or on the remote) with todos but
  no `04-validate/acceptance-wNN.md` on `main`.
- **Wave preview** — any `04-validate/<scope>-preview.md` still ending `User answer: pending`
  (`.harness/phases/redteam.md` § 4).
- **Review stopped for a decision** — a branch whose latest round record led to
  `ESCALATE_TO_HUMAN` (the recorder's state, or a `round-<scope>-<n>.json` after the debug round
  with no later round), or a residual in a receipt or decision record that names no human
  acceptor yet.
- **Undeployed changes** — when `deploy/deployment-config.md` exists, the drift from
  `/deploy --check`, and any open fix record with `Deploy hold: yes`.
- **Open S1/S2 bugs** — fix records in `workspaces/*/fixes/` whose `Status:` is not `closed`,
  with what users are affected by.
- **Harness changes awaiting your OK** — lessons whose latest `.harness/codify-log.md` row is
  `awaiting user` (classify exactly as `.harness/phases/learn.md` step 1), with the pull request
  or backlog item holding the change; say in one line what it would change for the user.
- **Open product questions** — journal `GAP` entries with no later entry that resolves them.
- **Parked hotfix follow-ups** — parked proposals whose first line is `Source: hotfix <fix-id>`:
  that area shipped on an emergency review and still needs its full review through `/todos`.

## 2. Where the project stands

List all directories under `workspaces/` (excluding `instructions/` and every directory whose
name starts with `_`). For the most recently modified workspace (or `$ARGUMENTS`):

- Workspace name and path.
- Current phase, from the most advanced of these that is true (each needs its own artifact,
  not just a folder):
  - `convergence-wNN.json` on `main` for the latest wave → wave NN reviewed and merged
  - a `round-wNN-<n>.json` without a converged receipt → wave NN in review (`/redteam`)
  - `todos/completed/` files for the current wave → building wave NN (`/implement`)
  - `04-validate/acceptance-wNN.md` → wave NN approved, ready to build
  - `todos/active/` files with no acceptance list → plan written, awaiting approval
  - `01-analysis/` files → analysis done; next is `/todos`
  - `briefs/` only → next is `/analyze`
- Counts: todos in `todos/active/` vs `todos/completed/`; open records in `fixes/`; pending
  proposals in `todos/parked/` with the oldest's age.
- A `completed/` todo is CLOSED only when
  `node .harness/bin/check-redteam-convergence-receipt.mjs --workspace workspaces/<project> --todo <id>`
  exits 0 — either a converged `/redteam` receipt covers it (`CLOSED`), or it was completed
  before the gate existed (`grandfathered — pre-gate`, shown as such, never as awaiting);
  otherwise show it as `implemented — awaiting convergence`, never "done".
- Harness lessons: the open count (and that `/codify` will run at the next trigger,
  `.harness/phases/codify.md` § When it runs) and deferred lessons with their revisit condition.
- If `.session-notes` exists at the repository root, its contents and age.

### Missing-phase scan

Flag a missing canonical directory only when the phase that creates it should already have
run (git does not keep empty directories, so an emptied `todos/active/` is normal):

```
!! MISSING: briefs/        — no brief yet; ask the user what they want to build
!! MISSING: 01-analysis/   — todos exist without /analyze; run it before more planning
!! MISSING: todos/         — /implement work without /todos; halt and plan first
```

The flag is advisory, not a failure.

### Journal

Count entries by type and show the 3 most recent (number, type, date, topic).

## 3. Recommended next step

End with one line: the single next action you recommend and why, in plain words (for example
"Approve the wave 2 plan so building can start" or "Run `/redteam` — all wave 1 todos are
built").
