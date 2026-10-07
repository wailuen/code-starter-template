---
name: test-skip-discipline
description: "How to tell an acceptable skipped test (it genuinely cannot execute in this environment) from one that hides a broken system, for any test runner. Use when adding, reviewing or reporting skipped tests."
---

# Test-Skip Discipline

**The distinguishing rule**: skip if the test **cannot execute** (missing credentials, wrong platform, feature flag off); **fail** if the test executes but the system is broken.

Every skip (`test.skip(...)`, `pytest.skip(...)`, `@pytest.mark.skipif`, Go `t.Skip()`, JUnit `assumeTrue`) is one of two things. One is a legitimate "we cannot run this test here" gate. The other is a silent mask over a broken system — the test ran, the upstream was degraded, the skip absorbed the signal, and the runner reports green for an unknown period. The second class is BLOCKED.

## The Problem

A Playwright spec contained `test.skip(chatStatus >= 500, ...)`, which was the only reason
the spec wasn't red despite `POST /api/chat` returning 503 on every run. The skip masked the
outage for an unknown period; nobody noticed until a human filed an issue.

Any test that skips on the system-under-test's runtime behaviour silently absorbs every non-functional path — an auth failure, a rate limit, a TLS handshake problem, a local dependency not running, any upstream degradation.

Examples below are illustrative TypeScript (Playwright/Vitest) with Python (pytest) equivalents;
the rule is identical for every runner. The project's runners are listed in
`.harness/guides/project-profile.md` § Commands.

## Acceptable Skip Patterns

Skip gates that check whether the test **can execute at all** — before the system-under-test is invoked. The check is on the environment, not on the response.

### 1. `credential_absent` — Tier 2/3 Tests Requiring Real Cloud Credentials

```typescript
// DO — Playwright: skip when the credential isn't present; the test cannot execute without it.
// No `{ page }` fixture requested — this test calls an API directly, and requesting a browser
// fixture it doesn't need would launch a browser BEFORE the skip check runs, defeating the
// whole point (a missing-browser CI runner would then fail on launch, not skip on the credential).
test("bedrock claude returns a completion", async () => {
  test.skip(
    !process.env.AWS_BEARER_TOKEN_BEDROCK,
    "requires AWS_BEARER_TOKEN_BEDROCK",
  );
  // ... real upstream call; 5xx here is a FAILURE, not a skip
});
```

```typescript
// DO — Vitest: the same credential gate, Tier 2 integration
import { describe, it } from "vitest";

describe.skipIf(!process.env.AWS_BEARER_TOKEN_BEDROCK)(
  "bedrock claude completion",
  () => {
    it("returns a completion", async () => {
      // ... real upstream call; 5xx here is a FAILURE, not a skip
    });
  },
);
```

```python
# DO — pytest: the same credential gate, evaluated before the system-under-test is called
import os, pytest

@pytest.mark.skipif(not os.environ.get("MODEL_API_KEY"), reason="requires MODEL_API_KEY")
def test_model_returns_a_completion():
    ...  # real upstream call; 5xx here is a FAILURE, not a skip
```

**Why:** The test physically cannot exercise the path without the secret. A skip here does not absorb any signal about the system-under-test — the system-under-test was never called.

### 2. `feature_flag_off` — Tests Gated On Flags Not Enabled In This Run

```typescript
// DO — Vitest feature-flag gate
import { describe, it } from "vitest";

describe.skipIf(process.env.FEATURE_STREAMING_AGENT !== "1")(
  "streaming agent",
  () => {
    it("yields deltas", async () => {
      // ...
    });
  },
);
```

**Why:** If the feature isn't wired in for this run, the test has no code path to exercise. Same principle as credential-absent: the system-under-test cannot even attempt the work.

### 3. `platform_specific` — macOS-Only / Linux-Only Tests

```typescript
// DO — platform gate
test("keychain credential store", async () => {
  test.skip(process.platform !== "darwin", "keychain is macOS-only");
  // ...
});
```

**Why:** A macOS API on a Linux runner literally does not exist. The gate is on the runner's capability to execute the test, not on the result of executing it.

## BLOCKED Skip Patterns

Skip gates that check the **result of calling the system-under-test**. By the time the skip triggers, the system has already been exercised and the breakage observed — the skip is silently converting a failure into a pass.

