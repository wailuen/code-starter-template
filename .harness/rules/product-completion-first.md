---
priority: 10
scope: path-scoped
cli_delivery: skill-channel
paths:
  - ".claude/commands/**"
  - ".harness/phases/**"
  - "**/todos/**"
---

# Product-Completion-First — Triage Gate Findings By Category, Not Severity

`.harness/guides/task-delivery.md` and `.harness/rules/completion-criterion.md` govern
scope decisions and retry limits. A BUG stays blocking. An INVEST-NOW finding is fixed now
when it fits the current todo's accepted scope and budget; one that would expand the task is
recorded and adjudicated by the owner before it is built (MUST-2). "Fix now" in this rule always
operates inside the completion-criterion MUST-4 circuit breaker: a repeated root cause
triggers reassessment, including for security work, rather than another repair round.

Red-team runs in every phase, wave and session and stays. But grinding every surfaced
finding to convergence spends most of the budget on the lowest-value increments, so weeks
pass with no complete, visible product. The fix is not to weaken red-team — every
reviewer still runs every round, and the errored/empty-reviewer evidence gate is
unchanged. The fix is to triage the disposition of findings by category: findings that
block completion are fixed now; polish that does not is documented, tracked, and
revisited at the right point (when the product is visible, or on demand).

**Severity (CRIT/HIGH/MED/LOW) ranks and reports; it never decides fix-vs-defer.** A
LOW-severity bug still blocks completion and is fixed now; a MED-severity polish item with
no forward impact is deferred.

Implementation can run in parallel (`.harness/rules/autonomous-execution.md`), so the
scarce resource this protects is convergence attention and context budget, not labor. The
honest reason to defer an increment is "it would overflow this wave's convergence
budget", never "we don't have time" (`.claude/rules/time-pressure-discipline.md`).

## The three categories

| Category                    | Definition                                                                                                                                                                                                                                                        | Disposition                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BUG**                     | Prevents successful testing/closure of an in-scope item — a failing test/build/type check, a shipped path that is wrong/insecure/lossy, a contract/API break, a gate-integrity or self-ref-enforcement defect, an unmet success-criterion on a _shipped_ feature. | **Fix now — regardless of severity.** At wave convergence, converges to 2 clean rounds.                                                                                               |
| **INVEST-NOW ISSUE**        | Does not itself block testing/closure of the current item, BUT has material impact on later stages such that fixing now is the correct investment (deferring compounds cost — foundational / architectural / shared-substrate that later work builds on).         | **Fix now if it fits the current todo's accepted scope and budget**, and report it at the gate. If it would expand the task, record it and surface it for the owner's decision before building. It is the **judgment bucket**: classify with an impact rationale, never silently deferred. |
| **INCREMENTAL IMPROVEMENT** | "Could do" quality — polish, prose/naming, defense-in-depth _beyond an already-working guard_, tail-quality _off_ shipped paths, redundant coverage, refactor-for-elegance. No forward impact; does not block testing/closure.                                    | **Defer** to the deferred-quality tracking list with a value-anchor. Does not reset the redteam clean-round counter.                                             |

## MUST Rules

### 1. Every Gate-Surfaced Finding Gets Exactly One Category; Severity Never Gates

Classify every finding a review, redteam or sweep gate surfaces as exactly one of BUG,
INVEST-NOW ISSUE or INCREMENTAL IMPROVEMENT per the table, before deciding fix-vs-defer.
Severity is a ranking attribute: "it's only LOW, defer it" and "it's HIGH, so it blocks"
both use the wrong axis. When the category is ambiguous, resolve toward BUG/INVEST-NOW,
never toward silent deferral. (An INCREMENTAL label must also name the success criterion
it was checked against — MUST-3.)

```markdown
# DO — category gates; severity ranks

Finding: a LOW-severity null-deref on a shipped auth path.
Category: BUG (shipped path is wrong) → FIX NOW, even at LOW severity.

# DO NOT — severity gates

Finding: LOW-severity null-deref on a shipped auth path.
"LOW severity, no CRIT/HIGH → defer to next cycle." (a LOW bug still blocks completion)
```

**Why:** Severity measures blast radius if triggered, not whether the item blocks a
complete product. Gating on it defers real bugs and grinds harmless polish through full
convergence rounds.

### 2. BUG And INVEST-NOW Are Immediate; INCREMENTAL Defers Only With The Deferral Fields

Fix BUG findings in-cycle to convergence. Fix an INVEST-NOW finding in-cycle when it fits
the current todo's accepted scope and budget, and report it at the gate. When it would
expand the task, record it (as a todo, with its impact rationale) and surface it at the gate
with impact, implications and symmetric pros/cons (`.claude/rules/recommendation-quality.md`
MUST-1/2/3) for the owner's decision before building it — never decide it silently, and never
defer it silently.

This is the one deferral rule; other files point here. An INCREMENTAL finding may go to
the deferred-quality tracking list (GitHub issues labelled `deferred-quality`) only with
all five deferral fields:
(i) a blocking-safety note (which shipped/success path it does not touch), (ii) a
value-anchor citing a user-anchored source (`.claude/rules/value-prioritization.md`
MUST-1 and MUST-2), (iii) full-fix acceptance criteria, (iv) a revisit trigger
(`after-milestone:<name>` | `on-demand`), and (v) a calendar backstop date
(`YYYY-MM-DD`) by which it is revisited even if the trigger never fires — so `on-demand`
still carries a date. The agent files these itself without stopping to ask; until the user
accepts the item it is a pending decision, surfaced at `/sweep` (MUST-4). These generalize
`.claude/rules/zero-tolerance.md` Rule 1b. Commit to one disposition: "implement X or
document it as a known limitation" is not a disposition
(`.claude/rules/value-prioritization.md` MUST-4).

