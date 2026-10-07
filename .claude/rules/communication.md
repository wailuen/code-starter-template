---
priority: 0
scope: baseline
---

# Communication Style

Many users of this workflow are non-technical. Default to plain language; match the user's level if they speak technically.

Report **outcomes**, not implementation. Explain choices in **business terms** the user can act on. Frame every decision as **impact + trade-off + your recommendation**.

After a long stretch of work, write the final message for a reader who saw none of it: open with what happened or what you found, then what you need from them. Drop the shorthand you used while working — no arrow chains, made-up labels or packed lists of file names; give each file, command or term its own plain clause. If you must choose between short and clear, choose clear.

```
# DO — the change the user can observe, and a question they can answer
"Users can now sign up and receive a welcome email."
"Validate cards instantly (faster checkout, $0.01/check) or on submit (free, errors later)?"
# DO NOT — the mechanism, and a question only an engineer can answer
"Implemented POST /api/users with SendGrid integration." / "Modified 12 files across 3 modules."
"Should we integrate the Stripe CardElement with real-time validation?"
```

## Asking the user to decide

Every question that needs the user's decision — plan approval, an escalation after the review-round limit, accepting a known remaining risk, a lesson waiting for approval, a deploy or rollback — uses the same five parts, in this order:

1. **What it is** — one plain sentence.
2. **If yes** — what happens.
3. **If no** — what happens.
4. **My recommendation** — the pick and why (`.claude/rules/recommendation-quality.md`).
5. **How to answer** — one word, e.g. "yes" / "no" or "A" / "B".

```
Approve the plan for wave 3 (bulk customer import)?
If yes: I start building it now, in three parts.
If no: nothing is built; tell me what to change.
I recommend yes — it covers everything in your brief and nothing extra.
Answer "yes" or "no".
```

**Why:** A fixed shape lets the user decide in one read, and makes a missing "if no" or a missing recommendation easy to spot.

## Approval Gates

At plan approval (end of `/todos`), ask all four — each catches a different failure. Other decisions — a deploy, a rollback, an escalation — use the five-part shape in § Asking the user to decide; which actions need asking at all is set by `.harness/rules/autonomous-execution.md` § What needs the user.
Skip a gate the user has already passed for the same scope; never re-ask an approval already
given (`.harness/rules/autonomous-execution.md`):

- "Does this cover everything you described in your brief?"
- "Is anything here that you didn't ask for or don't want?"
- "Is anything missing that you expected to see?"
- "Does the order or sequence make sense?"

## MUST NOT

- Ask non-coders to read code — describe in plain language

**Why:** Non-technical users cannot act on code snippets; they ignore them or assume wrongly.

- Use unexplained jargon — immediately explain technical terms

**Why:** Unexplained jargon doubles the turns needed to reach a decision.

- Present raw error messages — translate to impact

**Why:** Raw errors create anxiety without enabling action.

- Repeat the same jargon if user says "I don't understand" — find new analogy

**Why:** Repeating failed explanations erodes user trust in the entire session.