### 1. `test.skip(status >= 500)` — Absorbs Every Upstream 5xx

```typescript
// DO NOT — silently eats every Bedrock 503, OpenAI 502, Anthropic 504
test("chatbot responds within scope", async ({ request }) => {
  const res = await request.post("/api/chat", { data: { message: "hi" } });
  test.skip(res.status() >= 500, "chatbot upstream degraded — skipping");
  // ↑ the 503 path is the exact breakage we needed to catch; the skip hides it
});

// DO — fail on 5xx, or assert < 500 before continuing
test("chatbot responds within scope", async ({ request }) => {
  const res = await request.post("/api/chat", { data: { message: "hi" } });
  expect(res.status()).toBeLessThan(500); // 5xx here = FAIL, red suite, fix upstream
  // ...
});
```

**Why:** The skip ran the system-under-test. The 5xx is the failure. Converting it to "skipped" is the exact masking pattern that hid a chatbot outage for an unknown period.

```python
# DO NOT — pytest equivalent of the same mask
def test_chat_responds(client):
    res = client.post("/api/chat", json={"message": "hi"})
    if res.status_code >= 500:
        pytest.skip("chat upstream degraded")   # BLOCKED

# DO
def test_chat_responds(client):
    res = client.post("/api/chat", json={"message": "hi"})
    assert res.status_code < 500
```

### 2. `test.skip(upstream_unavailable)` — Masks Real Integration Breakage

```typescript
// DO NOT — any skip tied to the upstream being unreachable
test("chat completion", async () => {
  try {
    await client.ping();
  } catch {
    test.skip(true, "LLM backend unreachable"); // BLOCKED
  }
  // ...
});

// DO — unreachable upstream is a failure the test should report
test("chat completion", async () => {
  const response = await client.complete({ prompt: "hi" }); // let the connection error throw
  expect(response.text).toBeTruthy();
});
```

**Why:** "Upstream unavailable" during a test that needs the upstream is not a skip condition — it is a test failure. The retry/backoff/fail logic belongs in the test, not a skip gate.

### 3. `test.skip(response.ok === false)` — Any Skip Tied To Runtime Behaviour

```typescript
// DO NOT — any form of "if the system misbehaved, skip"
test("login returns session token", async ({ request }) => {
  const res = await request.post("/api/login", { data: creds });
  test.skip(!res.ok(), "login failed — skipping dependent assertions"); // BLOCKED
  // ↑ the login regression we were supposed to catch is now invisible
});

// DO — assert on ok(), fail otherwise
test("login returns session token", async ({ request }) => {
  const res = await request.post("/api/login", { data: creds });
  expect(res.ok()).toBe(true);
  // ...
});
```

**Why:** The whole point of the test is to verify runtime behaviour. Skipping based on runtime behaviour is a contradiction — it turns every assertion the test was supposed to make into a no-op the moment the system regresses.

**BLOCKED rationalizations:**

- "The upstream is flaky, skipping prevents false negatives"
- "CI will be red too often without the skip"
- "We'll fix the upstream first, then re-enable the assertion"
- "This protects the downstream suite from transient issues"
- "The 5xx isn't a real bug, just a rate limit / deploy churn"

## 429 Rate-Limit Edge Case

Rate-limited upstreams (HTTP 429) are **BLOCKED as a skip condition**. 429 is the endpoint declining to execute this request _right now_ — but the test can execute after backoff. Skipping on first 429 hides ongoing rate-limit breakage (e.g. a bug that exhausts the token bucket on every CI run, or a quota that was silently reduced upstream).

**Acceptable:** Tier 2/3 LLM tests that retry on 429 up to N times with exponential backoff before failing.

```typescript
// DO — retry 429 with backoff, fail after N attempts
test("anthropic completion retries on rate limit", async () => {
  let response = await client.complete({ prompt: "hi" }); // always assigned before the loop
  for (let attempt = 0; attempt < 5 && response.statusCode === 429; attempt++) {
    await new Promise((r) => setTimeout(r, 2 ** attempt * 1000)); // 1s, 2s, 4s, 8s, 16s
    response = await client.complete({ prompt: "hi" });
  }
  expect(response.statusCode).toBe(200); // still rate-limited after 5 retries = FAIL
});
```

**BLOCKED:** Skip on the first 429.

