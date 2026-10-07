---
name: journal
description: "View, create or search entries in the workspace journal (workspaces/<project>/journal/) — the record of decisions, discoveries, trade-offs, risks and gaps across sessions. Use to record a decision or finding, or to look up why something was decided."
---

Manage the project journal. The journal is the primary knowledge trail — it captures decisions, discoveries, trade-offs, risks, connections, and gaps across sessions.

Parse `$ARGUMENTS`:

- **Empty or "status"**: Show journal status
- **"new TYPE topic"**: Create a new journal entry (e.g., `new DECISION chose-event-driven`)
- **"search QUERY"**: Search existing entries by topic or tag

---

## Action: Status (default)

1. Determine the active workspace:
   - If working in a workspace, use it
   - Otherwise, use the most recently modified directory under `workspaces/` (excluding `instructions/` and any directory whose name starts with `_`)

2. In `workspaces/<project>/journal/`:
   - Count total entries
   - Count entries by type (DECISION, DISCOVERY, TRADE-OFF, RISK, CONNECTION, GAP, AMENDMENT)
   - List the 5 most recent entries with their date, type, and topic (from frontmatter)
   - Show the highest entry number (for next entry reference)

3. Present as a compact summary.

---

## Action: New Entry

1. Parse the TYPE and topic from arguments. Valid types: DECISION, DISCOVERY, TRADE-OFF, RISK, CONNECTION, GAP, AMENDMENT.

2. Check the highest existing entry number in `workspaces/<project>/journal/` on the current branch, on `main` and on every unmerged local branch (`git ls-tree -r <branch> --name-only -- workspaces/<project>/journal/`)
   — the new entry's number is highest + 1. The harness has no reservation or locking system,
   so this all-branches check is what keeps a number from being used twice.

3. Create the file at `workspaces/<project>/journal/NNNN-TYPE-topic.md` (the convergence-receipt checker looks for journal entries there, not at the repo root) with this structure:

```markdown
---
type: [TYPE]
date: [today's date, YYYY-MM-DD]
author: [human | agent | co-authored — per the journal.md decision tree]
project: [workspace name]
topic: [topic description]
phase: analyze | todos | implement | redteam | debug | fix | codify | learn | design | validate | sweep | wrapup | deploy
tags: [list — include `harness` only for a harness lesson, see below]
relates_to: NNNN-slug of the entry this amends/extends/references (optional; required for AMENDMENT)
---

## [Section heading appropriate to type]

[Content — prompt the user for details if not provided]
```

This frontmatter is the canonical contract `.claude/rules/journal.md` documents — the two MUST
agree.

**The `harness` tag.** A journal entry of any type whose `tags:` include `harness` is a
harness lesson: `/learn` lists it and `/codify` folds it into the harness
(`.harness/phases/learn.md`). Tag `harness` only when the entry is about the harness itself
— a rule, phase, role, guide, agent or tool. Product findings (DISCOVERY, GAP, TRADE-OFF
about the product, its users or its domain) never carry it. `/codify`'s own summary entries
are type `DECISION` without the `harness` tag, so a codify run never creates a new lesson.

Set `author:` per the decision tree in `.claude/rules/journal.md`; default to `agent`
when uncertain, because `human`/`co-authored` DECISION entries count as user decisions.

4. Type-specific structure:
   - **DECISION**: Sections for Decision, Alternatives Considered, Rationale, Consequences
   - **DISCOVERY**: Sections for What Was Discovered, Why It Matters, Follow-Up
   - **TRADE-OFF**: Sections for Trade-Off, What Was Gained, What Was Sacrificed, Acceptable Because
   - **RISK**: Sections for Risk Identified, Likelihood and Impact, Mitigation, Follow-Up
   - **CONNECTION**: Sections for Connection, Components Linked, Why This Matters
   - **GAP**: Sections for What Is Missing, Why It Matters, How to Resolve
   - **AMENDMENT**: Sections for What Is Amended (with `relates_to:` the original), What Changed, Why — extends a prior entry, never overwrites it

   **`## For Discussion`** (per `.claude/rules/journal.md` Requirements): append 2-3 probing questions (≥1 counterfactual, ≥1 referencing specific data) for analytical types (DISCOVERY, TRADE-OFF, RISK, GAP, CONNECTION) and substantive DECISIONs. A terse **coordination-receipt DECISION** or **AMENDMENT** (closure SHAs, criteria-met tables, redteam dispositions, convergence verdicts) MAY omit it — it must still be self-contained.

5. After creating, confirm with the entry number and path.

---

## Action: Search

1. Search all `workspaces/<project>/journal/*.md` files for the query string in:
   - Filename
   - Frontmatter `topic` and `tags` fields
   - Body content

2. Display matching entries with their number, type, date, and topic.

## Error Handling

- **No workspace detected**: Ask the user which workspace to use, or list available workspaces.
- **Journal directory missing**: Create `workspaces/<project>/journal/` and proceed.
- **Invalid TYPE**: Show the list of valid types (DECISION, DISCOVERY, TRADE-OFF, RISK, CONNECTION, GAP, AMENDMENT) and ask the user to choose.
- **Numbering gaps**: Acceptable. Always use the highest existing number + 1, regardless of gaps.
