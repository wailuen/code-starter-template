---
priority: 10
scope: path-scoped
paths:
  - "**/specs/**"
  - "**/specs/_index.md"
  - "**/workspaces/**/specs/**"
  - "**/02-plans/**"
  - "**/briefs/**"
  - "**/README*.md"
  - "**/docs/**"
  - "**/skills/**/*.md"
---

# Spec Accuracy Rules

A spec describes what the system does **today**. If a behavior is not implemented, it does not go in the spec, and neither do gap acknowledgements ("Phase-1 scaffold, Phase-2 will wire live", "Promised / Current", "TBD — backend follow-up", "accessor pending"). Gap-annotated specs create **lookaway risk**: downstream devs implement against the scaffold side, the frontend renders "fine" on scaffolds, and the Phase-2 switch never flips because nothing is visibly broken. Split-state specs become tombstones for work that should have shipped.

Sister rule: `.claude/rules/specs-authority.md` manages HOW specs are organized. This rule manages WHAT specs can contain.

Origin: a spec audit found citations to functions that did not exist; the user's directive was "i want accurate and perfect, acknowledging gaps is useless to user."

## MUST Rules

### 1. Every Citation Resolves Against Working Code

Every file:line, function, class, endpoint, SQL query, table, column, environment variable, and config key named in spec content must resolve against a literal `grep` / `find` / the language's parser at merge time. A citation that depends on "Phase-2 will wire it" / "scaffold for now" does not resolve.

```markdown
# DO — citation grep-resolves at merge

POST /api/v1/scenarios/{id}/cascade — implemented at `routes/scenarios.py:127`,
calls `analytics_service.get_metric("metric_a")` (SUPPORTED_METRICS:235).

# DO NOT — phantom citation surviving merge

POST /api/v1/scenarios/{id}/cascade — backed by data-platform accessors for
metric_c, metric_d, metric_e (Phase-2 will wire; scaffold returns mocks).
```

"It lands next sprint" and "it's in PR review" do not make a citation resolve today.

**Why:** Phantom citations make the spec a lie that downstream devs implement against: they build UI against the scaffolds, and the Phase-2 switch never flips because the frontend renders fine. Verification is mechanical: every cited symbol resolves via `grep` / `find` / a parser.

### 2. No Split-State Framings Inside Spec Content

Do not use "Phase-1 / Phase-2", "Promised / Current", "Target / Fallback", "Scaffold / Live" or "Now / Later" framings to acknowledge gaps in spec sections, nor inline markers such as `TBD`, `pending`, `to be wired`, `backend follow-up`, `FE follow-up`, `accessor pending`.

```markdown
# DO — describe what ships today, full stop

| Metric   | Source            | Resolution        |
| -------- | ----------------- | ----------------- |
| metric_a | analytics_service | SUPPORTED_METRICS |
| metric_b | analytics_service | SUPPORTED_METRICS |

# DO NOT — split-state column

| Metric   | Promised (Phase-2)     | Current (Phase-1) |
| -------- | ---------------------- | ----------------- |
| metric_c | data-platform accessor | scaffold(0.85)    |
| metric_d | data-platform accessor | TBD               |
```

**Why:** Split-state framings invite implementation against the scaffold side. Roadmap context belongs in a todo proposal that enters the plan through `/todos`, or a GitHub issue, not in the spec — see Rule 4. Honesty about gaps is a virtue for `journal/` entries and PR descriptions; it is a structural defect in spec content.

### 3. Out-Of-Scope Is Not A Gap

Explicit `## Out of scope` sections that bound the spec's coverage are fine (Exception 1). Gap trackers describing incomplete coverage within the spec's own scope are not.

```markdown
# DO — bounded out-of-scope (the spec covers everything else fully)

## Out of scope

- FX hedging analytics (covered by `specs/treasury-hedging.md`)
- Multi-currency reporting (separate domain, future spec)

# DO NOT — gap tracker disguised as out-of-scope

## Out of scope (for now)

- metric_c data-platform accessor (Phase-2)
- metric_d retention model (TBD — backend lead)
```

**Why:** Out-of-scope sections set the spec's perimeter; gap trackers describe holes inside the perimeter. Holes inside the perimeter belong in todos / issues — they are not stable enough to live in a domain-truth document. The "(for now)" qualifier is the linguistic tripwire.

### 4. Work Trackers Live Outside Specs

Backend follow-ups, frontend follow-ups, "wire later" lists, migration plans, deprecation timelines and integration TBDs live outside spec files: as a todo proposal (`workspaces/<project>/todos/parked/<slug>.md`, per `.harness/rules/autonomous-execution.md` § Problems found along the way) that becomes `workspaces/<project>/todos/active/wNN-MM-<slug>.md` only through `/todos` plan approval, as a GitHub issue, or in a PR description — never inline in spec files.

```markdown
# DO — todo/issue lives outside, spec describes shipped behavior

specs/scenario-planning.md says: "Cascade returns metric_a, metric_b, FX (5 pairs)"
workspaces/scenario-planning/todos/active/w04-02-wire-data-platform-accessors.md (approved via /todos) tracks the rest

# DO NOT — todo embedded as spec content

specs/scenario-planning.md says: "§11.2 Phase-1 scaffolds + code-hygiene follow-ups:

- metric_c (BE: wire data-platform)
- metric_d (BE: wire retention model)
- metric_f (FE: render once BE lands)"
```

**Why:** Specs are domain truth indexed by `_index.md`; todos are workstreams indexed by `workspaces/<project>/todos/`. Mixing them creates lookaway: spec readers treat todos as authoritative; todo readers treat specs as roadmap. Each surface stops doing its job.

