---
priority: 10
scope: path-scoped
paths:
  - ".harness/phases/implement.md"
  - ".harness/phases/redteam.md"
  - ".harness/roles/**"
  - ".claude/agents/**"
  - "**/e2e/**"
  - "**/*.e2e.*"
  - "**/playwright*"
---

# End-To-End Testing Rules

These rules govern browser-driven end-to-end (E2E) and redteam browser runs.

### 1. Create Missing Test Records

When a record the test needs is missing (404, 403, empty response), create it through the
API or the database as test setup, then continue. Do not skip the step, call it a "gap",
or report it as "expected behavior".

**Why:** Skipping missing records produces hollow runs that never exercise the
application's real create/read/update/delete paths, hiding integration bugs until
production.

### 2. Adapt to Data Changes

Test data changes between runs. Query the API to discover the actual records before
testing; do not hardcode user emails, IDs or other test data.

**Why:** Hardcoded IDs break whenever ID generation changes, turning every test into a
false failure.

### 3. A Missing Endpoint Becomes A Todo, Not A "Limitation"

If testing needs an API endpoint that doesn't exist:

- If building it is inside the current todo's acceptance scope, build it now.
- Otherwise record it per `.harness/rules/autonomous-execution.md` § Problems found along
  the way: a `/fix` record if the accepted scope already promised that behavior (a BUG),
  otherwise a todo proposal that goes to the user through `/todos` plan approval
  (`.harness/rules/completion-criterion.md` MUST-1). Continue testing everything that
  doesn't depend on it.

Never write it off as a "limitation", and never silently expand the current task to
build it.

**Why:** A missing endpoint written off as a limitation leaves the dependent surface
untested indefinitely; building it unasked silently widens the task past what the user
accepted. A recorded todo keeps the gap visible and the scope decision with the user.

### 4. Follow Up on Failures

When an operation fails gracefully (an error is shown, nothing crashes), investigate the
root cause and fix it, or record it per Rule 3 if the fix is outside the current todo. Do
not report "graceful failure" and move on.

**Why:** A "graceful failure" often hides a caught exception or an error silently
converted to a default value — the feature stays broken behind a polished message.

### 5. Assume The Correct Role

During multi-persona testing, log in as the role each operation needs (admin for admin
actions, a restricted user for restricted views).

**Why:** Testing admin-only features as a superuser bypasses authorization entirely,
leaving permission bugs undetected until a real restricted user hits them.

### 6. Run Headed — Watch The Browser

Launch every E2E and redteam browser run with a visible browser window, using the headed
setting of the project's browser runner (the end-to-end test command in
`.harness/guides/project-profile.md`). Do not default to headless for speed.

```text
# DO — e.g. Playwright: use: { headless: false }  (the Playwright MCP tool already renders visibly)
# DO NOT — use: { headless: true }  (or omit `headless`, which defaults to true)
```

**Why:** A headless run hides rendering glitches, layout breaks and unexpected dialogs that
a headed run shows immediately.

### 7. Navigate Only As A Real User Would

Perform every step inside a browser-driven E2E/redteam test the way a real user would:
click links and buttons, fill in forms, follow the app's own navigation. Do not use a
direct navigation call (e.g. Playwright's `page.goto()`), `fetch()`, `curl` or any direct
backend call to jump to a page, pre-fill state, or skip a step the test exercises. The
only exceptions are the single initial page load that opens the session (the app's home
or login URL) and following a link a user would genuinely open from outside the app
(e.g. an emailed verification link).

Backend/API calls remain fine for unrelated test-data setup performed before the test
starts (seeding a fixture user, resetting a database).

```text
# DO — click through the actual flow (Playwright shown; same principle for any runner)
await page.click('[data-testid="login-link"]');
await page.fill('[data-testid="email-input"]', "user@example.com");
await page.click('[data-testid="submit-btn"]');

# DO NOT — jump straight to the destination or fake it via API
await page.goto("/dashboard");                 # skips the login flow being tested
await fetch("/api/login", { method: "POST" });  # proves the backend works, not the UI
```

**Why:** Jumping to a URL or calling the API proves the backend works, not that a real user
can reach that state — the gap that lets a broken link, a missing button or a stuck form
ship unseen.

## Pre-E2E Checklist

- Every part of the app running (the project profile's start command)
- Configuration (e.g. `.env`) loaded and verified
- Required users, resources and access records exist (query the API, create if missing)
- Browser launches headed (visible), not headless
