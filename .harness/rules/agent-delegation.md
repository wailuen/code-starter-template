---
priority: 0
scope: baseline
---

# Agent orchestration

For the project delivery phases, `.harness/guides/task-delivery.md` is the execution
contract.

## Ownership and delegation

Give each task one owner. Check in with a specialist when you're genuinely unsure about
their domain — don't spawn a full team for a small change. For small, quick tasks, just
do them yourself directly; that's usually faster and adds no value delegated. Parallelize
independent work only when the files, infrastructure and outputs involved are truly
separate — stages of one dependent task are not independent work. Keep working on
independent parts while delegated agents run; step in if one goes off track or is missing
context. Back off if you hit throttling.

Before dispatching an agent, check it has the tools it needs. Give it the relevant spec
content, delivery acceptance, trust boundary, absolute worktree path, pinned commit where
relevant, owned paths, and where it should report back to — not the entire journal
history. Picking a stronger model is not a substitute for a real verification plan.

## Worktree orchestration

Create a sibling checkout outside the repository before parallel work. Each agent's
first action verifies its resolved repository root and expected revision. A review
checkout is pinned to the commit under review. A reviewer never mutates the author's
checkout; mutation probes get their own disposable checkout. A second database or
namespace on the same shared server does not isolate tests that change server-wide state
(roles, permissions, extensions). See
`.claude/rules/worktree-isolation.md` and task-delivery for lifecycle and environment ownership.

## Quality gates

Review at a coherent implementation checkpoint, not on every file edit or bookkeeping
commit. Correctness review is independent of whoever wrote the code. Security- or
trust-bearing work additionally needs an independent security review — a correctness
CLEAR is never security evidence. Which changes need the security reviewer is decided by
`isSecuritySurface()` in `.harness/bin/check-redteam-convergence-receipt.mjs`: every changed
path counts except workspace bookkeeping records and plain documentation outside the
harness folders (read the function for the exact list). Bring in UX/value, testing, or architecture reviewers
for their own actual surface. Existing self-referential artifact review requirements
still apply.

Reviewers check acceptance and affected downstream consumers with whatever instrument
fits: structural enumeration for structure, executable scenarios for behavior, semantic
evaluation for LLM intent. Review ordinary operational failure as well as attacker
behavior. Preserve security and data-integrity obligations when scoping the work.

## Delivery and evidence

A lifecycle notification from an agent is not a report — get the actual result, verdict,
evidence, and what's still unresolved. An empty, errored, timed-out, or throttled result
is zero clean evidence. If a delivery goes missing, recover it through the existing
return channel rather than paying for a whole duplicate review because a report didn't
arrive. If you're using addressable teammates, tell them explicitly to report back;
otherwise use a dispatch mode that returns its result to the caller directly. Keep the
launch ledger current.

Only a complete round — every expected reviewer, on one pinned commit — counts.
The orchestrator records it with `.harness/bin/record-review-round.mjs`; individual
messages can't reset or advance the round counter. A branch gets three counted rounds,
then one debug round, then a human (`.harness/rules/redteam-stall-debug.md`). At REPLAN
or DEBUG_ROUND, reassess
architecture, scope, or the verification environment before repairing further; at
ESCALATE_TO_HUMAN, stop — only a named human's acceptance admits another round. Never
defer a necessary design decision until a stalled loop happens to converge. The final
convergence-receipt checker still owns closure — neither an agent's confidence nor a
retry counter can certify it.

## Cross-wave closure

Before closing a plan spanning more than one wave, do a holistic integration review of
the merged behavior and cross-wave invariants. Reuse verified unchanged mechanical
evidence with its source/environment identity; independently test integration and any
disputed properties. Don't restart unrelated repository-wide audits on every fix.

## Failure disposition

Separate in-scope regressions, baseline defects, and environment faults. Fix in-scope
defects; for anything else follow `.harness/rules/autonomous-execution.md` § Problems
found along the way — fix it now if it is small and related, otherwise record it with its
evidence in the place that section names for its kind. Restore a trustworthy test environment
before adjudicating code. No silent dismissal, no false green counts.

## References

`.claude/rules/specs-authority.md` owns domain truth; `.harness/rules/completion-criterion.md` owns
acceptance/closure; `.harness/rules/redteam-stall-debug.md` owns reassessment; the delivery
guide owns phase sequencing.
