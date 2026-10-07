
## Trigger

Run when the complete-round recorder returns exit 2 (`REPLAN` or `DEBUG_ROUND`), the
scope/complexity budget is exceeded, or evidence shows the implementation and review share
a mistaken assumption. `REPLAN` fires when a root cause recorded in any earlier non-clear
round on the branch comes back (clean rounds in between don't reset it), or after four
non-clear rounds since the last decision record. `DEBUG_ROUND` fires when the branch's
three-round budget is spent without convergence. This applies to security work too, and
it does not waive any open defect. Exit 3 (`ESCALATE_TO_HUMAN`) is not a `/debug` trigger:
stop and ask the user (`.harness/guides/task-delivery.md` § Review protocol and circuit
breaker).

`/debug` reassesses a stalled review loop. A newly reported bug in built behavior goes
through `/fix` instead.

Read `.harness/guides/task-delivery.md` and the current delivery contract.

## 1. Establish facts

Pin the branch/commit and retain a recoverable checkpoint. Inspect the acceptance
criteria, trusted/untrusted boundary, actual integration path, test isolation, changed
surface size, and findings grouped by root cause. Separate fresh product defects,
regressions caused by patches, repeated mechanisms, new requirements and environment
faults. A reproduced attack must name the capability needed to launch it.

## 2. Independent assessment

Use a fresh correctness reviewer and, for trust-bearing work, a security-reviewer
with Read and Bash. Each uses its own pinned checkout and disposable probe copy.
First provide the contract and source without leading fix instructions; ask for
independent hypotheses. Then supply the recurrence history and ask why previous fixes
did not eliminate the mechanism. Fresh context does not require repeating a full audit
of unrelated repository surfaces.

The question is now: which design or verification change will end this failure class?
Compare at least the existing approach with one structural alternative. Include
ordinary infrastructure failure, concurrency, retained handles, cleanup and rollback.
Do not default to another enumeration of objects, paths or adversarial examples.

## 3. Decide before resuming

Write a decision record at `workspaces/<project>/04-validate/replan-<scope>-<n>.md` (`<n>`
is the round that will cite it) with open findings, the mechanism of non-convergence,
alternatives and trade-offs, chosen approach, owned paths, updated acceptance and
boundary assumptions, and a discriminating experiment. Choose one:

- Redesign the boundary or abstraction and test the whole property.
- Split the work at a real invariant boundary while preserving integrated acceptance.
- Repair or isolate the test environment, then re-establish the baseline.
- Continue with a justified changed verification approach and named stopping condition.

Proceed autonomously within existing authorization. If the decision changes product
behavior, authority or accepted security risk, surface the concrete choice now. Never
queue that choice until convergence; it may be what convergence depends on.

If the mechanism lies in the harness itself — a misleading rule, a missing check, a wrong
role brief — rather than in the product, file it as a `.harness/backlog/` item on this branch
(`.harness/rules/autonomous-execution.md` § Problems found along the way). `/codify` picks it
up automatically when the wave merges into `main` (`.harness/phases/codify.md` § When it
runs); until then this branch keeps working under the harness text it already has and is not
merged with `main` mid-review (`.harness/guides/task-delivery.md` § Branches, pull requests
and merging).

## 4. Resume with evidence

Update the current todo's contract; run the readiness checker and the discriminating
experiment. The next complete-round JSON cites the decision file as `replan`
(repository-root-relative path; each decision record is consumed by the first round that cites it, except that an errored round's re-run may cite it again). The
recorder keeps the branch's full root-cause history and round count; a decision record
starts a new non-clear streak but never resets the three-round budget. After
`DEBUG_ROUND`, the next round is the branch's single debug round: `"debug": true`, this
new `replan`, and reviewer ids never used on the branch (for example `correctness-debug`).
If `replan_closes` claims a root cause is closed, a later recurrence of it fires again.
Capture concise evidence, not an ever-growing narrative pasted into every source file.

Use the normal `/redteam` completion gate after the revised implementation. The cap,
an approved redesign, or one clean lens is never a convergence verdict. If the new
approach repeats the same mechanism again, reassess again rather than quietly grinding.
