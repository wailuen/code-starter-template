---
priority: 10
scope: path-scoped
paths:
  - ".harness/guides/review-round-recorder.md"
  - ".harness/phases/**"
  - ".claude/commands/**"
  - ".harness/bin/record-review-round.mjs"
  - ".harness/lib/redteam-stall.cjs"
  - "**/04-validate/**"
---

# Review stalls require a changed approach

Count complete review rounds, not reviewer messages. The orchestrator aggregates all
expected reviewers on one pinned commit and runs
`node .harness/bin/record-review-round.mjs <round.json>` per
`.harness/guides/task-delivery.md`. The final convergence verifier remains separate.

The recorder enforces two independent limits on a branch, and whichever fires first
wins: the **round cap** (MUST-3: three counted rounds, then one debug round, then a
human) and **REPLAN** (MUST-1). Because the cap is three, it normally fires before
REPLAN's four-round counter; REPLAN's recurrence trigger can fire on any round. When both
apply, the cap's action (`DEBUG_ROUND` or `ESCALATE_TO_HUMAN`) is reported, and the
debug round's required decision record also satisfies REPLAN.

## MUST-1 — Reassess before another stalled repair cycle

REPLAN (exit 2) fires after a non-clean round when any of these holds:

- (a) four non-clean rounds in a row since the last decision record — errored rounds
  count here even when they are void for the cap, a clean round resets the count to
  zero, and the round that cites a new decision record counts as the first;
- (b) a root-cause key recorded on this branch in any earlier non-clear round appears
  again, and no decision record has accepted it — clean rounds in between do not reset
  this;
