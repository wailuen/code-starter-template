## Resolve scope and acceptance

Resolve the named workspace/wave; otherwise choose the latest real workspace excluding
`instructions` and leading-underscore directories. Read briefs, relevant specs, the
current wave's delivery contracts and `03-user-flows/`. Results belong in `workspaces/<project>/04-validate/`, named as in
`.harness/guides/task-delivery.md` § Workspace file layout. A wave review runs with the wave
branch `feat/wNN-<slug>` checked out, scope `wNN`; its rounds are recorded on that branch.

Read `.harness/rules/completion-criterion.md` and, from `.harness/guides/task-delivery.md`,
§ Wave boundary, § Workspace file layout, § Branches, pull requests and merging and § Review
protocol and circuit breaker. Find each section's line range with `grep -n '^## ' .harness/guides/task-delivery.md` and read
only those ranges.
A user-approved acceptance list must predate review: for a wave it is
`workspaces/<project>/04-validate/acceptance-wNN.md`, committed by `/todos` before the work. New uncovered product
requirements are surfaced as design/scope decisions immediately; do not silently add
unbounded obligations to the current task or dismiss a credible security issue.

## 1. Prepare a stable review

In light mode the wave gets one review round and records no launch ledger
(`.harness/guides/task-delivery.md` § Light mode); the rest of §§ 1–3 applies.

Record scope, round number, target commit, acceptance IDs, expected reviewers and
infrastructure ownership. Review depth scales with the change's risk; it never makes
missing evidence clean. Security/trust-bearing changes require
independent correctness and security reviewers; add testing, UX/value or domain seats
for their actual surface. Do not spawn irrelevant specialists by default. Plan the security
seat for nearly every wave: the convergence checker treats every changed path as security
surface except workspace bookkeeping, root licence/readme files and plain documentation
outside the harness and deploy folders (the exact list, matched without regard to letter case,
is in the header of `.harness/bin/check-redteam-convergence-receipt.mjs`, `isSecuritySurface`),
and refuses a receipt whose `security_critical` is lower than that. The checker
recognises the security seat only from the agent type in the launch ledger, which the
orchestrator writes by hand, so it is honour-based: record the type actually dispatched, never a
relabelled generic agent (`.harness/adapters/codex.md` § Known limitations).

Each reviewer gets a separate checkout pinned to the same commit, the relevant spec
and contract, and a report path. Never probe by editing the implementer's tree.
Mutation tests use a disposable copy and private test resources. Reduce concurrency
when throttled or when infrastructure cannot be isolated.

Record each fresh dispatch's launch rows in the committed
`04-validate/convergence-<scope>.launches.jsonl` before verdicts exist. If the runtime
provides a native hook that records launches to `.claude/learning/dispatch-reconcile/` and
the project has configured it, copy the rows from there; otherwise nothing writes that live
ledger (the convergence checker then treats the live cross-check as advisory), so record each
reviewer dispatch manually in the committed ledger — one JSON line per dispatch with
`kind: "launch"`, a unique `launch_id`, the `subagent_type` dispatched and an ISO `ts` taken
at dispatch time. Keep the existing
launch/ran-evidence requirements: errored, empty, timed-out or throttled reviewers do
not supply clean evidence. A resumed original dispatch is not a new review round.

## 2. Verify the full affected behavior

- Derive assertions from accepted requirements and the changed surface's transitive
  consumers. Use actual commands and outputs. AST/grep proves structural claims;
  executable scenarios prove behavior. Do not call file existence or a matching token
  behavioral compliance. Reuse unchanged deterministic results only with their exact
  source/environment identity; independently rederive new or disputed properties.
- Inspect authorization, tenant boundaries, concurrency, transaction atomicity, rollback,
  timeout, connection loss, cancellation and resource release. Ordinary failure with
  no attacker is a mandatory lens for infrastructure work.
