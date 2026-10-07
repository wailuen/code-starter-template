# Review-round recorder: known limits

Companion to `.harness/rules/redteam-stall-debug.md`, which states the behavior the
recorder (`.harness/lib/redteam-stall.cjs`, run through
`.harness/bin/record-review-round.mjs`) enforces. This file lists what it does not check.
Read it before relying on the recorder for a real branch.

## Known residuals — disclosed, not fixed

The round budget is an anti-loop aid, not a security control. Gate review (the `/redteam`
reviewers and the orchestrator who compiles the convergence receipt, per
`.harness/rules/redteam-stall-debug.md`) remains its backstop.

What it detects: a round number out of order; a partial round; a changed reviewer list without
a decision record; a debug round reusing a spent lens; a person-only acceptor that is an
honest mistake (an agent, model, role or placeholder name — `.harness/rules/completion-criterion.md`
MUST-1). When its local state (git-ignored `.claude/learning/`) is missing, it rebuilds from
every round record ever added in the branch's history or on the local `main` (where a merged
record-only branch, such as a codify `-ask` review's, leaves them) whose file name is this scope's
(`round-<scope>-<n>.json`) or whose `branch` is this branch, each as first committed, and
refuses an unreadable, duplicate or gapped history ("Cannot rebuild the review count for <b>
from its committed round records: <why>…") or a round number that skips ahead ("round N
refused: … so the next round is K+1"). A renamed or re-cut branch for the same scope keeps its
count; a todo branch cut from a wave branch starts at round 1.

What it does not detect:

- Deliberate local history rewriting (resetting a branch, rewriting commits, editing a shallow
  clone, or starting a new scope on a new branch) can restart the count. That is a history rewrite, which needs the user
  (`.harness/rules/autonomous-execution.md` § What needs the user); the recorder does not try
  to catch every local git trick.
- A round recorded but never committed is not counted after the local state is lost.
- Reviewer ids are compared as written; a variant spelling of a spent lens is a fabricated
  record that gate review catches against the dispatch roster.
- Control characters in a reviewer id or a cited path reach the one-line `NEXT:`
  guidance unescaped, so a hostile id could forge or hide a line on a terminal. A
  committed-file control-byte check, if the project has one, does not cover runtime strings.
- The recorder verifies the branch exists and the head is on it, not that the work is new.
- The branch check compares against `refs/heads`, not the invoking checkout's `HEAD`,
  because the CLI may legitimately run from the main checkout for a worktree branch.
- A record named `__proto__` relies on null-prototype maps and `Object.hasOwn`; that
  path has no dedicated test.
- Action precedence: `DEBUG_ROUND` and `ESCALATE_TO_HUMAN` outrank `REPLAN`, and
  `REPLAN` outranks `REPAIR_ENVIRONMENT`, so an errored round that also recurs a root
  cause reports `REPLAN`; the `NEXT:` line and the state's `consecutiveErrors` still
  show the error.
- `readState` validates the budget fields and the last round record; the older
  `head`, `action`, `keyHistory`, `closedBy` and `accepted` fields are read as
  written. Corrupt values there fail loud downstream rather than at read time.
- Several LOW/NIT items from the original code review (one untested guard clause,
  wording drift) were never addressed.
- Recurrence matches root-cause keys as exact strings. A recurrence recorded under a new
  key is caught only by the naming discipline in the rule (MUST-1) and by gate review.

## Verification

`.harness/tests/` exercises the recorder; run `node --test ".harness/tests/*.mjs"` after any
change to `.harness/lib/redteam-stall.cjs` or `.harness/bin/record-review-round.mjs`, and add a
test that fails without the change. A retry counter cannot prove the semantic correctness of a
review or that a declared threat model is sufficient; independent review owns those.
