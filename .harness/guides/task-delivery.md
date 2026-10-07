# Task delivery contract

## Priority: build the product first — defer polish unless skipping it forces a rewrite

Default posture, standing until the user says otherwise or the product has real
users/data: build visible, working product functionality — data model, backend wiring,
UI — before security hardening, extra adversarial review rounds, migration-tooling polish,
or CI/test-harness reliability work. The cautionary case this guards against is real: weeks
spent on backend security review cycles (a dozen checkpoints re-attacking one scanner, dozens
of redteam rounds on one slice) before any application feature existed. No product means
there is nothing yet worth that level of protection.

**Defer freely, without asking:** attacking a review round that already came back clean for NEW
findings — new attack surfaces, deeper adversarial coverage, exhaustive edge cases (homoglyphs,
invisible Unicode, timing races) on a surface with no real user or data yet; migration-runner or
CI-gate hardening found mid-review but not blocking anything; test-harness reliability
improvements. Keep the automated checks that already run (tenant-isolation gates, secret
scanning, linting — whatever `.harness/guides/project-profile.md` § Mechanical checks lists) —
they're free and already built; just stop spending new session time deepening them. "Without
asking" means without stopping to ask: still record each deferral with the five fields of
`.harness/rules/product-completion-first.md` MUST-2 (its value anchor for CI-gate and
test-harness work is "keeps the checks that protect the product reliable"), or file it as a
`.harness/backlog/` item when it is about the harness itself. **This does
NOT license skipping the confirming second round the convergence gate requires** (§ Review
protocol and circuit breaker below; `.harness/lib/redteam-stall.cjs`): two clean rounds on the SAME,
unchanged commit are still necessary to converge, and a change to the reviewed code after a clean
round — however small — resets that counter to zero, not one. Bookkeeping commits (review
reports, round records, launch rows, journal and todo files) do not; keep each round's `head` =
the commit the reviewers checked out. "Defer freely" means stop
hunting for new problems once a round is clean; it does not mean the confirming round is optional
or that further code changes after a clean verdict are free.

**Do NOT defer — handle now — anything that fails this one test: would skipping it force an
architecture change or a large rewrite once more is built on top?** Concretely, handle now:

- A schema/data-model decision other entities will reference or that future waves are
  specified to build on (undoing it later means migrating live data through every dependent
  structure, not just this one).
- A choke-point or pattern every future caller is expected to route through (retrofitting N
  already-built call sites is worse than establishing the pattern once, correctly, up front).
- A tenant-isolation, identity-resolution, or trust-boundary mechanism the whole system's
  data-separation model rests on — this is the one class of "security" work that IS
  architecture, not polish, because every data store and every feature built after it inherits
  whatever shape it has.