- Adversarial findings name prerequisites, the reachable entry point, violated acceptance
  or security obligation, reproduction, category, severity and stable root-cause key.
  Runtime tampering and malicious input are different attacker capabilities. Challenge
  the declared boundary when evidence warrants it; resolve that decision before more code.
- Enumerate tests with the project's actual runner and verify new behavior has meaningful
  coverage. Show defect regressions can fail for the property in question. Classify
  environment contamination separately; a compromised test baseline cannot adjudicate code.
- Run the wave boundary walk (`.harness/guides/task-delivery.md` § Wave boundary) over
  everything the wave landed together and save it at `04-validate/<scope>-boundary-walk.md`.
  For UI changes, run the completed todos through `check-browser-walk-receipts.mjs` (exit 3
  means it found no todo to check — that is not a pass) and
  independently walk the affected user journeys in a headed browser. Record verbatim
  steps, observations and disposition, including persistence after reload. Follow
  `.harness/rules/e2e-god-mode.md` — headed, real-user navigation only (click links/
  buttons/forms; no direct navigation such as `page.goto()` mid-flow, no direct API calls
  to skip a step). API
  calls and suite counts do not replace the walk.
- Use the applicable persistent semantic eval corpus for LLM/intent properties per
  `.claude/skills/12-testing-strategies/probe-driven-verification.md`. Accrete actual defects as regressions; classify
  incremental probes consistently. Do not introduce LLM evaluation for a deterministic
  counter or schema check. Scan affected build/test logs and disposition WARN+ findings.

## 3. Aggregate and decide

Collect every expected reviewer's actual report before counting a round. Classify each
finding BUG / INVEST-NOW / INCREMENTAL under `.harness/rules/product-completion-first.md`.
Severity ranks findings; it does not justify hiding bugs. Out-of-contract discoveries
remain visible and are adjudicated against product requirements and the threat model.

Save each report verbatim, with secret values redacted (task-delivery § Review protocol and
circuit breaker), at `workspaces/<project>/04-validate/<scope>-<lens>-r<n>.md` and
write `workspaces/<project>/04-validate/round-<scope>-<n>.json` in the format in
task-delivery § Review protocol and circuit breaker, with one verdict and a
repository-root-relative evidence path per expected reviewer. Run:

`node .harness/bin/record-review-round.mjs <round.json>`

then commit the round file and its reports; the receipt is checked against them.

