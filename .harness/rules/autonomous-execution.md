---
priority: 0
scope: baseline
---

# Autonomous execution

The user defines the outcome and operating envelope. The agent implements and verifies
within it. Explicit user authorization persists across turns: never re-request an
approval the user already gave, and don't stop merely to propose work already
authorized. Stop to ask only when you are genuinely uncertain and the point is not
already covered by a user decision (a brief, a ratified plan, a journal `DECISION-`
entry, or something the user said this session). Destructive, hard-to-reverse or
outward-facing actions still need confirmation unless the user already gave it for that
action.

## Delivery policy

For `/analyze`, `/todos`, `/implement`, `/redteam`, `/debug` and `/fix`, follow
`.harness/guides/task-delivery.md`. It supersedes per-edit reviews, mandatory
build/wire splits and unlimited same-approach retries. Security and data-integrity
requirements remain obligations; a retry limit is reassessment, never permission to ship
defects.

Choose the simplest design that satisfies the accepted requirements. Estimate work
from observed implementation and verification effort, not an assumed 10x multiplier.
Agent capacity has context, coordination, dependency and infrastructure limits.
Parallelize independent work with disjoint mutable resources; more agents are not a
remedy for an unresolved architectural decision or a contaminated shared test database.

## Structural vs execution gates

Plan approval, release authorization, material envelope changes and accepted security
risks require the user's authority unless already granted. Routine implementation,
diagnosis, test execution, independent review and in-envelope root-cause fixes proceed
autonomously. When an architectural choice materially changes behavior, authority,
resources or accepted risk, prepare the concrete alternatives and surface it promptly.
Do not queue a necessary decision until a stalled review loop happens to converge.

If a question comes up partway, first do everything that doesn't depend on the answer.
If one part turns out to be blocked, complete every other part in full and say exactly
what you left out and why — the whole task is the deliverable, and scaling it down is
the user's call. A step you have decided on is something to run, not to announce:
describing the next step and ending the turn leaves it undone until the user replies.

## Root-cause fixes

Fix the mechanism when evidence establishes a better in-envelope design. A finding
report is an example to explain, not the entire repair specification. Verify the
generalized property across sibling dimensions and preserve regression coverage.
If a root cause comes back in a later review round on the same branch, reassess the
design before adding another exception (§ Bounded repair cycles). Do not introduce a
second parallel implementation or an increasingly large enumeration of cases when a
simpler structural boundary solves the class.

When it will not affect the end result, edit the part of a file that needs changing
rather than rewriting the whole file.

## Problems found along the way

When you find a problem the current task did not ask about — a failing test, a warning,
a defect, a missing piece — fix it in the current change if it is small and related to
that change. Otherwise record it as a follow-up with its evidence, in the one place
that fits:

- **Product scope addition** (a missing feature, new behavior) → a todo proposal: a file
  `workspaces/<project>/todos/parked/<slug>.md` in the active workspace naming what is
  missing, the evidence and where it was found, with a first line
  `Source: <found-along-the-way | fix <fix-id> | hotfix <fix-id>>`. It joins the plan only through `/todos`
  (`.harness/phases/todos.md` § Workflow step 1) and its plan approval, never by writing
  straight into `todos/active/`.
- **Bug in already-built behavior** → a `/fix` record (`.harness/phases/fix.md`).
- **Harness defect** (a phase, rule, role, guide or tool of this harness) → an item in
  `.harness/backlog/`.
- **INCREMENTAL review finding** that meets the four conditions of
  `.harness/rules/product-completion-first.md` MUST-2 → the deferred-quality list (GitHub
  issues labelled `deferred-quality`, revisited by `/sweep` Sweep 8).

Say in your summary which you did. Never drop it silently, and never let it silently
enlarge the current task. Other files point here rather than restating the list.

Before acting on a failing test, establish whether it reflects code, a changed
environment, or another process's mutation.

## Per-session capacity budget

One implementation slice should fit all of:

- ≤500 lines of load-bearing logic (not generated/CRUD boilerplate).
- ≤5–10 simultaneous invariants.
- ≤3–4 cross-file reasoning hops.
- ≤15k lines of relevant source in working context.
- One integrated outcome whose intent can be described concisely.

Size at `/todos` time and recheck as work grows. These are triggers to reconsider
decomposition and architecture, not evidence that an estimate is correct. Crossing the
budget, materially expanding owned paths, or needing a stronger threat model requires
reassessment before further repair. Split at an actual invariant/interface boundary
and preserve end-to-end acceptance. Boilerplate volume alone does not require splitting.

## Bounded repair cycles

Record every complete review round with `.harness/bin/record-review-round.mjs`. The
recorder enforces two limits; the exact behavior is in
`.harness/rules/redteam-stall-debug.md`:

- **Round cap.** A branch gets three counted rounds in total, and the count never
  resets. If a round at or past the cap is not clean, the branch's next round must be
  its single debug round (`/debug`, a new decision record, reviewers never used on the
  branch). If that does not converge, a named human must accept each further round.
- **REPLAN.** A root cause recorded in any earlier non-clear round on the branch comes
  back, or four non-clean rounds pass in a row since the last decision record. Run
  `/debug` and record a changed approach before another repair cycle.

The cap usually fires first. Security work follows the same limits while all unresolved
security obligations remain blocking. An approved new approach restarts the REPLAN
interval; it does not reset the round cap, erase failure history, or waive the final
convergence verifier.

## Handoff and recovery

Leave a coherent checkpoint and concise record of acceptance status, current commit,
test environment/evidence, open defects, architectural decisions and next action.
Preserve a recoverable good state. Independent reviewers work on pinned checkouts;
mutation probes never edit a live implementer's tree. Report uncertainty and blockers
accurately.
