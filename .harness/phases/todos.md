
## Resolve the workspace

Use `workspaces/$ARGUMENTS/` when named; otherwise the most recently modified real
workspace, excluding `instructions` and every leading-underscore directory. Read its
briefs, `02-plans/` and `specs/_index.md`. If the workspace has no spec index, return to
`/analyze`; do not invent domain specifications during task creation.
Read relevant analysis decisions and any existing active/completed todos.

For a product with screens, read the approved prototype on `main`
(`workspaces/<project>/prototype/`, `.harness/phases/prototype.md`): `SCREENS.md`, `DESIGN.md`
and `APPROVAL.md`. Run `node .harness/bin/check-prototype.mjs workspaces/<project>` on `main`
and plan screen work only for phases whose `status` it reports as `approved` (the Approval cell
in `SCREENS.md` says the same); a held or changed phase reads `awaiting approval` and is not
planned. If `SCREENS.md` ends with `Screen check: owed`, stop and run `/prototype` first: it runs the
owed check on a new `docs/prototype-<n>` branch and, if any page changed, takes a new approval
for that phase before the branch merges. If no approval covers the phase being
planned, stop and recommend `/prototype`; plan without it only when the user says so, recorded
as a journal `DECISION` entry with `author: human` — the same record covers a product whose
built screens stand in for the prototype (`.harness/phases/prototype.md` § When to run). A
product with no screens has only `prototype/00-no-screens.md` instead. Proposals in
`todos/parked/` marked `design change` come from a revised prototype and are ranked with the
rest.

Plan on a `docs/wNN-plan` branch cut from `main` (`.harness/guides/task-delivery.md`
§ Branches, pull requests and merging). It merges into `main` after plan approval, before
the wave branch is cut.

## Execution contract

From `.harness/guides/task-delivery.md`, read § Priority, § Before a wave starts, § Harness
backlog, § Workspace file layout, § Branches, pull requests and merging and § Before
implementation. Find each section's line range with `grep -n '^## ' .harness/guides/task-delivery.md` and read
only those ranges. Keep the entire value-ranked roadmap visible;
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
   requirement has a roadmap owner, including testing, integration and deployment. The first
   wave of a new repository also owns its setup: a CI workflow that runs the project profile's
   Local CI parity command on every pull request (check out the full history, e.g. `fetch-depth: 0`,
   because the harness checkers read git history), plus — in standard mode —
   `node .harness/bin/check-redteam-convergence-receipt.mjs --sweep workspaces` on pushes to
   `main` and pull requests into `main` only (todo and wave branches carry todos that are not
   converged yet); a health endpoint when the product will be deployed; and branch protection
   on `main` requiring the CI check
   (a repository-settings change, so the user confirms it — `.harness/rules/autonomous-execution.md`
   § What needs the user). Branch protection is optional: on a private repository it may need a
   paid GitHub plan, so say so in the plan and let the user choose. Without required checks,
   every merge runs Local CI parity on the pinned head first (task-delivery § Branches, pull
   requests and merging, step 4). Pushing the CI workflow needs the user's OK; ask for it as
   part of plan approval (step 10) and name it in the approval record.
   A one-wave plan states why it fits one convergence surface.
