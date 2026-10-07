---
priority: 0
scope: baseline
---

# Security Rules

These apply to every code change in the repository.

## No Hardcoded Secrets

All sensitive data comes from environment variables (or the secret store named in `.harness/guides/project-profile.md` § Configuration), never from source.

**Why:** Hardcoded secrets persist in git history, CI logs, and error traces — permanently extractable even after deletion.

```
❌ const apiKey = "sk-...";                      // JS/TS
❌ password = "admin123"                          # Python
❌ DATABASE_URL = "postgres://user:pass@..."

✅ const apiKey = process.env.API_KEY;           // JS/TS
✅ password = os.environ["DB_PASSWORD"]           # Python
✅ dbURL := os.Getenv("DATABASE_URL")             // Go
```

## Parameterized Queries

Every database query uses parameters, never string-built SQL. The raw database driver should be importable from exactly one data-access module (the project's query choke point, named in `.harness/guides/project-profile.md`); every other module goes through it. See § 2 "Single Database-Access Module" and § 3 in `.claude/skills/17-gold-standards/SKILL.md`.

**Why:** Without parameterization, user input becomes executable SQL — data theft, deletion, or privilege escalation.

```
❌ `SELECT * FROM users WHERE id = ${userId}`
❌ "DELETE FROM users WHERE name = '" + name + "'"
❌ cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

✅ db.query("SELECT * FROM users WHERE id = $1", [userId])
✅ cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

## Credential Decode Helpers

Connection strings carry credentials URL-encoded.

1. Route every user/password extraction from a parsed connection URL (`new URL(...)` in JS, `urllib.parse.urlparse` in Python, `url.Parse` in Go) through one shared helper that rejects null bytes after percent-decoding. Do not percent-decode at the call site (`decodeURIComponent(url.password)`, `unquote(parsed.password)`).
2. Keep password pre-encoding helpers (percent-encoding `#$@?` etc.) in that same module, not as per-adapter copies.

```typescript
// Illustrative (TypeScript); the same shape applies in any language.
// DO — one helper owns both halves
const { user, password } = decodeUserinfoOrThrow(new URL(preencodePasswordSpecialChars(rawUrl)));
// DO NOT — hand-rolled at the call site, no null-byte check
const password = decodeURIComponent(url.password || "");
```

This holds for a new database dialect too, and for URLs from "trusted" config files.

**Why:** A crafted `postgres://user:%00bypass@host/db` can truncate at the null byte to an empty password on a C-based database client library; and encode/decode are two halves of one contract, so splitting them across modules guarantees drift.

## Input Validation

Validate all user input before use (type, length and format checks; an allowlist when possible) on every attack surface — API, CLI, uploads, forms.

**Why:** Unvalidated input is the entry point for injection, buffer overflows, and type confusion.

## Output Encoding

Encode all user-generated content before display in HTML templates, JSON responses, and log output.

**Why:** Unencoded user content enables XSS — attackers execute arbitrary JavaScript in other users' browsers.

```
❌ element.innerHTML = userContent
❌ dangerouslySetInnerHTML={{ __html: userContent }}

✅ element.textContent = userContent
✅ DOMPurify.sanitize(userContent)
```

## MUST NOT

- **No eval() on user input:** never pass user input to `eval()`, `exec()`, or `subprocess.call(cmd, shell=True)`.

**Why:** `eval()` on user input is arbitrary code execution — the attacker runs whatever they want.

- **No secrets in logs:** never log passwords, tokens, or personal data.

**Why:** Log files are widely accessible and rarely encrypted, turning every logged secret into a breach.

- **No .env in Git:** keep `.env` in `.gitignore`; use `.env.example` for templates.

**Why:** Once committed, secrets persist in git history even after removal, exposed to anyone with repo access.

- **Confirm before raising content's exposure:** before writing more-sensitive material into a less-protected or wider-audience durable place — a secret or personal data into a commit, journal or doc; private local config into a shared committed file; one tenant's content into a global file — name what is being exposed, offer the lower-exposure form, and get the user's confirmation, even for a cheap local commit.

**Why:** Nothing else checks this at the moment of writing, and once committed the content is permanent. Detail: `.claude/rules/recommendation-quality.md` MUST-8.

## Multi-Site Parameter Plumbing

When a security-relevant parameter (classification policy, tenant/clearance scope, audit ID) is threaded through a helper, update every call site in the same PR (`grep` every caller), not just the primary one.

```typescript
// DO — grep every caller; both sites get the parameter in this PR
function engineValidateRecord(record: ModelRecord) {
  return validateModel(record, { policy, modelName });
}
function expressValidateIfEnabled(record: ModelRecord) {
  return validateModel(record, { policy, modelName });
}

// DO NOT — patch the primary site, leave the sibling on the unqualified signature
function expressValidateIfEnabled(record: ModelRecord) {
  return validateModel(record); // sibling still unqualified
}
```

"The sibling is rarely used", "we'll patch it in a follow-up" and "the parameter has a safe default" are the usual reasons a sibling gets left behind; none of them holds.

**Why:** A sibling left unqualified ships the exact failure mode the parameter fixes, and the "safe default" is the insecure default — it is what the vulnerable path already did. Worked example: `.claude/skills/18-security-patterns/multi-site-parameter-plumbing.md`.

## Enforcement-Surface Parity — New Fail-Closed Dimension Lands At Every Surface

When a fix promotes a field to a fail-closed authorization control where access is checked, every independent validation surface for that field — especially a re-registration validator with no shared callee — must learn it in the same PR, through one shared restrictiveness function that ranks unrecognized values tightest (fail-closed). A transition from an unrecognized to a recognized value widens access and must raise.

**Why:** A fail-closed gate the tightening validator never learned lets a re-registration lower the bar as "tightening" — a privilege escalation the fix itself introduced. (A `secret`→`public` re-registration was once accepted this way; a grep for the field name missed it because the two validators shared no code.)

**Identity-derivation parity (same-PR sibling sweep).** In any approval or distinctness check, derive the approver/decider identity on the server (the authenticated session, never a request-body field) on both sides, and pin a self-approval identity immutably at create time (never re-resolved from mutable role occupancy). Fixing one decision endpoint means sweeping all sibling decision endpoints in the same PR.

## Secure-Default For A New Security Feature — Fail-Closed Or Loud-WARN

A new security feature whose default (config field, constructor option, injected dependency) would make it a silent no-op must instead default fail-closed (feature on, opt-out explicit), or — when backward compatibility forbids on-by-default — emit a loud one-time warning at init or first use naming the disabled protection and how to wire it. A silent fail-open default is not acceptable.

**Why:** The feature's own tests each wire it, so the un-wired default goes unexercised.

## Redactor Contract

Subject-keyed redactors (substring-matching a `subject_id`) enforce a subject-id length floor (≥8 chars), failing closed with a typed error naming the floor and the received length. A scrubbed matching object key scrubs both key and value — key → `[REDACTED_KEY_N]`, with the audit trail via the original-hash return.

**Why:** 1–7-char ids substring-match benign strings ("alice" → "malice"); a preserved matching key under `[REDACTED]` leaks the subject's identity.

## Path Containment — Resolve And Normalize Before The Trust Decision

A filesystem-path containment or spawn/executable-allowlist decision tests the real canonical form — both the candidate and the boundary root resolved through the same resolver (`realpathSync` / `std::fs::canonicalize` / `os.path.realpath`) and OS-normalized — never the lexical string. Fail closed if the path will not resolve. Spawn allowlists also need OS-aware separators and Windows drive-relative handling.

```text
# DO — resolve BOTH candidate and boundary root through the SAME resolver, then compare canonical forms; fail closed if resolution raises
# DO NOT — compare a realpath'd candidate against a RAW root, trust the lexical string, or claim the realpath re-check defeats TOCTOU
```

**Why:** A symlink at a lexically-contained path whose target escapes the boundary passes every string check and would read or execute out-of-tree content; resolving both sides is the only sound comparison. This is necessary but not sufficient: the resolve closes the lexical-bypass class but does not by itself defeat the check-to-use race (a symlink swap between the check and the exec/read) — that needs fd-based / `O_NOFOLLOW` enforcement at the point of use.

## Exceptions

Security exceptions require written justification, security-reviewer approval, documentation, and a time-limited remediation plan. An exception never permits committing a secret value to the repository.

## Enforcement

No hook checks the rules above automatically. Catching a violation depends on the agent
applying the rule and on code review. Any project guard scripts that do enforce part of this
rule (secret scanning, forbidden-import checks) are listed in
`.harness/guides/project-profile.md` § Mechanical checks.
