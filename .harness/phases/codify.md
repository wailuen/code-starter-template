## What this phase does

Capture durable, reusable knowledge from the current session into the harness itself — not
into the product. If a rule was wrong, a skill was missing a pattern, or an agent needs a
correction, this is where that gets written down so the next session doesn't rediscover it.
The harness assumes a single operator — no multi-operator lease, coordination log, or
cross-repo proposal routing is included (see `.harness/README.md` § Not included).

## When it runs

`/codify` runs automatically at these points; the user can also run it at any time.

| Trigger | Who starts it |
| --- | --- |
| A wave's convergence receipt check exited 0 and the wave branch merged into `main` — this also brings in lessons and harness backlog items recorded on that wave's branches, including those `/debug` filed | `/redteam`, right after the merge, before spec/todo reconciliation |
| A session ends and `/learn` reports open lessons | `/wrapup`, before writing `.session-notes` |
| A `/fix` closure pull request merged into `main` and the closure created a journal DISCOVERY entry | `/fix` § 8 |

**The right moment.** Start an automatic run only when all three hold — otherwise don't run
it; `/wrapup` lists the pending lessons under Outstanding work so the next session starts with
`/codify`:

1. In the checkout where product work happens, `git status --porcelain` shows no change
   outside `workspaces/<project>/journal/`, `.harness/backlog/`, `.harness/codify-log.md`
   and `.session-notes` (no uncommitted product work).
2. No review round is in progress in that checkout: every
   `04-validate/<scope>-<lens>-r<n>.md` report has its `04-validate/round-<scope>-<n>.json`
   record.
3. No reviewer you dispatched in this session is still running.

