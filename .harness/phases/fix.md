## When to use

Use `/fix` for a defect in behavior that is already built: a user report, a failing check on
`main`, a production incident (including an outage alert from `alert_destination` — that is an
S1 intake), or a bug found while doing other work that is too large to fix
in that change. It is not for new behavior or a change to agreed behavior — that is scope and
goes through `/analyze` or `/todos`. A review loop that stopped converging goes to `/debug`.

From `.harness/guides/task-delivery.md`, read § Branches, pull requests and merging and § Review
protocol and circuit breaker (they apply here as written; find their line ranges with
`grep -n '^## '`) and `.claude/rules/zero-tolerance.md`
Rule 4: fix the root cause, never work around it.

## 1. Intake

**S1 — stop the bleeding first.** Before anything else, when users are down or data is being
lost or exposed: check whether `/deploy --rollback` has a verified earlier revision to return
to (`.claude/commands/deploy.md` § Rollback Mode). If it does, ask the user at once, in the
format in `.claude/rules/communication.md` § Asking the user to decide — for example: "Users
can't sign in. Should I undo the last update now? If yes: sign-in works again in about N
minutes, but feature X disappears until the fix ships. If no: users stay locked out until the
fix ships, about N hours. I recommend yes. Answer yes or no." Roll back on a yes, then continue
below with users safe. If there is no rollback target, or rolling back would not help (the
defect is older than the last deploy, or a migration cannot be undone), say so and go straight
to the hotfix path. If the product is not deployed at all, an S1 follows the normal path below,
just first in line.

One bug has one fix record. A rollback started here continues this record (fill in
`Deploy hold`); a rollback started from `/deploy --rollback` opened a record already, so
continue that one instead of creating a new id.

Resolve the workspace as `/implement` does; if none exists, create `workspaces/<project>/`.
Give the bug the next fix id in that workspace — `f001`, `f002`, … (check the highest existing
one in `fixes/`; never reuse an id) — and write `workspaces/<project>/fixes/<id>-<slug>.md`,
for example `fixes/f007-login-timeout.md`. Fix records live outside `todos/`, so the todo
convergence sweep does not apply to them.

Severity:

| Severity | Meaning | Path |
| --- | --- | --- |
| S1 | Production down, data being lost or exposed, or users cannot do the product's core job | Rollback question first (§ 1), then hotfix (§ 7) |
| S2 | A major feature is broken or gives wrong results, with no workaround | Normal, next in line |
| S3 | Broken with a workaround, or not yet released | Normal |
| S4 | Cosmetic or minor | Normal, may be batched |

Use this shape for the record and keep it current through every step:

```markdown
# f007 — <one-line symptom>

Status: open | in progress | converted to todo | closed

## Intake
- Reported by / where: <person, issue #N, log, monitoring alert>
- Reported on: <YYYY-MM-DD>
- Severity: S1 | S2 | S3 | S4 — <why>
- Live in production: yes | no
- Expected / actual: <what should happen / what happens>

## Reproduction
- Failing test: <path and test name> — fails on <base commit> with: <quoted output>
  (or) Manual reproduction: <steps, observed output, and why no test can express it>

## Root cause
<the mechanism, file and symbol; why existing tests missed it>

## Fix
- Branch: <fix/f007-… or hotfix/f007-…>
- Change: <what changed and why it is the minimal root-cause fix>
- Regression test: <path> — failed before, passes after (quoted output)
- Sibling cases checked: <…>
- Local CI parity: <command> → exit 0

## Review
- Round record: workspaces/<project>/04-validate/round-f007-<n>.json — <verdicts>

## Closure
- Pull request / merge commit: <#N / SHA>
- Deployed: <deployment record path in deploy/deployments/, or "not deployed — reason">
- Verified live: <check and result, or n/a>
- Issue closed: <#N with SHA, or n/a>
- Deploy hold: <yes | cleared | n/a> — `yes` exactly while production is rolled back because of this bug (set by the rollback), `cleared` at closure
- Follow-ups: <todo proposal, backlog item or /redteam todo proposal, or none>
```

## 2. Branch

Cut `fix/<id>-<slug>` from `main`. For S1, cut `hotfix/<id>-<slug>` from the bad revision:
after a rollback, the commit production was rolled back FROM (named in the rollback record), so
the failing test can fail; without a rollback, the revision production runs now, as
`deploy_check_command` in `deploy/deployment-config.md` reports it (the local
`deploy/.last-deployed` file is only a cache).

## 3. Reproduce first

Write a test that fails for the reported reason, run it, and quote the failure in the record
before changing product code. Confirm it fails for the right reason, not for a setup error
(`.claude/rules/instrument-discipline.md` MUST-2). Use the project's real test tiers
(`.harness/guides/project-profile.md`); a bug in an integration path gets an integration test.
Only when no test can express the bug (for example a visual glitch in one browser), record a
manual reproduction with exact steps and observed output, and say why a test cannot express it.

## 4. Fix the root cause, minimally

Change what causes the defect, and check the same mechanism in sibling cases. Don't bundle
unrelated changes; a small related problem may be fixed in the same change, anything else is
recorded as a follow-up (task-delivery § Implement and verify).

