---
priority: 10
scope: path-scoped
paths:
  - "journal/**"
  - "**/journal/**"
---

# Journal Rules


## Naming & Format

Sequential naming: `NNNN-TYPE-topic.md`. Check the highest existing number in the journal
directory before creating a new entry — always use highest + 1, gaps are fine, never reuse a
number.

```yaml
---
type: DECISION | DISCOVERY | TRADE-OFF | RISK | CONNECTION | GAP | AMENDMENT
date: YYYY-MM-DD
author: human | agent | co-authored
project: [project name]
topic: [brief description]
phase: analyze | todos | implement | redteam | debug | fix | codify | learn | design | validate | sweep | wrapup | deploy
tags: [list]
relates_to: NNNN-slug of the entry this amends/extends/references (optional; required for AMENDMENT)
---
```

This is the canonical contract the `/journal` command (`.claude/commands/journal.md`) emits —
the two must agree, so change both together. The harness has no cryptographic operator identity and no per-session
provenance ledger to verify `author:` against — set it honestly by judgment.

**Author decision tree**: `human` — user stated the conclusion before the AI did. `agent` — AI
surfaced it unprompted. `co-authored` — it evolved through exchange (default when uncertain).

## Entry Types

| Type           | When                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DECISION**   | Architectural, design, strategic, or scope choices                                                                                                          |
| **DISCOVERY**  | Research/analysis reveals new understanding                                                                                                                 |
| **TRADE-OFF**  | Balancing competing concerns                                                                                                                                |
| **RISK**       | Stress-testing reveals vulnerabilities                                                                                                                      |
| **CONNECTION** | Cross-referencing reveals relationships                                                                                                                     |
| **GAP**        | Missing data, untested assumptions, unresolved questions                                                                                                    |
| **AMENDMENT**  | Amends/extends a prior entry (redteam dispositions, convergence receipts, gap-closures) — references the original via `relates_to:` and never overwrites it |

## Requirements

- Analytical entries (DISCOVERY, TRADE-OFF, RISK, GAP, CONNECTION) and **substantive DECISION**
  entries (those weighing alternatives) SHOULD include `## For Discussion` with 2-3 probing
  questions (at least one counterfactual, at least one referencing specific data). A terse
  coordination-receipt DECISION or AMENDMENT (closure SHAs, criteria-met tables, redteam
  dispositions, convergence verdicts) MAY omit it — it must still be self-contained.

**Why:** Without discussion questions, analytical entries become write-only artifacts that
capture a decision but never challenge it. A terse closure receipt has nothing to
counterfactually challenge — forcing manufactured questions onto it is ceremony for no benefit.

- Entries MUST be self-contained — readable without other session context.

**Why:** An entry read months later by a different session is useless if it depends on context
that no longer exists.

- DECISION entries SHOULD include alternatives and rationale.
- Entries SHOULD include consequences and follow-up actions.

## MUST NOT

- Overwrite existing entries — immutable once created. A new entry references the original via `relates_to:`.

**Why:** Overwriting destroys the audit trail of how a decision evolved, making it impossible to understand why a position changed.

- Create entries without frontmatter.

**Why:** Entries without frontmatter can't be filtered by type, phase, or date, making the journal unsearchable at scale.

## Backfill / Grandfathering

Entries created before a frontmatter-or-section contract change are grandfathered — do not
rewrite them to match a new contract (the immutability rule above forbids it). A contract
change applies only to entries created after it lands; the corpus can carry mixed shapes
across that boundary.

**Why:** Immutability and "every entry matches the current contract" are in direct tension;
immutability wins. Rewriting historical entries to fit a new shape would destroy the audit
trail immutability exists to protect.

## Enforcement

No hook checks this automatically — no write-guard blocks an overwrite, no sweep checks
frontmatter shape. Catching a violation depends on the agent applying the rule and on review
at `/codify`. A project that adds a hook for it should name it here.

