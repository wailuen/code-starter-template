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
  no `04-validate/acceptance-wNN.md` on that branch (one that has it is approved and only
  waiting to merge).
- **Prototype awaiting approval** — a `docs/prototype-<n>` branch (local or on the remote)
  that is not yet merged into `main` (`git merge-base --is-ancestor <branch> main` fails) and
  whose `prototype/APPROVAL.md` has no more approval records than `main`'s; and, on `main`, any
  PRD phase that `node .harness/bin/check-prototype.mjs workspaces/<project>` reports as
  `awaiting approval` (held by the user, or changed since its approval). Name the phases
  (`.harness/phases/prototype.md` step 8).
- **Prototype screen check owed** — `prototype/SCREENS.md` on `main` ends with
  `Screen check: owed`; the design was shown unchecked and the check still has to run
  (`.harness/phases/prototype.md` step 5).
- **Wave preview** — any `04-validate/<scope>-preview.md` still ending `User answer: pending`
  (`.harness/phases/redteam.md` § 4).
- **Review stopped for a decision** — a branch whose latest round record led to
  `ESCALATE_TO_HUMAN` (the recorder's state, or a `round-<scope>-<n>.json` after the debug round
  with no later round), or a residual in a receipt or decision record that names no human
  acceptor yet.
- **Deploy setup not finished** — when the project profile's `main_deploys_live` is still
  `unknown` and the product may already be live (`.harness/rules/autonomous-execution.md`
  § What needs the user defines it): every merge into `main` waits for the user's OK — "this
  may put it live for your users" — until `/deploy --onboard` confirms `main` does not deploy;
  list those merges.
- **Undeployed changes** — when `deploy/deployment-config.md` exists, the drift from
  `.claude/commands/deploy.md` § Check Mode (read-only; follow it directly), and any fix record
  (open or closed) with `Deploy hold: yes`. Ask the user whether to run `/deploy`.
- **Open S1/S2 bugs** — fix records in `workspaces/*/fixes/` whose `Status:` is not `closed`,
  with what users are affected by.
- **Harness changes awaiting your OK** — lessons whose latest `.harness/codify-log.md` row is
  `awaiting user` (classify exactly as `.harness/phases/learn.md` step 1), with the
  `docs/codify-<slug>-ask` pull request or branch holding the change; say in one line what it
  would change for the user. Lessons "in progress" in an open codify pull request are listed
  under § 2, not here.
- **Open product questions** — journal `GAP` entries without the `harness` tag and with no
  later entry that resolves them.
- **Open pull requests into `main`** — any not merged after its gate passed (for example
  waiting for the user), with what it is waiting for.
- **Sweep decisions** — every decision point in the newest sweep report
  (`workspaces/*/04-validate/sweep-<date>.md` or a root `SWEEP-<date>.md`) not yet answered.
- **Update check due** — when the newest sweep report (either location) that ran Sweep 9 (or no
  such report at all, once the product is deployed) is more than a month old: "Dependency and
  security updates were last checked N days ago. Run `/sweep`?"
- **External setup the next wave needs** — any credential or account the plan asked the user
  for (`.harness/guides/task-delivery.md` § Before a wave starts) and not yet provided.
- **Parked hotfix follow-ups** — parked proposals whose first line is `Source: hotfix <fix-id>`:
  that area shipped on an emergency review and still needs its full review through `/todos`.

## 2. Where the project stands

List all directories under `workspaces/` (excluding `instructions/` and every directory whose
name starts with `_`). For the most recently modified workspace (or `$ARGUMENTS`):

- Workspace name and path.
- Current phase, from the most advanced of these that is true (each needs its own artifact,
  not just a folder). Read `main` and the open wave branch (`feat/wNN-<slug>`): completed todos
  and wave review rounds live on the wave branch until it merges.
  - a `convergence-wNN*.json` receipt (`wNN`, `wNNb`, …) on `main` for the latest wave → wave
    NN reviewed and merged (in light mode, the wave's CLEAR round record and its merge into
    `main`; `.harness/guides/task-delivery.md` § Light mode)
  - a `round-wNN*-<n>.json` without a merged receipt → wave NN in review (`/redteam`)
  - `todos/completed/` files for the current wave → building wave NN (`/implement`)
  - `04-validate/acceptance-wNN.md` → wave NN approved, ready to build
  - `todos/active/` files with no acceptance list → plan written, awaiting approval
  - `prototype/APPROVAL.md` on `main` with at least one phase the checker reports `approved`,
    or `prototype/00-no-screens.md` as the only file in `prototype/` → screens approved (or
    none needed); next is `/todos` (name any phase still awaiting approval)
  - `01-analysis/` files → analysis done; next is `/prototype` (or `/todos` for a product with
    no screens)
  - `briefs/` only → next is `/analyze`
- Counts: todos in `todos/active/` vs `todos/completed/`; open records in `fixes/`; pending
  proposals in `todos/parked/` with the oldest's age.
- In light mode (`delivery_mode: light` in the project profile), a `completed/` todo is CLOSED
  once its wave branch has merged into `main`; do not run the checker
  (`.harness/guides/task-delivery.md` § Light mode). In standard mode, a `completed/` todo is
  CLOSED only when
  `node .harness/bin/check-redteam-convergence-receipt.mjs --workspace workspaces/<project> --todo <id>`
  exits 0 — either a converged `/redteam` receipt covers it (`CLOSED`), or it was completed
  before the gate existed (`grandfathered — pre-gate`, shown as such, never as awaiting);
  otherwise show it as `implemented — awaiting convergence`, never "done".
- Harness lessons: the in-progress ones with their codify pull request, the open count (and that `/codify` will run at the next trigger,
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