**What counts.** A run looks only at lessons visible on `main` that are **open** as
`.harness/phases/learn.md` step 1 defines them. Waiting lessons (latest log row `awaiting
user`) never start a run; `/ws` shows them until the user answers. Lessons recorded only on
an unmerged todo or wave branch are picked up by the wave-merge trigger, not before. When nothing counts, an automatic run stops after one line ("No lessons to
codify") with no branch and no commit.

When the user corrects you in a way they would otherwise have to repeat next session, record
it straight away as a journal entry (`/journal new DISCOVERY <slug>`), so the next automatic
run picks it up.

### Automatic runs

An automatic run follows the workflow below, with these additions. They take precedence
over the workflow where they differ.

- **Where.** Cut `docs/codify-<slug>` from `main`. If the current checkout holds other work
  (an open todo or wave branch), do the codify work in a sibling worktree created with
  `/worktree` (`.claude/rules/worktree-isolation.md` Rule 7), so product work is neither
  disturbed nor mixed into the harness change. A branch still under review keeps working
  under the harness text it already has; the change reaches it only through `main` later.
- **Ask first.** Prepare these changes but do not apply them without the user's
  confirmation:
  - removing or loosening a rule, a prohibition or a confirmation step;
  - anything touching security, git safety, secrets or evidence rules;
  - changing what the user must approve, or anything that gives agents more autonomy, adds
    an automatic trigger, or removes or weakens a review;
  - changing an agent's model or effort, or deleting a file;
  - any edit to `.harness/rules/autonomous-execution.md`, `.claude/rules/recommendation-quality.md`
    or `.claude/rules/value-prioritization.md` (they define what counts as a user decision),
    `.claude/rules/journal.md` or `.claude/commands/journal.md` (their
    `author:` labels decide what counts as a user decision), `.harness/phases/learn.md`
    (it decides what is open), any rewrite or deletion of an existing row in
    `.harness/codify-log.md`, `.claude/CLAUDE.md`, `AGENTS.md`, `.claude/settings*.json`, hooks, CI
    workflow files, `.harness/manifest.json`, `.harness/bin/`, `.harness/lib/`, or this
    file's § When it runs, § Automatic runs and this list.

  Everything else — clarifications, corrected references, new examples, a missing step
  that adds no autonomy — goes ahead without asking.
- **Waiting for the user.** If an ask-first change cannot be confirmed now (the user is not
  there), do not leave it uncommitted. Merge the rest, and file the waiting change as a
  `.harness/backlog/harness-NN-<slug>.md` item holding the proposed edit, the recommendation
  and the paths of the lessons it covers; log those lessons as `awaiting user` with the
  item's path. `/ws` and `/learn` show them. Only the user's answer may add a row that
  replaces an `awaiting user` row: when the user answers, apply or drop the change and add a
  `folded in` or `declined` row (with "user confirmed/declined <date>") for every lesson it
  covered **and** for the holding backlog item's own path, so the question is never asked
  again.
- **Numbering.** Before assigning a journal entry number or a backlog item number, check
  the highest number in use on `main` and on every unmerged local branch
  (`git for-each-ref refs/heads` and `git ls-tree -r <branch> -- <dir>`), and take the next
  one, so a number used on a wave branch is never reused.
- **Disposition record.** Every automatic run that looked at open lessons — even one that
  changes nothing — appends one row per lesson it considered to `.harness/codify-log.md`:
  the lesson's full path and one outcome — `folded in` (with the file changed), `declined`
  (with the reason), `deferred` (with the revisit condition, for work that waits on something
  outside the harness) or `awaiting user` (with the backlog item's path). This log, not a
  journal entry, is what closes a lesson, so it works with or without a workspace. If a
  workspace exists, also write a short journal summary — always type `DECISION`, never
  DISCOVERY, GAP or TRADE-OFF (those are lessons and would start the next run), with
  `author: agent`, a record and not a user decision (`.harness/rules/autonomous-execution.md`).
- **Order.** Edit the files, append the log rows, run `node
  .harness/bin/check-adapters.mjs`, `node --test ".harness/tests/*.mjs"` and the project
  profile's Local CI parity command (all must exit 0; `.claude/rules/git.md` § Pre-FIRST-Push
  CI Parity Discipline), then commit the files and the log rows together. Review that pinned
  commit: always one independent `reviewer` (scope `codify-<slug>`, one CLEAR round; with no
  `workspaces/<project>/` yet, save the review report and round record under
  `.harness/reviews/` with the same file names task-delivery gives for `04-validate/`,
  `.harness/guides/task-delivery.md` § Review protocol and circuit breaker), plus
  `security-reviewer` under the conditions in step 3. The reviewer also checks that each
  change was put in the right class above. The small-fix self-review exemption in step 3
  does not apply.
- **Merge.** When the round is CLEAR, open the pull request and merge it as in
  task-delivery § Branches, pull requests and merging.
- **Report** in one or two plain sentences: which lessons were folded in, which were
  declined, which files changed, the pull request, and anything waiting for the user.

## Workflow

### 1. Identify what's worth codifying

Start from `/learn`'s open list (`.harness/phases/learn.md`): the journal entries not yet
folded into the harness. Then look back over this session (or the sessions since the last
`/codify`) for:

- A correction the user gave, especially if they'd have to give it again next session.
- A bug or dead reference in a rule/skill/agent file that this session actually hit.
- A working pattern this session used that would save a future session the same discovery.

Not everything is worth codifying — a one-off mistake isn't a rule. If nothing from this
session clears that bar, say so and stop. Producing no change is a normal, correct outcome.

### 2. Update the real files

Edit the actual file in its real location. Shared policy lives in `.harness/`, so look
there first:

- `.harness/phases/<phase>.md` — a phase procedure (both runtimes read it).
- `.harness/rules/<rule>.md` — a shared rule. `.claude/rules/<same name>.md` is a short
  pointer to it (a few lines, plus `paths:` frontmatter on some): edit the `.harness/rules/`
  file, never the pointer.
- `.harness/roles/<role>.md` — a role brief that agents load.
- `.harness/guides/` — the delivery contract and the project profile.
- `.harness/manifest.json` — phase and role names and descriptions; after changing it run
  `node .harness/bin/check-adapters.mjs --write` and never hand-edit the generated adapters.
- `.claude/rules/` (Claude-loaded rules with no `.harness/` twin), `.claude/skills/*/`,
  `.claude/agents/*/`, and the Claude-only commands in `.claude/commands/`.

Follow the shape of the existing sibling files in that directory (a rule
file's MUST/Why/DO-DO NOT structure, an agent's thin pointer-to-role-file body, a skill's
SKILL.md + supporting files). If nothing existing covers the topic, create a new file in the
same shape rather than bolting the knowledge onto an unrelated file.

Do not invent a new enforcement mechanism (a hook, a trust-level system, a probe suite) to back
the new rule unless the user asked for one — none is configured by default, and an
unenforced rule that says otherwise is worse than an honest one.

### 3. Review the change

Dispatch the agent that matches what changed (see the mapping in `.harness/adapters/claude.md`):

- A rule wording/content change → `gold-standards-validator` for a small fix, `reviewer` for
  anything substantive.
- An agent file change → `reviewer`.
- Anything touching how an agent handles untrusted input, secrets, or file-system access →
  also `security-reviewer`.

For a small, obviously-correct fix (a typo, a dead link), reviewing it yourself is enough —
don't dispatch a subagent for something you can verify by reading the diff.

### 4. Journal the decision

Create a journal entry — `/journal new DECISION <slug>` — recording which file changed and
why, and append the outcome rows to `.harness/codify-log.md` as in § Automatic runs. Use
`DECISION` even when nothing changed: a DISCOVERY, GAP or TRADE-OFF entry would itself become
a new open lesson. See `.claude/rules/journal.md`
for the entry format. Skip only when nothing from this session was journal-worthy.

### 5. Commit

Commit the changed harness file(s) together with the journal entry in one commit, on a
`docs/codify-<slug>` branch merged by pull request (review rounds, if any, use scope
`codify-<slug>`; `.harness/guides/task-delivery.md` § Branches, pull requests and merging), with a message that says why (per
`.claude/rules/git.md`). If you changed `.harness/`, run `node .harness/bin/check-adapters.mjs`
and `node --test ".harness/tests/*.mjs"` first; both must exit 0.
