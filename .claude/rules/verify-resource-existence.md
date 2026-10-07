---
priority: 10
scope: path-scoped
cli_delivery: skill-channel
paths:
  - "**/*.py"
  - "**/*.rs"
  - "**/*.mjs"
  - "**/*.cjs"
  - "**/*.js"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.go"
  - "**/*.java"
  - "**/*.kt"
  - "**/*.rb"
  - "**/*.cs"
  - "**/*.sh"
  - "**/workspaces/**"
  - ".claude/{commands,skills}/**"
  - ".harness/phases/**"
---

# Verify Resource Existence Before Debugging Access

When a tool fails with a permission error (HTTP 403, "access denied", "insufficient
scope") against a named external resource, first check that the resource exists.
Debugging permissions against a resource that isn't there produces endless
credential-rotation cycles.

## MUST Rules

### 1. Existence Check Precedes Permission Debugging

When responding to a 403/401/permission-denied against a named external resource, run an
existence check against that resource as the first diagnostic step — before recommending
a new token, a scope expansion or a credential rotation.

**Why:** A 403 says "you cannot access this thing", not that the thing exists. Many APIs
return the same 403 for "no permission to access" and "no permission to discover it
exists" — identical message, opposite root cause. One read query settles it.

### 2. The Existence Check Queries The Live Endpoint, Not The Documentation

Verify with a live read against the same API surface the failing operation targets — not
a grep of documentation, source comments, spec files or the script's own intent.

**Why:** Documentation, comments and memory describe intent; only the live query is
evidence of current runtime state.

### 3. When The Resource Is Absent, Recommend Removal And Ask

If the existence check comes back empty and there is no active user request to provision
the resource, recommend deleting the dependent code and ask the user before deleting it.
Do not replace it with a stub or no-op — `.claude/rules/zero-tolerance.md` Rule 2 bans
stubs in production code, and Rule 6 says to delete only when the user says "remove it".
Recommend provisioning ("create the missing resource") only if the user asked for that
capability.

**Why:** Code targeting a non-existent resource cannot have worked, so removal is usually
right — but deleting code is the user's call. Provisioning is expensive and durable
(server costs, secret rotation, monitoring), so it waits for an explicit request.

### 4. Convergence / Round-Verdict Claims Cite Durable Receipts

A claim that a multi-round process (redteam, review, sweep) reached convergence — "round N
met target", "rounds 5 and 6 clean", "cross-agent agreement achieved" — must cite an
external receipt: (a) a journal entry recording the verdict and agent task ID, or (b) a
commit SHA referencing the agent invocation transcript. The disposition document cannot
attest to itself.

```markdown
# DO — receipt cited

Receipts: journal/.pending/0003 § round-history table.

# DO NOT — self-attest

Rounds 5+6 met convergence target.
```

**Why:** A self-attested verdict cannot be verified by inspecting itself — the same defect
as trusting documentation that a resource exists.

## MUST NOT

- Recommend creating a credential (token, service account, API key) before the existence
  check has run. **Why:** it spends real operator time on a credential that unlocks
  nothing.
- Try more than one permission-scope variation against the same 403 without re-checking
  existence. **Why:** two failed scope attempts are the signal that permission is the
  wrong axis.
- Self-attest a convergence verdict in the document making the claim. **Why:** the
  receipt must be external (MUST-4).

## Three-Layer Defense

1. Existence check first — `gh api`, `psql \dt`, `kubectl get`, `aws describe-*`, etc.
2. If it exists — proceed with permission/scope debugging (`.claude/rules/security.md`).
3. If it is absent — recommend removal and ask; provision only on explicit user request.

MUST-4 mirrors this shape: receipt first, then the claim; if no receipt exists, create one
or surface the gap.
