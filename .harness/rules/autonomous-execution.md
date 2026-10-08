---
priority: 0
scope: baseline
---

# Autonomous execution

The user defines the outcome and operating envelope. The agent implements and verifies
within it. Explicit user authorization persists across turns: never re-request an
approval the user already gave, and don't stop merely to propose work already
authorized. Stop to ask only when you are genuinely uncertain and the point is not
already covered by a user decision (a brief, a ratified plan, a journal `DECISION-`
entry whose `author:` is `human` or `co-authored`, or something the user said this
session). An entry an agent wrote on its own (`author: agent`) — including every record an
automatic `/codify` run writes — is not a user decision. Genuinely uncertain means you
can name the evidence for your doubt, and the choice matters: the reasonable picks would
lead to materially different work or results. Destructive, hard-to-reverse and
outward-facing actions are listed in § What needs the user; that list decides which of them
need confirmation.

## Delivery policy

For `/analyze`, `/todos`, `/implement`, `/redteam`, `/debug` and `/fix`, follow
`.harness/guides/task-delivery.md`. It supersedes per-edit reviews, mandatory
build/wire splits and unlimited same-approach retries. Security and data-integrity
requirements remain obligations; a retry limit is reassessment, never permission to ship
defects.

Choose the simplest design that satisfies the accepted requirements. Estimate work
from observed implementation and verification effort, not an assumed 10x multiplier.
Agent capacity has context, coordination, dependency and infrastructure limits.
Parallelize independent work with disjoint mutable resources; more agents are not a
remedy for an unresolved architectural decision or a contaminated shared test database.

## What needs the user

This is the complete list of actions and decisions that need the user. Other files point
here and do not add their own. "The envelope" in this harness means the work the user
approved (a brief, a ratified plan, a fix they reported, or a request this session) plus the
actions below that need no confirmation. If an action is destructive, hard to reverse,
outward-facing or costs money and this list does not name it, ask, and record the gap as a
harness lesson.

**No confirmation needed** (inside approved work):

- local commits;
- pushing a `feat/`, `fix/`, `docs/` or `release/v*` branch, unless it changes
  CI workflow files (below);
- opening a pull request in this repository (for a security fix, see the disclosure item
  below);
- merging a todo branch into its wave branch;
- merging into `main` after the pull request's gate passed, unless the product may already
  be live (below):
  - a wave: in standard mode,
    `check-redteam-convergence-receipt.mjs --workspace workspaces/<project> --scope <wave>`
    exited 0; in light mode, its one review round was recorded CLEAR
    (`.harness/guides/task-delivery.md` § Light mode);
  - a fix: its one CLEAR review round was recorded;
  - an analysis (`docs/<slug>`) or a plan (`docs/wNN-plan`): after its CLEAR review round, or
    in light mode after the user approved; a plan always only after the user approved it;
  - a prototype (`docs/prototype-<n>`): only after the user approved it, in the session they
    gave the words, with `check-prototype.mjs --require-approval` exiting 0 — every phase
    approved for the pages it has now, or held by the user;
  - a record-only pull request: it changes only records — review reports, round records,
    journal entries, fix records, deploy records under `deploy/deployments/`, a sweep report or
    a wave preview; never plans, specs, todos or code. A record of the user's own decision (an
    approval record, a wave preview's answer, a journal entry marked `author: human` or
    `co-authored`) merges only in the session where the user gave the words, with the words
    quoted. A deploy hold set by a confirmed rollback, or cleared by the deploy record of the
    confirmed deploy that shipped the fix, needs no further words — the user already
    confirmed that rollback or deploy;
  - an automatic `/codify` pull request, or a `/codify` change the user approved, exactly as
    `.harness/phases/codify.md` § Automatic runs allows (an automatic merge needs
    `check-codify-allowlist.mjs` to exit 0);
- deleting a work branch after its pull request merged;
- running `/deploy --check`, which only reads;
- reversible edits inside the approved scope, routine implementation, diagnosis, test runs,
  independent review and root-cause fixes inside the approved scope.

**Needs the user's confirmation every time**, unless the user authorized that specific
action in this session. Record the user's words where the decision is recorded. Person-only
fields hold the user's name and are never filled before they answer
(`.harness/rules/completion-criterion.md` MUST-1).

Decisions about the work:

- approving the plan (`.harness/phases/todos.md`), including the stack and hosting choice
  `/analyze` proposes and, for the first wave, the push of its CI workflow — the plan names
  that push and the approval record quotes the user's yes to it;
