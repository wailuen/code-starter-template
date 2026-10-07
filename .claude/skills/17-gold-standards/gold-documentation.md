# Gold Documentation Standards

How documentation is written in a project built with this harness, and what a reviewer checks it against. Companion to
`SKILL.md` (code patterns) and `documentation-validation-patterns.md` (how to verify a doc).

Three documentation surfaces exist, each with a different job. Mixing them is the most common
documentation defect, because each surface stops doing its job the moment it takes on
another's content.

| Surface   | Location                                                         | Answers                                                    | Tense           |
| --------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | --------------- |
| **PRD**   | `workspaces/<project>/docs/prd/` (or the brief in `briefs/` for small projects) | What the product does for a user            | Product-present |
| **ADR**   | `workspaces/<project>/docs/adr/`                                 | Why we chose this over the alternatives                    | Past decision   |
| **Spec**  | `workspaces/<project>/specs/` (per `rules/specs-authority.md`)   | What the system does today, precisely enough to build from | Present         |
| **Todos** | `workspaces/<project>/todos/` (per `.harness/phases/todos.md`)   | What is not built yet                                      | Future          |

If a project keeps these elsewhere, record the locations in the project profile and keep this
table's separation of jobs.

## The Separation Rule

A spec describes what ships. Work that is not built goes in todos, not in the spec. This is
`rules/spec-accuracy.md`, and it is the standard most often bent:

```markdown
# DO — the spec states current behaviour; the gap lives in todos

specs/…: "Every non-HTTP entry point resolves its tenant through the tenant resolver."
todos/active/…: "Wire the sync-worker entry point to the tenant resolver."

# DO NOT — a split-state table inside the spec

| Entry point | Promised (Milestone 4) | Current |
| sync worker | tenant resolver | TBD — pending |
```

Split-state framings (`Phase 1 / Phase 2`, `Promised / Current`, `Scaffold / Live`, inline `TBD`
or `pending`) invite implementation against the scaffold column, and the switch never flips
because nothing looks broken.

**Two sanctioned exceptions:**

- A bounded `## Out of scope` section that sets the spec's perimeter — permitted. A gap tracker
  describing holes _inside_ the perimeter — not permitted.
- An `## Open Questions` section recording genuinely unresolved **product or design** questions,
  which every spec file carries by convention. This is not a licence for implementation
  TODOs: "should data residency be per-tenant or per-workspace?" belongs there; "wire the resolver"
  does not.

## ADR Standards

Filename: `NNNN-<slug>.md` in `workspaces/<project>/docs/adr/`, sequentially numbered;
`0001` is the system-architecture record. Registered in the ADR directory's `README.md` index table with a Status column.

Every ADR opens with a metadata block:

```markdown
# ADR-0002: <decision title>

- **Status:** Accepted
- **Date:** YYYY-MM-DD
- **Amended:** YYYY-MM-DD — <what changed, and whether it reverses anything>
- **Related:** 0001 (parent), 0008 (…), 0011 (…)
```

Then: **Context** (the forces, including the ones that lost), **Decision** (stated as a
commitment, not a preference), **Consequences** (what this costs as well as what it buys), and
**Alternatives considered** (each with the reason it was rejected).

Four disciplines a reviewer checks:

1. **Amend, never rewrite.** An ADR is a dated record of a decision. When something changes, add
   a dated `**Amended:**` line saying what it changes and — explicitly — whether it reverses
   anything — for example "Both are additive: nothing above … is reversed." That sentence is
   doing real work; without it a later reader cannot tell an addition from a reversal.
2. **Say when a prior framing was wrong.** If an ADR's own framing turns out to be incomplete,
   record that in an amendment and name the ADR that corrects it. A superseded claim that is silently overwritten
   leaves every citation of it dangling.
3. **`Related:` is bidirectional in intent.** If `0011` supersedes part of `0002`, `0002` says so
   too. One-way links rot.
4. **Status is one of Proposed / Accepted / Superseded by NNNN.** "Draft" and "WIP" are not
   statuses; they are a todo wearing a document's clothes.

## PRD Standards

Filename: `pNNN-short-slug.md`. Registered in the PRD directory's `README.md` index table with both a
Contents and a Status column, and the README carries the set's version line.

- **Write for the reader who is not building it.** The PRD describes what a user can do and what
  the product guarantees, in plain language. Implementation mechanism belongs in the spec.
- **Per-file status tracks the set version.** When a file changes materially, its Status cell
  says what changed in that revision (`"v2.2 — onboarding redefined as a guided setup …"`), not
  just the version number.
