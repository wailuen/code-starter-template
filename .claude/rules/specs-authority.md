---
priority: 10
scope: path-scoped
paths:
  - "**/specs/**"
  - "**/specs/_index.md"
  - "**/workspaces/**"
  - "**/briefs/**"
  - "**/02-plans/**"
  - "**/todos/**"
---

# Specs Authority Rules

The `specs/` directory is the single source of domain truth for a project: detailed spec files organized by the project's own ontology — components, modules, user needs, domains. Phase commands read targeted spec files before acting and update them when domain truth changes.

`specs/` is not a process artifact (that's `workspaces/`). It is the detailed record of WHAT the system is and does, not HOW we are building it. Plans, todos, and journals keep their existing roles.

Origin: an analysis of six ways intent and implementation drifted apart across the phase workflow.

## MUST Rules

### 1. Every Project Has A `specs/` Directory With `_index.md`

`/analyze` creates `specs/` at the project root with an `_index.md` manifest listing every spec file and a one-line description. Phases read `_index.md` to find relevant files, then read only those.

```markdown
# DO — lean lookup table

| File              | Domain | Description                              |
| ----------------- | ------ | ---------------------------------------- |
| authentication.md | Auth   | Login/register flows, JWT, session mgmt  |
| data-model.md     | Data   | All entities, relationships, constraints |

# DO NOT — actual specifications inline in \_index.md
```

**Why:** Without an index, phases must read every spec file to find relevant content, wasting context. Without `specs/`, alignment drifts as phases work from stale memory.

### 2. Spec Files Are Organized By Domain Ontology, Not Process

```
# DO — domain-organized
specs/authentication.md / billing.md / data-model.md / notifications.md / tenant-isolation.md

# DO NOT — process-organized (duplicates workspaces/)
specs/intent.md / decisions.md / progress.md / boundaries.md
```

**Why:** Process-organized specs duplicate the workspace directory structure. Domain-organized specs capture WHAT the system does — exactly what drifts during implementation.

### 3. Spec Files Are Detailed, Not Summaries

Make each spec file comprehensive enough to be the authority on its topic: every nuance, constraint, edge case, contract, and decision.

```markdown
# DO — detailed authority

## Login Flow

1. User submits email + password to POST /api/v1/auth/login
2. Server validates credentials against bcrypt hash
3. On success: generate JWT (RS256, 24h expiry), set HttpOnly cookie
4. On failure: increment failed_attempts
5. If failed_attempts >= 5: lock account, require email verification
6. Rate limit: 10 attempts per IP per minute (429)

# DO NOT — thin summary

## Login Flow

Users can log in with email and password. JWT is used. Failed logins tracked.
```

**Why:** Thin summaries lose the exact details agents need. "JWT tokens are used" doesn't tell the agent RS256 vs HS256, expiry, or cookie strategy — these omissions become the bugs.

### 4. Phase Commands Read Specs Before Acting

Each phase reads `specs/_index.md` at start, identifies the relevant files, and reads those before taking action. Read only the files relevant to the current work, not the whole `specs/` directory.

**Why:** Working from memory instead of specs is the root cause of incremental divergence. Agents recall 3 of 15 details; the other 12 become bugs.

### 5. Spec Files Are Updated At First Instance

When domain truth changes during any phase, update the relevant spec file immediately — not batched at phase end.

```
# DO — update when the truth changes
1. Implement todo changing UserService.create_user() signature
2. Immediately update specs/user-management.md with new signature
3. Continue

# DO NOT — batch for later
```

**Why:** Batched updates create a staleness window where other agents or the next session read outdated specs. First-instance updates keep specs current within one action.

### 5b. Spec Edits Trigger Full Sibling-Spec Re-Derivation

Every spec edit triggers a re-derivation sweep against the full sibling-spec set in the same domain (editing `specs/ml-engines.md` triggers all `specs/ml-*.md`), not just the specs you edited, because three categories of finding only emerge from the full sweep:

1. **Field-shape divergence** — sibling specs reference the changed data structure differently
2. **Downstream consumer drift** — specs whose mandates depend on the changed surface are now stale
3. **Cross-spec terminology drift** — the same concept named two ways across files

```bash
# DO — edit one spec, grep ALL siblings for references, re-derive assertions
ls specs/ml-*.md                          # enumerate full sibling set
grep -l "TrainingResult" specs/ml-*.md    # find downstream consumers
# Re-derive for EACH matching sibling, not just the edited file

# DO NOT — narrow scope
# (ml-backends.md references TrainingResult.backend/.devices as top-level fields
#  after ml-engines.md moved them — drift invisible to narrow scope)
```

"Siblings re-derive when they are edited" and "the last round was green on the edited specs" both leave the drift in place until someone happens to touch the sibling.

**Why:** Spec domains share vocabulary, data structures, and invariants; editing one without re-deriving the full sibling set lets narrow-scope approvals ship with silent cross-spec drift.

### 5c. Orchestrator Amends Todo Text At Launch When The Spec Has Moved

Before launching any `/implement` shard agent, cross-check the todo's claims (version bumps, symbol lists, spec section refs) against the current canonical spec and current package state (prior merged shards). Resolve discrepancies in the todo text before launch — do not launch with a known-stale todo and leave the agent to discover the conflict mid-implementation. This amendment is bookkeeping that keeps the approved todo accurate, not a scope change; if the discrepancy changes what the todo delivers, surface it as a decision instead.

```markdown
# DO — amend at launch time, note inline

Todo says: "the schema exports 34 fields"
Spec §5.9 says: "the schema exports 41 fields (40 + a later addition)"
→ AMEND AT LAUNCH: prefer spec per §5b, prompt the agent with 41.

# DO NOT — launch with stale todo, let agent hit the conflict mid-flight
```

**Why:** Todos are written at `/todos` time against the repo as it was; by `/implement` time prior shards have shipped and specs have been edited during `/redteam` convergence. Launching a stale todo burns the agent's budget on re-derivation and risks shard failure; a two-minute launch-time amendment costs far less than any shard re-run.

### 6. Deviations From Spec Require Explicit Acknowledgment

When implementation deviates from a spec: (a) update the spec with the new truth, (b) log the deviation with its rationale, (c) flag user-visible changes for the user's approval.

```markdown
# DO

## Notifications

~~Real-time via WebSocket~~ → Polling every 5s (changed YYYY-MM-DD)
**Reason:** WebSocket requires dedicated server; polling achievable with current infra
**User impact:** 5s delay. User notified: YES

# DO NOT — silent divergence (spec says WebSocket, code does polling, nobody knows)
```

"It's an implementation detail" and "I'll update the spec once it stabilizes" are how a deviation stays silent; if the approach differs from the spec, it is a deviation.

**Why:** Silent deviations are the top cause of "it works but it's not what I asked for." The spec is the contract.

### 7. Agent Delegation Includes Relevant Spec Files

When delegating to a specialist, read `_index.md`, select the relevant spec files, and include their content in the delegation prompt. For specs over 200 lines, include only the relevant section with a pointer to the full file.

```
# DO — include spec content
Agent(prompt: "Build user schema.\n\nFrom specs/data-model.md:\n[content]\n\nFrom specs/tenant-isolation.md:\n[content]")
# DO NOT — delegate without specs context
Agent(prompt: "Build user schema.")
```

**Why:** Specialists without spec context produce intent-misaligned output — e.g., schemas without `tenant_id` because multi-tenancy wasn't communicated.

### 8. Large Spec Files Are Split

When a spec file exceeds 300 lines, split it into sub-domain files and update `_index.md`. Each sub-file is self-contained for its sub-domain.

**Why:** Oversized spec files crowd out implementation reasoning when loaded into context, and make delegation prompts enormous.

### 9. Workspace Specs Reference Canonical Artifacts (Not Restate)

When a workspace spec describes the mechanism of a canonical artifact (a command, rule, skill, agent, or harness script), cite the artifact by a grep-stable anchor (`<path> §<section>` or a named symbol) rather than restating its content. Prefer the grep-stable form per `.claude/rules/symbol-anchored-citations.md` — a bare `<path>:<line>` is only a paired hint next to a symbol, never on its own, because line numbers drift the moment the cited file is edited.

```text
# DO — workspace spec references canonical source by a grep-stable anchor

The security-reviewer requirement comes from `isSecuritySurface()` in
`.harness/bin/check-redteam-convergence-receipt.mjs`, which decides which changed paths
count as security surface.

# DO NOT — workspace spec restates the implementation

(a verbatim copy of the function's actual code, pasted into the spec — updating one
without the other creates silent drift)
```

"Restating makes the spec self-contained" is the usual reason given; it buys readability at the cost of a second source of truth that drifts.

**Why:** Workspace specs describe semantics while canonical artifacts encode implementation; restating implementation in specs creates parallel sources of truth that drift silently. Referencing keeps the canonical artifact the single source of truth and keeps specs focused on what they uniquely contribute — semantics, invariants, and rationale.

**Exception:** Educational DO / DO NOT examples in `.claude/rules/` are not covered — those teach by restating. This rule applies only to workspace specs (under `workspaces/<project>/specs/`), not canonical rule files.

## MUST NOT

- Organize specs by workflow process stages (duplicates `workspaces/`)
- Read the entire `specs/` directory at a phase gate (except the `/redteam` and `/codify` audits)
- Treat specs as optional documentation — "the code is the spec" and "plans already capture this" leave no domain truth to check work against

## Enforcement

No hook checks this automatically. Catching a violation of this rule depends on the agent
applying it and on review at `/redteam`/`/codify`. A project that adds a hook for it should
name it here.
