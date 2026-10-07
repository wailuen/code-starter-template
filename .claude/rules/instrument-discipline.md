---
priority: 0
scope: baseline
cli_delivery: baseline
---

# Instrument Discipline — A Check That Cannot Discriminate Is Not Evidence

Before you treat a check, probe, fixture, or test result as evidence of something, ask one question:

> **Would this check have come back different if the thing I'm claiming were actually false?**

If not, it isn't evidence — no matter what it printed.

## MUST Rules

### 1. Name The Falsifying Result Before Citing Any Check As Evidence

Before you cite a check as evidence, say what it would have shown if the thing you're claiming were false. If you can't say that, the check isn't evidence yet — go find or build one that can tell the two cases apart, or say plainly that the question is still open. Having run, having exited cleanly, or having printed something plausible doesn't satisfy this on its own.

```bash
# DO — this could return the opposite answer, and you've said so
gh pr checks "$N" --json name,state -q '.[]|select(.state!="SUCCESS")'   # non-empty = NOT green

# DO NOT — same output whether the claim is true or false
git status --porcelain      # empty on "nothing done" AND on "all committed"
```

**Why:** A result that would look the same either way carries zero information — acting on it is acting on a guess dressed up as a measurement.

### 2. A Passing Test Is Itself A Check — Confirm It Can Fail Before You Trust That It Passed

**(a)** Before citing a green test as proof a behavior works, make sure you know it would have gone red in that behavior's absence — not "it's named for that behavior," but that it's actually been seen to fail on broken code. **(b)** If you deliberately break the code and the test still passes, that's ambiguous, not proof the test is useless — it could mean the test is vacuous, or that your change never actually reached the tested code. Confirm which one it is (e.g. check the mutated line actually ran) before drawing a conclusion either way.

```bash
# DO — establish the test can fail, before trusting that it passed
git add -N . && git diff > /tmp/feature.patch   # -N first, so new untracked files are in the patch (worktree-isolation.md Rule 9)
git apply -R /tmp/feature.patch && pytest -k revocation                       # must FAIL without the feature
git apply /tmp/feature.patch && pytest -k revocation                                         # restore, must PASS (no stash: see git.md)
<mutate>; <confirm the mutated line ran>; <run test>   # now the result means something

# DO NOT — trust a green suite, or read an unconfirmed mutation as a verdict
pytest -q   # "412 pass" — never seen this fail — so the number alone tells you nothing
```

**Why:** A test that asserts nothing about the behavior it's named for passes whether that behavior exists or not. An unconfirmed mutation is a second unproven check stacked on the first: it can mean "the test is broken" just as easily as "my mutation missed the code."

### 3. Confirm The Check Actually Fires On A Case You Already Know The Answer To, And Read What It Actually Matched

**(a)** Before trusting a check's silence (an empty grep, "0 found," a clean report), run it against a case you already know should trigger it. If you've never seen it fire, an empty result could mean "nothing's wrong" or "this check can't see this kind of problem here" — and you can't tell which. **(b)** When you do get a result, read what it actually matched, not just the count — a count can be technically accurate and still answer a different question than the one you're asking.

```bash
# DO — prove the check can fire, on a case you know has the pattern; then read the hits
git grep -c 'process\.exit(0)' -- path/known-to-have-it.js   # prints > 0 = the check works here
git grep -n 'severity: "block"' -- .claude/rules/            # then read each hit in context

# DO NOT — trust an empty result from a check never shown to fire, or report a tally instead
grep -rn 'process\.exit([12])' .claude/hooks/    # silently misses this shell's own syntax quirks
<runner> tests/integration/*                      # "14 tests" may count files, not the real total
```

**Why:** A sound check can be physically unable to catch the thing right here — a regex dialect it doesn't support, a case-insensitive filesystem, a shell that won't split the way you expect — and its silence looks identical to a genuine all-clear. Reading the actual matches (not just the count) is what catches an over-broad match that a control alone wouldn't reveal.

### 4. A Check Built To Answer One Question Doesn't Automatically Answer A Different One

A check being reliable for question A tells you nothing about whether it answers question B. Before reading an existing check's output as the answer to a new question, ask: could this check even have shown the opposite, for THIS question? If not, treat the new question as still open and go find or build a check that actually looks at it. What a field means is set by whatever produced it, not by whatever you happen to be asking right now.

```bash
# DO — the new question gets its own check
git merge-tree "$(git merge-base A B)" A B | grep -c '^<<<<<<<'   # >0 = they actually conflict

# DO NOT — reuse a tool that never looked at the thing you're now asking about
# "the merge-order simulator returned 4 clean groups, so the PRs don't conflict" — it never opened a diff
```

**Why:** A tool built for one question can return a value that looks perfectly reasonable for a different question it was never designed to check, and nothing in the output itself flags the mismatch.

## MUST NOT

- Treat a check's output as settling a question when nothing that check could have produced would have shown the opposite.

**Why:** A confident wrong answer, delivered with a straight face, ends the search that would have found the real one.

## Enforcement

Whether a check actually discriminates is a judgment call about its own logic, not something a hook can verify mechanically. No hook checks this automatically. Catching a violation depends on the agent applying the rule and on review. A project that adds a hook for it should name it here.

## Origin

Landed after a session cited several checks as evidence without any of them being able to fail in the way that mattered.
