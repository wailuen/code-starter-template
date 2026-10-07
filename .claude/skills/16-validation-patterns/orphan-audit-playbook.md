# Orphan Audit Playbook

There's no separate `orphan-detection` rule in this harness — this file is the standalone
authority: what "orphaned code" means, why it matters, and the actual procedure to find it —
what to run, in what order, against the project's own tooling.

**The core rule, stated once:** code that exists but is never called from a real entry point is
a stub wearing a working-code costume — it passes review because it reads correctly, and passes
tests because tests import it directly, but no user-facing path ever reaches it. Find it by
enumerating exported symbols and checking each one for a production call site.

An orphan is code that compiles, exports cleanly, and passes its unit tests, while nothing on
the production path ever calls it. The security, audit, or correctness promise it was written
to deliver never executes. Unit tests cannot detect this: they _are_ the caller.

**Stack note.** Source roots, test roots and every command come from
`.harness/guides/project-profile.md` (§ Identity, § Commands). The snippets below are
illustrative — TypeScript and Python are shown side by side where the syntax differs; adapt the
patterns to the project's language.

## Detection Protocol

Six detection steps, then a disposition. Runs as part of `/redteam` and `/codify`.

### Step 1 — Classify the artifact before auditing it

The audit surface depends on the artifact class, and running the wrong audit manufactures
false positives.

- **Application** (a service, web app, CLI or worker started from its own entry point) — the hot
  path is INTERNAL. An orphan is a symbol with no in-repo production call site.
- **Library** (a package consumed by name from outside its own tree) — the consumer IS the call
  site. An orphan is a symbol absent from the public entry point, or one no Tier 2 / wiring test
  imports through the package name.

Record which class the project is in the project profile § Identity ("Application shape"). For
an application, audit for internal call sites, not export-surface presence.

### Step 2 — Enumerate the candidate surface

Candidates are the constructs that carry a behavioural promise: resolvers, services, executors,
registries, connection helpers, policy checkers, guards.

```bash
# Illustrative — TypeScript: exported classes and exported factory/verb functions
grep -rnE '^export (class|abstract class) ' <source-root>/
grep -rnE '^export (async )?function (create|make|build|resolve|check|verify|enforce)' <source-root>/
grep -rnE '^export const [A-Za-z]+ = \{' <source-root>/      # const objects acting as services

# Illustrative — Python: public top-level classes and verb functions
grep -rnE '^class [A-Z]' <source-root>/
grep -rnE '^(async )?def (create|make|build|resolve|check|verify|enforce)' <source-root>/
```

Fire the matcher at a known-answer file first, so an empty result means "none" rather than
"the pattern never worked here" (`rules/instrument-discipline.md` MUST-3):

```bash
grep -cE '^export ' <a-file-you-know-exports-something>   # non-zero ⇒ the matcher fires in this tree
```

### Step 3 — Prove a production call site for each candidate

For every symbol from step 2, find at least one caller that is **not** a test and **not** the
declaring file.

```bash
sym=openTenantSession
decl=$(grep -rlE "(export .*|def |class )${sym}\b" <source-root>/)
grep -rnw "${sym}" <source-root>/ | grep -vF -- "${decl}"   # drop the declaring file(s)
```

Read the hits. A hit inside a tooling directory (scripts, one-off maintenance commands) is a
caller, but a _tooling_ caller — note it, and keep looking for one on the request / ingestion /
scheduled path. A symbol whose only non-test references are its own re-export is an orphan.

```bash
# The negative case a sweep must be able to produce
grep -rnw "SomeResolver" <source-root>/ | grep -v '/some_resolver\.\|/some-resolver\.'
# empty ⇒ declared, exported, never called ⇒ HIGH finding
```

### Step 4 — Prove a Tier 2 test drives it through the real seam

A Tier 1 test that constructs the class directly proves the class works. It does **not** prove
the system calls it. For each wired symbol, confirm a Tier 2 test exercises it through the
surface a caller actually uses, against real infrastructure provisioned for the run (the
project profile's "Integration tests (Tier 2)" command and § Test infrastructure — never a
shared development database).

```ts
// Illustrative (TypeScript) — DO: Tier 2 drives the real seam; the isolation guarantee is observable
it("cannot read another tenant's rows through the ordinary connection path", async () => {
  await openTenantSession(tenantA, async (db) => {
    const rows = await db.query("select id from documents");
    expect(rows.map((r) => r.id)).not.toContain(tenantBDocumentId);
  });
});

// DO NOT — Tier 1 in isolation; proves the helper CAN scope, not that callers USE it
it("builds the tenant-scoping statement", () => {
  expect(buildTenantScopeStatement(tenantA)).toContain("tenant_id");
});
```