### 5. Incremental Spec Extension Is The Workflow

Spec content describes only behavior already shipped on `main`. Do not add spec content without the corresponding code on `main`. The reverse also fails: code merged without the matching spec extension fails `/redteam` (per `specs-authority.md` Rule 5).

```markdown
# DO — code first, spec describes what landed

PR 1: implement metric_a metric in analytics_service
PR 2 (after merge): extend specs/scenario-planning.md §metrics with metric_a entry

# DO NOT — spec ahead of code

PR: add §13.4 "Monte Carlo Cascade" describing 8 data-platform accessors that
do not exist in any branch. (The failure mode in Rule 1's Why.)
```

**Why:** Spec-first is design-doc workflow; that work belongs in `02-plans/` and `briefs/`. Specs are domain truth. If you need an alignment artifact for unimplemented work, write a plan — do not pollute the truth surface.

### 6. Historical Change Logs Permitted

Append-only `## §X Change log` sections describing past transitions in past tense are fine (Exception 2). Keep future-tense planning out of change logs.

```markdown
# DO — past-tense, append-only

## §13 Change log

- YYYY-MM-DD: removed split-state Phase-1/Phase-2 framing per spec-accuracy.md
- YYYY-MM-DD: added metric_a metric (PR #<N>)

# DO NOT — future-tense disguised as change log

## §13 Change log

- YYYY-MM-DD (planned): wire data-platform accessors for metric_c
```

**Why:** Past-tense change logs are institutional memory; future-tense entries are split-state framings (Rule 2) in disguise. Use todos / issues for forward planning.

### 7. Doc Code-Fence API Citations Pass An Import-Execution Sweep At /redteam

Rule 1 extends from spec prose to README / skill / guide code fences: every doc/skill code fence passes an import-execution sweep at `/redteam` — import each cited symbol and assert every called method, constructor argument, and method-call argument resolves against installed code, carrying variable-to-class bindings across fences within a file. Do not ship fences that teach a fictional API (phantom methods, phantom arguments, wrong import paths). Intentional before/after migration contrasts opt out per fence with an auditable `# doc-sweep: ignore` marker.

```markdown
# DO — fence cites the real surface; sweep imports + resolves every call

`get_metric(name: str) -> Metric` # exported function, real signature

# DO NOT — fence teaches a phantom method that exists on NO surface

`db.queryScoped(sql)` # no exported symbol has this name
```

Fixing the import path alone is not enough when the methods called after it are still phantoms; "the example is illustrative" does not excuse a phantom either.

**Why:** Doc fences are the most-copied surface in the repo — a phantom method in a skill propagates into every consumer's first attempt and fails at runtime, the Rule-1 phantom-citation failure one surface over. Verification is mechanical: a sweep tool imports each cited symbol from a doc's code fence and asserts every constructor argument, method name, and method argument resolves against the actual export — never executing the fence, just resolving what it references.

## MUST NOT

- Ship a spec citing a function / class / endpoint / data source / table / column that fails `grep` against `main`

**Why:** Phantom citations are the failure this rule exists to prevent — every shipped phantom is a lookaway tombstone.

- Use Phase-1 / Phase-2 / Promised / Target / Scaffold / Now-Later framings inside a spec section

**Why:** Split-state framings normalize "spec describes intent, code describes reality" — exactly the divergence this rule prevents.

- Treat "honest about what's missing" as a virtue for spec content

**Why:** Honesty about gaps is right for journals and PRs; in spec content it turns a truth surface into a roadmap surface, dissolving the distinction users rely on.

- Maintain gap trackers as permanent residents of spec files

**Why:** Permanent gap trackers signal acceptance that the spec is partly aspirational — readers stop trusting any section.

- Write a spec section for behavior not yet implemented

**Why:** A spec for behavior that doesn't ship is a brief or a plan; it belongs in `briefs/` or `02-plans/`, not `specs/`.

## Exceptions (Structural Carve-Outs)

1. **Explicit `## Out of scope` sections** that bound the spec's coverage (not gap trackers within it).
2. **Append-only `## §X Change log`** sections describing past transitions in past tense.
3. **`§X [reserved for future work]`** section-numbering anchors with no prose content (numbering placeholder only — no description).

## Audit Protocol (runs in /redteam)

```bash
# 1. Split-state framing scan — zero matches required; any hit = HIGH
rg -i 'phase-?1.*phase-?2|target.state|promised.*current|scaffold.*later|TBD|backend.follow-?up|FE.follow-?up|pending.accessor|to.be.wired|accessor.pending' specs/
# 2. Citation resolution — every cited symbol must resolve via grep / find / the language's parser. Any unresolved = CRITICAL.
```

## Migration For Existing Violations

When a spec touched in this PR contains a gap tracker:

1. Extract gap-tracker content into a todo proposal (`workspaces/<project>/todos/parked/<slug>.md`; it becomes `todos/active/wNN-MM-<slug>.md` only through `/todos` plan approval) or open a GitHub issue.
2. Delete the gap-tracker section from the spec entirely (don't soften — delete).
3. Land both changes in the same PR as the first new spec edit touching the affected file.

Sister rule to `.claude/rules/specs-authority.md` (organization) and `.claude/rules/zero-tolerance.md` Rule 2 (no stubs in code — this is the spec-side companion).

## Enforcement

No hook checks this automatically — the Audit Protocol above is a manual `/redteam` step.
Catching a violation depends on the agent applying this rule and on review. A project that adds
a hook or sweep tool for it should name it here.