- approving the prototype (`.harness/phases/prototype.md`) or some of its phases, holding a
  phase, a change to an approved one, and showing the user a prototype whose screen check is
  still owed;
- changing approved scope — adding, dropping or swapping approved work, mid-wave or not
  (`.harness/phases/todos.md` § Changing or cancelling approved scope). `/autonomize` does
  not override this;
- accepting a known risk: a security exception (`.claude/rules/security.md` § Exceptions), a
  residual in a convergence receipt, deferring a scanner finding
  (`.claude/rules/zero-tolerance.md` Rule 1b), a recurring root cause knowingly left open
  (`replan_accepts`), or another review round after the debug round (`escalation_accepts`);
- closing value-bearing deferred work as not planned (`.claude/rules/value-prioritization.md`
  MUST-4), or closing an issue as won't-do (`not_planned`);
- a user-visible deviation from a spec (`.claude/rules/specs-authority.md` Rule 6);
- breaking a public surface without a deprecation period (`.claude/rules/zero-tolerance.md`
  Rule 6a);
- removing a dependency the product still uses, or downgrading one.

Production and releases. Code reaches users only from the `production` branch (or a
release tag), never by merging into `main`. Only the user starts `/deploy` in a mode that
changes production; an agent never deploys on its own.

- deploying: moving `production` to a commit already on `main` through the project's deploy
  command. The user confirms by running `/deploy`; when an S1 fix is ready, ask them quickly,
  in plain words, to run it. The first deploy creates the `production` branch;
- every merge into `main` while the project profile says `main_deploys_live: unknown` (the
  default until `/deploy` onboarding has checked that `main` does not deploy) and the product
  may already be live. **May already be live** means any of: the profile's § Production says the product
  already runs on a host (a planned host recorded by `/analyze` does not count); the repository has host configuration (`vercel.json`, `netlify.toml`, `fly.toml`,
  `render.yaml`, `app.yaml`, a `Procfile`, or a `Dockerfile` together with a deploy
  workflow) or a CI deploy job; or the user said it is hosted. Other files point to this
  definition;
- rolling back production: the host's `rollback_command` and pointing `production` back at
  the last good commit. `main` is never reverted for a rollback;
- decommissioning the product (`/deploy --decommission`);
- pushing a tag or publishing a release. When the host deploys from release tags, pushing a
  release tag is a deploy, so it goes through `/deploy`, which the user starts.

Anything outside this repository:

- messages to people outside the repository: issue or pull request comments addressed to
  others, telling a reporter, emails, chat posts, uploads to third-party services;
- publishing details of a security fix, of any severity, before the fix is deployed: in a
  public repository keep the work on a private fork or a private security advisory, or keep
  public commit, pull request and issue text to a minimal description, until the user has
  confirmed the deploy;
- pushing a change to CI workflow files (for example `.github/workflows/**`), which runs with
  the repository's secrets as soon as it is pushed — except the first wave's workflow the user
  approved with the plan (above).

Destructive or exposing actions:

- deleting branches, files or data this session did not create (except merged work branches,
  above);
- killing processes you did not start, or overwriting uncommitted changes you did not make;
- dropping tables or running migrations against a shared or production database;
- force-pushing, or rewriting history — published history, or local history that holds
  review records (rewriting it to win back review rounds is exactly this);
- raising content's exposure — a secret or personal data into a commit, journal or doc,
  private config into a shared file, one tenant's data into a global one
  (`.claude/rules/security.md` § MUST NOT; `.claude/rules/recommendation-quality.md` MUST-8).

Repository, money and merges:

- changing repository settings (branch protection, secrets, collaborators, webhooks);
- anything that costs money;
- merging a held `/codify` change (`docs/codify-<slug>-ask`), as
  `.harness/phases/codify.md` § Automatic runs describes;
- merging with `gh pr merge --admin`, which bypasses branch protection. Never use it in an
  automatic run; use it only when the user asks for it on that pull request.

**When checks prove nothing.** If the repository has no required CI checks, `gh pr checks`
passing proves nothing. Before merging, run the Local CI parity command from
`.harness/guides/project-profile.md` § Commands on the pinned head commit, and say in the
pull request that you did.

`/autonomize` removes check-ins on technical choices. It widens nothing on this list except
the actions the user explicitly names when they invoke it, and it never changes approved
scope.

Ask in the shape `.claude/rules/communication.md` § Asking the user to decide sets out.
Bundle questions that can wait into one message, and keep doing every part of the work that
does not depend on the answers.

## Open decisions while working