```python
# Illustrative (Python) — same shape
def test_cannot_read_other_tenants_rows(real_db):
    with open_tenant_session(real_db, tenant_a) as db:
        ids = [r.id for r in db.query("select id from documents")]
    assert tenant_b_document_id not in ids
```

Both matter — but only the first one fails when a caller stops routing through the choke point.

### Step 5 — Sweep the whole test corpus for stale references

Three sweeps, all against the ENTIRE corpus, never the CI-selected subset:

```bash
# (a) A removed symbol still imported by a test → collection failure
grep -rn "RemovedSymbolName" <test-root>/ <source-root>/

# (b) A now-implemented stub still asserted as unimplemented
grep -rniE "not implemented|NotImplemented" <test-root>/

# (c) A changed default still pinned by an old assertion
grep -rn "<old-default-value>" <test-root>/ <source-root>/ workspaces/<project>/specs/
```

Sweep (c) is the one most often skipped, because CI can be fully green while it fails —
separate test projects, the end-to-end runner, and any config-gated suite each select a
different file set. "CI green" is not "corpus green".

### Step 6 — Run the collection gate

Every test file must _load_, independently of whether its assertions pass. One unresolvable
import can abort collection for the whole project.

Run the test runner's collect/list-only mode for every test surface, plus the static type check
from the project profile. Illustrative collect-only commands:

| Language / runner  | Collect without running                 |
| ------------------ | --------------------------------------- |
| Python / pytest    | `pytest --collect-only -q`              |
| TypeScript / Vitest | `npx vitest list --config <config>`    |
| TypeScript / Jest  | `npx jest --listTests`                  |
| Go                 | `go test -run '^$' ./...` (compiles every test package) |
| Playwright (E2E)   | `npx playwright test --list`            |

Before banking this gate as evidence, confirm it can fail: a test file importing a non-existent
module should make the collect step exit non-zero and the static type check report an
unresolved import; with the file removed both should exit 0. That is what makes this gate
evidence rather than ceremony. Full per-surface mechanics: § Sub-Package Collection-Gate
Patterns.

### Disposition

| Finding                                                                                | Severity | Action                                                                    |
| -------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| Exported symbol, no production call site, carries a security/audit/correctness promise | HIGH     | Wire it, or recommend deletion and ask the owner; never leave a stub     |
| Wired symbol with Tier 1 coverage only                                                 | MED      | Add the Tier 2 test that drives the real seam                             |
| Symbol reachable only from tooling scripts                                             | MED      | Confirm that is the intended surface; record it, or wire the runtime path |
| Test importing a removed symbol                                                        | BUG      | Delete or port the test in the same commit                                |
| Deferral test asserting a now-implemented stub                                         | BUG      | Rewrite it into real coverage in the same commit                          |
| Stale assertion pinning a changed default                                              | BUG      | Update in the same PR as the default change                               |

For an unwired symbol, recommend deleting it and ask the owner before deleting
(`.claude/rules/verify-resource-existence.md` MUST-3, `.claude/rules/zero-tolerance.md` Rule 6);
never delete it silently and never replace it with a stub. Once the owner agrees, it is
**deleted, not deprecated**: a deprecation banner or a feature flag leaves the symbol
importable, so consumers keep building on a promise that never executes. (A surface
exposed to external callers — an HTTP endpoint, a published API — follows the deprecation path
in `.claude/rules/zero-tolerance.md` Rule 6a instead.) Per
`.claude/rules/product-completion-first.md` MUST-1 the category — not the severity — gates the
lane: a BUG row is fixed now regardless of how small it looks.

## 2a — Crypto-Pair Round-Trip Through The Facade

Paired operations (`encrypt`/`decrypt`, `sign`/`verify`, `seal`/`unseal`, `redact`/`reveal`,
`serialize`/`parse`) are the orphan pattern at a smaller scale: each half is the other half's
only real consumer, so isolated unit tests can both pass while the pair is broken.

The failure pattern: a unit test for `encrypt` asserts the output is not the plaintext. A unit
test for `decrypt` feeds it a fixture ciphertext captured months ago. Someone changes the cipher
mode on the encrypt side only. Both tests still pass — the encrypt test never decrypts, and the
decrypt test never encrypts. Every new value written is unreadable, and nothing goes red until
production reads one back.

The defence is a Tier 2 test that round-trips through the facade both halves are reached
through, asserting equality end to end:

