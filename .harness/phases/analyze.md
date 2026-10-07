
## Workspace Resolution

1. If `$ARGUMENTS` specifies a project name, use `workspaces/$ARGUMENTS/`
2. Otherwise, use the most recently modified directory under `workspaces/` (excluding `instructions/` and leading-underscore meta-dirs like `_archive`/`_template`)
3. If no workspace exists, create `workspaces/<name>/briefs/` using the project name from the request; ask only when no name can be derived, and capture the user's description as the first brief
4. Read all files in `workspaces/<project>/briefs/` for user context (this is the user's input surface)

## Phase Check

- Output goes into `workspaces/<project>/01-analysis/`, `workspaces/<project>/02-plans/`, and `workspaces/<project>/03-user-flows/`

## Execution Model

Use `.harness/guides/task-delivery.md` with `.harness/rules/autonomous-execution.md`. Design for small integrated outcomes and the simplest architecture satisfying requirements. Estimate from measured delivery and verification effort; parallelism does not remove dependency, context or test-isolation costs.

## Workflow

### 1. Be explicit about objectives and expectations

Understand the product idea before diving into research.

### 2. Perform Deep Research

Document in detail in `workspaces/<project>/01-analysis/01-research`.

- Use as many subdirectories and files as required
- Name them sequentially as 01-, 02-, etc, for easy referencing

### 3. Ensure strong product focus

Keep this soft rule in mind for everything:

- 80% of the codebase/features/efforts can be reused (agnostic)
- 15% of client specific requirements goes into consideration for self-service functionalities that can be reused (agnostic)
- 5% customization

Steps:

1. Research thoroughly and distill value propositions and UNIQUE SELLING POINTS
   - Scrutinize and critique the intent and vision, focusing on perfect product-market fit
   - Research competing products, gaps, painpoints, and any other information that helps build solid value propositions
   - Define unique selling points (not the same as value propositions) — be extremely critical and scrutinize them
2. Evaluate using platform model thinking
   - Seamless direct transactions between users (producers, consumers, partners)
     - Producers: Users who offer/deliver a product or service
     - Consumers: Users who consume a product or service
     - Partners: To facilitate the transaction between producers and consumers
3. Evaluate using the AAA framework
   - Automate: Reduce operational costs
   - Augment: Reduce decision-making costs
   - Amplify: Reduce expertise costs (for scaling)
4. Features must cover network behaviors for strong network effects
   - Accessibility: Easy for users to complete a transaction (activity between producer and consumer, not necessarily monetary)
   - Engagement: Information useful to users for completing a transaction
   - Personalization: Information curated for an intended use
   - Connection: Information sources connected to the platform (one or two-way)
   - Collaboration: Producers and consumers can jointly work seamlessly

### 4. Document everything

Document analysis in `workspaces/<project>/01-analysis/`, plans in `workspaces/<project>/02-plans/`, and user flows in `workspaces/<project>/03-user-flows/`.

- Use as many subdirectories and files as required
- Name them sequentially as 01-, 02-, etc, for easy referencing

### 5. Record the project profile

If `.harness/guides/project-profile.md` still has `<unset>` values that this analysis can now
determine — project name, primary language(s), application shape, source/test roots, the
commands, test infrastructure — propose concrete values alongside the stack recommendation.
Once the user approves the stack, write them into the profile. Leave a row `<unset>` when it
is genuinely still unknown, and `n/a` (with a reason) when the project has no such step;
never guess a command. Later phases read commands only from the profile.

### 6. Create specs/ (MUST — before red team)

Create `specs/` at the project root with detailed domain specification files. Specs are organized by the project's domain ontology (components, modules, features, user needs), NOT by process stages. See `.claude/rules/specs-authority.md`.

1. **Create `specs/_index.md`** — a lean manifest listing every spec file with domain and one-line description
2. **Create domain spec files** — one per major domain area discovered during analysis. Each file must be detailed enough to be the authority on its topic: every flow, contract, constraint, edge case, and decision.
3. **Brief traceability** — for each requirement sentence in `briefs/`, confirm a corresponding spec file section exists. Missing mappings are BLOCKING — they become the requirements that silently disappear.
4. **Execution readiness** — name the trusted/untrusted boundary, real integration path, transaction/lock owners, dependency signatures, ordinary failure cases and isolated test environment. Resolve uncertain mechanisms with a bounded experiment before detailed implementation todos. Architectural suggestions remain revisable when evidence supports a simpler design.

The structure is project-defined. Examples:

- SaaS: `authentication.md`, `billing.md`, `data-model.md`, `notifications.md`
- SDK: `core-api.md`, `configuration.md`, `error-handling.md`, `extensibility.md`
- ML: `data-pipeline.md`, `model-architecture.md`, `training.md`, `serving.md`
- Non-coding: organized by whatever domain structure fits

### 7. Red team

Work with red team agents to scrutinize analysis, plans, user flows, AND specs.

- Classify gaps against accepted requirements and the threat model; distinguish defects from new scope
- Always go back to first principles, identify the roots, and plan the most optimal and elegant implementations
- Analysis, user flows must flow into plans
- Verify every brief requirement appears in at least one spec file

### 8. Testable-surface inventory (optional — no enumerator tool is included)

If useful, list the actionable units this project will expose (endpoints, components, CLI
commands) and note which already have an expected behavior defined and which don't, into
`01-analysis/`. This is a manual step — the harness includes no automated enumerator —
so skip it when the project is small enough that `specs/` already covers this.

## Agent Teams

Dispatch the **analyst** agent (`.claude/agents/analysis/analyst.md`) via the Agent tool for
failure analysis, complexity assessment, risk identification, requirements breakdown, and ADRs
(written to `workspaces/<project>/docs/adr/NNNN-<slug>.md`).

For frontend or AI-interface work, additionally dispatch **uiux-designer**
(`.claude/agents/design/uiux-designer.md`) for information architecture, visual hierarchy,
design-system planning, and AI interaction patterns.

There is no dedicated agent in this harness for buyer value-proposition critique —
have the analyst cover that lens directly, or write a `value-auditor` agent (same shape as the
others in `.claude/agents/`) once the product's target buyer is defined.

Review against explicit acceptance, with task-delivery's complete-round recorder and reassessment limits. Commit analysis on a `docs/<slug>` branch, never `main`, and record its review rounds there (scope `analysis-<slug>`, so a later analysis does not overwrite this one's round and report files), so they don't spend another branch's round budget (`.harness/guides/task-delivery.md` § Branches, pull requests and merging). Repeated gaps trigger a design decision; an absence-of-findings search over unlimited scope is not a completion criterion.

