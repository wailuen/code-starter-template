## Resolve scope and acceptance

Resolve the named workspace/wave; otherwise choose the latest real workspace excluding
`instructions` and leading-underscore directories. Read briefs, relevant specs, the
current wave's delivery contracts and `03-user-flows/`. Resolve root/workspace spec
authority explicitly. Results belong in `workspaces/<project>/04-validate/`, named as in
`.harness/guides/task-delivery.md` § Workspace file layout. A wave review runs with the wave
branch `feat/wNN-<slug>` checked out, scope `wNN`; its rounds are recorded on that branch.

Read `.harness/guides/task-delivery.md` and `.harness/rules/completion-criterion.md`.
An independently ratified acceptance list must predate review: for a wave it is
`workspaces/<project>/04-validate/acceptance-wNN.md`, committed by `/todos` before the work. New uncovered product
requirements are surfaced as design/scope decisions immediately; do not silently add
unbounded obligations to the current task or dismiss a credible security issue.

## 1. Prepare a stable review

Record scope, round number, target commit, acceptance IDs, expected reviewers and
infrastructure ownership. Review depth scales with the change's risk; it never makes
missing evidence clean. Security/trust-bearing changes require
independent correctness and security reviewers; add testing, UX/value or domain seats
for their actual surface. Do not spawn irrelevant specialists by default. Plan the security
seat for nearly every wave: the convergence checker treats any change under the common source
roots (`src/`, `lib/`, `app/`, `apps/`, `web/`, `cmd/`, `internal/`, `pkg/`, `server/`,
`api/`, `scripts/`), `.claude/`, `.harness/`, `.github/`, root dependency or build manifests,
and auth/tenant/secret/token-named paths as security surface, and refuses a receipt whose
`security_critical` is lower than that.

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
- For UI changes, run the completed todos through `check-browser-walk-receipts.mjs` and
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

Save each report verbatim at `workspaces/<project>/04-validate/<scope>-<lens>-r<n>.md` and
write `workspaces/<project>/04-validate/round-<scope>-<n>.json` in the format in
task-delivery § Review protocol and circuit breaker, with one verdict and a
repository-root-relative evidence path per expected reviewer. Run:

`node .harness/bin/record-review-round.mjs <round.json>`

Only complete rounds count. One lens's CLEAR cannot clear another lens's failure.
Duplicate delivery cannot add a round. ERROR is never clean. The branch gets three rounds,
then one debug round with never-used reviewer lenses, then a named human. Exit 2 (`REPLAN`
or `DEBUG_ROUND`) requires `/debug` reassessment before another repair cycle — `REPLAN`
fires when a root cause recorded in any earlier non-clear round on this branch comes back
(clean rounds in between don't reset it), or after four non-clear rounds since the last
decision record. Exit 3 (`ESCALATE_TO_HUMAN`) means stop and ask the user. This applies to
security work too; unresolved defects remain blocking. Cite the decision record in the next
round's `replan` field. Full rules: task-delivery § Review protocol and circuit breaker.

## 4. Certify convergence

Convergence requires two complete clean rounds on the same commit, no unresolved
gating findings, acceptance/spec compliance over the affected surface, meaningful
tests, applicable UI/boundary receipts, and green gating semantic evals where applicable.
Incremental findings follow existing tracked residual/acceptance requirements. A
circuit breaker or reassessment is not convergence and never authorizes shipping bugs.

Write and commit the final receipt using
`node .harness/bin/check-redteam-convergence-receipt.mjs --template <scope>`.
Preserve its wave-base, ratified-acceptance, per-round launch identity, evidence,
covered-todo, current-commit and named residual-acceptor requirements. Commit the
DECISION journal receipt and run
`node .harness/bin/check-redteam-convergence-receipt.mjs --workspace workspaces/<project> --scope <scope>`.
Only exit 0 permits a convergence claim. Committed certificates remain immutable;
subsequent changes use a new certificate scope. The round recorder does not replace
this final verifier. Then merge the wave branch into `main` by pull request, reading CI on
the pinned head SHA before a separate merge command, with a merge commit (task-delivery
§ Branches, pull requests and merging). At a wave boundary, right after the merge, run
`/codify` — on a `docs/codify-<slug>` branch cut from `main` (`.harness/phases/codify.md` §
When it runs) — then spec/todo reconciliation and value re-ranking before the next wave.

## Conditional checks

The harness carries no fork/upstream relationship (see `.harness/README.md` § Not
included), so there is no inherited-artifact skip class to apply. For parity migrations run the original
and replacement on the same cases. For plans spanning multiple waves, retain the
holistic integration review in `.harness/rules/agents.md` before plan closure.
