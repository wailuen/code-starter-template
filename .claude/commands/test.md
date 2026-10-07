---
name: test
description: "Testing quick reference for this project: the three test tiers, which project-profile command runs each, the no-mocking rule for integration and end-to-end tests, and example test shapes. Use when writing, running or reviewing tests."
---

# /test - Testing Strategies Quick Reference

## Purpose

Testing patterns for this project, whatever its stack. The concrete commands live in
`.harness/guides/project-profile.md`; this command is the strategy reference.

## Test Commands

Run the commands recorded in the project profile's § Commands — never guess one:

| Purpose | Profile row | Mocking |
| --- | --- | --- |
| Fast: unit tests only | Unit tests (Tier 1) | Allowed |
| Integration against real, throwaway services | Integration tests (Tier 2) — plus "Database migrate (test)" first when the project has a database | **Prohibited** |
| Full user journeys through the real app | End-to-end tests (Tier 3) | **Prohibited** |
| Everything CI runs | Local CI parity | — |

Any no-mocking guard for Tier 2/3 the project has is listed in the profile's § Mechanical
checks. A row still marked `<unset>` is a question for the user.

**Default to the narrowest command that exercises your change.** Run the Local CI parity command before the first push of a branch (`git.md` § Pre-FIRST-Push CI Parity Discipline).

## Quick Reference

| Command       | Action                                      |
| ------------- | ------------------------------------------- |
| `/test`       | Load testing patterns and tier strategy     |
| `/test tier1` | Show unit test patterns (mocking allowed)   |
| `/test tier2` | Show integration test patterns (NO MOCKING) |
| `/test tier3` | Show E2E test patterns (NO MOCKING)         |

## What You Get

- 3-tier testing strategy
- No-mocking enforcement (Tier 2-3), checked by the project's no-mock guard when it has one
- Real infrastructure patterns (real database, real HTTP, throwaway per run)
- Coverage requirements

## 3-Tier Strategy

| Tier   | Type        | Mocking        | Focus                  | Infrastructure                         |
| ------ | ----------- | -------------- | ---------------------- | -------------------------------------- |
| Tier 1 | Unit Tests  | ALLOWED        | Isolated functions     | None                                   |
| Tier 2 | Integration | **PROHIBITED** | Component interactions | Real, throwaway services per test run  |
| Tier 3 | E2E         | **PROHIBITED** | Full user journeys     | Real app + real services, driven like a user |

## Quick Pattern — Illustration

The samples below use TypeScript (Vitest + Playwright) for illustration only; write the same
shape in the project's language and test runner.

```typescript
// Tier 1: Unit test (mocking allowed)
import { describe, it, expect, vi } from "vitest";

describe("formatCurrency", () => {
  it("formats cents as dollars", () => {
    expect(formatCurrency(1050)).toBe("$10.50");
  });
});
```

```typescript
// Tier 2: Integration test — real, throwaway database (NO MOCKING)
import { describe, it, expect } from "vitest";
import { getTestDb } from "./helpers/db";

describe("createUser", () => {
  it("persists a user and is readable back", async () => {
    const db = getTestDb();
    const user = await createUser(db, { email: "a@example.com" });
    const found = await db.query("SELECT * FROM users WHERE id = $1", [
      user.id,
    ]);
    expect(found.rows[0].email).toBe("a@example.com");
  });
});
```

```typescript
// Tier 3: E2E test — Playwright, real app, real DB (NO MOCKING)
import { test, expect } from "@playwright/test";

test("user can sign up and see the dashboard", async ({ page }) => {
  await page.goto("/signup");
  await page.fill('[name="email"]', "new@example.com");
  await page.click('button[type="submit"]');
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
```

## No Mocking in Tier 2-3

```typescript
// PROHIBITED in Tier 2/3 test roots (illustration: TypeScript mocking calls)
vi.mock(...)          // BLOCKED
vi.fn()                // BLOCKED as a stand-in for a real dependency
jest.mock(...)         // BLOCKED
// Same for any language: no patched modules, no fake database pool, no simulated API responses.
```

If the project has a no-mock guard script, it is listed in the project profile's § Mechanical checks and fails the build when a mocking call appears in a Tier 2/3 test root; without one, review enforces this.

## Agent Teams

For sizeable test work, these agents can split it (a small change doesn't need a team — `.harness/rules/agent-delegation.md`):

- **testing-specialist** — 3-tier strategy, test architecture, coverage requirements, browser-driven E2E generation
- **tdd-implementer** — test-first implementation for work that is neither server-side nor UI
- **reviewer** — Review test quality after writing

For validating an E2E test from a buyer/value perspective rather than a technical one, have the
reviewer or analyst cover that angle directly.

## Related Commands

- `/analyze`, `/todos`, `/implement`, `/redteam`, `/debug`, `/codify`, `/learn` — the phase commands (see `.harness/README.md`)
- `/fix` — bug intake: reproduce the bug as a failing test first, then fix it

## Rule Reference

CI-parity command set: `.claude/rules/git.md` § Pre-FIRST-Push CI Parity Discipline.
