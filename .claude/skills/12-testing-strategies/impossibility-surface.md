---
name: impossibility-surface
description: "Justify happy-path test gaps that a lower-layer security control makes physically unreachable. Use when a test you 'should' write cannot be executed and you need to document why so auditors don't file the missing test as a bug."
priority: HIGH
tags: [testing, security, tenant-isolation, row-level-security, layering, audit]
paths:
  - "tests/**"
  - "**/*test*"
  - "**/*spec*"
---

# Impossibility Surface

When a happy-path test for a layer cannot run because a documented security control or OS-level constraint at a *lower* layer makes it physically impossible, that test gap is an **impossibility surface**. The pattern says: write the gap down with the *reason* and a *link to where the coverage actually lives*, so future auditors don't file the missing test as a defect and the next contributor doesn't try to "fix" it by weakening the security control.

This is **not** a blanket excuse to skip tests. It is a narrow pattern for one specific situation: the test physically cannot run.

## Scope — What This Skill IS And IS NOT

**This pattern IS** a justification framework for happy-path coverage that genuinely cannot run at the layer being tested. The canonical example: a multi-tenant application whose database enforces tenant isolation with a row-level access policy (for example PostgreSQL row-level security). An application-layer test that tries to prove "a user in tenant A cannot read tenant B's rows" cannot show *why* the read came back empty. The happy path ("tenant A gets nothing back for tenant B's ID") is genuinely testable and MUST be tested; what's impossible is proving that the policy actually fired, rather than the row simply not existing, from application-layer code alone — the database filters those rows out before the query code ever sees them. That proof lives at the database layer, in a test that connects as the restricted database role directly and inspects the policy's own behavior.

The same shape appears at any defense-in-depth boundary: an OS sandbox that blocks a syscall before the app sees it, a network policy that drops a packet before the service handler runs, a gateway that strips a header before the backend reads it.

**This pattern is NOT** any of the following:

- A reason to skip **error-path tests**. Error paths are the entire reason the isolation layer exists. They MUST be exercised at every layer.
- A reason to skip **eager-validation tests** (rejecting a malformed tenant ID or missing session context before any query runs). Eager validation is fast, has no database dependency, and MUST be tested at every layer.
- A reason to skip **rejection-behavior tests** (the test that proves the security control fires). Those are the most important tests; without them the control could be silently broken.
- A reason to skip a test because the test setup is *inconvenient*, *slow*, or *requires more infrastructure than the author wants to write*. Those gaps are technical debt, not impossibility surfaces.
- A reason to skip a test because *the team hasn't gotten to it yet*. That is a TODO, not an impossibility.

**The test:** a gap is an impossibility surface only if the answer to *"what would it take to write this test?"* is *"weaken or bypass a documented security control, or run the test in an environment that doesn't exist."* If the answer is *"more time"* or *"a fixture I haven't built"*, it is not an impossibility surface.

## MUST Rules

### 1. Document The Impossibility Surface At The Top Of The Test File

When a test file deliberately omits a category of test (e.g., happy-path roundtrips) because of an impossibility surface, the file MUST open with a docstring or comment block that:

1. States WHICH category of test is missing and at this layer
2. States WHY the lower-layer control makes it impossible (named control, file/line reference if available)
3. POINTS to the file/path where the coverage actually lives at the lower layer
4. CONFIRMS that error paths, rejection behavior, and eager validation ARE covered in this file