```ts
// Illustrative (TypeScript) — DO: round-trip through the real seam; drift in either half fails
it("round-trips a stored secret through the real encryption path", async () => {
  const plaintext = "tenant-scoped-credential-value";
  const stored = await credentialStore.put(tenantA, "connector-key", plaintext);
  const read = await credentialStore.get(tenantA, stored.id);
  expect(read).toBe(plaintext);
});

// DO NOT — two isolated halves, neither exercising the other
it("encrypts", () => expect(encrypt(pt)).not.toBe(pt));
it("decrypts", () => expect(decrypt(FIXTURE_CIPHERTEXT)).toBe("known"));
```

A captured-fixture test is not worthless — it pins the on-disk format against silent breaking
changes. Keep it **and** add the round-trip. The round-trip catches drift; the fixture catches
format migration. Neither substitutes for the other.

## 4a — Deferral-Test Sweep When A Stub Is Implemented

Mirror of the removed-API sweep. When a PR replaces a deferred stub with a real implementation,
every test asserting the _deferred_ behaviour flips from pass to fail.

```ts
// Illustrative (TypeScript) — the scaffold-era test that now fails
it("is not implemented yet", () => {
  expect(() => resolveScheduledRunTenant(runId)).toThrow(/not implemented/);
});
```

```python
# Illustrative (Python) — same stale claim
def test_not_implemented_yet():
    with pytest.raises(NotImplementedError):
        resolve_scheduled_run_tenant(run_id)
```

Once the function works, that test fails on every job in the matrix — and it surfaces at CI
time, on the release PR, when it is most expensive.

```bash
# Run at implementation time, before pushing — O(seconds)
sym=resolveScheduledRunTenant   # or resolve_scheduled_run_tenant
grep -rn "${sym}" <test-root>/ | grep -iE "not.?implemented|toThrow|raises|todo|skip"
```

The same commit that lands the implementation MUST delete or rewrite each hit, adding real
coverage in its place. Skipped and todo-marked tests count (`it.skip`, `it.todo`,
`@pytest.mark.skip`, `t.Skip()`): a skipped assertion of deferred behaviour is the same stale
claim, just quieter — see `skills/test-skip-discipline/` for the skip contract.

Why this lands late without the sweep: the matrix runs the full suite across every job, so one
stale deferral test reddens every job at once, and the diagnosis cost is paid per job. The grep
above costs seconds at authoring time; the CI round costs minutes plus a reviewer cycle.

## 4b — Error-Contract Refactor

A refactor that changes _how_ a failure is signalled — a thrown exception becoming a returned
result type, an error class being renamed, a discriminated union gaining a variant — orphans
every consumer that still handles the old shape. The old handler compiles, is never entered, and
the failure it existed to catch now flows past it silently.

Projects that model expected negatives as values rather than exceptions (see
`skills/17-gold-standards/SKILL.md` § Expected Negatives Are Values) are especially exposed. An
illustrative TypeScript union:

```ts
export type TenantResolution =
  | { readonly resolved: true; readonly tenantId: string }
  | { readonly resolved: false; readonly reason: string };
```

When a union like this gains or renames a variant, sweep three things in the same PR:

```bash
# 1. Every consumer that discriminates on the union
grep -rn "\.resolved" <source-root>/ <test-root>/

# 2. Every catch/handler keyed to a renamed error class
grep -rnE "OldErrorName|instanceof [A-Z][A-Za-z]*Error|except [A-Z][A-Za-z]*Error" <source-root>/ <test-root>/

# 3. Exhaustiveness — the type checker is the instrument
<Type / static check command from the project profile>
```

A static checker catches the exhaustiveness half **only** when the consumer is written so that
an unhandled variant is a type error — TypeScript: a `switch` on the discriminant with a
`never`-typed default; Python (mypy/pyright): `match` with `assert_never()` in the fallback arm;
Kotlin: a `when` expression over a `sealed` type with no `else`. If consumers use
`if (x.resolved)` with a bare `else`, adding a third variant compiles clean and routes the new
case into the old else-branch. That silent routing is the orphan: the new variant's handler is
never written, and the old branch quietly absorbs it.

```ts
// Illustrative (TypeScript) — DO: exhaustive, so a new variant is a compile error at every consumer
function describe(r: TenantResolution): string {
  switch (r.resolved) {
    case true:
      return r.tenantId;
    case false:
      return r.reason;
    default: {
      const _exhaustive: never = r;
      return _exhaustive;
    }
  }
}

// DO NOT — a bare else silently absorbs every future variant
if (r.resolved) return r.tenantId;
else return r.reason; // a third variant lands here, unhandled, forever
```