3. Slice by observable outcome. Prefer one small real caller→component→data-store
   scenario per todo. Split build and wire only with the independently testable interface
   and integration owner required by task-delivery; never mark an unwired user outcome done.
   A todo that builds or changes a screen has a `Prototype screens:` line naming the
   `SCREENS.md` files it builds (for a built screen the prototype does not list, under the
   journal decision in `.harness/phases/prototype.md` § When to run: `Prototype screens: built —
   <that journal entry's path>`), and an acceptance criterion that the built screens match
   them — layout, words and states — at 400, 800 and 1280 pixels wide (the phone, tablet and
   desktop widths of the prototype's `views.html`). Every approved screen
   has an owner in `WAVE-SEQUENCE.md`: a current-wave todo, or a later wave.
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
   in task-delivery, with no unresolved questions. Leave `approved_by` empty until the user
   approves the plan at step 11 (task-delivery § Before implementation); the implementer must
   not retroactively redefine acceptance to match the code.
6. Keep each implementation slice within the complexity budget in
   `.harness/rules/autonomous-execution.md`: ≤500 lines of load-bearing logic, ≤5–10 simultaneous
   invariants and ≤3–4 reasoning hops. Count dependencies and verification complexity;
   three long sentences do not make a large task small. Reassess if implementation grows
   materially beyond the estimate. Preserve the outcome when splitting.
7. (In light mode there is no planning review round; see task-delivery § Light mode.) Freeze
   the expectations of new actionable units, so `/implement` § 3b Expectation
   coverage can check them. Have an
   independent planning reviewer check the integrated scenario, boundary assumptions,
   dependency readiness and negative controls. Classify new findings before expanding
   scope. Record planning review rounds with the same round recorder and limits as
   `/redteam`, on the `docs/wNN-plan` branch with scope `wNN-plan`. One complete CLEAR
   round is the bar for the plan (task-delivery § Review protocol and circuit breaker);
   repeated "find any remaining gap" prompting is not a planning completion criterion.
8. Run `node .harness/bin/check-task-contract.mjs --pre-approval <todo.md>` on each
   implementation-ready current-wave todo: it checks everything except `approved_by`, which
   must still be empty. This checks structure; the reviewer still judges the actual contract.
9. Surface the top three value-ranked workstreams with brief/spec anchors, dependencies,
   scope trade-offs, and current-wave acceptance. Journal decisions and unresolved risks
   concisely. Update specs when planning legitimately changes an agreed contract.
10. Stop for plan approval before implementation. Show the plan in plain language: what the
    user's users will be able to do after this wave, what is left for later waves, and any
    external setup the wave needs, the delivery mode the user picked in `/analyze`
    (`.harness/guides/task-delivery.md` § Light mode) and, in the first wave, the push of the CI
    workflow. Ask the four questions in `.claude/rules/communication.md`
    § Approval Gates, and say plainly that approving freezes this wave's scope: adding,
    dropping or changing a feature later means re-planning it under a new scope name (§ Changing
    or cancelling approved scope), which costs a new plan approval (and, in standard mode, a
    new planning review). Existing explicit approval
    remains valid; ask again only for material scope, authority, behavior or accepted-risk
    changes.
11. After the user approves, write the wave's acceptance list to
    `workspaces/<project>/04-validate/acceptance-wNN.md`: the approval record (`approved_by`
    with the user's name, `approved_on`, and the user's approving words quoted — task-delivery
    § Workspace file layout — naming anything else they approved with it, such as the CI workflow
    push; the delivery mode was approved in `/analyze` § 5, so cite that journal entry instead), the scope name `wNN`, every current-wave todo id and each todo's
    acceptance IDs. Set the same name as `approved_by` in each current-wave todo's delivery
    contract, then run `node .harness/bin/check-task-contract.mjs <todo.md>` (the full check)
    on each. Never fill either before the user has approved, and never with an agent's name.
    Commit it with the todos; never edit it afterwards — the convergence receipt
    requires it byte-identical at the verdict commit, so changed acceptance means a new scope.
    Only now — after the user approved — merge the plan branch into `main` (task-delivery
    § Branches, pull requests and merging); a re-plan merges into the wave branch instead
    (§ Changing or cancelling approved scope step 4).

## Changing or cancelling approved scope

When the user changes direction mid-wave ("drop that feature", "stop, we're doing X instead"):

1. Restate the change in plain words with its impact, trade-off and your recommendation
   (`.claude/rules/communication.md` § Asking the user to decide), including what happens to
   work already built. Act only on the user's answer.
2. Record it in a journal `DECISION` entry with `author: human` that quotes the user's words
   and names every todo it affects.
3. A dropped todo that is still wanted later moves (`git mv`) to `todos/parked/` with a first
   line `Parked: <date> — <reason>`; one the user no longer wants is deleted. Either way the
   journal entry names the file.
4. The frozen `acceptance-wNN.md` is never edited. Re-plan the remaining work as a new scope
   (the next unused letter: `wNNb`, then `wNNc`): run steps 7–11 for it (in light mode, without the planning review round) on a `docs/wNNb-plan`
   branch, with a new approval record. New todos keep the `wNN-MM-<slug>.md` naming with new
   item numbers (a `wNNb-` filename does not parse as an id). `acceptance-wNNb.md` lists every
   todo the wave still delivers — new ones and every already-completed todo the user keeps —
   so none is left uncovered by a receipt. Commit `acceptance-wNNb.md` and the changed todos in
   ONE place: cut `docs/wNNb-plan` from the wave branch (not from `main`), and after the user
   approves, merge it into the wave branch (`git merge --no-ff`), not into `main`. The re-plan
   reaches `main` with the wave. This is the one plan branch that does not merge into `main`
   by itself: carrying the same files to `main` separately would leave a todo the wave later
   completes in both `active/` and `completed/` after the wave merges. The acceptance list is
   then committed before the reviewed commit, as the convergence receipt requires.
5. A dropped todo already merged into the wave branch is either reverted on the wave branch
   (its own commit, reviewed with the wave) with its `completed/` file moved to `parked/` or
   deleted, or — if the user wants to keep the code — kept and listed in `acceptance-wNNb.md`.
   The journal entry says which.
6. Review rounds for `wNNb` run on the same wave branch and continue its round count and its
   three-round budget (in light mode: the wave's one CLEAR round); if that budget is spent, the wave goes to `/debug` or the user
   (task-delivery § Review protocol and circuit breaker). `/redteam` then certifies `wNNb`.
7. Half-built todo branches: a kept todo continues on its branch; a dropped one is not merged.
   Keep the branch until the user agrees to delete it (deleting work is a user decision), and
   name it in the journal entry so it stays findable.
8. Abandoning a whole wave: the wave branch is not merged into `main`. Record the decision as
   above; the user decides whether its branches are kept or deleted.

A change the user asks for before step 11 is not a scope change: update the plan and ask for
approval again.

## Resuming

Revalidate changed dependencies and new briefs. Add delivery contracts to existing todos
as they are resumed; preserve their verification records and open findings. Do not rewrite
the full backlog or manufacture approval dates. Implementation works on the current wave;
the next wave starts after convergence, learning capture, spec/todo updates and re-ranking.
