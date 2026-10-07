# Type-Relaxation Sweep

There's no separate `type-relaxation-sweep` rule in this harness — this file is the standalone
authority. When a change relaxes a type constraint that was load-bearing for runtime safety,
inventory **value-extraction** sites separately from **render** sites, at analysis time, against
the PROPOSED type.

The dangerous guards are the ones nobody wrote. Where the type system narrowed ambiently, safety
was a side effect of the constraint rather than of a check — so there is no guard code for a
reviewer to notice missing, and the compiler stops objecting at exactly the moment the guard
disappears.

**Applies to any statically-typed or statically-checked language** — TypeScript, Python under
mypy/pyright, Go, Kotlin, Java, C#, Rust. The type checker is the project profile's
"Type / static check" command (`.harness/guides/project-profile.md` § Commands); record its
strictness settings there. Examples below are illustrative and show more than one language.
The stricter the checker configuration, the more the type system is guarding — and the more a
relaxation removes.

## What Counts As A Relaxation

| Change                                                   | TypeScript                                          | Python (mypy/pyright)                               | Go / Kotlin                                       | Why it is load-bearing                                         |
| -------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| Key type widened to an arbitrary string                  | `K extends keyof T` → `string`                      | `Literal[...]` key → `str`                          | typed enum key → `string`                         | Indexing was total; now it can miss                            |
| Closed set of variants widened to a supertype            | discriminated union → base type                     | `Union[A, B]` → `object` / `Any`                    | Kotlin `sealed` → open interface                  | Exhaustive matching stops being exhaustive                     |
| Immutable collection made mutable                        | `readonly T[]` → `T[]`                              | `Sequence[T]` / `tuple` → `list[T]`                 | Kotlin `List` → `MutableList`                     | Callers can now mutate shared state                            |
| Branded / nominal type collapsed to its base             | `string & { __brand }` → `string`                   | `NewType("TenantId", str)` → `str`                  | Go `type TenantID string` → `string`              | A validated value and an unvalidated one become the same type  |
| Escape hatch added                                       | `as X`, `as unknown as X`, `any`, `@ts-ignore`, `@ts-expect-error` | `cast()`, `Any`, `# type: ignore`                   | Go `interface{}`/`any` + type assertion; Kotlin `as`, `!!` | The assertion is a claim the checker no longer verifies        |
| Absence check suppressed at a site                       | non-null `arr[i]!` under `noUncheckedIndexedAccess` | `assert x is not None` removed / `# type: ignore[union-attr]` | Kotlin `!!`; Go ignoring the `ok` of `v, ok := m[k]` | The "may be missing" the checker forced you to handle is gone  |
| Required field made optional                             | `x: T` → `x?: T`                                    | `x: T` → `x: T \| None`                             | Kotlin `T` → `T?`; Go value → pointer             | Every read becomes "maybe absent"                              |
| Parameter widened from a closed set to an open type      | literal union → `string`                            | `Literal[...]` → `str`                              | enum → `string`                                   | Typo-level call errors become runtime errors                   |

Sweep triggers on **any** of these, regardless of how small the diff looks.

## The Two Inventories

### Inventory A — Value-extraction sites

Where a value is **pulled out** under the relaxed type. These are the sites where absence
becomes possible.

```bash
# The relaxed symbol, then every place a value is read out of it (adjust the file glob to the language)
sym=TABLE_CLASS
grep -rnw "${sym}" <source-root>/ <test-root>/
grep -rnE "\b${sym}\[|\b${sym}\.(get|at)\(" <source-root>/
```

### Inventory B — Render sites

Where the extracted value is **displayed, logged, serialised, or returned to a caller**. These
usually already have a coalesce or a null check, which is exactly why they read as safe.

```bash
# Illustrative coalesce patterns: TS `??` / `?.` / `|| "..."`, Python `or "..."` / `.get(k, default)`, Kotlin `?:`
grep -rnE "\?\?|\?\.|\?:|\|\| *[\"'\`]| or [\"']|\.get\([^,]+," <source-root>/ | grep "${sym}"
```

