# Multi-Site Parameter Plumbing — depth

Depth for `.claude/rules/security.md` § "Multi-Site Parameter Plumbing". The rule carries the MUST
clause; this file carries the worked DO/DO-NOT and the BLOCKED corpus.

When a security-relevant parameter (classification policy, tenant/clearance scope, audit ID) is
plumbed through a helper, EVERY call site MUST be updated in the SAME PR. Primary-site-only is
BLOCKED.

Illustrative example (TypeScript; the pattern is identical in any language):

```typescript
// DO — grep every caller, update every sibling, same PR
// $ grep -rn 'validateModel(' <source roots from the project profile>
// → both production call sites get policy+modelName in this PR
function engineValidateRecord(record: ModelRecord) {
  return validateModel(record, { policy, modelName });
}
function expressValidateIfEnabled(record: ModelRecord) {
  return validateModel(record, { policy, modelName });
}

// DO NOT — update the primary site, skip the sibling
// (the unpatched sibling still leaks classified field names in error messages)
function expressValidateIfEnabled(record: ModelRecord) {
  return validateModel(record); // sibling bypasses the sanitiser
}
```

**BLOCKED rationalizations:** "The primary call site is the one users hit 99% of the time" / "The
sibling is rarely used; we'll patch it in a follow-up" / "The helper signature is
backwards-compatible, sibling can stay as-is" / "Test coverage will catch divergence later" / "The
parameter has a safe default — siblings still get baseline behaviour".

**Why:** A sibling left on the unqualified signature ships the EXACT failure mode the parameter was
added to fix — and the "safe default" the last rationalization leans on IS the insecure default,
because the default is what the vulnerable path was already doing. The grep is the whole defense:
the parameter's presence at one call site tells you nothing about the others, and by default
nothing in the type system links them (a static type checker verifies that each call site's
arguments match ITS OWN function signature, not that every function meant to plumb the same
security parameter actually does). Making the parameter a REQUIRED argument on `validateModel` (not optional) turns
a forgotten sibling into a compile error instead of a silent omission — do this whenever the
helper's own call sites are few enough to update in the same PR; the grep remains the defense
for call sites the compiler can't see (a caller behind dynamic dispatch, reflection, or a different package).