- (c) a key that a decision record claimed to close appears again (the stronger signal:
  a closure claim that didn't hold).

Recurrence, (b) and (c), is checked only on rounds that do not cite a new decision
record.

On REPLAN, run `/debug` to decide architecture, scope, test-environment or verification
changes before more implementation or review, and reference the decision record as
`replan` in the next round. The recorder refuses the next round without it.

A decision record is consumed by the round that first cites it; re-citing the same path
on any later round of the branch is refused, because it would suppress recurrence
detection for the whole interval it covers. A decision record may declare
`replan_closes` (root-cause keys it claims to structurally end) and/or `replan_accepts`
(keys knowingly left recurring, each naming a human acceptor).

Record a finding under the earlier round's key when the reviewer's evidence names it as
the same mechanism; do not mint a fresh key for a named recurrence. The recorder matches
keys as exact strings, so this naming discipline is what makes recurrence detection
work. An architectural choice is surfaced when needed, never queued until convergence.
Open security obligations remain blocking.

## MUST-2 — Instrument errors are visible, never clean

Counts live at the main checkout's `.claude/learning/redteam-stall-state.json`,
including the branch's full `keyHistory`/`closedBy`/`accepted` record and its round
budget (`roundsRecorded`, `reviewersSeen`, `debugRound`, `acceptancesConsumed`,
`replansConsumed`). State written before the budget existed is seeded from the round
number, the last recorded lens set and decision record, and — through the CLI — the
branch's earlier `round-*.json` files beside the one being recorded, so a spent record
stays spent; the round count can only over-count. When a checkout has no state for the branch at all
(the gitignored state file was deleted, or the repository was cloned fresh), the recorder
rebuilds the budget from the branch's committed `round-<scope>-<n>.json` records and refuses
any round after 1 whose earlier records are not committed. A missing state file is never a
fresh budget, so commit each round record before the next round.

Duplicate rounds cannot increment; conflicting or out-of-order rounds are refused;
errors and partial results never count as clean. Every recorded round prints the
branch's known-root-cause history (round numbers, and any closed/accepted disposition)
and its round budget alongside the JSON result, so an author sees existing keys before
minting a new one. That is an aid against the mistake, not a mechanical guarantee;
gate review — the `/redteam` reviewers and the orchestrator who compiles the convergence
receipt, read against the dispatch roster and the round files — is the backstop for whether
a new key should have reused an existing one.
Writes are serialized by `redteam-round.lock`; a busy or stale lock or corrupt state is
reported, never reset silently. Exit codes: 0 with a `NEXT:` line (`FIX`, `REVIEW`,
`REPAIR_ENVIRONMENT` or `VERIFY_CONVERGENCE_RECEIPT`) when the round was recorded; a
refusal records nothing and exits 1, or 2/3 when the refusal is the cap, debug-round or
REPLAN gate (2 = `REPLAN`/`DEBUG_ROUND`, 3 = `ESCALATE_TO_HUMAN`). After a round is
recorded, commit its `round-<scope>-<n>.json` before the next round. The recorder runs only through its CLI,
`.harness/bin/record-review-round.mjs`, which takes complete structured round JSON; there
is no hook entry point. Individual prose
verdicts are never round evidence — the orchestrator aggregates them and records the
round through the CLI.

## MUST-3 — Three rounds per branch; the fourth is a fresh-lens debug; the fifth is a human's

A branch gets `TOTAL_ROUND_CAP = 3` counted rounds in total — clean, non-clear or
charged-errored (void errored rounds, below, do not count) — and a decision record never
resets that count. MUST-1's four-round counter resets on every new decision record, so
without this cap an orchestrator that never repeats a key and replans every few rounds
could run indefinitely. A non-clean, non-errored counted round at or past the cap
returns `DEBUG_ROUND` (exit 2) while the debug round is unused, and `ESCALATE_TO_HUMAN`
(exit 3) after it.

Past the cap the recorder admits exactly four shapes and refuses everything else
without recording it:

- **(a) Same-head confirmation** of an immediately preceding first clean round — the
  closing half of convergence, admitted once. `head` is the commit the reviewers checked
  out, not the branch tip: committing the round's own record, reports and ledger rows on top
  does not move it, but any change to the reviewed code is a new cycle. Once the pair has closed, another round with the same
  lenses on the unchanged head reviews nothing and is refused inside or outside the cap.
- **(b) The branch's single debug round:** `debug: true`, a new decision record in
  `replan`, and `expected_reviewers` disjoint from every reviewer id ever recorded on
  the branch. A plain replan with new lenses is not a debug round, a debug round reusing
  a lens is refused, and `debug: true` inside the cap is refused.
- **(c) Human-accepted rounds.** Once the debug round is spent and the branch still has
  not converged, each further round needs `escalation_accepts: {acceptor, record}` — a
  named person — the shared denylist in `.harness/lib/agent-identity.cjs` refuses agent
  and model words, role and agent names, reviewer lenses and placeholders such as
  "human", "user" or "owner" — citing a new acceptance
  record per round (re-citation refused; the record must exist and must not be the
  agent's own replan record). An acceptance buys that round and, if clean, its same-head
  confirmation — nothing more. REPLAN still binds an accepted round.
- **(d) Re-run of an errored round** — the same dispatch again: same
  `expected_reviewers`, same `debug` flag, same `head`; a moved head is a new round.

The first `ERROR_RERUN_LIMIT = 2` consecutive errored rounds are void: visible
(`REPAIR_ENVIRONMENT`) but spending nothing — no round counted, neither the debug
allowance nor an acceptance record consumed, no lens added, the clean streak left as it
was on an unchanged head — and the re-run may cite the decision record the errored round
cited. The next consecutive failure is charged like any complete non-clear round, and no
further re-run is admitted: an instrument that keeps failing is a repair job, not a retry
budget. An errored debug attempt must be re-run as a debug round, and a fabricated
`ERROR` is a fabricated record.

Every cited file — evidence, `replan`, acceptance record — must be a non-empty file
inside the checkout the round is recorded from, and `branch` must be a branch of that
repository with `head` a commit on it (the recorder verifies both, so a renamed branch
string is not a fresh budget). A cited file is tracked by where it really is (resolved
through symlinks, relative to that checkout), never by how the citation was spelled:
`./x`, `x/./x` and an absolute path are one record and consume once. A new branch cut
from the same head is the same work for budget purposes; gate review checks this,
because the recorder cannot.

```json
// DO — round 4 is the debug round: the flag, a new record, lenses the branch has never seen
{ "round": 4, "debug": true, "replan": "workspaces/<project>/04-validate/replan-w03-2.md", "expected_reviewers": ["fresh-correctness", "fresh-security"] }
// DO NOT — an ordinary replan on round 4 (refused, exit 2), or a "fresh" lens that reviewed round 1
{ "round": 4, "replan": "workspaces/<project>/04-validate/replan-w03-2.md", "expected_reviewers": ["correctness", "security"] }
```

"The four-round counter never fired, so the loop is healthy", "one more debug round will
do it", "the lead accepted the escalation" and "a new branch name is a new budget" are
the usual ways around this; none of them is a recorded human acceptance.

**Why:** MUST-1 bounds rounds since a reassessment; nothing else bounds the branch
total, so legitimate replanning can itself be the runaway. The fresh-lens check is a
naming discipline the state can audit (`debugRound`, `reviewersSeen`), not a proof of
context freshness — the round JSON carries no agent identity — and the acceptor is a
named string checked against the shared denylist (`.harness/lib/agent-identity.cjs`),
not a verified human. Both are floors that gate review confirms against
the dispatch roster.

## Recorder limits

The recorder's known gaps and its missing test fixtures are listed in
`.harness/guides/review-round-recorder.md`. Read that file before relying on the
recorder for a real branch. Gate review remains the backstop for what it cannot check.
