## Resolve and anchor

Resolve the named project/todo, otherwise the most recently modified real workspace
(exclude `instructions` and leading-underscore directories). Read briefs and
`todos/WAVE-SEQUENCE.md`; select the requested current-wave task or the highest-value
ready task in the lowest incomplete wave. A missing wave sequence returns to `/todos`.
Resolve `specs/_index.md` at the project root or workspace and read the relevant spec,
plan section, decisions, todo and current dependency source. Resolve conflicting spec
roots explicitly. Compare changed briefs with approved scope; mtime alone is not a
semantic change. Ask only if a material unapproved requirement changes the task.

Read `.harness/guides/task-delivery.md`; it governs this phase's task scope, review
cadence, isolation, branches and circuit breaker. Existing approval authorizes implementation.

Work on the todo's own branch, `feat/wNN-MM-<slug>` (`fix/wNN-MM-<slug>` for a defect todo),
cut from the wave branch `feat/wNN-<slug>`; create the wave branch from `main` first if this
is the wave's first todo (task-delivery § Branches, pull requests and merging).

## 1. Readiness and baseline

- Run `node .harness/bin/check-task-contract.mjs <todo.md>`. Hydrate a legacy task's
  contract from approved scope and independently ratify it before new implementation.
- Set one implementer/worktree owner and explicit paths. Parallel agents need disjoint
  writes and mutable infrastructure, not merely different worktree directories.
- Verify the baseline once. Integration tests run against throwaway real infrastructure
  provisioned per run, as recorded in `.harness/guides/project-profile.md` § Test
  infrastructure, or in isolated CI — never the shared development database. A private
  database on a shared server is insufficient for tests that change server-wide state.
- Classify baseline failures: in-scope defect, unrelated defect, or environment fault.
  Fix a defect outside the todo in this change when it is small and related; otherwise record
  it as a follow-up (task-delivery § Implement and verify). Repair the instrument before
  trusting its failures; do not repeatedly run a contaminated suite or silently dismiss
  failures as pre-existing.

## 2. Implement the integrated acceptance scenario

Use the relevant implementation specialist and test-first development for changed
behavior. No default requirement to spawn unrelated specialists for every task.
Keep the real caller, authorization, transaction, persistence and read-back connected.
For pure libraries the integrated scenario is the real consumer contract. Use the
project's own language, test runner and commands from `.harness/guides/project-profile.md`,
not conventions from another stack. External service configuration (for example an LLM
provider or model) comes from the project environment and owning specifications.

Before adversarial review, exercise normal operation, connection loss, timeout,
rollback, cancellation/resource release and concurrency where applicable. A bug fix
gets a regression test that fails for the defect; test the generalized property across
sibling cases. Do not weaken the acceptance oracle to make the implementation pass.

If the task grows beyond its complexity budget, needs a stronger attacker model, or a root
cause already recorded on this branch comes back, reassess immediately with `/debug`. Do not keep adding
guards until an architectural choice becomes unavoidable. Retain a recoverable good
checkpoint; preserve existing defects and security obligations when revising the approach.

## 3. Verify at a stable checkpoint

Run targeted tests during edits and affected regression checks once at completion.
Review one coherent checkpoint, not every file edit or bookkeeping commit. Independent
correctness review is required; security/trust-bearing work also gets independent
security review. Reviewers inspect pinned separate checkouts. Mutation probes use their
own disposable checkouts and infrastructure; nobody mutates the implementer's tree.
Record the checkpoint review with `node .harness/bin/record-review-round.mjs` on the todo
branch, scope `wNN-MM` (task-delivery § Review protocol and circuit breaker). One complete
CLEAR round is enough for the todo; the wave's two-clean-round convergence comes later. After
that round the recorder's `NEXT:` line still says `dispatch round N+1 … cleanRounds 1/2`; do
not dispatch it for a todo checkpoint.

Re-read acceptance/specs, inspect the actual wiring, and write `## Verification` in
the todo with commands, results, commit, relevant constraints and open findings.
Changed domain truth is reconciled sequentially by the orchestrator. User-visible or
authority changes outside approval require a decision before closure.

## 7a. Browser walk receipt

Before closing any browser-visible task, walk the changed flow in a headed browser
as a real user, including write→reload→read-back. Follow `.harness/rules/e2e-god-mode.md`.
Record it as a `### Browser walk receipt` subsection inside the todo's `## Verification`
section — a `##` heading of its own is not found — with non-empty `Steps:`, `Observed:` and
`Disposition:` lines. `Disposition:` starts with `proceed` (the flow works; the only value
that lets the todo close), `blocked` or `confused`. No browser surface: put exactly one
`Browser walk: not applicable — <reason>` line inside `## Verification` instead, never both.
Run `node .harness/bin/check-browser-walk-receipts.mjs <todo.md>`; a blocked/confused
walk stays active. Suite green, API-only calls, or a conformance declaration do not
replace this walk.

## 7b. Expectation coverage

No automated enumerator is included to check this mechanically. Manually confirm every new endpoint/component/CLI surface this todo adds
has an explicit acceptance criterion in the spec or todo contract — not just a passing test for
whatever it happens to do. Missing expectations must be ratified before closure; do not
back-fit them to the implemented behavior.

## 7c. Boundary-injection receipt

Shared-state and side-effect tasks record refusal, mid-operation exception, corrupt/
partial re-entry and unauthorized-action cases under `### Boundary-injection receipt`.
Shared-file writers additionally need a real multi-process race. Transaction-owned locks
and writes must be tested across their caller boundary, even if one helper is read-only.
No side-effect surface: `Boundary injection: not applicable — <reason>`. Follow
`.claude/rules/user-flow-validation.md` MUST-7; ordinary unit tests do not replace these cases.

## 4. Close the cycle and enforce the wave boundary

Run integration/log hygiene for the changed surface; update durable documentation for
actual behavior. Record concise decisions and a handoff: commit, acceptance status,
new/repeated defect causes, test environment, next action and required decisions.
Use `/redteam`'s structured complete-round recorder for review/fix cycles. Exit 2 means
reassess before another cycle, never "done" or "start one more review".

A todo moves to `completed/` (same filename) only after its implementation and receipts
are verified. Commit that move on the todo branch, run the project profile's local CI
parity command, and merge the todo branch into the wave branch. Until wave convergence it
is **implemented — awaiting wave convergence**, not shipped.
At the boundary: `/redteam` on the wave branch → merge the wave branch into `main` by pull
request (task-delivery § Branches, pull requests and merging) → learning capture →
specs/remaining todos update → re-rank.
Do not start the next wave until
`node .harness/bin/check-redteam-convergence-receipt.mjs --workspace workspaces/<project> --scope <wave>`
exits 0. The existing launch evidence, two clean rounds on one commit, accepted-residual
and browser-walk requirements remain. Use `--todo <id>` before claiming a covered todo
closed. A circuit-breaker stop is never convergence.
