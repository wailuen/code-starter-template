---
priority: 10
scope: path-scoped
cli_delivery: skill-channel
paths:
  - "**/todos/**"
  - "**/specs/**"
  - "**/briefs/**"
  - "**/.session-notes*"
  - "**/.session-notes.d/**"
  - ".claude/commands/**"
  - ".harness/phases/**"
---

# Completion criterion

Completion means satisfying an explicit accepted contract with evidence. Searching
an unlimited space until no reviewer finds anything is not a definition of done.
The operational protocol is `.harness/guides/task-delivery.md`.

## MUST-1 — Acceptance precedes implementation and review

Each delivery has acceptance criteria the user ratified (`ratified_by` and `approved_by` name
the user, never a reviewer or agent), testable by two readers, plus an explicit trusted/untrusted boundary and integrated scenario. The implementing
agent cannot redefine its own oracle after seeing the result. Use the delivery-contract
readiness checker. A credible threat (security or correctness) is adjudicated
immediately: classify it BUG or not-BUG, with evidence, before any other step. Only a
newly uncovered requirement (a missing feature or scope addition) may be surfaced as a
scope decision or recorded as a todo proposal. Do not silently expand the task or declare
either harmless by omission. Small, related fixes follow
`.harness/rules/autonomous-execution.md` § Problems found along the way.

**Person-only fields** — `ratified_by`, `approved_by`, `residuals[].accepted_by`, and the
recorder's `escalation_accepts.acceptor` and `replan_accepts[].acceptor` — go through one
identity check, `.harness/lib/agent-identity.cjs`. It first normalises the value (NFKC,
invisible characters removed, lookalike letters folded, spaces collapsed, punctuation
trimmed, lowercased), then refuses: model and vendor names with or without versions
(`gpt5`, `sonnet4`, `opus4.5`, `o1`/`o3`, ChatGPT, OpenAI, Anthropic, Grok, DeepSeek, Mistral,
Llama), names run together or letter-spaced, no-reply and bot email addresses, and values
made only of role or filler words ("the user", "Project owner", "operator", "myself",
"User (chat approval)"). A real name passes, also next to a role ("Jane, owner"). The check
cannot tell a real name from an invented one, so never write a name the user did not give.

## MUST-2 — Preserve gating obligations and triage discoveries

BUG and ratified INVEST-NOW obligations remain blocking until fixed or a material
scope/risk decision is explicitly authorized. Severity ranks; category and accepted
requirements determine disposition. Incremental work follows the one deferral rule,
`.harness/rules/product-completion-first.md` MUST-2. Ambiguity requires a decision, not automatic
scope expansion or silent deferral. A live incident is surfaced immediately and routed
to its own response lane, the `/fix` phase (`.harness/phases/fix.md`); never bury it in a
routine review backlog.

## MUST-3 — Evidence follows artifact state

Only complete reviews on the same pinned commit count toward the two clean rounds
required by the final convergence checker. A shared dependency change invalidates
evidence for its affected consumers. A duplicate reviewer delivery is not another
round; one clear reviewer cannot clear a failing peer. Errored/missing evidence is
not clean. Unchanged deterministic checks may be reused with exact source/environment
identity, but new or disputed properties require independent verification.

## MUST-4 — The repair approach has a circuit breaker, including security work

Run `.harness/bin/record-review-round.mjs` after each complete round. It enforces two
limits (exact behavior: `.harness/rules/redteam-stall-debug.md`):

- **Round cap.** A branch gets three counted rounds in total; the count never resets. A
  non-clean round at or past the cap makes the next round the branch's single `/debug`
  round; if that does not converge, a named human must accept each further round.
- **REPLAN.** A root cause recorded in any earlier non-clear round on the branch comes
  back (clean rounds in between do not reset this), a root cause a decision record
  claimed to close comes back, or four non-clean rounds pass in a row since the last
  decision record. Run `/debug` before another repair cycle.

Reassessment must choose a changed architecture, decomposition, test environment or
verification approach and state a falsifying experiment. Preserve the failure history
and a recoverable good checkpoint. Record the decision and reference it on resumption.
Never wait for convergence before surfacing the architectural choice that could end the
loop.

This bounds retries of an approach, not security obligations. Open bugs still block;
a cap, replan, elapsed time, or exhausted budget is never success. The final
convergence-receipt checker must still accept before closure. Do not mechanically
dispatch another pair of fresh reviewers with the same repair instructions.

## MUST-5 — Use the instrument appropriate to the property

For executable properties, require a meaningful test and negative control. AST/grep
can verify structure, not runtime correctness. Prose and design need independent
judgment. Security changes need both correctness and security review, with attacker
prerequisites and a reachable path. Model confidence or identity is never an oracle.
Ordinary connection loss, timeout, rollback and cleanup are part of infrastructure
correctness even when no attacker exists. Fix contaminated instruments before using them.

Scratch scripts and quick checks need not be kept. Commit tests where the task asks for
them or the repository already keeps tests for this kind of change, sized like the
neighboring test files; don't turn scratch checks into permanent test files.

## MUST-6 — Residual acceptance is explicit

Only an INCREMENTAL finding can ship as a residual, and only after the user accepted it.
The fields it needs, and what the convergence checker refuses, are defined once in
`.harness/rules/product-completion-first.md` MUST-2 (its "Shipping a deferred item as a
residual" paragraph): the five deferral fields plus `accepted_by`, the name of the person who
accepted it. An agent never fills `accepted_by`. Without acceptance the item stays a
pending decision, not a clean verdict. Replanning cannot erase findings or acceptance
history. The readiness and retry tools check structure; they do not approve product risk.