Keep them separate. A coalesce at the render site does **not** establish that the extraction
expression is guarded — two distinct safety properties, only one visible in the output.

## Worked Sites

### Site 1 — Keyed lookup loses totality

A catalogue maps every database table name to its isolation class, and a catalogue check
(project profile § Mechanical checks) enforces that the key set is total against the live
schema. Under a key type constrained to the known table names, the lookup is guaranteed present.

```ts
// Illustrative (TypeScript) — BEFORE: the constraint is the guard
function classOf<K extends keyof typeof TABLE_CLASS>(name: K): TableClassEntry {
  return TABLE_CLASS[name]; // total: the type proves the key exists
}

// AFTER the relaxation — same body, now unsound
function classOf(name: string): TableClassEntry {
  return TABLE_CLASS[name]; // may be undefined at runtime; nothing here says so
}
```

```python
# Illustrative (Python) — BEFORE: key constrained to the known names
TableName = Literal["documents", "users", "audit_log"]
def class_of(name: TableName) -> TableClassEntry:
    return TABLE_CLASS[name]

# AFTER — any str accepted; a KeyError (or a .get() returning None) is now possible
def class_of(name: str) -> TableClassEntry:
    return TABLE_CLASS[name]
```

The extraction site is unchanged in the diff. Nothing in the function body was edited. Only the
signature moved — and with a strict checker (TypeScript `noUncheckedIndexedAccess`, a Python
`.get()` typed `Optional`), the compiler _would_ flag this, which is why the relaxation usually
arrives paired with an escape hatch that silences it:

```ts
return TABLE_CLASS[name]!; // the assertion IS the relaxation; sweep from here
```

```python
return cast(TableClassEntry, TABLE_CLASS.get(name))  # same thing in Python
```

Downstream, the render site looks fine and hides the defect:

```ts
logger.info("table.classified", {
  table: name,
  class: entry?.class ?? "unknown",
});
```

That `?? "unknown"` makes the log line safe. It does nothing for the caller that used `entry` to
decide whether to apply a tenant predicate. **Log-safe is not decision-safe.**

### Site 2 — Widened union silently absorbs a new case

```ts
// Illustrative (TypeScript) — BEFORE: exhaustive; a new variant is a compile error at every consumer
switch (resolution.resolved) {
  case true:
    return resolution.tenantId;
  case false:
    return refuse(resolution.reason);
  default: {
    const _e: never = resolution;
    return _e;
  }
}

// AFTER — the union widened; the bare else absorbs everything new, forever
if (resolution.resolved) return resolution.tenantId;
else return refuse((resolution as { reason: string }).reason);
```

The same shape in Python is a `match` that loses its `assert_never()` arm, and in Kotlin a
`when` over a sealed type that gains an `else ->` branch.

The extraction site is `resolution.reason`, now reached by a case that may carry no `reason` at
all. The escape hatch is doing the damage; the render path (`refuse`) still produces a
well-formed response, so tests keep passing and the new variant is silently treated as the old
one.

### Site 3 — Branded type collapsed to its base

```ts
// Illustrative (TypeScript) — BEFORE: a TenantId is a string that PASSED validation
type TenantId = string & { readonly __brand: "TenantId" };
function withTenant(id: TenantId): Promise<void>;

// AFTER — any string is accepted; validation is now a convention, not a contract
function withTenant(id: string): Promise<void>;
```

```python
# Illustrative (Python) — BEFORE / AFTER
TenantId = NewType("TenantId", str)
def with_tenant(tenant_id: TenantId) -> None: ...
def with_tenant(tenant_id: str) -> None: ...   # relaxed
```

Every call site that previously _had_ to route through the validator now compiles without it.
The sweep is not "find the changed signature" — it is "find every caller that was relying on the
brand to have forced validation upstream":

```bash
grep -rnE "withTenant\(|with_tenant\(" <source-root>/   # then read each call's argument provenance
```

The durable defence is for the function itself to re-validate at runtime (for example, an
explicit format check on the identifier) rather than trusting the type alone — a runtime check
survives a type relaxation that would otherwise delete the guarantee.

### Site 4 — Optional field flips every read

