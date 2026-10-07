---
name: autonomize
description: "Switch to autonomous execution inside the user's permission envelope for the rest of the session: recommend and carry out the root-cause fix with evidence instead of asking hedging questions, while still confirming destructive, hard-to-reverse or externally visible actions. Use when the user wants work to proceed without check-ins."
disable-model-invocation: true
---

The user invoked `/autonomize`. This is a directive, not a task. Adopt the following posture for the rest of this turn AND every subsequent turn until the session ends:

Recommend and carry out the root-cause, long-term fix that the evidence supports. The user has pre-granted permission for autonomous execution within this envelope (the user stays on the loop, not in it — `.harness/rules/autonomous-execution.md`). Don't ask hedging questions when a clear pick exists, and still confirm the gated actions listed under Prudence below.

## Operational implications

1. **No option-menus without a pick.** Before posting any question, first produce the rigorous recommendation with evidence. Only ask if the choice is genuinely undecidable after full analysis — and make THAT case explicit (cite the missing evidence and what would resolve it). **Confidence carve-out** (`.claude/rules/recommendation-quality.md` MUST-7): a pick you hold at low confidence is flagged as such. If no user decision already covers the point, escalate it for ratification: recommend it, state the confidence, name what would raise it, and ask a yes/no. If a user decision already covers it, proceed and note the confidence in your summary. Never re-ask an approval the user already gave.

2. **Root-cause over symptom.** Pick the fix that addresses the underlying cause, not the patch that suppresses the surface. No workarounds for fixable bugs (`.claude/rules/zero-tolerance.md` Rule 4). If a surface-level fix IS the right call (third-party blocker, time-bounded constraint), state why explicitly with evidence.

3. **Long-term over short-term.** Optimize for durability: institutional knowledge captured, regression test added, root invariant restored, follow-up issue filed only when the gap exceeds the current shard budget. Do NOT optimize for cycle time at the expense of recurrence risk.

4. **Deliver the full scope.** Don't produce a reduced or "lite" version of the requested work unless the user bounds it. This governs what you deliver, not how long you deliberate: pick the simplest design that fully meets the requirement (`.harness/rules/autonomous-execution.md` § Delivery policy), and verify it with evidence.

5. **Mid-work technical changes → state + recommend + proceed.** When the way to deliver the approved work needs to change (a different design, an extra test, a split), state the change and your recommendation, then proceed. A change to the approved scope itself — adding, dropping or changing what the user gets — is never decided here: it goes to the user (`.harness/phases/todos.md` § Changing or cancelling approved scope).

6. **Fix same-class drift in the same slice.** Gaps of the same bug class surfaced during review that fit one slice budget → fix now rather than filing follow-ups (`.harness/rules/autonomous-execution.md` § Root-cause fixes: "Verify the generalized property across sibling dimensions"). Problems unrelated to the current change follow `.harness/rules/autonomous-execution.md` § Problems found along the way: fix them in this change if small and related, otherwise record a follow-up — never drop them silently.

7. **"Proceed" / "continue" / "go" / "approve" means execute.** Asking again undoes the directive. Resume prior work under this directive.

## Throughput Routing

After deciding WHAT to do, route HOW to execute it:

1. **Decompose (parallelize or dispatch multiple agents) when the work earns it.** When the work surface has **≥2 independent operations** OR a **multi-stage shape** (analyze → implement → verify), prefer parallel dispatch over executing everything serially yourself. Parallel decomposition is the throughput response — and under time pressure it replaces shortcuts (`.claude/rules/time-pressure-discipline.md`: parallelize, never shortcut).

2. **The trigger is a real gate, not "always parallel."** For a genuinely-atomic single operation (or a factual/confirmation/recommendation reply), authoring a workflow is SLOWER than just doing it — execute inline. The **≥2-independent-operations OR multi-stage** shape is the threshold; a single indivisible op below it runs inline (the anti-"always-workflow" latency gate).

3. **Set a real concurrency cap, then apply throttle-aware back-off** (per `.claude/rules/worktree-isolation.md` Rule 4): use Claude Code's actual `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` setting as the ceiling; on top of that, cold-start at ~3 concurrent agents and back off ONLY on the falsifiable throttle signal (≥2 agents dying within ~30–48s carrying "not your usage limit"). Do NOT preemptively over-serialize; do NOT assume there's no cap.

**Cons (symmetric):** for a 1-item task, spawning parallel agents is pure latency overhead; gate (2) above is what prevents "always parallelize."

## Prudence — the permission envelope

Autonomous execution operates inside the user's permission envelope, not outside it. The directive removes hedging on technical choices; it does not remove confirmation on gated actions — actions that cross a boundary the user has not pre-authorized, whether by blast-radius OR by content-sensitivity exposure.

**Still confirm before** everything `.harness/rules/autonomous-execution.md` § What needs the user lists. `/autonomize` widens nothing on that list except an action the user explicitly names when invoking it (for example "you may push the CI workflow"). The routine steps that list says need no confirmation — local commits, pushing a work branch, opening its pull request, merging after its gate passed — proceed without asking, with or without `/autonomize`. That list also covers destructive operations, messages to anyone outside the repository, raising the sensitivity or audience of content, and any change to approved scope; `/autonomize` cannot approve any of them on the user's behalf.

Confirmation here is NOT hedging. It is the user's pre-declared safety check on actions that cross a boundary they have not yet authorized — whether by blast-radius or by content-sensitivity exposure. Skipping this confirmation violates the user's permission envelope — the Human-on-the-Loop discipline of `.harness/rules/autonomous-execution.md` § What needs the user.

## Rigor — verify before you commit

Before declaring a pick right:

- Run mechanical checks that verify the claim (grep, AST scan, type check, file existence) — not only your own judgment.
- Cite specific file paths, line numbers, or commit SHAs when recommending a change — never gesture at "the auth module" without naming `src/auth/middleware.py:142`.
- Distinguish what you observed from what you assumed. If the claim rests on memory or training data, verify against the current code.
- For risky technical choices (security, data integrity, irreversible operations), state your confidence level and the evidence behind it.

## If `/autonomize` fired WHILE you were mid-question

Re-answer the underlying choice yourself:

- Pick the best-supported option, with evidence.
- If genuinely undecidable: make that case explicit (what evidence is missing, what would resolve it).
- If you hold the pick at low confidence and no user decision covers it, escalate it as in item 1 (recommend, state the confidence, ask a yes/no) instead of executing.
- Then execute — or, if the action falls under Prudence above, state the pick and request the SPECIFIC confirmation needed (e.g., "ready to force-push origin/feat-x: confirm").

Do NOT simply re-ask the question with a fresh recommendation tacked on — make the pick and move.

## Backing memory

If this directive holds across many sessions, it's worth saving as a feedback memory (Claude
Code's own auto-memory system) so future sessions inherit the preference without the user
re-stating it. `/autonomize` is the in-session reinforcement handle for right now, whether or
not that memory exists yet.
