---
name: user-flow-validation
description: Walk the actual user-facing flow before declaring any deliverable done. Tests passing is necessary but not sufficient. Receipts (verbatim command + verbatim output + user's next-step disposition) are required and must be scrubbed of secrets/PII before any public-surface embedding.
priority: 10
scope: path-scoped
paths:
  - "src/**"
  - "app/**"
  - "apps/**"
  - "lib/**"
  - "cmd/**"
  - "pkg/**"
  - "tests/**"
  - "scripts/**"
  - ".claude/hooks/**"
  - ".claude/bin/**"
  - ".harness/bin/**"
  - ".harness/lib/**"
  - ".harness/phases/implement.md"
  - ".harness/phases/redteam.md"
  - ".harness/phases/fix.md"
  - ".harness/phases/codify.md"
  - ".github/workflows/**"
---

# User-Flow Validation Rules

Exercise a deliverable through the actual user-facing path before calling it "done". Passing tests (unit / integration / Tier-1/2/3) are necessary but not sufficient: invoke the command the user would invoke, observe the output the user would see, and follow the next step the user would take. Do this before declaring done, not after.

(Rules are numbered 1, 2, 4, 6, 7, 8; other files cite MUST-2 and MUST-6 by number, so the gaps stay.)

## MUST Rules

### 1. Walk The User Flow Before Declaring Complete

Before calling any deliverable "done" / "complete" / "shipped" / "landed" / "ready": invoke the command / load the rule / run the script the way the user will; observe the actual output; follow the next step the user would take. A gate-level test result is the author's belief about the user's experience, not the experience itself. A reviewer agent reviews the diff, not the running deliverable; CI runs the author's test suite, not the user's path.

```text
# DO — walk the literal user path, evidenced (verbatim command + output + disposition)
# DO NOT — "tests passed, reviewer approved, CI green → done" (none of the three is the walk)
```

Tests, reviewer approval, green CI, a traced code path, or "it compiled / parsed / loaded" are not the walk, and "the user can verify if it doesn't work" hands your job to the user.

**Why:** Primitives that pass every test in isolation still fail when composed with argument parsing, output rendering, session state, hook ordering, and next-step legibility — only the literal user walk catches these.

### 2. Receipts For The Walk Are Mandatory

The walk produces a **receipt**: verbatim command + verbatim output + the inferred user disposition (proceed / blocked / confused), embedded in the deliverable's commit message, PR description, or session notes. "Walked it, looks good" without a receipt does not count — the receipt is the only evidence the walk happened.

```text
# DO — receipt: `$ /onboard` → <verbatim output> → Disposition: next-step clear
# DO NOT — "Walked it; it works." / "Tested end-to-end. Looks good." (unfalsifiable)
```

**Why:** "Walked it, looks good" is unfalsifiable — the next reader cannot verify the walk happened, what the output was, or whether the disposition was correct; the receipt turns a claim into evidence.

### 4. Prose Deliverables (Rules, Commands, Skills) Have A Walk Too

For rule / command / skill files, the walk is: the file loads under the actual CLI runtime; frontmatter parses; paths resolve; the rule's claims about its own behavior are verified end-to-end; the DO/DO-NOT examples render in the real CLI surface; the patterns the rule forbids are caught when matched against fixture scenarios.

```text
# DO — prose walk: rule loaded under the CLI, frontmatter parsed, fixture's forbidden pattern caught as expected
# DO NOT — "Wrote the rule. All sections present. Done." (authoring ≠ the user's experience)
```

**Why:** Rules and commands are deliverables the user invokes; "the file exists and the prose looks right" is not the user's experience — the rule firing at a real gate, or the command rendering real output, is.

### 6. Scrub Receipts Before Embedding In Public-Surface Artifacts

Scrub verbatim receipts (MUST-2) of secrets, credentials, and PII (`.claude/rules/security.md`, the no-secrets-in-logs rule) before embedding them in PR descriptions, commit messages, journal entries, or session notes. A receipt's evidential value is its **structural shape** (sections present, errors absent, next-step legible), not the raw bytes — a scrubbed receipt that preserves the shape is valid; a verbatim dump exposing a real credential is not acceptable.

```text
# DO — scrubbed receipt: user identity + result, no raw secret
# DO NOT — verbatim: jane.doe@example.com / sk-prod-XXXXXX
```

**Why:** Once a secret is committed to git history, redaction afterward is partial at best — the commit stays in history and any clone made before the fix keeps the original.

### 7. Write / Side-Effecting Surfaces Need Boundary-Injected Fixtures Per Failure-Mode Class

When a deliverable writes or causes a side effect (mutates state, emits to an external target, takes a consequential action beyond its return value), the walk (MUST-1) includes automated fixtures that inject that boundary and exercise each failure-mode class — **(a)** refusal at the boundary, **(b)** exception mid-operation, **(c)** corrupt / partial persisted state on re-entry, **(d)** unauthorized / out-of-envelope action — not only the pure-function core. A green unit suite over the pure core is not convergence evidence for the write surface; a fixture that is green while asserting the wrong invariant is a covered failure, not a pass.

```text
# DO — one injected-boundary fixture per class (a)-(d): refused → no partial land; mid-run exception → full rollback; corrupt state → refuse-to-start; unauthorized → blocked before the boundary
# DO NOT — "unit fixtures pass over the pure core → converged" (every fixture sat on the safe side of the boundary)
```

**Why:** Defects concentrate at the I/O boundary while a pure-core suite reports green on the safe side of it — boundary injection per failure-mode class is the only fixture shape that makes write-surface regressions mechanically detectable.

The walk remains the last gate before "done" even when every earlier gate is green. When the walk surfaces a failure mode, fix it; a passing test next to a broken walk is not done.

### 8. A Release / Verification Gate Drives The Un-Pre-Configured Real-Consumer Path

When a gate verifies a deliverable by driving it — a release first-act gate, an install-and-invoke check, an integration walk — drive the path a real, un-pre-configured consumer hits: the consumer arrives without the system pre-seeded into the happy state. A gate that seeds the config / keys / fixtures the real consumer supplies at runtime, drives only that happy path, and reports PASS is walking a substitute path (see MUST NOT below). The gate also drives **(a)** the un-pre-configured cold entry, **(b)** the real provider / format / dialect variants the consumer uses, and **(c)** the error / boundary paths (MUST-7's failure-mode classes). A pre-configured happy walk alone does not verify the deliverable.

```text
# DO — install the published artifact, do NOT pre-seed the consumer's runtime state, drive
#      cold-entry + a real RS256 provider + the boundary paths → receipt
# DO NOT — pre-seed the exact config the callback needs, drive good-vs-bad state, report PASS
#      (a real un-seeded consumer then hits every defect that walk sat on the safe side of)
```

"Seeding the config is just test setup" and "my fixture's provider is the same as the consumer's" are the two usual ways this slips; check both.

**Why:** A gate that seeds the exact runtime state the real consumer supplies drives a path no consumer ever walks — it sits on the safe side of every defect a cold, real-provider consumer hits.

## MUST NOT

- Declare a deliverable "done" / "complete" / "shipped" / "landed" / "ready" without the walk. **Why:** that is the failure this rule exists to prevent.
- Substitute "the reviewer agent approved" or "CI passed" for the walk. **Why:** review agents check the diff for known failure modes; CI runs the author's test suite — neither invokes the deliverable through the user's literal path.
- Submit a PR description that says "tested" without verbatim command + output receipts. **Why:** "tested" without a receipt is unfalsifiable.
- Walk a substitute path (a similar command, a previous version, a fixture) instead of the actual user-facing path. **Why:** substitutes verify the substitute; the failure modes the user hits live on the actual path.

## Enforcement

No hook checks this automatically — no Stop hook checks a "done" claim for a receipt, and `.harness/bin/check-browser-walk-receipts.mjs`
(run from `.harness/phases/implement.md` and `.harness/phases/redteam.md`) checks only the declaration: one exact `## Verification` heading (two is `contradictory`), lines inside code fences or indented as code (four spaces or a tab) ignored, every `### Browser walk receipt` judged (any `blocked` or `confused` disposition is `walk-blocked`), a not-applicable reason of at least two words and eight letters ("no UI" fails), and exit 3 (`UNRUN`) on an empty folder. It does not check that the walk actually happened. Catching a violation of
this rule depends on the agent applying it and on review. A project that adds a hook for it
should name it here.

Origin: a directive that green tests are not the same as a verified user experience, for prose deliverables as much as for code.