```python
# Illustrative (Python 3.11+, checked by mypy/pyright) — DO: exhaustive match
from typing import assert_never

def describe(r: Resolved | Unresolved) -> str:
    match r:
        case Resolved():
            return r.tenant_id
        case Unresolved():
            return r.reason
        case _:
            assert_never(r)
```

Disposition: an error-contract change ships with its consumer sweep in the same PR, or it is not
done. A follow-up issue for "update the remaining handlers" leaves the old shape live.

## Sub-Package Collection-Gate Patterns

The collection gate (Detection Protocol step 6) cannot always be a single invocation. Test
projects that need different environments — different setup files, different globals, live
infrastructure for one and not the other — have to be collected separately, because the
environment one project requires is exactly what makes the other unable to load.

A typical project has three test surfaces, each with its own configuration or marker:

| Surface            | Environment                                                        |
| ------------------ | ------------------------------------------------------------------ |
| Tier 1 unit        | none                                                               |
| Tier 2 integration | throwaway real services, provisioned per § Test infrastructure    |
| Tier 3 E2E         | running app + real browser/client                                 |

Iterate the gate per surface, and fail on the first non-zero exit. Illustrative script — fill
the `surfaces` array with the project's own collect-only commands:

```bash
#!/usr/bin/env bash
set -euo pipefail

# One collect-only command per test surface (see the table in Step 6).
surfaces=(
  "npx vitest list --config vitest.unit.config.mts"        # e.g. Tier 1 (TypeScript)
  "pytest --collect-only -q tests/integration"             # e.g. Tier 2 (Python)
  "npx playwright test --list"                             # e.g. Tier 3
)

fail=0
for cmd in "${surfaces[@]}"; do
  echo "=== collect: ${cmd} ==="
  if bash -c "${cmd}" >/dev/null; then
    echo "OK   ${cmd}"
  else
    echo "FAIL ${cmd} — collection error, not a test failure"
    fail=1
  fi
done

echo "=== static check (static half of the same gate) ==="
bash -c "<Type / static check command from the project profile>" >/dev/null \
  && echo "OK   static check" || { echo "FAIL static check"; fail=1; }

exit "${fail}"
```

Two disciplines make this a real gate rather than a ritual:

1. **Do not collapse the loop into one invocation to "save time".** Merging the integration
   project into the unit configuration makes every unit run require live infrastructure — which
   is exactly the dependency the tier split exists to remove. The per-surface granularity
   matches the environment granularity.
2. **Distinguish a collection error from a test failure.** A collect-only step never runs
   assertions, so a non-zero exit is always a _load_ problem: an unresolvable import, a syntax
   error, a throwing module-level side effect. That distinction is why the gate is worth running
   separately from the unit tests — it isolates the blast-radius class where one bad import
   takes down every file collected after it.

In a monorepo or multi-package workspace, the same loop iterates packages instead of surfaces,
with each package's own dev dependencies installed before its collection runs. The principle is
unchanged: collection granularity matches dependency granularity.

## The Canonical Shape Of This Failure

A security-enforcing class exists, is exported, is unit-tested, and behaves correctly when
constructed directly — but the framework's actual request path never calls it. Every unit test
passes because tests construct the class themselves. Every code review looks clean because
there's no missing line to spot — the defect is an absence, not a mistake in what was written.
Consumers who read the public API assumed the protection was active and built on that
assumption; it never was.

Three properties make this failure mode dangerous:

- **It is invisible at diff level.** No reviewer sees a call site that was never written.
- **Unit tests report success throughout.** They ARE the caller, so they can't detect that
  nothing else calls it.
- **The public surface actively misleads.** A typed, documented, importable class reads as
  "wired in" even when it isn't.

Concrete instance: a tenant-scoped connection helper exists, is exported, is unit-tested, and
sets the tenant context correctly — while some entry point acquires its database connection
another way and never routes through it. That's why fencing database-driver imports to one
module (a dependency-boundary check) and asserting every entry point resolves its own tenant
both matter: they convert "nobody called the guard" from an invisible absence into a failing
check.

## Related

- `.harness/guides/project-profile.md` — source/test roots and every command referenced above
- `.claude/rules/instrument-discipline.md` — name the falsifying result before citing any sweep
- `.claude/rules/zero-tolerance.md` Rule 2 — an unwired symbol behind a flag is a stub
- `.claude/rules/product-completion-first.md` — category, not severity, gates fix-vs-defer
- `.claude/commands/test.md` — the Tier 2 real-infrastructure requirement step 4 depends on
- `type-relaxation-sweep.md` (this skill directory) — the sibling sweep for widened type constraints