### Journal (MUST — phase-complete gate)

Before reporting `/analyze` complete, create journal entries for journal-worthy findings produced this phase:

- **DISCOVERY** — key findings, patterns, or domain knowledge uncovered during research
- **GAP** — missing information, unvalidated assumptions, or areas needing follow-up research
- **CONNECTION** — non-obvious relationships between requirements, components, or findings

Use `/journal new <TYPE> <slug>` (or write directly to `workspaces/<project>/journal/NNNN-TYPE-slug.md`). Skip only when the phase genuinely produced nothing journal-worthy — use judgment, not formulas. Do not batch: create each entry as you recognize it, not at the end.

### Output-Completeness Gate (MUST — phase-complete + advance gate)

`/analyze` MUST NOT be declared complete, and `/todos`/`/implement` MUST NOT advance, while any compulsory output tree is empty. Prose naming the outputs is insufficient — they were named above and still got skipped; the gate is mechanical. Run the `find` battery; ANY `INCOMPLETE` line BLOCKS completion AND blocks advancing to `/todos`:

```bash
W="workspaces/<project>"   # the resolved workspace
for tree in 01-analysis 02-plans 03-user-flows; do
  find "$W/$tree" -type f -name '*.md' ! -name '.gitkeep' 2>/dev/null | grep -q . \
    || echo "INCOMPLETE: $W/$tree has no non-.gitkeep .md output"
done
# specs/ belongs at the repository root (specs-authority.md Rule 1); a legacy
# workspaces/<project>/specs/ also satisfies this check:
{ find "$W/specs" -type f -name '*.md' ! -name '.gitkeep' 2>/dev/null
  find specs -type f -name '*.md' ! -name '.gitkeep' 2>/dev/null; } | grep -q . \
  || echo "INCOMPLETE: specs/ empty at BOTH $W/specs and repo-root specs/"
```

The `03-user-flows/` tree is compulsory. A change with genuinely no user-facing surface (a pure back-end refactor) does NOT skip it silently — write `03-user-flows/00-no-user-flows.md` stating WHY no flows apply. That documented-rationale file is a real `.md` and satisfies the gate; a silent-empty tree does not.

No hook enforces this automatically — the `find` battery above is the actual check; run it yourself before declaring the phase complete.