The test in one sentence: if this decision is wrong, does fixing it after five more features
are built cost more than those five features were worth? If yes, do it now. If no, defer it —
record it as a residual (`rules/completion-criterion.md`: record, don't self-accept) and move
on to the next visible piece of product. Concrete example: in a multi-tenant product, leaving
out tenant scoping at the data layer (e.g. database row-level security or a mandatory scoped
data-access module) would be exactly this kind of forced rewrite — so that work belongs up
front, before any UI exists, and stays done rather than revisited.

## Wave boundary: a real headed end-to-end run, zero open critique, before the next wave starts

A wave is not done because its individual todos each got their own one-round review and
browser walk — those check ONE feature in isolation. Before starting the next wave, run ONE
additional headed end-to-end pass (the project profile's Tier 3 runner, e.g. Playwright) over
everything the just-finished wave landed TOGETHER, clicking through it the way a real user
would (`.harness/rules/e2e-god-mode.md` — headed, no direct-navigation/API shortcuts). For a
product with no browser surface, the pass is the same real-user walk through its actual
interface (CLI, API client, app). This is what catches a feature
that works alone but breaks when composed with what shipped beside it (a nav link pointing at
a route that got renamed, a session state two features assume differently). Zero open critique
from that pass is the gate: BUG and INVEST-NOW findings are fixed before the next wave's work
begins. A genuinely minor (INCREMENTAL) finding may be deferred as
`.harness/rules/product-completion-first.md` MUST-2 describes; it is listed under "left for
later" in the wave preview, where the user ratifies or overrides it. Record the pass at
`04-validate/<scope>-boundary-walk.md` (steps, observations, disposition per flow) and cite it,
with the preview, in the wave's DECISION journal entry (the receipt has no field for it);
`/redteam` § 2 runs it. This composes
with, and does not replace, the per-todo review/walk each shard already does.

The user then sees the wave: `/redteam` § 4 gives them a plain summary of what changed for
their users and a way to try it themselves (a local address, a preview deploy, or a command to
run), and asks whether it matches what they wanted — before the merge when they are present,
otherwise as the first open question, and always before the wave is deployed. A "no" is a
defect for `/fix` or a scope decision (`.harness/phases/todos.md` § Changing or cancelling
approved scope), never something to deploy over.

## Before a wave starts: ask for the real external setup its end-to-end signoff will need

Before beginning a wave whose real end-to-end signoff needs something this session cannot
provision itself — an LLM provider API key, a real identity-provider app registration for a
genuine sign-in walk, a third-party integration API key, or similar — ASK
the user for it up front, before starting the wave's work, not after building against a mock
and discovering at signoff time that the walk can't be genuine. Building locally for now does
not mean mocking indefinitely: a wave's headed end-to-end signoff (the gate above) is only as
real as the credentials behind it, and a walk against a mocked identity provider or a stubbed
LLM call is not the same claim as a walk against the real thing. Ask plainly, in the same terms
as any other setup request — what it's for, and that it's needed before this wave's signoff can
be genuine — and proceed with a disclosed mock/dev-mode stand-in only if the user says the real
credential isn't available yet, never silently.

Write each request so a non-technical user can complete it alone: the site to open, each
click, which value to copy, and where to put it safely (the git-ignored `.env`, or the
deployed environment's secret store from `.harness/guides/project-profile.md` § Configuration
— never in chat, a commit or an issue), plus any cost or free-tier limit.

## Harness backlog — `todos/` holds product scope only

`workspaces/<project>/todos/{active,completed}/` holds ONLY genuine product-scope work
items: something on the plan approved via `/todos`, or an explicit user request. It MUST
NOT be used to file a finding about the AI development harness itself (`.claude/`/
`.harness/` tooling, hooks, learning logs, review or codify plumbing) —
that is work about the tool building the product, not about the product, and mixing the
two silently inflates the product backlog with items the user never asked for and that
compete for review attention with the work they actually want. A harness/tooling
self-maintenance item discovered mid-review (`/debug`, `/implement`, `/redteam`) goes to
`.harness/backlog/harness-NN-<slug>.md` instead — a flat, incrementing, cross-project
numbering (check the highest existing number on the current branch, on `main` and on every
unmerged local branch before assigning a new one; do not restart per project and do not reuse
a number). See `.harness/backlog/README.md`.

A genuine PRODUCT idea that was found or preserved (e.g. an abandoned WIP branch worth
keeping discoverable) but is not on the approved plan and not scheduled goes to
`workspaces/<project>/todos/parked/`, not `active/` — `active/` means "on the plan, being
worked," not "exists and might matter someday." Promoting a parked item to `active/` is a
scope decision and needs the same plan-approval gate as any new scope. Todo proposals —
product scope found along the way, a `/fix` converted to a todo, a hotfix's follow-up
`/redteam` — wait in `parked/` the same way until `/todos` takes them in
(`.harness/phases/todos.md` § Workflow step 1).

Why: harness items filed under a product's `todos/` show up as product work the user never
asked for, and numbers assigned without checking the existing ones collide.

A bug report against already-built behavior is neither: it goes through `/fix`
(`.harness/phases/fix.md`) and is recorded under `workspaces/<project>/fixes/`.

This is the execution contract for `/analyze`, `/todos`, `/implement`, `/redteam`,
`/debug` and `/fix`. Product security and acceptance obligations remain blocking. A
retry limit changes the approach; it never makes broken code done.

## Workspace file layout

The tools read these exact paths; other names are not found.

| Artifact | Path (under `workspaces/<project>/`) | Written by |
| --- | --- | --- |
| Spec index and domain specs | `specs/_index.md`, `specs/<domain>.md` | `/analyze`; reconciled with built behavior after each wave merges (`/redteam` § 4) |
| Architecture decision record | `docs/adr/NNNN-<slug>.md` | `/analyze` (analyst) |
| Wave plan | `todos/WAVE-SEQUENCE.md` | `/todos` |
| Todo (being worked) | `todos/active/wNN-MM-<slug>.md` | `/todos` |
| Todo (implemented) | `todos/completed/wNN-MM-<slug>.md` | `/implement` (moved, same name) |
| Parked product idea | `todos/parked/<slug>.md` | anyone; promotion needs plan approval |
| Wave acceptance list, with the user's approval record | `04-validate/acceptance-<scope>.md` | `/todos`, at plan approval; never edited afterwards |
| Review report | `04-validate/<scope>-<lens>-r<n>.md` | orchestrator, from the reviewer, secrets redacted |
| Round record | `04-validate/round-<scope>-<n>.json` | orchestrator, after every expected report is in |
| Decision record | `04-validate/replan-<scope>-<n>.md` | `/debug` |
| Convergence receipt + launch ledger | `04-validate/convergence-<scope>.json`, `04-validate/convergence-<scope>.launches.jsonl` | `/redteam` |
| Wave boundary walk | `04-validate/<scope>-boundary-walk.md` | `/redteam` § 2 |
| Wave preview for the user | `04-validate/<scope>-preview.md` | `/redteam` § 4; the user's answer replaces `User answer: pending` |
| Sweep report | `04-validate/sweep-<date>.md` | `/sweep` |
| Bug-fix record | `fixes/<fix-id>-<slug>.md` | `/fix` |
| Journal entry | `journal/NNNN-TYPE-<slug>.md` | `/journal` |

Outside the workspace: a `/codify` run with no workspace yet saves its review report and round
record under `.harness/reviews/` with the same file names; deployment records live in
`deploy/deployments/` (`/deploy`).

The acceptance list starts with the user's approval record, written only after the user
approves (`.harness/phases/todos.md` § Workflow step 11):

```markdown
approved_by: <the user's name>
approved_on: <YYYY-MM-DD>
approval: "<the user's approving words, quoted>"
```

Todo ids: the convergence checker reads a todo's id from its filename with
`^([a-z]+[0-9]*-[0-9]+[a-z]?)` (case-insensitive), so `w03-07-invite-flow.md` has id
`w03-07`. Use `wNN-MM-<slug>` — wave `NN`, item `MM`, both zero-padded — and never reuse an
id inside a workspace. A completed todo whose name does not parse fails
`check-redteam-convergence-receipt.mjs --sweep workspaces` with `todo-id-unparseable`.

Scopes: a wave's scope is `wNN`, a todo's checkpoint scope is its id `wNN-MM`, a planning
review's scope is `wNN-plan`, an analysis review's scope is `analysis-<slug>` (the slug of
its `docs/<slug>` branch, so a later analysis never overwrites an earlier one's round and
report files), a codify review's scope is `codify-<slug>` (and `codify-<slug>-ask` for its ask-first part), and a fix's scope is its fix id. The acceptance list for scope
`wNN` names `wNN` and every todo id in the wave; it is committed before the wave's work and
must be byte-identical at the verdict commit, so a change of acceptance means a new scope
name, not an edit (`.harness/phases/todos.md` § Changing or cancelling approved scope).

## Branches, pull requests and merging

The round recorder keeps one round budget per branch (§ Review protocol and circuit
breaker), so each kind of review runs on its own branch and cannot spend another's rounds.

| Work | Branch | Cut from | Review rounds recorded there (scope) | Merges into |
| --- | --- | --- | --- | --- |
| Analysis (`/analyze`) | `docs/<slug>` | `main` | analysis review (`analysis-<slug>`) | `main` |
| Wave plan (`/todos`) | `docs/wNN-plan` | `main` | planning review (`wNN-plan`) | `main`, after plan approval |
| Wave integration | `feat/wNN-<slug>` | `main`, after the plan merged | wave `/redteam` (`wNN`) | `main`, after the convergence receipt check exits 0 |
| One todo (`/implement`) | `feat/wNN-MM-<slug>`, or `fix/wNN-MM-<slug>` for a defect todo | the wave branch | todo checkpoint review (`wNN-MM`) | the wave branch, after a CLEAR round and its receipts |
| Bug fix (`/fix`) | `fix/<fix-id>-<slug>` | `main` | fix review (`<fix-id>`) | `main` |
| S1 hotfix (`/fix`) | `hotfix/<fix-id>-<slug>` | the bad revision production was rolled back FROM (its commit, from the rollback record), or the revision production runs now when there was no rollback (`deploy_check_command`) | fix review (`<fix-id>`) | deploy the branch head with `/deploy` and verify it live first, then `main` (`.harness/phases/fix.md` § 7) |
| Fix closure record (`/fix` § 8) | `docs/<fix-id>-closure` | `main` | none (record only) | `main` |
| Deployment record (`/deploy`) | `docs/deploy-<date>` | `main` | none (record only) | `main` |
| Sweep report (`/sweep`) | `docs/sweep-<date>` | `main` | none (record only) | `main` |
| Wave preview answer (`/redteam` § 4) | `docs/<scope>-preview` | `main` | none (record only) | `main` |
| Spec reconciliation after a wave (`/redteam` § 4) | `docs/wNN-spec-reconcile` | `main` | none (spec text; the next wave's review reads it) | `main` |
| Harness change (`/codify`), allowlisted part | `docs/codify-<slug>` | `main` | codify review (`codify-<slug>`) | `main`, without the user only when every file is on the allowlist (`.harness/phases/codify.md` § Automatic runs) |
| Harness change (`/codify`), ask-first part | `docs/codify-<slug>-ask` | `main` | codify review (`codify-<slug>-ask`) | `main`, after the user approves |
| User's answer to a waiting harness change | `docs/codify-<slug>-answer` | `main` | none (records the user's answer) | `main`, in the session the user answered |
| Release prep | `release/v<X.Y.Z>` | `main` | none (metadata only) | `main` |

A `/fix` branch is reviewed by one CLEAR round and merges straight into `main`; it does not
pass through a wave's two-clean-round convergence check, because a fix record lives outside
`todos/` and outside any wave. That is intended: a fix is narrow and has its own failing
regression test. An S1 hotfix, reviewed under emergency pressure, additionally gets a
follow-up `/redteam` todo proposal (`.harness/phases/fix.md` § 7).

For every branch:

1. Commit one logical change at a time, with a message that says why (`.claude/rules/git.md`).
2. Before the first push of the branch, run the project profile's "Local CI parity" command;
   push only when it exits 0 (`.claude/rules/git.md` § Pre-FIRST-Push CI Parity Discipline).
3. A todo branch merges into its wave branch locally (`git merge --no-ff`) or by a pull
   request targeting the wave branch; delete it after the merge.
4. A branch that merges into `main` goes through a pull request whose body has a
   `## Related issues` section. Read CI and merge as two separate commands — never bundle them:

   ```bash
   head=$(gh pr view <N> --json headRefOid -q .headRefOid)
   gh pr checks <N>      # every REQUIRED check is SUCCESS, and the run is for $head
   gh pr merge <N> --merge   # separate command, only after the read above
   ```

   Never merge over a red or pending required check; fix it on the same branch and push. If
   the repository has no required checks, `gh pr checks` passing proves nothing: run the
   project profile's Local CI parity command on a checkout of `$head` first, and say in the
   pull request that this was the gate. If the project profile says `main_auto_deploys: yes`,
   every merge into `main` is a production deploy: it needs the user's confirmation, respects
   any open `Deploy hold: yes`, and is verified with `/deploy` Step 4 afterwards. Whether a merge needs the user is set in
   `.harness/rules/autonomous-execution.md` § What needs the user (for example, a merge whose
   gate passed does not, unless `main` deploys itself; `--admin` always does, and never in an
   automatic run).
5. Merge with a merge commit, not squash or rebase: the convergence receipt pins
   `verdict_head`, which must stay reachable from `main`. A repository set to squash-only must
   allow merge commits before the first wave (a repository-settings change, so ask the user).
6. Run the convergence check with `--scope` while the wave branch is checked out, before it
   merges; that exit 0 is the wave's gate. After the merge, `main` moves on (fixes, `/codify`,
   spec updates), so `--scope` is no longer the question; judge each receipt as of its own
   commits with `--workspace workspaces/<project> --todo <id>` or `--sweep workspaces`.
   After a pull request merges on GitHub, run `git fetch origin` and update the local `main`
   before cutting the next branch.
7. Keep `main` out of an open wave branch where possible. If you must merge `main` in, do it
   before the wave's first review round, because the receipt's `wave_base` is computed with
   `git merge-base main <verdict_head>`. If a `/fix` lands on `main` after review started and
   the wave needs it or conflicts with it, do not resolve the conflict inside the wave's merge
   into `main` (that would be unreviewed code): merge `main` into the wave branch, which moves
   the reviewed head, so the wave needs two new clean rounds on the new head from its
   remaining budget. Tell the user the delay in plain words; if the budget cannot cover it,
   take it to `/debug`.

## Releases

Only for a project that publishes versions (a library, a command-line tool, a mobile app, or
an application that tags what it deploys). The project profile names the version source,
changelog and publish command (§ Release).

No command owns a release; the user asks for one in plain words ("release a new version") and
the orchestrator follows these steps.

1. Recommend the version number in plain words from what merged since the last tag
   (`git log <last-tag>..main`): bug fixes only → patch (`1.4.0` → `1.4.1`); new features that
   change nothing existing → minor (`1.5.0`); anything that breaks how people already use it →
   major (`2.0.0`), naming what breaks. The user picks.
2. Cut `release/v<X.Y.Z>` from `main`. It carries metadata only — no code (`.claude/rules/git.md`
   § Release-Prep PRs Use The `release/v*` Branch Convention).
3. Bump the version in the profile's version source and in every file that repeats it
   (`.claude/rules/zero-tolerance.md` Rule 5).
4. Add release notes to the changelog, written for the people who use the product.
5. Push, open the pull request and merge as in § Branches, pull requests and merging.
6. Tag the merge commit on `main` (`git tag -a v<X.Y.Z> <merge-sha>`) and push the tag, then
   publish with the profile's publish command, or ship with `/deploy`. Pushing a tag and
   publishing are public and need the user's confirmation
   (`.harness/rules/autonomous-execution.md` § What needs the user).

A bad published version: never delete or overwrite a published version. With the user's
confirmation, mark it bad where the registry allows (deprecate, yank, or halt a staged store
rollout), then ship the fix as a new patch version through `/fix` and these steps.

## Before implementation

Keep the complete roadmap visible, but elaborate only the current wave to execution
depth. A todo delivers one observable outcome through its real integration boundary.
Split build/wire only when an independently useful interface exists, its consumer
contract is tested, and the paired integration owner is named. Describe behavior and
constraints; a class name in an old plan is not a requirement to preserve a bad design.

Resolve signatures, data ownership, transaction/lock ownership, error behavior, and
dependency readiness before writing code. An unresolved load-bearing question is a
design/spike task, not an implementation assumption. For security work, distinguish
untrusted input from trusted server code and compromised-runtime capabilities. A
review finding names the attacker prerequisite and a reachable path from the declared
boundary. New credible threats trigger reassessment immediately, not silent dismissal
or indefinite runtime hardening. Preserve all discovered defects in the decision record.

Put one fenced JSON object under `## Delivery contract` in the todo. Example:

```json
{
  "approved_by": "<the user's name>",
  "owned_paths": ["src/example/", "tests/integration/example/"],
  "acceptance": [
    {
      "id": "A1",
      "scenario": "A stale update is refused and the stored row is unchanged",
      "verify": "named integration test and negative control"
    }
  ],
  "interfaces": [
    "caller supplies the transaction; compare and write share its lock"
  ],
  "dependencies": ["verified dependency symbol, source path and revision"],
  "boundaries": {
    "untrusted": ["request data"],
    "trusted": ["server runtime"],
    "excluded": [
      "arbitrary code execution in the server process; handled by isolation"
    ]
  },
  "integration": "real caller to real database, including concurrent update",
  "test_environment": {
    "isolation": "isolated-cluster",
    "command": "project-specific isolated test command",
    "ordinary_failures": ["connection loss", "rollback failure", "timeout"]
  },
  "open_questions": []
}
```

`test_environment.isolation` is one of `none` (the tests touch no shared mutable
infrastructure), `isolated-cluster` or `exclusive-cluster` (§ Implement and verify).

`approved_by` is the name of the person who approved the plan this contract belongs to — the
user, the same name as the acceptance list's approval record (§ Workspace file layout). Fill it
only after the user approved the plan (`.harness/phases/todos.md` § Workflow step 11), never
before. The same person check applies there, to a receipt's `acceptance_list.ratified_by` and
`residuals[].accepted_by`, and to the recorder's `escalation_accepts.acceptor` and
`replan_accepts[].acceptor`. It normalises the value (lookalike letters folded, invisible
characters and extra spaces removed, punctuation trimmed, lowercased) and refuses model or
vendor names with or without a version ("gpt5", "sonnet4", "opus4.5", "o3", "chatgpt",
"anthropic"), run-together or letter-spaced spellings, noreply or bot emails, and values made
only of role or filler words ("the user", "Project owner", "operator", "myself"). A real name
passes, even next to a role ("Jane, owner").

Run `node .harness/bin/check-task-contract.mjs <todo.md>` before implementation.
It checks structural readiness, not truth, security sufficiency, or human approval.
The independent planning reviewer checks the actual scenarios and trust assumptions; the user
approves the plan.
For existing todos, add the contract when next resumed; do not rewrite the entire
backlog or back-date approval. Preserve previous verification and open findings.

## Implement and verify

One implementer owns each mutable worktree. Reviewers use a separate checkout pinned
to a commit. Mutation probes run in their own disposable checkout; never in the
implementer's tree. Parallelize only disjoint writes AND disjoint mutable resources.
Separate databases on one shared server do not isolate server-wide state (roles,
permissions, extensions): use a dedicated throwaway instance per lane (the contract's
`isolated-cluster`) or an exclusive cross-process lease around the ENTIRE run
(`exclusive-cluster`). If neither is available, use isolated CI. Serial tests inside one
runner do not serialize other agents. Temporary local test infrastructure MUST be
provisioned and torn down the way `.harness/guides/project-profile.md` § Test
infrastructure records — explicit ownership, immediate teardown and cleanup of orphans
from interrupted runs — never against the shared development database. No ad-hoc
container creation outside that mechanism, even from an older pinned review worktree.

Run the baseline once on that environment. Distinguish product regressions, baseline
defects, and environment faults. Repair the instrument before using its failures as
product evidence. A pre-existing problem found on the way: fix it in this change when it
is small and related to the work; otherwise record it as a follow-up with its evidence, in
the place `.harness/rules/autonomous-execution.md` § Problems found along the way names for
its kind. Never drop one silently. Write
tests for acceptance and ordinary lifecycle failures before unusual adversarial cases.
Exercise the integrated path before external review. After a fix, test the generalized
property and sibling dimensions, not just the reported example. A repeated root cause
is a design signal. Run targeted tests during edits and affected regression checks
once at the stable checkpoint. Review that checkpoint, not every edit or bookkeeping
commit. Security work still requires independent correctness and security reviewers.

## Screen red-team before the owner sees it

Applies to projects with a visual interface. No proposed screen — a design drawing or a
built screen — goes to the product owner for review until it has passed:

1. **A headed browser pass** (the project profile's E2E runner, e.g. Playwright) at widths
   1440, 1280, 1024, 800 and 400 over every drawn state:
   accessibility scan (no serious or critical issues), no clipped or overflowing text, no
   unintended overlap (floating panels against inputs, buttons or chips), no
   horizontal scroll at phone width, text contrast at least 4.5:1 (3:1 for large text, icons and
   the logo), a visible focus ring and sensible keyboard order, no broken assets or console
   errors, no placeholder copy. Screenshots are kept.
2. **A design critique** of those screenshots against the project's design language and
   product requirements.

Bugs are fixed and the pass re-run before the hand-off; the hand-off states the result in one
line and lists any polish left. This composes with, and does not replace, a screen todo's own
headed walk-through.

## Design sync — keep an external design tool in step with the code (optional)

Applies only if the project keeps its design in an external design tool (a design-system
workspace in a design or prototyping tool). If it does not, skip this section. If it does,
record the tool, how a sync is run and who starts it in `.harness/guides/project-profile.md`
or the runtime adapter, and treat the sync as part of delivery: the tool must always show the
design system as it really is in code, so the owner and any design agent work from the real
parts.

The sync is **required** whenever a change that reaches the main branch does any of these:

- adds, removes or changes a shared UI component exported from the design system;
- changes design tokens, fonts or shared styles;
- merges a screen todo (its screen half), since screen todos add components and states.

Order: after the change is **merged to the main branch** (never from an unmerged or held
branch), the orchestrator gets the sync ready (a clean main-branch checkout, dependencies
installed, the list of changed components) and, if the tool needs a human to start it, asks
the owner to start it. After it runs:

- the orchestrator records the result — project link, components uploaded or changed,
  anything refused and why — in the todo's § Verification, or in the wave's carry-forward when
  several merges share one sync;
- it batches: one sync after a group of merges is fine, but a sync is owed before any screen is
  designed or reviewed in the design tool, and before the wave's boundary walk;
- a sync that cannot run (sign-in expired, tool unavailable) is recorded as **owed**, never
  silently skipped, and the owner is told what to do (for example, sign in again).

Everything in the design tool must be rebuildable from this repository, so the project is not
locked to one tool account: a page authored there for review is saved in the repository and
listed in the project's sync manifest in the same change that publishes it.

A change to static screen-design pages alone (no component or token change) does not need a
sync if those pages are not uploaded. It needs the owner's review copy refreshed instead, so
the owner always reviews the current drawing.

A screen todo's builder makes its new shared components sync-ready as part of the todo:
exported from the design system's entry point, with a preview the sync can render.

## Review protocol and circuit breaker

A reviewer works in a fresh context and its own checkout, reports, and never fixes: the
implementer applies fixes. Each report ends with a verdict and lists findings in this shape
(`.harness/roles/reviewer.md` § Review Output Format, `.harness/roles/security-reviewer.md`
§ Review Output Format):

- `Verdict:` `CLEAR` (no BUG or INVEST-NOW finding) or `NOT_CLEAR`. INCREMENTAL findings may
  accompany a CLEAR. The orchestrator, not the reviewer, records `ERROR` for a dispatch that
  errored, timed out, was throttled or returned nothing usable.
- Per finding: `Category:` `BUG` | `INVEST-NOW` | `INCREMENTAL`
  (`.harness/rules/product-completion-first.md`); `Severity:` `CRITICAL` | `HIGH` | `MEDIUM` |
  `LOW` (ranks only, never gates); `Root-cause key:` a short lowercase-kebab name for the
  mechanism (`transaction-ownership`, not `bug-in-line-42`), reusing a key from the
  recorder's "Known root causes on this branch" list when it is the same mechanism;
  `Acceptance:` the acceptance ID, or `NEW` for a requirement the contract does not have;
  `Trigger:` attacker or failure prerequisites; `Evidence:` reproduction, command and output;
  `Location:` file and symbol.

Review ordinary infrastructure failure, concurrency, rollback, and resource release,
as well as adversarial input. A reviewer may expand the investigation but cannot silently
expand the task's accepted implementation obligations. Adjudicate boundary disputes now.

The orchestrator saves each report verbatim at
`workspaces/<project>/04-validate/<scope>-<lens>-r<n>.md` — except secrets: before committing a
report, replace any secret value it quotes (key, token, password, private key) with its file and
line, kind, length and first four characters, and run the project's secret scan if
`.harness/guides/project-profile.md` § Mechanical checks lists one. Then it aggregates EVERY expected
reviewer's result for ONE pinned commit in `workspaces/<project>/04-validate/round-<scope>-<n>.json`.
`root_causes` is the set of root-cause keys of the round's BUG and INVEST-NOW findings; it is
empty on a clean round and required on a NOT_CLEAR one. Example (use the real branch, a real
full commit SHA on it, and real report paths):

```json
{
  "branch": "feat/w01-02-invite-flow",
  "round": 1,
  "head": "0123456789012345678901234567890123456789",
  "expected_reviewers": ["correctness", "security"],
  "reviewers": [
    {
      "id": "correctness",
      "verdict": "NOT_CLEAR",
      "evidence": "workspaces/<project>/04-validate/w01-02-correctness-r1.md"
    },
    {
      "id": "security",
      "verdict": "CLEAR",
      "evidence": "workspaces/<project>/04-validate/w01-02-security-r1.md"
    }
  ],
  "root_causes": ["transaction-ownership"]
}
```

From the repository root run `node .harness/bin/record-review-round.mjs <round.json>`, then
commit the round file and its reports on the branch. The recorder keeps its budget in local
state; when that state is missing (a fresh clone, another machine) it rebuilds the branch's
history from every `round-*.json` ever added on the branch's own commits, as first committed
(later edits and deletions change nothing; an unreadable, duplicate or gapped history makes it
refuse, and a missing or edited history is never a fresh budget). A branch cut from a branch
with recorded rounds inherits them and continues their numbering, so a new branch name is not a
new budget. It refuses a round above 1 with no history at all, so an uncommitted round record
is a lost round. A branch that exists only on the remote must be created locally first
(`git switch <branch>`). Write
every cited path (`evidence`, `replan`, `escalation_accepts.record`) relative to the
repository root, as above. The recorder looks for it from the round file's own directory and
from the current directory only, so `04-validate/<file>.md` (relative to the workspace) is
not found. Every cited file must be non-empty and inside the checkout. The recorder also refuses, without recording:
a `branch` the repository does not have, a `head` not on that branch, a round number that is
not the previous one plus one, a partial round, a NOT_CLEAR round without `root_causes`, a
clean round with `root_causes`, and a changed `expected_reviewers` list without a new `replan`.
It is a retry-control instrument; the convergence-receipt checker still decides convergence.
Its last lines start with `NEXT:` and list the branch's known root causes and budget — read them.
How many clean rounds a scope needs: one complete CLEAR round for a todo checkpoint (scope
`wNN-MM`), a `/fix` branch (`<fix-id>`), a planning review (`wNN-plan`), an analysis review
(`analysis-<slug>`) and a codify review (`codify-<slug>`); two consecutive clean rounds on one
unchanged commit only for wave convergence (`/redteam`, scope `wNN`). After a single CLEAR round the recorder always
prints `dispatch round N+1`; at a one-round checkpoint do not dispatch it.

Exit codes: `0` — keep going (`FIX`, `REVIEW`, `REPAIR_ENVIRONMENT`, or
`VERIFY_CONVERGENCE_RECEIPT` after two clean rounds on one unchanged commit); `1` — the round
was refused or invalid and nothing was recorded; `2` — `REPLAN` or `DEBUG_ROUND`; `3` —
`ESCALATE_TO_HUMAN`. A refused round records nothing: exit 1, or 2/3 when the refusal is the
cap, debug or `REPLAN` gate itself (stderr explains it). A round was recorded only when the
recorder printed its JSON line on stdout. Committing a round's record, reports or launch rows
does not reset the clean-round count while `head` stays the same; only a new reviewed head does.

`ESCALATE_TO_HUMAN` and a residual that needs acceptance are questions for the user: ask them
in the format in `.claude/rules/communication.md` § Asking the user to decide — what accepting
means for their users, what the alternatives (split the work, drop it, one more round) cost,
and your recommendation — never as a recorder message or a file path.

The budget is per branch (`.harness/lib/redteam-stall.cjs`):

- **Three rounds per branch.** A branch gets three counted rounds in total
  (`TOTAL_ROUND_CAP = 3`) — clean, non-clear or charged-error alike — and nothing resets that
  count, a decision record included. A third round that is not clean returns exit 2 /
  `DEBUG_ROUND` (a clean third round that is the first in its streak returns `REVIEW`). Repair the findings; the branch's only remaining ordinary round is then its
  single debug round: `"debug": true`, a new decision record in `replan`, and
  `expected_reviewers` ids named `<lens>-debug` (`correctness-debug`, `security-debug`), never used on this branch. If
  the debug round does not converge, the recorder returns exit 3 / `ESCALATE_TO_HUMAN`: stop.
  Each further round needs `"escalation_accepts": {"acceptor", "record"}` — a named human and
  a new acceptance record of theirs for every round. Past the cap the recorder also admits,
  once, the same-head confirmation that follows a first clean round.
- **Recurrence.** A non-clear round returns exit 2 / `REPLAN` when one of its root-cause keys
  was recorded in ANY earlier non-clear round on this branch — clean rounds in between do not
  reset it — or was marked closed by an earlier `replan_closes`. Keys a decision record
  accepted through `replan_accepts` do not fire, and a round that cites a new `replan` does
  not fire.
- **Non-clear streak.** Four non-clear rounds since the last decision record also return
  `REPLAN` (`FIRING_THRESHOLD = 4`); a clean round resets the streak. The three-round cap
  usually fires first; the streak matters across errored re-runs and human-accepted rounds.
- **Errored rounds.** A round with an `ERROR` verdict returns `REPAIR_ENVIRONMENT`. Fix the
  instrument and re-run the same round — same `expected_reviewers`, same `debug` flag, same
  `head`. The first two consecutive errored rounds spend no budget; the third is charged.

`REPLAN` (and `DEBUG_ROUND`) mean: before another repair/review cycle, `/debug` writes a
decision record at `workspaces/<project>/04-validate/replan-<scope>-<n>.md` — cause of
non-convergence, current open defects, alternative designs, chosen change of approach,
updated scope/acceptance (a change to approved scope follows `.harness/phases/todos.md` § Changing or
cancelling approved scope), test/environment correction, and next falsifying experiment.
Choose redesign, split, repair environment, or justified continuation with a changed
verification approach. The next round cites that file in `replan`. A decision record is
consumed by the first round that cites it, except that an errored round's re-run may cite it
again; a later reassessment needs a new file. A fresh
reviewer with the same fix instructions is not a reassessment. Do not wait for convergence
to surface a required architectural choice. Proceed autonomously within the approved
envelope; ask only when the choice changes product behavior, authority, or accepted risk.
See `.harness/rules/redteam-stall-debug.md`.

The convergence receipt is tied to these files: each reviewer's `evidence` is the
repository-root path of that round's saved report, committed no later than the receipt; every
round the receipt lists has its committed `round-<scope>-<n>.json` with the same head, lenses,
evidence and verdicts; and the receipt ends at the scope's highest recorded round. The checker also reads every committed round
record of the scope: it refuses `cap_hit: false` when they show the cap was passed without the
debug round or an escalation (`cap-hit-understated`), a copied, duplicate, edited or gapped
record (`round-records-invalid`), a record whose `branch` differs from the receipt's
(`round-record-mismatch`), and any round record committed after the receipt
(`round-record-after-receipt`). Commit every
report and round record before committing the receipt.

Two complete clean rounds on the same unchanged commit remain necessary for convergence. A
cap, missing evidence, replan, or unresolved bug is never success. Keep the launch ledger,
browser/boundary receipts, accepted-residual requirements, and the final machine-checkable
convergence receipt. Record concise progress: current commit, acceptance status, new vs
repeated defect causes, test/environment result, next action, and decisions needed.