When an architectural choice materially changes behavior, authority, resources or accepted
risk, prepare the concrete alternatives and surface it promptly. Do not queue a necessary
decision until a stalled review loop happens to converge.

If a question comes up partway, first do everything that doesn't depend on the answer.
If one part turns out to be blocked, complete every other part in full and say exactly
what you left out and why — the whole task is the deliverable, and scaling it down is
the user's call. A step you have decided on is something to run, not to announce:
describing the next step and ending the turn leaves it undone until the user replies.

## Root-cause fixes

Fix the mechanism when evidence establishes a better in-envelope design. A finding
report is an example to explain, not the entire repair specification. Verify the
generalized property across sibling dimensions and preserve regression coverage.
If a root cause comes back in a later review round on the same branch, reassess the
design before adding another exception (§ Bounded repair cycles). Do not introduce a
second parallel implementation or an increasingly large enumeration of cases when a
simpler structural boundary solves the class.

When it will not affect the end result, edit the part of a file that needs changing
rather than rewriting the whole file.

## Problems found along the way

When you find a problem the current task did not ask about — a failing test, a warning,
a defect, a missing piece — fix it in the current change if it is small and related to
that change. Otherwise record it as a follow-up with its evidence, in the one place
that fits:

- **Product scope addition** (a missing feature, new behavior) → a todo proposal: a file
  `workspaces/<project>/todos/parked/<slug>.md` in the active workspace naming what is
  missing, the evidence and where it was found, with a first line
  `Source: <found-along-the-way | fix <fix-id> | hotfix <fix-id>>`. It joins the plan only through `/todos`
  (`.harness/phases/todos.md` § Workflow step 1) and its plan approval, never by writing
  straight into `todos/active/`.
- **Bug in already-built behavior** → a `/fix` record (`.harness/phases/fix.md`).
- **Harness defect** (a phase, rule, role, guide or tool of this harness) → an item in
  `.harness/backlog/` (`harness-NN-<slug>.md`), or a journal entry tagged `harness`
  (see the `harness` tag in `.claude/rules/journal.md`). Either one is a lesson for `/codify`.
- **INCREMENTAL review finding** that carries the five deferral fields of
  `.harness/rules/product-completion-first.md` MUST-2 → the deferred-quality list (GitHub
  issues labelled `deferred-quality`, revisited by `/sweep` Sweep 8).

Say in your summary which you did. Never drop it silently, and never let it silently
enlarge the current task. Other files point here rather than restating the list.

Before acting on a failing test, establish whether it reflects code, a changed
environment, or another process's mutation.

## Per-session capacity budget

One implementation slice should fit all of:

- ≤500 lines of load-bearing logic (not generated/CRUD boilerplate).
- ≤5–10 simultaneous invariants.
- ≤3–4 cross-file reasoning hops.
- ≤15k lines of relevant source in working context.
- One integrated outcome whose intent can be described concisely.

Size at `/todos` time and recheck as work grows. These are triggers to reconsider
decomposition and architecture, not evidence that an estimate is correct. Crossing the
budget, materially expanding owned paths, or needing a stronger threat model requires
reassessment before further repair. Split at an actual invariant/interface boundary
and preserve end-to-end acceptance. Boilerplate volume alone does not require splitting.

## Bounded repair cycles

Record every complete review round with `.harness/bin/record-review-round.mjs`. The
recorder enforces two limits; the exact behavior is in
`.harness/rules/redteam-stall-debug.md`:

- **Round cap.** A branch gets three counted rounds in total (counted from the committed
  round records of its scope or branch, `.harness/rules/redteam-stall-debug.md` MUST-2). If
  a round at or past the cap is not clean, the branch's next round must be its single debug
  round (`/debug`, a new decision record, reviewers never used on the branch). If that does
  not converge, the user must accept each further round.
- **REPLAN.** A root cause recorded in any earlier non-clear round on the branch comes
  back, or four non-clean rounds pass in a row since the last decision record. Run
  `/debug` and record a changed approach before another repair cycle.

The cap usually fires first. Security work follows the same limits while all unresolved
security obligations remain blocking. An approved new approach restarts the REPLAN
interval; it does not reset the round cap, erase failure history, or waive the wave's final
gate (the convergence check in standard mode, the CLEAR wave round in light mode).

## Handoff and recovery

Leave a coherent checkpoint and concise record of acceptance status, current commit,
test environment/evidence, open defects, architectural decisions and next action.
Preserve a recoverable good state. Independent reviewers work on pinned checkouts;
mutation probes never edit a live implementer's tree. Report uncertainty and blockers
accurately.
