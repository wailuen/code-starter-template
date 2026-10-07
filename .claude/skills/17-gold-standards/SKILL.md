---
name: 17-gold-standards
description: "Mandatory code and documentation gold standards any project adopts and then specializes: single parameterized database-access module, no secrets in code (.env + .env.example), structured logging, explicit config, expected negatives as values, real-infrastructure tests, documentation tiers. Use when writing or reviewing data access, configuration, logging, tests or docs."
---

# Gold Standards

The patterns every change is checked against. These are not style preferences — each one has a
mechanical check behind it or a failure mode that has to be prevented by convention because no
check can see it.

**Adopt, then specialize.** These standards are stack-neutral. Each project records how it meets
them in `.harness/guides/project-profile.md`: the commands in § Commands, the guard scripts in
§ Mechanical checks, the config source in § Configuration, the test infrastructure in § Test
infrastructure. Where a standard says "**Checked by:**", the check is whatever the profile lists
for it; if the profile has no such row, the standard is enforced by review only — say so.
Code snippets are illustrative and shown in more than one language where the idiom differs.

Authoritative context: `workspaces/<project>/docs/adr/` for stack decisions (start with the first
ADR, the system-architecture record) and `workspaces/<project>/specs/` for behavioural contracts.
If a project has not created them yet, the brief under `workspaces/<project>/briefs/` is the
authority for what the product does until `/analyze` produces them.

## Progressive Disclosure

| Question                                                        | Read                                     |
| --------------------------------------------------------------- | ---------------------------------------- |
| "What are the code patterns?"                                   | this file                                |
| "How should docs, ADRs, and specs be written?"                  | `gold-documentation.md`                  |
| "How do I validate a doc's code examples and cross-references?" | `documentation-validation-patterns.md`   |
| "Which mechanical check covers this?"                           | `skills/16-validation-patterns/SKILL.md` |

## Code Standards

### 1. Language-specific conventions belong in the project profile

Every language has load-bearing conventions that the type checker or runtime enforces in ways a
newcomer gets wrong (module resolution, import style, packaging layout). Record them once in the
project profile (or an ADR it links to), name the command that checks each, and review against
that list — do not re-derive them per change.

```ts
// Illustrative (TypeScript, "module": "NodeNext") — relative imports carry the .js extension
import { openTenantSession } from "../db/session.js";   // DO — what Node resolves at runtime
import { openTenantSession } from "../db/session";      // DO NOT — resolves in the editor, fails at runtime
```

```python
# Illustrative (Python, src layout) — import through the package, never via sys.path hacks
from app.db.session import open_tenant_session   # DO
sys.path.insert(0, "../db"); import session       # DO NOT — works locally, breaks when installed
```

**Checked by:** the project profile's "Type / static check" command and the test runner's
collection step.

### 2. Single Database-Access Module

Exactly one module acquires database connections and imports the database driver — the choke
point. No other file may import the driver. The connection pool is a private module-level
binding with no exported accessor, so "never export the pool" holds by construction rather than
by review. Every caller goes through the choke point's public functions.

```ts
// Illustrative (TypeScript) — DO: every caller goes through the choke point
await openTenantSession(tenantId, async (db) => {
  const rows = await db.query("select id from documents where id = $1", [docId]);
});

// DO NOT — a second pool bypasses whatever scoping the choke point applies
import { Pool } from "pg";
```

```python
# Illustrative (Python) — DO
with open_tenant_session(tenant_id) as db:
    rows = db.query("select id from documents where id = %s", (doc_id,))

# DO NOT — a second engine/connection outside the choke point
import psycopg
conn = psycopg.connect(os.environ["DATABASE_URL"])
```

**Checked by:** a dependency-boundary check (for example dependency-cruiser, import-linter,
depguard) listed in the project profile § Mechanical checks.

