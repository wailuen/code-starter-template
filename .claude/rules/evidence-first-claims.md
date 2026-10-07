---
priority: 0
scope: baseline
---

# Evidence-First Claims — No Assertion Without Quoted Evidence

When you say why something failed, or flag something as suspicious, quote the actual line of output, code, or bytes that shows it — in the same message as the claim. Inference is fine, but say it's inference; don't state a guess in the same voice as something you actually read.

## MUST Rules

### 1. Diagnostic And Root-Cause Claims Cite The Evidence Inline

If you're saying why something failed, quote the log line, output, exit code, or file content that shows it — in the same message. Read the evidence before naming the cause, not after.

**Why:** A symptom usually has more than one plausible cause. Naming one before you've actually read the evidence means the next action gets built on a guess that sounds like a fact.

### 2. Security Or Anomaly Claims Quote The Triggering Bytes, Decoded

If you think something looks like compromise, injection, or tampering, quote the exact bytes and decode the whole suspicious span (`hexdump -C` / `od -c`) before you characterize it. How a character is _displayed_ (e.g. a `cat -v` rendering) isn't the same as what it actually _is_. If there's a real, byte-less finding (a structural issue, say), describe the exact repro steps instead of skipping it.

**Why:** A false security claim is worse than staying quiet — it triggers a costly escalation and burns the credibility real findings need. One decode usually settles the question.

### 3. An Errored Or Empty Command Confirmed Nothing

If a command errored, hit an invalid flag, timed out, or came back empty, that's zero information — not confirmation of anything. If a security check errors out, that's not an all-clear either: re-run it correctly, or say plainly "this didn't run, so I don't know."

**Why:** An error and a genuinely clean-but-empty result look the same in the raw output, but they mean opposite things.

### 4. Inference Is Labeled As Inference; Only Quoted Observation Is Stated As Fact

"I see [quoted X]" is a fact. "This suggests [Y]" is your interpretation of it. Keep the two visibly different — don't phrase a guess as if it were something you directly observed.

**Why:** The reader needs to know what's confirmed versus your best guess, so they can act on it correctly or double-check it first.

### 5. Before You Bank A Verification Result, Confirm The Check Could Have Come Back The Other Way

Before treating a passing check as real verification, confirm it was actually capable of failing. Two common ways it isn't: the "expected" value was computed from the very thing being checked (so it will always agree with itself), or the check quietly answers a different question than the one you're asking — for example, comparing `base..HEAD` on a branch that's behind base makes base's own newer commits look like your reversions; use `base...HEAD` instead.

**Why:** A check that can't fail, or is quietly answering the wrong question, passes a broken change exactly as readily as a working one, with no visible sign of the problem.

### 6. Know What A Green Result Actually Covers Before You Generalize It

A check passing tells you it works for the cases it actually exercised, not automatically for every related case. Before extending a green result further, check what it actually ran against — what code path, what build configuration, what test engine. A green run on an easier stand-in (an in-memory database standing in for the real one, a feature flag that only adds tests and never removes them) doesn't tell you the stricter, real version is also fine.

**Why:** A check can be completely honest about what it covers and still not cover the thing you're about to assume — passing its own scope isn't the same as passing the harder case you actually care about.

### 7. Ground Progress Claims In This Session's Tool Results

Before reporting progress, check each claim against a tool result from this session. Report only work you can point to evidence for; if something is not yet verified, say so. If tests fail, say so with the output; if a step was skipped, say that; when something is done and verified, state it plainly without hedging.

**Why:** A status report built from intent rather than results tells the reader work happened that may not have; it is the progress-report form of a root cause stated before reading the evidence.

## MUST NOT

- State a security, compromise, injection, or tampering claim without quoting the actual bytes.
- Treat a display rendering as if it were the underlying content, without decoding it first.
- Treat an errored, timed-out, or empty command as confirming anything.
- State a root cause before reading the evidence that shows it.
- Bank a verification result from a check never shown able to return the opposite answer, or extend a green result past the scope it actually covered.
- Report progress you cannot point to a tool result for.

## Enforcement

Whether a claim is actually grounded is a judgment call, not something a hook verifies mechanically. No hook checks this automatically. Catching a violation depends on the agent applying the rule and on review. A project that adds a hook for it should name it here.

## Related rules

Extends `.claude/rules/verify-resource-existence.md` MUST-2 to all diagnostic/anomaly/security claims. Pairs with `.claude/rules/recommendation-quality.md` MUST-3, `.claude/rules/user-flow-validation.md` MUST-2 and `.claude/rules/instrument-discipline.md`.

## Origin

Landed after a session made three escalating claims without checking evidence first, including a fabricated security claim from a mis-decoded character. A false security claim costs more trust than it could ever save.
