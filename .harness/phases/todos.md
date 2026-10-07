
## Resolve the workspace

Use `workspaces/$ARGUMENTS/` when named; otherwise the most recently modified real
workspace, excluding `instructions` and every leading-underscore directory. Read its
briefs and `02-plans/`, and resolve the spec index at the project root or in this
workspace. If both exist and disagree, resolve authority before planning. If neither
exists, return to `/analyze`; do not invent domain specifications during task creation.
Read relevant analysis decisions and any existing active/completed todos.

Plan on a `docs/wNN-plan` branch cut from `main` (`.harness/guides/task-delivery.md`
§ Branches, pull requests and merging). It merges into `main` after plan approval, before
the wave branch is cut.

## Execution contract

Read `.harness/guides/task-delivery.md`. Keep the entire value-ranked roadmap visible;
write detailed delivery contracts only for the current wave. Later-wave tasks are
provisional and are revalidated at each wave boundary. Estimate using this repository's
measured work; do not apply an assumed universal 10x throughput multiplier.

## Workflow

1. Review the plans against actual source signatures and available infrastructure.
   Consult the relevant backend, frontend or other domain specialist for uncertain
   contracts. The todo-manager tracks existing tasks; the analyst/planner authors them.
   Take in the pending todo proposals in `workspaces/<project>/todos/parked/`: a `/fix`
   converted to a todo or a hotfix's follow-up `/redteam` (`.harness/phases/fix.md` § 4 and
   § 7), and items found along the way (`.harness/rules/autonomous-execution.md` § Problems
   found along the way). Rank each with the rest of the roadmap. One joins the plan only
   through this phase's plan approval (step 10), and only into a wave whose acceptance list
   is not yet written: the current wave before step 11, or a later wave with its own new
   acceptance list. Never edit a frozen `acceptance-wNN.md` to add one. When the plan is
   approved, an accepted proposal is renamed (`git mv`) into
   `todos/active/wNN-MM-<slug>.md` and given its delivery contract; a declined one is
   deleted, and the reason is recorded in a journal `DECISION` entry that names the file.
   One the user wants later stays in `parked/` unchanged.
2. Declare `workspaces/<project>/todos/WAVE-SEQUENCE.md`, ordered by user value and dependencies. Every
   requirement has a roadmap owner, including testing, integration and deployment.
   A one-wave plan states why it fits one convergence surface.
3. Slice by observable outcome. Prefer one small real caller→component→data-store
   scenario per todo. Split build and wire only with the independently testable interface
   and integration owner required by task-delivery; never mark an unwired user outcome done.
4. Resolve every current-wave task's dependency signatures, input/output/error shapes,
   authorization source, transaction/lock owner, concurrency behavior, and test environment.
   Read the actual dependency code. Unknown load-bearing behavior becomes a design/spike
   task with an experiment and decision output, not a guess in an implementation todo.
5. Write each current-wave todo to `workspaces/<project>/todos/active/wNN-MM-<slug>.md` —
   wave `NN`, item `MM`, both zero-padded, for example `w03-07-invite-flow.md`. The
   convergence checker reads the id (`w03-07`) from the filename with
   `^([a-z]+[0-9]*-[0-9]+[a-z]?)` (case-insensitive); a name it cannot parse fails the
   sweep, so never use another pattern and never reuse an id. For each task, name the spec sections and user-value anchor. Freeze 1–10 observable
   acceptance criteria, the owned paths, one integrated scenario, ordinary failure cases,
   and explicit trusted/untrusted boundaries. Use the `## Delivery contract` JSON format
   in task-delivery, with no unresolved questions. Record independently ratified approval;
   the implementer must not retroactively redefine acceptance to match the code.
6. Keep each implementation slice within the complexity budget in
   `.harness/rules/autonomous-execution.md`: ≤500 lines of load-bearing logic, ≤5–10 simultaneous
   invariants and ≤3–4 reasoning hops. Count dependencies and verification complexity;
   three long sentences do not make a large task small. Reassess if implementation grows
   materially beyond the estimate. Preserve the outcome when splitting.
7. Freeze the expectations of new actionable units, so `/implement` § 7b Expectation
   coverage can check them. Have an
   independent planning reviewer check the integrated scenario, boundary assumptions,
   dependency readiness and negative controls. Classify new findings before expanding
   scope. Record planning review rounds with the same round recorder and limits as
   `/redteam`, on the `docs/wNN-plan` branch with scope `wNN-plan`. One complete CLEAR
   round is the bar for the plan (task-delivery § Review protocol and circuit breaker);
   repeated "find any remaining gap" prompting is not a planning completion criterion.
8. Run `node .harness/bin/check-task-contract.mjs <todo.md>` on each implementation-ready
   current-wave todo. This checks structure; the reviewer still judges the actual contract.
9. Surface the top three value-ranked workstreams with brief/spec anchors, dependencies,
   scope trade-offs, and current-wave acceptance. Journal decisions and unresolved risks
   concisely. Update specs when planning legitimately changes an agreed contract.
10. Stop for plan approval before implementation. Existing explicit approval remains valid;
    ask again only for material scope, authority, behavior or accepted-risk changes.
11. After approval, write the wave's acceptance list to
    `workspaces/<project>/04-validate/acceptance-wNN.md`: the scope name `wNN`, every
    current-wave todo id, each todo's acceptance IDs, and who ratified it (a named human or
    the independent planning reviewer — never the authoring agent). Commit it with the
    todos; never edit it afterwards — the convergence receipt requires it byte-identical at
    the verdict commit, so changed acceptance means a new scope. Then merge the plan branch
    into `main` (§ Branches, pull requests and merging).

## Resuming

Revalidate changed dependencies and new briefs. Add delivery contracts to existing todos
as they are resumed; preserve their verification records and open findings. Do not rewrite
the full backlog or manufacture approval dates. Implementation works on the current wave;
the next wave starts after convergence, learning capture, spec/todo updates and re-ranking.