```typescript
// DO NOT — first-429-skip masks the quota breakage
test("anthropic completion", async () => {
  const response = await client.complete({ prompt: "hi" });
  test.skip(response.statusCode === 429, "rate limited"); // BLOCKED
  expect(response.statusCode).toBe(200);
});
```

**Why:** A quota cut from 1000 req/min to 10 req/min surfaces as 429-on-first-call in every CI run. First-429-skip turns that ongoing breakage into a permanently-green suite; retry-then-fail turns it into a red suite the moment the rate-limit is structurally wrong rather than transiently saturated.

## Test-Runner Example Summary

| Runner     | Acceptable skip (cannot execute)                                    | BLOCKED skip (system broken)     |
| ---------- | --------------------------------------------------------------------- | --------------------------------- |
| Playwright | `test.skip(!process.env.API_KEY, "requires API_KEY")`                 | `test.skip(res.status() >= 500, "...")` |
| Vitest     | `describe.skipIf(!process.env.API_KEY)(...)` / `it.skipIf(...)`       | a skip gated on response shape inside the test body |
| pytest     | `@pytest.mark.skipif(not os.environ.get("API_KEY"), reason=...)`      | `pytest.skip(...)` after calling the system-under-test |
| Go         | `if os.Getenv("API_KEY") == "" { t.Skip("requires API_KEY") }` at the top of the test | `t.Skip()` inside an `if err != nil` after the call |
| JUnit 5    | `assumeTrue(System.getenv("API_KEY") != null)` before the call       | `assumeTrue(response.ok())` after the call |

## Detection Protocol (Used At `/redteam`)

Run these greps at every `/redteam`, against the project's test roots. Any match is a HIGH finding; review manually and either fix or exception-document. The patterns shown are for JavaScript/TypeScript and Python runners; write the equivalent for the project's runner and fire it at a known-bad fixture first.

```bash
# Playwright / Vitest — skip tied to HTTP status
rg '(test|it|describe|ctx)\.skip(If)?\(.*status.*[>=<]' tests/ tests/e2e/

# Playwright / Vitest — any skip referencing response, res, status, ok (includes Vitest's
# in-test `ctx.skip(...)`, not just the test/it/describe-level forms)
rg '(test|it|describe|ctx)\.skip(If)?\([^)]*(response|res\.|status|\.ok\()' tests/

# Any skip whose reason string names runtime/upstream behaviour rather than an environment
# precondition — catches `test.skip(true, "upstream unreachable")`, which the two greps above
# miss because it names no response/status/ok token, only describes the runtime condition in prose
rg '(test|it|describe|ctx)\.skip(If)?\([^)]*(upstream|unavailable|unreachable|degraded)' tests/

# pytest — imperative skips (every one needs a read: is it before or after the system-under-test call?)
rg -n 'pytest\.skip\(' tests/
rg -n 'pytest\.skip\([^)]*(status|upstream|unavailable|unreachable|degraded|rate.?limit)' tests/
```

**A known limit of these greps, not a gap in disguise:** none of them catch a runtime-behaviour
skip split across two lines, e.g. `if (!res.ok()) test.skip();` or `if (!res.ok) ctx.skip();`
with an empty/bare skip call — the condition and the skip call are on different lines with no
shared token a single-line regex can match. These greps are a pattern check, not a control-flow
analyzer; a manual read of every `test.skip`/`ctx.skip`/`.skip(` call site during `/redteam`
review remains the actual backstop, per `.claude/rules/instrument-discipline.md` MUST-3(b) (read
what a check actually matched, don't trust a clean grep as proof nothing is there).

Each match MUST be resolved to one of:

- **FIX**: replace the skip with an `expect(...)` / retry-then-fail.
- **RELAX**: confirm the skip is genuinely checking an environment precondition (credential / flag / platform) and rename the skip reason to make that explicit.
- **EXCEPTION**: rare; requires a linked tracking issue, a time-bounded remediation plan, and sign-off per `.claude/rules/security.md` § Exceptions.

## Related Rules

- `.claude/commands/test.md` — the tiered testing strategy. Test-skip hygiene is an extension of "tests MUST be deterministic": a skip-on-5xx turns the suite non-deterministic (green today, green tomorrow, never red despite breakage).

Origin: a chatbot returned 503 on every run; `test.skip(chatStatus >= 500)` masked it until a human filed the issue.