Illustrative example (TypeScript-style comments; use the project's own test language — the content of the block is what matters):

```typescript
// DO — opens with a clear impossibility-surface declaration
/**
 * Tests for the application-layer tenant scoping in the database-access module.
 *
 * These tests do NOT attempt to prove that the database's row-level access
 * policy itself blocks a cross-tenant read — the policy is enforced inside the
 * database, below every query this module issues, so a "does the policy actually
 * filter" assertion cannot be made from application code: the query simply
 * returns zero rows whether the policy fired or the row never existed at all.
 *
 * Policy-level coverage (proving the policy itself filters) lives in:
 *     <test root>/db/row-access-policies.test.ts (connects as the restricted
 *     database role directly, bypassing this module, to inspect policy behavior)
 *
 * What THIS file covers:
 * - The tenant-scoped connection helper rejects a missing/malformed tenant context (eager validation)
 * - A query issued without a tenant context throws before reaching the database
 * - A query issued for a nonexistent tenant ID returns an empty result, not an error
 */

// DO NOT — silently omit the "why no cross-tenant happy path" explanation
/** Tests for the database-access module. */
test("rejects missing tenant context", () => { ... });
test("returns empty for unknown tenant", () => { ... });
// (where's the test proving cross-tenant reads are blocked? auditor files a HIGH finding)
```

**Why:** Without the docstring, the next auditor running coverage analysis sees "no test proving the row-level policy blocks a cross-tenant read at the application layer" and files it as a HIGH gap. They then waste hours either re-writing the test (which fails for the same reason) or trying to query with elevated privileges to "make it work" (which defeats the isolation model). The docstring is the cheapest possible defense against repeat-discovery.

### 2. Link Both Directions

The lower-layer test file (where the happy paths live) MUST also have a comment near the fixture pointing back to the higher-layer test file, so anyone editing the security control sees both places that depend on it.

```typescript
// DO — bidirectional cross-reference in the lower-layer (database) test file
// NOTE: This is the ONLY place that proves the row-level policy actually filters
// cross-tenant rows (queries here run as the restricted database role directly,
// bypassing the app layer). <test root>/db/tenant-scoping.test.ts cannot reach
// this proof — from application code, "the policy blocked it" and "the row
// doesn't exist" look identical. If you change a policy, review both files together.
test("tenant A's role cannot select tenant B's row even by primary key", async () => { ... });

// DO NOT — fixture with no reference back to the application-layer constraint
test("policy blocks cross-tenant select", async () => { /* ... */ });
// (the next person "simplifying" the database-access module breaks the app-layer
//  tests and doesn't know to check this file for the actual security proof)
```

**Why:** Single-direction documentation rots the moment the lower-layer file is refactored. Bidirectional cross-references are the structural defense against drift.

### 3. The Impossibility Must Be Verified, Not Assumed

Before declaring a test "impossible at this layer" the author MUST attempt to write it once and observe the actual failure. Document the failure mode (which security control, which line, which behavior). "I think the policy would block this so I won't try" is BLOCKED.

```typescript
// DO — verified impossibility, observed failure mode
// Attempted <date>: tried to prove the row-level policy fired (vs. the row not
// existing) by querying tenant B's row through the tenant-scoped helper as
// tenant A and inspecting the query plan. Result: the application's database
// role has no visibility into the policy's internal decision — the driver
// returns an empty result set identically for "filtered by policy" and "no such
// row". Confirmed by inserting a known tenant-B row, then re-running the same
// query as tenant A: still empty, with no distinguishing signal available above
// the database layer. The distinguishing test (`tenant A's role cannot select
// tenant B's row even by primary key`) lives in
// <test root>/db/row-access-policies.test.ts, querying as the restricted role directly.

// DO NOT — assumed impossibility, no verification
// (no comment, just "doesn't make sense to test this here")
```

**Why:** Assumed impossibilities are how real test gaps get hidden. A short experiment confirms whether the gap is genuine and produces the exact reference the docstring needs.

## MUST NOT

- Cite "impossibility surface" to skip an **error-path test**

**Why:** Error paths are testable at every layer (the error itself is the assertion). Skipping an error-path test by citing an impossibility surface is exactly the rationalization this skill exists to prevent.

- Cite "impossibility surface" to skip an **eager-validation test** (rejecting bad input before any query runs)

**Why:** Eager validation runs before the query reaches the database — it never reaches the lower-layer security control, so the security control cannot make it impossible.

- Cite "impossibility surface" to skip a **rejection-behavior test** that proves the security control fires

**Why:** Rejection tests ARE the test of the security control. Skipping them means the control could silently break and nothing would notice.

- Use "impossibility surface" as a synonym for "I haven't written this yet"

**Why:** That is a TODO. Mark it as a TODO and either fix it or convert it to a real impossibility surface with the verified failure mode.

**BLOCKED rationalizations:**

- "The lower layer covers it, so we don't need it here"
- "It would be redundant to test it at both layers"
- "The test would just exercise the security control, not the new code"
- "Setting up a real database (or other real lower-layer service) at this layer is too much work"
- "The team hasn't gotten to it yet"

## Cross-References

- `.claude/commands/test.md` — the tiered testing strategy; impossibility surfaces are exceptions to per-tier coverage that MUST be documented, not silently skipped.
- `.claude/skills/test-skip-discipline/SKILL.md` — when a test that cannot execute may be skipped, and when a skip is hiding a broken system.
- `.claude/skills/17-gold-standards/SKILL.md` — the review checklist a documentation/code-quality pass checks against; impossibility-surface declarations should be consulted before filing a coverage gap.
- `.harness/guides/project-profile.md` § Test infrastructure — how the lower-layer test gets its own throwaway real database/service.

Origin: written for a multi-tenant application whose database enforced tenant isolation with row-level policies, where an application-layer test cannot distinguish "the policy filtered this row" from "this row doesn't exist" — that distinguishing proof can only be made by querying as the database role directly, one layer below the application code.