- **A commitment stated in the PRD is a contract.** A PRD guarantee such as "one customer can
  never see another customer's data" is quoted verbatim in the matching spec because the spec
  exists to make it true. Do not
  soften or restate such a commitment in a second place — quote it and cite the section.
- **Known gaps belong in the packaging/limits file**, listed as product limits with their
  consequences, not scattered as inline TBDs.

## Spec Standards

Filename: `domain-topic.md`, organized by domain, never by process stage or wave. Registered in
`specs/_index.md`'s table with a Domain and a Description cell.

Every spec file closes with two sections:

- **Traceability** — each requirement cites its PRD/ADR/decision-record source. This is what
  makes a spec auditable: a requirement with no upstream source is either an invention or an
  undocumented decision, and both need surfacing.
- **Open Questions** — genuinely unresolved product/design questions. When one resolves, mark it
  `RESOLVED` in place with the reasoning and the authority that settled it, rather than deleting
  it. `_index.md` carries a "Known cross-file open questions" section for questions that recur
  across domains, so they are not lost between files.

Numbered sections (`§1.2`, `§3.1`) are the citation surface — code comments and other specs cite
them directly (e.g. a table-classification module citing `specs/data-model.md §1.2, §2.4`).
That makes section numbers load-bearing: **renumbering a section breaks every citation of it.**
When you must renumber, grep for the old anchor first.

```bash
grep -rn "data-model.md §" <source-root>/ <test-root>/ .claude/ workspaces/
```

## Writing Standards Across All Three

### 1. Every code-surface claim cites a resolvable location

A claim about a method, file, endpoint, table, column, config key, or env var MUST resolve
against a `grep` at merge time. See `documentation-validation-patterns.md` for the sweep.

```markdown
# DO

The connection choke point is `openTenantSession` (`<source-root>/db/session.<ext>`).

# DO NOT

The connection helper handles tenant scoping. (which helper? where?)
```

### 2. Terminology is fixed per concept

One concept, one name, everywhere. A typical drift: a "shared space" concept gets renamed to
"Space" and nested under a new "Workspace" concept, and the rename has to be carried across the
PRD, the specs, and the object model simultaneously. When a term changes, sweep all three
surfaces in the same change — a half-renamed concept reads as two concepts.

Keep the project's current load-bearing terms in one place (a glossary section in the spec
`_index.md` or the first ADR) so reviewers check against a list, not memory.

### 3. Tables carry a Status or Description column, and it is maintained

Every index table (`adr/README.md`, `prd/README.md`, `specs/_index.md`) has a
per-row status or description. A new file that is not added to its index is invisible; a stale
row is worse than a missing one, because it is read as current.

### 4. No unexplained jargon

Name the exact term, then explain it in the same breath. `"the dependency-boundary check (the
command listed in the project profile) — the check that fails the build if any file outside the
connection module imports the database driver"` is usable; `"the boundary check fails"` is not,
because the reader can neither act on it nor search for it.

### 5. Past-tense change logs only

An append-only change log recording what changed and when is institutional memory. A change log
entry in the future tense (`"YYYY-MM-DD (planned): wire the resolver"`) is a todo in disguise —
move it to `workspaces/<project>/todos/`.

## Review Checklist

- [ ] The right surface: product behaviour → PRD, decision rationale → ADR, buildable contract →
      spec, unbuilt work → todos
- [ ] No split-state framing (`Phase 1/2`, `Promised/Current`, inline `TBD`/`pending`) in a spec
- [ ] Every code-surface claim resolves via `grep`
- [ ] New file registered in its index table (`adr/README.md`, `prd/README.md`, `specs/_index.md`)
- [ ] ADR carries Status / Date / Related; amendments are dated and say what they reverse
- [ ] Spec closes with Traceability and Open Questions
- [ ] Section numbers cited elsewhere were not silently renumbered
- [ ] Terminology matches the current names across all three surfaces
- [ ] Change-log entries are past tense
- [ ] No secrets, credentials, or personal data in examples

## Related

- `documentation-validation-patterns.md` — the mechanical sweeps behind this checklist
- `SKILL.md` — the code patterns documentation describes
- `.claude/rules/spec-accuracy.md` — what a spec may contain
- `.claude/rules/specs-authority.md` — how specs are organized and kept current
- `.claude/rules/communication.md` — plain-language requirement
- `.claude/rules/evidence-first-claims.md` — verify a claim before it lands in a durable doc
