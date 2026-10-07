---
priority: 0
scope: baseline
---

# Time-Pressure Discipline — Parallelize, Don't Shortcut

This rule applies when the user presses for speed on work where a procedure step could be
dropped: a stated deadline ("ship this by end of day", "we're past due") or an explicit
request to go faster ("speed it up", "everyone's waiting"). A casual "quick question" or
"when you get a chance" is not time pressure. Under real pressure the steps most at risk
are review rounds, regression tests, same-class fixes pushed to follow-up issues,
`--no-verify`, and scanner findings dismissed without `.claude/rules/zero-tolerance.md`
Rule 1b's four conditions.

The user's intent under time pressure is throughput, not corner-cutting. Pressure alone is
never a reason to drop a step. An explicit user instruction to skip a specific step is
different: it wins (Rule 2).

## MUST Rules

### 1. Keep Every Step; Raise Throughput Only Where The Work Earns It

Under time pressure, keep every procedure step. Raise throughput where there is room:
run independent remaining work in parallel when it is big enough to earn the setup
(several planned shards or todos — `.harness/rules/agent-delegation.md`: small, quick tasks you just
do yourself), stay inside `.harness/rules/autonomous-execution.md` § Per-session capacity
budget and `.claude/rules/worktree-isolation.md` Rule 4's concurrency cap, and name the
order you are taking (Rule 3). For a small task, the fastest correct path is usually to do
it directly; say so. Do not respond to pressure by skipping `/redteam`, omitting
regression tests, deferring in-shard same-class fixes to follow-up issues, or using
`git commit --no-verify`.

```markdown
# DO — pressure on several planned shards: parallel work, same steps

User: "We need to ship this by EOD, speed it up."
Agent: "Three planned shards remain (W3, W4, W5). Running them in parallel instead of one
after another — same reviews and tests on each, roughly a third of the wall-clock time."
[starts them]

# DO NOT — pressure framing triggers a procedure drop

User: "We need to ship this by EOD, speed it up."
Agent: "Skipping /redteam this cycle to save the round-trip. PR up in 5."
```

**Why:** Parallelization keeps every step while raising throughput; a shortcut removes
steps. Spinning up parallel worktrees for a small task costs more time than it saves.

### 2. Shortcuts: Say What The Step Protects Once, Then Follow An Explicit Instruction

Do not drop a step on your own initiative because of pressure. When the user explicitly
tells you to skip a specific step ("skip the review this time"):

1. State once, in plain language, what the step protects and offer the parallel path
   that keeps it.
2. If the user still wants it skipped, skip it. The user's explicit instruction wins.
3. Record it: the instruction and the skipped step go in the commit body or a journal
   entry, and a follow-up is recorded when the skip leaves real work undone (for
   example, a bypassed hook, per `.claude/rules/git.md` § Discipline), in the place
   `.harness/rules/autonomous-execution.md` § Problems found along the way names for it.

Do not ask again for the same skip later in the session. A skip of a security control
also needs what `.claude/rules/security.md` § Exceptions asks for, recorded the same way.

```markdown
# DO — concern once, then follow and record

User: "Skip the regression tests, just push it."
Agent: "Those tests are what catches the login break we hit last week. I can run them in
parallel with the push prep, which costs about 4 minutes. Or skip them?"
User: "Skip them."
Agent: [pushes; commit body: "Regression tests skipped at user's explicit instruction."
The skip is recorded; nothing else is filed, because the tests still run in CI.]

# DO NOT — refuse the user, or skip silently

Agent: "I can't skip tests, the rules forbid it."
Agent: [skips the tests and says nothing]
```

**Why:** The user owns the trade-off, but often lacks the agent's view of what a step
protects. One plain statement gives them that view; repeating it, or refusing, overrides
their decision. The record keeps the skipped work from being forgotten.

### 3. Ordering Under Pressure: Recommend, Then Proceed Unless The Order Is Open

When two or more outstanding tasks, shards or PRs are eligible:

- If the user already set the order (a ratified plan, a ranking) or told you to choose
  ("just pick the most important one and start"), proceed: name your pick and the
  runner-up in one line, then start.
- If the order is genuinely open and no user decision covers it, give a recommended order
  in the shape `recommendation-quality.md` MUST-1 to MUST-3 describes and ask a single
  yes/no.

```markdown
# DO — the user said pick and start: name the pick, then start

User: "We're past due, just pick the most important one and start."
Agent: "Starting (b), the issue #12 root cause — it removes the most risk; runner-up is
(a), the PR #67 follow-up." [starts (b)]

# DO NOT — re-ask a decision the user just delegated

User: "We're past due, just pick the most important one and start."
Agent: "Three eligible: (a), (b), (c). Recommend (b). Approve starting (b)?"
```

**Why:** "Just pick" is a delegation; asking for approval again costs a round-trip the
user already declined (`.harness/rules/autonomous-execution.md`: never re-request an
approval the user already gave). Naming the pick and runner-up keeps it visible.

"Deadline justifies a one-time exception", "we'll catch it next session" and "ship now,
validate later" are reasons an agent gives itself for dropping a step. None of them is an
instruction from the user; Rule 2 applies only to the user's explicit instruction.

## MUST NOT

- Drop a procedure step on your own initiative because of pressure. **Why:** that is the
  failure this rule exists to prevent.
- Skip a step at the user's instruction without recording it. **Why:** an unrecorded skip
  is indistinguishable from a forgotten step.
- Treat parallelization as a shortcut. **Why:** parallelization keeps every step; a
  shortcut removes steps.

## Enforcement

No hook checks this automatically. Catching a violation depends on the agent applying it
and on review.

## Cross-References

- `.harness/rules/autonomous-execution.md` § Per-session capacity budget is the upper
  bound — parallel work stays within it even under pressure.
- `.claude/rules/recommendation-quality.md` MUST-1 and MUST-3 give the shape of the
  ordering recommendation in Rule 3.
- `.claude/rules/zero-tolerance.md` Rule 1 (fix or record problems you find) and Rule 1b
  (scanner deferral conditions) are the steps most often dropped under pressure.