Only complete rounds count. One lens's CLEAR cannot clear another lens's failure.
Duplicate delivery cannot add a round. ERROR is never clean. The branch gets three rounds,
then one debug round with never-used reviewer lenses, then a named human. Exit 2 (`REPLAN`
or `DEBUG_ROUND`) requires `/debug` reassessment before another repair cycle — `REPLAN`
fires when a root cause recorded in any earlier non-clear round on this branch comes back
(clean rounds in between don't reset it), or after four non-clear rounds since the last
decision record. Exit 3 (`ESCALATE_TO_HUMAN`) means stop and ask the user, in the format in
`.claude/rules/communication.md` § Asking the user to decide. This applies to
security work too; unresolved defects remain blocking. Cite the decision record in the next
round's `replan` field. Full rules: task-delivery § Review protocol and circuit breaker.

## 4. Certify convergence

In light mode the wave needs one CLEAR round, with no launch ledger and no receipt
(`.harness/guides/task-delivery.md` § Light mode); skip to the steps after the receipt check
below.

Convergence requires two complete clean rounds on the same commit, no unresolved
gating findings, acceptance/spec compliance over the affected surface, meaningful
tests, applicable UI/boundary receipts, and green gating semantic evals where applicable.
Incremental findings follow existing tracked residual/acceptance requirements. A
circuit breaker or reassessment is not convergence and never authorizes shipping bugs.

Write the final receipt using
`node .harness/bin/check-redteam-convergence-receipt.mjs --template <scope>`.
Preserve its wave-base, ratified-acceptance, per-round launch identity, evidence,
covered-todo, current-commit and named residual-acceptor requirements. Each reviewer's
`evidence` is the repository-root path of its committed report; each round the receipt lists
has its committed `round-<scope>-<n>.json` with the same head, lenses, evidence and verdicts;
and the receipt lists every recorded round of the scope up to the highest. Its
`acceptance_list.ratified_by` and any `residuals[].accepted_by` are the user's name. A round
recorded on a debug round uses `<lens>-debug` lens names (`correctness-debug`,
`security-debug`); the checker accepts `security-debug` as the security lens. Write the DECISION journal entry for the convergence, then commit the
receipt and that journal entry together in ONE commit (the checker refuses a journal entry
committed after the receipt), and run
`node .harness/bin/check-redteam-convergence-receipt.mjs --workspace workspaces/<project> --scope <scope>`.
Only exit 0 permits a convergence claim. The round recorder does not replace this final
verifier.

A receipt the checker refuses is not a certificate and would block every todo it lists. Before
the wave merges, correct it in place: fix what the refusal names (a missing journal entry, a
wrong field, a missing artifact) and commit the corrected receipt for the SAME scope in a NEW
commit on the wave branch, then re-run `--scope`; the checker judges the receipt at its last
commit (an uncommitted edit is refused as `receipt-rewritten`). If only the journal entry was missing, commit it together with the receipt in one new commit
(re-save the receipt unchanged apart from a trailing newline so it is part of that commit).
Never copy round records. Only when the acceptance list itself changed does the wave move to a
new scope name (`.harness/phases/todos.md` § Changing or cancelling approved scope). After the
merge into `main`, a receipt is immutable (`receipt-rewritten`).

After the receipt check exits 0, in this order:

1. Write the wave preview (task-delivery § Wave boundary) at `04-validate/<scope>-preview.md`:
   what users can now do, how to try it, and what is left for later (including any deferred
   INCREMENTAL finding), ending with the line `User answer: pending`. Commit it with a NEW
   DECISION journal entry that cites the preview and the boundary walk; never edit the entry
   committed with the receipt.
2. If the user is here, ask whether it matches what they wanted
   (`.claude/rules/communication.md` § Asking the user to decide). If they are not, it stays
   the first open question for `/ws` and `/wrapup`. Until they answer — and after a "no" until
   its fix or scope change has landed — `/deploy` refuses to ship the wave
   (`.claude/commands/deploy.md` Step 1.3). Record the answer by replacing the last line with
   their words and the date: on the wave branch if they answer before the merge, otherwise on a
   record-only `docs/<scope>-preview` branch cut from `main` after the merge (light mode too).
3. Merge the wave branch into `main` by pull request: read CI on the pinned head SHA, then
   merge in a separate command with a merge commit (task-delivery § Branches, pull requests
   and merging). Merging deploys nothing and needs no confirmation, except while the project
   profile's `main_deploys_live` is `unknown` and the product may already be live
   (`.harness/rules/autonomous-execution.md` § What needs the user defines it). If this merge waits for the user, stop here: steps 4 and 5 run after
   it, and `/ws` lists the waiting merge.
4. Run `/codify` on a `docs/codify-<slug>` branch cut from `main` (`.harness/phases/codify.md`
   § When it runs).
5. Reconcile specs on a `docs/wNN-spec-reconcile` branch: for each spec this wave built, remove
   its `Status: approved design` line and cite the real code (`.claude/rules/spec-accuracy.md`
   § Exceptions item 4). Then reconcile the remaining todos and re-rank by value before the next
   wave.

## Conditional checks

The harness carries no fork/upstream relationship (see `.harness/README.md` § Not
included), so there is no inherited-artifact skip class to apply. For parity migrations run the original
and replacement on the same cases. For plans spanning multiple waves, retain the
holistic integration review in `.harness/rules/agent-delegation.md` before plan closure.