Stop and convert to the normal flow when the fix grows into any of these: new behavior, a
schema or migration change, a change to more than one module's public interface, or unclear
acceptance (nobody can say what "fixed" means). Set `Status: converted to todo`, keep the
failing test, and write a todo proposal that names this fix record
(`.harness/rules/autonomous-execution.md` § Problems found along the way). It enters the plan
through `/todos` (`.harness/phases/todos.md` § Workflow step 1), or `/analyze` first if the
design is in question.

## 5. Verify

The regression test fails before the fix and passes after; quote both. Run the affected test
tiers, then the project profile's local CI parity command; it must exit 0 before the first
push. For a bug with a browser surface, walk the fixed flow headed as a real user
(`.harness/rules/e2e-god-mode.md`) and record steps, observations and disposition under
`## Fix`.

## 6. Review

One independent correctness reviewer (`reviewer`) on its own checkout pinned to the fix
commit. Add a security reviewer (`security-reviewer`) when the fix touches authentication or
permissions, secrets, input handling, data access, tenant isolation, cryptography, or a
surface where untrusted text reaches an LLM prompt (prompt injection) — a judgment call against
that list; when in doubt, add it. Reviewers report in the format in their role briefs and
never edit the fix branch.

Save each report at `workspaces/<project>/04-validate/<id>-<lens>-r<n>.md` and record the round
on the fix branch with scope `<id>`:

```json
{
  "branch": "fix/f007-login-timeout",
  "round": 1,
  "head": "<full SHA of the reviewed commit>",
  "expected_reviewers": ["correctness"],
  "reviewers": [
    {
      "id": "correctness",
      "verdict": "CLEAR",
      "evidence": "workspaces/<project>/04-validate/f007-correctness-r1.md"
    }
  ],
  "root_causes": []
}
```

`node .harness/bin/record-review-round.mjs workspaces/<project>/04-validate/round-f007-1.json`

One complete CLEAR round is the bar for a fix. After it the recorder's `NEXT:` line still
says `dispatch round N+1 … cleanRounds 1/2`; do not dispatch that round for a fix — a second
same-head clean round is required only for wave convergence (`/redteam`). On NOT_CLEAR, fix
and record the next round;
the branch's budget (three rounds, then one debug round, then a human) and its exit codes
apply exactly as in task-delivery § Review protocol and circuit breaker. No convergence
receipt is needed.

## 7. Ship

For a security defect, keep details private until the fix is deployed: use the repository's
private security advisory or a private branch where available, and keep public commit,
pull-request and issue text to a neutral one-line summary; publishing the details earlier needs
the user (`.harness/rules/autonomous-execution.md` § What needs the user).

Push, open a pull request into `main` with `Fixes #N` under `## Related issues`, read CI on the
pinned head SHA, then merge as a separate command with a merge commit (task-delivery
§ Branches, pull requests and merging). If the bug is live, ask the user whether to deploy it
now (deploying needs their confirmation — `.harness/rules/autonomous-execution.md` § What needs
the user), then ship with `/deploy`.

S1 hotfix (the rollback question was already asked in § 1), in this order:

1. After the CLEAR round, ask the user quickly and plainly to confirm the emergency deploy,
   then deploy the `hotfix/` branch head with `/deploy`. Deploying the branch, not
   `main`, keeps other undeployed `main` work out of an emergency release.
2. Verify the deploy with the user-visible check: the reported failure no longer happens on
   the live surface (`/deploy` Step 4).
3. Merge the branch into `main` through a pull request, the same way as above: CI read on
   the pinned head SHA, then a separate merge command with a merge commit.
4. Write a todo proposal (first line `Source: hotfix <fix-id>`) for a full `/redteam` of the
   affected area that names this fix record (`.harness/rules/autonomous-execution.md` § Problems found along the way),
   committed with the closure record on the `docs/<fix-id>-closure` branch (§ 8). It joins
   a wave only through `/todos` plan approval (`.harness/phases/todos.md` § Workflow step 1),
   then goes through `/redteam`'s normal convergence gate.

## 8. Close

Fill in `## Closure`: pull request, merge commit, deploy record, the live check, and set
`Deploy hold: cleared` if a rollback had set it. Close the issue as completed with a comment
that cites the merge commit or pull request (`.claude/rules/git.md` § Discipline); closing it as
won't-fix needs the user. Draft, in plain words, what was wrong and what changed for the
reporter. A comment or message that reaches someone outside the repository's own team (an
outside reporter, email, chat) is sent only after the user approves the text
(`.harness/rules/autonomous-execution.md` § What needs the user). If the bug taught something about the harness itself — a missing test pattern
in a rule, a misleading phase step — create a journal entry with `tags: [harness]`
(`/journal new DISCOVERY <slug>`); a lesson about the product gets no `harness` tag. Set
`Status: closed`, and commit the record and any journal entry on a short
`docs/<fix-id>-closure` branch cut from `main`, merged by pull request like any other branch to
`main`. Then, if you created a `harness`-tagged entry, run `/codify`
(`.harness/phases/codify.md` § When it runs).