**Shipping a deferred item as a residual.** A convergence receipt may list a deferred item
under `residuals` only after the user has accepted it. Each residual then carries
`category: INCREMENTAL`, the five fields above (`blocking_safety_note`, `value_anchor`,
`full_fix_criteria`, `revisit_trigger`, `backstop`), and `accepted_by` set to the name of
the person who accepted it — never an agent name, and never filled in before they say yes.
`check-redteam-convergence-receipt.mjs` (`checkResiduals`) refuses a residual missing any of
these, a non-INCREMENTAL category, a backstop that is not a calendar date, or an
`accepted_by` that fails the shared identity check for person-only fields — the same check
used for `ratified_by`, `approved_by` and the recorder's `escalation_accepts` and
`replan_accepts[].acceptor` (`.harness/rules/completion-criterion.md` MUST-1). A BUG or INVEST-NOW finding can never ship as a residual.

```markdown
# DO — incremental defers with the five fields; bug/invest-now fixed now

INCREMENTAL: extra defense-in-depth on an already-guarded path.
Defer → deferred-quality list: (i) does not touch the shipped validation path;
(ii) value-anchor: "polish per brief §UX-quality"; (iii) acceptance: add the second
guard + test; (iv) revisit: after-milestone:walking-skeleton; (v) backstop: 2026-12-01.

# DO NOT — silent defer, OR bug relabelled incremental, OR the OR-escape

"Deferring the failing-test fix as incremental." (a failing test is a BUG)
"Defer the polish (tracked separately)." (no value-anchor, no revisit trigger, no backstop)
"Implement the fix OR add a smoke-test asserting current behavior." (OR-escape)
```

**Why:** A deferral without the five fields is deferral-as-forgetting: the item
leaves the queue and its rationale is lost at the next `/clear`. The conditions make it a
tracked hold on the same work. Relabelling a BUG or INVEST-NOW item "incremental" ships
the defect the category gate exists to catch.

### 3. A Warm Same-Class BUG/INVEST-NOW Gap Is Fixed Now

When a gate surfaces a latent gap of the same class as the in-flight fix, and it fits the
remaining budget (`.harness/rules/autonomous-execution.md` § Per-session capacity
budget), the category decides the lane, not convenience: a same-class BUG or INVEST-NOW
gap is fixed in the same session — it is small enough and related, which is the fix-now
case of `.harness/rules/autonomous-execution.md` § Problems found along the way. An
INCREMENTAL same-class gap may go to the deferred-quality list with a value-anchor. If an
INCREMENTAL classification cannot name the success criterion it was checked against ("no
criterion covers this path"), escalate it to the user instead of deferring it.

```markdown
# DO — category verdict gates the warm-gap lane

Reviewer flags 40 sibling call-sites, same null-bind class as the in-flight fix, ~300 LOC.
Category: BUG (sibling paths are wrong) → fix now, same session.

# DO NOT — defer a warm bug as "incremental"

"The 40 siblings are incremental hardening — file a follow-up issue." (same-class BUG,
warm context, fits budget; the category, not convenience, gates the lane)
```

**Why:** Same-class gaps cost least to fix while the context is loaded; a follow-up issue
makes the next session rebuild that context from scratch. Silence about coverage in the
brief is a question for the human, not a license to defer.

### 4. `/sweep` Surfaces The Triage, Completion Status And Decision Points

At `/sweep`, present the judgment-bucket items (INVEST-NOW vs defer) and the
deferred-quality backlog as a management decision report: completion status, an estimate
to complete in autonomous cycles, the prioritized immediate queue, the deferred-quality
backlog grouped by revisit trigger, each INVEST-NOW-vs-defer decision point (with
implications and symmetric pros/cons), and a recommended next step for ratification. Do
not decide a judgment-bucket item silently, and do not let a deferred item sit past its
revisit trigger unsurfaced.

```markdown
# DO — /sweep surfaces the decision points for direction

Decision point (INVEST-NOW vs defer): the shared cache-key refactor.
Recommend INVEST-NOW — later billing + audit waves build on this key shape; deferring
compounds. Pro: unblocks two waves. Con: ~1 cycle now vs ~3 if deferred. Ratify? (y/n)

# DO NOT — silently decide the judgment bucket

[agent quietly defers the cache-key refactor as incremental; never surfaced at /sweep]
```

**Why:** The judgment bucket is where a misclassification ships a real defect under a
converged banner; the human ratifying the deferred set at `/sweep` is the check that
catches it. Without the revisit, the deferred list is a place items go to rot
(`.claude/rules/value-prioritization.md` MUST-3).

## MUST NOT

- Use severity as the fix-vs-defer gate. **Why:** it defers real bugs and grinds harmless
  polish.
- Defer a BUG or INVEST-NOW finding as "incremental". **Why:** it ships the defect under a
  converged banner.
- Defer an INCREMENTAL finding without the five deferral fields. **Why:** that is silent
  deferral, not a tracked hold.
- Ship the deferred-quality list without the `/sweep` revisit. **Why:** a list that makes
  deferral easier with no revisit is net-negative; the two ship together.

## Enforcement

No hook checks this automatically. Catching a misclassified finding — a bug deferred as
polish, a judgment call decided silently — depends on the agent applying this rule and on
review.

Origin: red-team stays in every phase, but small increments that don't block completion
are "documented and tracked separately, and revisited as required or after the full
product is done and visible."