```ts
// Illustrative (TypeScript) — BEFORE
interface AccessDecision {
  readonly reason: string;
}
// AFTER
interface AccessDecision {
  readonly reason?: string;
}
```

Every `decision.reason` becomes "maybe absent". Render sites break loudly (they concatenate or
template the value, so the checker complains). Extraction sites that feed a _comparison_ fail
silently:

```ts
if (decision.reason === "revoked") revokeSession(); // undefined !== "revoked" ⇒ never fires
```

```python
if decision.reason == "revoked":   # None != "revoked" ⇒ never fires; mypy is satisfied
    revoke_session()
```

This is the shape that survives review most often: the code reads correctly, the compiler is
satisfied, and the branch simply stops executing.

## The Sweep Procedure

1. **Name the relaxed constraint** — the exact before/after type, not "we loosened the typing".
2. **Build Inventory A** against the PROPOSED type, not the current one. Sites that are safe
   today are the ones that stop being safe.
3. **Build Inventory B separately.** Do not merge the lists.
4. **For every Inventory-A site, decide explicitly:** is absence possible here, and if so, is it
   handled _before_ the value is used in a decision?
5. **Fire the site matcher at a known-affected file before trusting an empty inventory**
   (`rules/instrument-discipline.md` MUST-3(a)). An empty grep from a pattern never shown to
   match here is indistinguishable from a true negative.
6. **Run the checkers** — the project profile's "Type / static check" and "Lint" commands. Then
   read the diff for every escape hatch added alongside the relaxation: each one is a site where
   the compiler _would_ have objected.

```bash
# Step 6, mechanically — every escape hatch added by this change (illustrative patterns per language)
git diff origin/main...HEAD | grep -nE \
  '^\+.*( as | as unknown as |: any\b|!\.|\]!|@ts-(ignore|expect-error)|# type: ignore|\bcast\(|\bAny\b|!!|interface\{\})'
```

Fire this matcher at a diff you know contains an escape hatch before trusting an empty result.

## BLOCKED Corpus

Rationalizations that route around the two-inventory requirement:

- "The render site already coalesces, so it's safe"
- "It's the same value, one pass is enough"
- "The compiler is happy" (it is happy _because_ the constraint was removed)
- "Strict mode is on, the type checker would catch it"
- "It's just widening a type, not changing behaviour"
- "The cast / ignore comment is only there to satisfy the checker" (that is the definition of the problem)
- "Every caller passes a valid value today"
- "The tests still pass" (they exercise the paths that were already guarded)
- "I only relaxed the parameter, not the body"
- "We can tighten it again later if it causes trouble"
- "The runtime validation downstream covers it" — only if you _checked_ that it runs before the
  value reaches a decision; asserting it without checking is the failure
- "It's one field, the blast radius is small"
- "The union only gained one variant"
- "Nobody indexes that map with an arbitrary string"
- "I'll sweep the call sites in a follow-up PR"

The last one is BLOCKED specifically: a type relaxation and its call-site sweep are one change.
Shipping the relaxation alone leaves every unswept extraction site live, and the next session has
no signal that a sweep is owed.

## Distinct From The Orphan Sweep

`orphan-audit-playbook.md` asks _is this code reached at all_. This sweep asks _is this code
still correct now that a constraint was removed_. They fail in opposite directions: an orphan is
code that never runs; a relaxation defect is code that runs on inputs it can no longer handle.
Run both when a change touches a shared type used across module boundaries.

## Origin

Written for a codebase on a strict type-checker configuration that leaned heavily on ambient
narrowing for runtime safety — the more the type system is doing the guarding, the more a
relaxation removes, and the fewer explicit checks there are for a reviewer to notice missing.
The same holds in any language with a static checker.

## Related

- `.claude/rules/instrument-discipline.md` MUST-3(a) — fire the matcher before trusting an empty inventory
- `orphan-audit-playbook.md` — the sibling reachability sweep
- `SKILL.md` — the mechanical gate inventory (type check, lint, dependency-boundary check)
- `.harness/guides/project-profile.md` — the actual commands for those gates