**Why:** The choke point is where cross-cutting guarantees live — per-request security context
(for example setting the current tenant transaction-locally before a row-level policy is
evaluated, so a pooled connection never carries a value left over from a previous request),
timeouts, credential handling, audit. A second connection path skips all of it, and every query
it runs is unscoped.

### 3. All queries are parameterized

```ts
// Illustrative (TypeScript) — DO
db.query("select id from documents where tenant_id = $1", [tenantId]);
// DO NOT — user input becomes executable SQL
db.query(`select id from documents where tenant_id = '${tenantId}'`);
```

```python
# Illustrative (Python) — DO
db.execute("select id from documents where tenant_id = %s", (tenant_id,))
# DO NOT
db.execute(f"select id from documents where tenant_id = '{tenant_id}'")
```

The same applies to any query language with string interpolation risk (search DSLs, shell
commands, LDAP filters).

**Checked by:** review + `rules/security.md` § Parameterized Queries, unless the project profile
lists a lint rule for it. Where no check exists, reviewers check it explicitly.

### 4. Expected Negatives Are Values

An _expected_ negative outcome (not found, refused, not permitted, invalid input) is returned as
a typed value the caller must handle — a discriminated union, a result type, a sealed class, a
`(value, err)` pair — never a bare `null`/`None` or an exception thrown for control flow.

```ts
// Illustrative (TypeScript) — DO: the caller cannot ignore the negative case
export type TenantResolution =
  | { readonly resolved: true; readonly tenantId: string }
  | { readonly resolved: false; readonly reason: string };

// DO NOT — a bare `string | null` loses the reason and invites a silent default
function resolveTenant(): string | null;
```

```python
# Illustrative (Python) — DO
@dataclass(frozen=True)
class Resolved:   tenant_id: str
@dataclass(frozen=True)
class Unresolved: reason: str
TenantResolution = Resolved | Unresolved

# DO NOT
def resolve_tenant() -> str | None: ...
```

Consume the result exhaustively, so a future variant is a type error rather than a silently
absorbed case — TypeScript `switch` with a `never` default, Python `match` with
`assert_never()`, Kotlin `when` over a `sealed` type without `else`:

```ts
switch (r.resolved) {
  case true:
    return r.tenantId;
  case false:
    return refuse(r.reason);
  default: {
    const _e: never = r;
    return _e;
  }
}
```

**Why:** An exception thrown for an _expected_ outcome gets caught somewhere generic and turned
into a default. A `null` gets passed through to a function that validates it and fails late — by
which point the contract has already failed to do its one job, which was to refuse before any
work was attempted. Unexpected failures (bugs, infrastructure down) remain exceptions.

### 5. Logging goes through the structured logger, never ad-hoc prints

```ts
// Illustrative (TypeScript) — DO
logger.info("server.start", { port });
// DO NOT
console.log(`server started on ${port}`);
```

```python
# Illustrative (Python, structlog-style) — DO
log.info("server.start", port=port)
# DO NOT
print(f"server started on {port}")
```

Log messages are stable event names (`server.start`, `tenant.resolve.refused`), with the varying
parts in structured fields. Never log a secret, credential, token, or PII value
(`rules/security.md` § MUST NOT, "No secrets in logs").

### 6. Config is explicit and comes from the environment, never from a literal

```ts
// Illustrative (TypeScript) — DO: read, validate, fail loudly at startup
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Load .env before any database operation.");
}

// DO NOT
const connectionString = "postgres://user:pass@localhost/app";
```

```python
# Illustrative (Python) — DO
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise RuntimeError("DATABASE_URL is not set. Load .env before any database operation.")
```

Config is loaded and validated in one place at startup, not read ad hoc deep in the call stack.
Local values live in a git-ignored `.env`; every referenced variable MUST also appear (without a
value) in the committed `.env.example` (project profile § Configuration). Model names, endpoints
and feature limits are config too — never hardcode them (`.claude/rules/security.md` § No
Hardcoded Secrets applies to any config value, not only credentials).

