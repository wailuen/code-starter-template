# Review-round recorder: known limits

Companion to `.harness/rules/redteam-stall-debug.md`, which states the behavior the
recorder (`.harness/lib/redteam-stall.cjs`, run through
`.harness/bin/record-review-round.mjs`) enforces. This file lists what it does not check.
Read it before relying on the recorder for a real branch.

## Known residuals — disclosed, not fixed

Found by the independent code and security reviews of the round cap and left open on
purpose: this is a harness instrument, and gate review (the `/redteam` reviewers and the
orchestrator who compiles the convergence receipt, per `.harness/rules/redteam-stall-debug.md`)
remains its backstop. Each is a
naming or presentation gap, not a way to record an unbounded number of rounds.

- Reviewer ids and `escalation_accepts.acceptor` are compared as raw strings: a
  whitespace, zero-width or fullwidth variant of a spent lens or a reserved word is
  not folded (no NFKC / control-character normalization). Gate review reads the ids
  against the dispatch roster; a variant spelling is a fabricated record.
- Control characters in a reviewer id or a cited path reach the one-line `NEXT:`
  guidance unescaped, so a hostile id could forge or hide a line on a terminal. A
  committed-file control-byte check, if the project has one, does not cover runtime strings.
- A branch cut from the same head under a new name starts a fresh budget; the
  recorder verifies the branch exists and the head is on it, not that the work is new.
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

No test fixtures for this logic ship with the harness, and no CI is wired up to run them
by default. The behavior is real — implemented in `.harness/lib/redteam-stall.cjs` and
exercised by `.harness/bin/record-review-round.mjs` — but untested here. Write fixtures
covering mixed reviewer verdicts, duplicate/out-of-order rounds, the cumulative cap, the
debug round, escalation acceptance, and errored-round re-runs before relying on it for a
real branch. A retry counter cannot prove the semantic correctness of a review or that a
declared threat model is sufficient; independent review owns those.
