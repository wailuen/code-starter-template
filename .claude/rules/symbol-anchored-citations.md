---
priority: 10
scope: path-scoped
paths:
  - "**/specs/**"
  - "**/workspaces/**/specs/**"
  - "**/02-plans/**"
  - "**/01-analysis/**"
  - "**/briefs/**"
  - "**/todos/**"
  - "**/journal/**"
---

# Symbol-Anchored Citations — Cite Code By Grep-Stable Anchor, Not Bare Line Number

A code reference in a durable planning artifact (spec, plan, todo, brief, journal, analysis) is a NAVIGATION POINTER: the next reader follows it to find the cited code. A bare line number (`foo.mjs:471`) is invalidated by any insertion above it — most often by the citing session's own later edits — and then silently points at the wrong code. A grep-stable anchor (the function / class / `const` name, or a `§section` heading) survives every edit: one `grep` recovers the location regardless of line drift. So the grep-stable anchor is the primary locator; a line number is only a paired, disposable hint.

## MUST Rules

### 1. The Primary Anchor Is Grep-Stable (Symbol Or `§Section`), Never A Bare Line Number

Anchor every code reference in a durable planning/spec/todo/journal artifact on a grep-stable token — a function / class / method / `const` / config-key name, or a `§section` heading — that survives line drift. Do not use a bare `<path>:<NNN>` (or `<path>:<NNN-MMM>`) as the only locator.

```markdown
# DO — grep-stable symbol / section anchor (survives any edit to the file)

`requireMainCheckout()` in `state-resolver.js` resolves the shared checkout root.
The containment rule is `security.md` § "Path Containment".

# DO NOT — bare line number as the sole anchor (breaks on the next edit above it)

The checkout resolver is at `state-resolver.js:19`.
The containment rule is at `security.md:130`.
```

"It resolved at merge" is not enough: resolution at merge is `.claude/rules/spec-accuracy.md` Rule 1; this rule is about durability over time. "The file won't change" and "I'll fix it if it drifts" fail for the reason below.

**Why:** A line number encodes a position that the next edit destroys — and the most frequent editor of a cited file is the same session that wrote the citation, so the citation is often stale before it is even read. The symbol anchor is recoverable with one `grep` no matter how the file is re-shaped; it is the only anchor that self-heals.

### 2. A Line Number Is A Paired, Disposable Hint — Never The Sole Anchor

When a line number genuinely aids navigation (a long file, a specific call site), put it next to the grep-stable symbol, never in place of it: the symbol is the recovery anchor, the line is convenience. A line range that pairs with a named contract (the `zero-tolerance.md` Rule 3e claim-bounding shape) satisfies this — the named contract IS the symbol.

```markdown
# DO — symbol primary, line as a paired hint (citation self-heals if the line drifts)

`escape_control_chars()` (`log_sink.py`, ~line 52) escapes the raw bytes.
Method list per `.claude/rules/zero-tolerance.md` Rule 3e: the resolver guard at
`state-resolver.js:39-45` (the `.git`-suffix check).

# DO NOT — bare line / line-range with no symbol to recover from

See `log_sink.py:52`.
The guard is at `state-resolver.js:39-45`.
```

**Why:** The pairing is what makes the citation self-healing: when the line drifts, the reader greps the symbol and finds the new location; with no symbol, a drifted line is an unrecoverable dead pointer. The line is the convenience, the symbol is the contract.

### 3. Plan/Spec Citations Feeding A Delegation Prompt Carry The Symbol And Instruct Re-Resolution

When a citation from a spec/plan/todo is injected into a delegation prompt (the orchestrator hands an agent "build on `X`"), pass the grep-stable symbol and tell the agent to re-resolve it against the current file before building — not a line the agent is told to trust. The plan's line numbers are presumed drifted by build time (prior shards merged, the file moved).

```markdown
# DO — delegation prompt carries the symbol + a re-resolve instruction

"Reuse `requireMainCheckout()` + the `.git`-suffix guard in `state-resolver.js`.
Re-grep for the actual symbols + their current locations before building —
the plan's line citations may have drifted."

# DO NOT — hand the agent a line and tell it to trust it

"Reuse the guard at `state-resolver.js:39` and the resolver at `:19`."
```

**Why:** Between `/todos` (when the line was cited) and `/implement` (when the agent reads it) the file has usually moved — prior shards merged, the spec was edited during convergence. An agent that trusts a drifted line builds against the wrong code or stalls; an agent handed the symbol greps it in one step.

## MUST NOT

- Cite code in a durable planning/spec/todo/journal artifact by a bare line number with no grep-stable symbol or `§section` anchor

**Why:** A bare line is a dead pointer after the next edit, and unrecoverable without a symbol.

- Strip the symbol from a citation "because the line is more exact"

**Why:** Exactness that the next edit destroys is worse than a stable anchor — the precise-but-stale pointer reads as authoritative and misdirects.

- Inject a bare-line citation into a delegation prompt as a trusted locator

**Why:** Plan lines are presumed drifted by build time; a trusted stale line sends the agent to the wrong code or stalls it.

## Enforcement

No hook checks this automatically. Catching a bare-line citation depends on the agent applying
this rule and on review at `/redteam`/`/codify`. A project that adds a hook for it should name
it here.

## Distinct From / Cross-References

- **Extends** `.claude/rules/spec-accuracy.md` Rule 1 (every cited symbol resolves via grep/ast at merge time) — that rule governs whether a citation resolves at write time; this rule governs the anchor shape so resolution survives later edits.
- **Reconciles** `.claude/rules/specs-authority.md` Rule 9 (cite a canonical artifact by `<path>:<line>` OR `<path> §<section>`) — this rule makes the `§section`/symbol form the required primary; the specs-authority `:line` alternative is the MUST-2 paired-hint case.

Origin: a line-number-only citation broke as soon as the cited file was edited, including by the citing session's own later edits.