**Checked by:** the project profile § Mechanical checks entries for config-example drift and
secret scanning, if the project has them.

### 7. Security catalogues are decided, not patched

When a project guards an invariant with a hand-maintained catalogue checked against the live
system — for example a map classifying every database table as tenant-scoped (with its explicit
discriminator column), platform-wide, or deliberately public, diffed against a list derived
from the live schema — the check is only a guarantee because the two sides come from different
processes. Adding an entry to silence a totality failure **without deciding the item's real
class** defeats the mechanism: the check goes green and the item ships under whatever policy the
wrong entry implies. Name per-item details explicitly (a tenant discriminator column is not
assumed to be `tenant_id` everywhere — the tenants table's own discriminator is its `id`).

**Checked by:** the catalogue checks listed in the project profile § Mechanical checks.

### 8. Every entry point establishes its own security context

Non-HTTP entry points — scheduled jobs, queue consumers, ingestion pipelines, sync workers, CLI
commands, tool/agent callers, public-link reads — have no session to derive identity or tenant
from. Each MUST resolve its own context explicitly and acquire data access through the single
database-access module, never through a bypass or an over-privileged service connection.

**Checked by:** an entry-point conformance check if the project profile lists one; otherwise
review.

### 9. Schema changes are ordered migrations

Schema changes are new, ordered migration files created with the project's migration tool
(project profile "Database migrate" rows). Never mutate schema from application code, and never
edit a migration that has already been applied anywhere — add a new one.

### 10. Tests follow the 3-tier model, and Tiers 2–3 use real infrastructure

| Tier            | Infrastructure                                                      |
| --------------- | ------------------------------------------------------------------- |
| 1 — unit        | none; pure logic; mocking allowed                                   |
| 2 — integration | real services (database, queue, cache), throwaway per run           |
| 3 — E2E         | the running app driven like a user (e.g. a real browser)            |

Test locations and commands are in the project profile § Identity and § Commands. Mocking is
not permitted in Tiers 2 and 3 — a mocked database cannot fail the way a real one does, and
guarantees enforced _by_ the infrastructure (constraints, row-level policies, transactions)
cannot be observed through a mock. Tier 2/3 run against real infrastructure provisioned for the
run (project profile § Test infrastructure), never a shared development or production database.

**Checked by:** a no-mock check for Tier 2/3 if the project profile lists one; otherwise review.

### 11. No stubs, placeholders, or silent fallbacks in production code

No `TODO`/`FIXME`/`STUB` markers, no empty function bodies, no empty catch/except blocks, no
"catch and return null" without logging. Frontend mock data counts as a stub. Per
`rules/zero-tolerance.md` — if a feature cannot be implemented, ask; if the answer is remove it,
delete it rather than leaving it half-wired.

## Review Checklist

- [ ] Language-specific conventions recorded in the project profile are followed
- [ ] No database-driver import outside the single database-access module
- [ ] Every query parameterized
- [ ] Expected negatives are typed values, consumed exhaustively
- [ ] No ad-hoc prints; no secrets or PII in log fields
- [ ] No config or model-name literals; new env vars added to `.env.example`
- [ ] New catalogue entries (e.g. table classifications) decided, with explicit per-item details
- [ ] New entry points establish their own security context and use the database-access module
- [ ] Schema changes are new ordered migrations
- [ ] Tier 2/3 tests use real, throwaway infrastructure
- [ ] No stubs, placeholders, or empty catch blocks
- [ ] Documentation touched by the change validated per `documentation-validation-patterns.md`

## Related

- `.harness/guides/project-profile.md` — how this project meets each standard (commands, checks, config, test infrastructure)
- `gold-documentation.md` — documentation, ADR, and spec standards
- `documentation-validation-patterns.md` — how to validate examples and cross-references
- `skills/16-validation-patterns/SKILL.md` — the mechanical gate inventory
- `.claude/rules/security.md`, `.claude/rules/zero-tolerance.md`, `.claude/commands/test.md`
