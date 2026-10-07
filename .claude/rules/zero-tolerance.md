---
priority: 0
scope: baseline
---

# Zero-Tolerance Rules

## Scope

All sessions, all agents, all production code. These rules are firm for production code.
A rule may be set aside only through one of the recorded paths this file names: the
user's explicit instruction to skip (Rule 1, Exceptions), a tracked follow-up (Rule 1,
Rule 1b, Rule 6), or the deprecation path (Rule 6a). Test files and scratch work during
iterative development are not production code.

## Rule 1: Resolve Failures, Warnings And Notices You Find

If you found it, you own getting it fixed. Fix it in the current change if it is small and
related to that change; otherwise record it as a follow-up with the evidence, in the place
`.harness/rules/autonomous-execution.md` § Problems found along the way names for its kind
(product scope, a bug in built behavior, a harness defect, or a deferred INCREMENTAL
finding), and say so in your summary. An acknowledgement or a log line without a fix or a
recorded follow-up is a silent dismissal.

**Applies to** (equal weight): test/build/type failures, compiler/linter warnings,
deprecation notices, WARN/ERROR in workspace logs since the previous gate, runtime and
peer-dependency warnings — a warning is an error the framework chose to keep running
through. **Process for a fix:** diagnose, fix, add a regression test, verify, commit.
Scan the latest test/build output for warnings and errors before reporting any gate
complete.

"Pre-existing", "outside the scope of this change", "known issue" and "only a warning" are
reasons to choose follow-up over fix-now, never reasons to do neither.

**Why:** Unrecorded deferral creates a ratchet — every session inherits more failures.
Today's `DeprecationWarning` is next quarter's "it stopped working when we upgraded".

**Exceptions:** The user says "skip this" — skip it and record the instruction in the
commit body or a journal entry. An unresolvable upstream third-party deprecation — pin the
version and record the reason, the upstream issue link and an owner todo.

**See also:** `.claude/rules/time-pressure-discipline.md` — pressure framing is the common
bypass; parallelize, don't drop steps.

### Rule 1a: Scanner-Surface Symmetry

Treat findings on a PR scan exactly like findings on a main scan. "Same on main, therefore
not introduced here" is not a disposition, because it is the ratchet that defers fixes
forever.

### Rule 1b: Scanner Deferral Requires Tracking Issue + Runtime-Safety Proof

A scanner finding may be deferred only when it is provably runtime-safe and needs an
architectural refactor outside the release scope, and only when all four hold: (1) a
written runtime-safety proof in a PR comment citing the guard lines, (2) a tracking issue
(`<scanner>: defer <rule-id> — <context>`) with full-fix acceptance criteria, (3) a
"deferred, safe per #<issue>" link in the release PR body, (4) release-owner sign-off or
the user's explicit override. Missing any one makes it a silent dismissal.

**Why:** Without all four, "deferred" is indistinguishable from silent dismissal.

### Rule 1c: "Pre-Existing" Is Unprovable After A Context Boundary

A "pre-existing" / "not introduced this session" disposition must cite a commit SHA that
pre-dates the session's first tool call. After `/clear`, auto-compaction, resume or a
sub-agent handoff the claim cannot be checked, so treat the problem as yours and apply
Rule 1.

**Why:** Context boundaries erase the edit log; `git blame` may attribute a same-session
regression to the original author.

### Rule 1d: Review Findings Follow The Category Gate

The classes Rule 1 lists, and Rules 2 and 3, are never "incremental". Only a review
finding outside those classes that is classified INCREMENTAL may be deferred, under
`.harness/rules/product-completion-first.md` MUST-2, which owns the conditions.

## Rule 2: No Stubs, Placeholders, Or Deferred Implementation

Production code must not contain: `TODO`/`FIXME`/`HACK`/`STUB`/`XXX` markers,
`raise NotImplementedError` (Python), `throw new Error("not implemented")` (JS/TS),
`todo!()`/`unimplemented!()` (Rust), `panic("TODO")` (Go), `pass # placeholder`, empty
function bodies, `return None # not implemented`.

**No simulated or fake data:** `simulated_data`, `fake_response`, `dummy_value`, hardcoded
mock responses, placeholder dicts. **Frontend mock is a stub too:**
`MOCK_*`/`FAKE_*`/`DUMMY_*`/`SAMPLE_*` constants; `generate*()`/`mock*()` for synthetic
display data; `Math.random()` for UI.

The same applies to fake encryption, transactions, health checks, classification or
redaction, tenant isolation, metrics and dispatch, and to an integration that "works"
only because a handoff field is missing.

**Why:** Users see fake data or fake guarantees presented as real; frontend mock data is
invisible to backend-focused stub detection but has the same effect.

## Rule 3: No Silent Fallbacks Or Error Hiding

Never swallow an error silently:

- `except: pass` (bare except + pass)
- `catch(e) {}` (empty catch, JS/TS/Java)
- `if err != nil {}` / `_ = err` with no handling (Go), `let _ = fallible();` / `.ok();`
  discarding a `Result` (Rust)
- `except Exception: return None` without logging

**Why:** Silent error swallowing hides bugs until they cascade into data corruption or
production outages with no stack trace to diagnose.

**Acceptable:** `except: pass` in hooks/cleanup where failure is expected.

### Rule 3a: Typed Delegate Guards For None/Undefined Backing Objects

A delegate method forwarding to a lazily-assigned backing object must guard with a typed
error before access, rather than letting `AttributeError` from `None.method()` (Python) or
`TypeError: Cannot read properties of undefined` (TypeScript) propagate.

**Why:** An opaque runtime error blocks many tests at once with no actionable message; a
typed guard turns the failure into a one-line fix instruction.

### Rule 3c: Documented Parameters Accepted But Unused

Every documented parameter (a Python kwarg, a TypeScript named/optional parameter or
options-object field) must be consumed by at least one branch or explicitly forwarded to
a callee. A parameter accepted in the public signature with zero effect on the body is a
silent fallback at the API surface.

**Why:** A documented parameter is a contract; the documented behavior advertises
something the code does not perform.

### Rule 3d: Dual-Shape Return + Structural Guard = Silent Fallback

Do not consume a property/method whose return type is a union of structurally distinct
shapes (e.g. `Union[ConfigWrapper(dict), AppConfig(dataclass)]`) through a structural
existence guard (`hasattr(value, "method")`) that is true on one branch and false on the
other. Dispatch on a discriminator (`isinstance`/type check) or collapse the API to one
return shape.

**Why:** `hasattr` silently flips false on the branch lacking the attribute; the
documented behavior never fires for users on that branch.

### Rule 3e: Doc Walk-Back Claims About Code Surface Cite Source Line Range

A doc edit that rewrites a code-surface claim (method lists, registered handlers, exposed
bindings, config keys, deprecation lists, magic-value constants) must cite the
ground-truth source as `<path>:<start>-<end>` in the same paragraph; a numeric claim
restated across code bases also needs a same-shard compile-time pin test. Any contract a
wrapper restates across two or more bindings must be re-derived from the code (not the
doc) for each binding.

**Why:** A wrong doc claim is faithfully mirrored by every binding, and a "safe by
construction" audit claim fails the same way when one binding is the only un-gated one.

## Rule 4: No Workarounds For Bugs In Owned Code

This repo owns its application code. Fix bugs directly, at the root cause — not with a
naive re-implementation, post-processing of a wrong result, or a dependency downgrade.

**Why:** Workarounds create parallel implementations that diverge from the intended
behavior, doubling maintenance cost and masking the root bug.

## Rule 5: Version Consistency On Release

The project's version manifest (e.g. `package.json` `"version"`, `pyproject.toml`
`[project] version`, `Cargo.toml` `[package] version`) is the single source of truth for
this repo's version. Update any other file that echoes it (docs, deploy manifests) in the
same change.

**Why:** A stale version string in a doc or manifest misleads anyone using it to identify
what's actually deployed.

## Rule 6: Implement Fully

- All methods, not just the happy path.
- If an endpoint exists, it returns real data.
- If a service is referenced, it is functional.
- No "will implement later" comments.
- If you cannot implement something, ask the user; if they say "remove it", delete it.
- Dead code (a symbol nothing calls, code targeting a resource that does not exist): recommend
  deleting it and ask the owner first; never delete it silently and never leave a stub in its
  place (`.claude/rules/verify-resource-existence.md` MUST-3).

Test files are excluded: `test_*`, `*_test.*`, `*.test.*`, `*.spec.*`, `__tests__/`.

A TODO during iterative development is allowed only while it is actively tracked (a
workspace todo or a linked issue), and it must be gone before the code ships.

**Why:** Half-implemented features present working UI with a broken backend — users trust
outputs that are silently incomplete or wrong.

### Rule 6a: Remove Fully — A Public-Facing Surface Removal Requires A Deprecation Path

Do not remove or change a surface this project exposes to other callers — an HTTP API
endpoint, a CLI command or flag, a library's exported API, an MCP tool/resource — in a
way that breaks existing callers without warning. Keep the old surface working and marked
deprecated for one release cycle, document the replacement, and remove it only after
callers have migrated. A hard break needs the user's explicit approval.

**Why:** Removal without a deprecation path hard-breaks every existing caller (a frontend,
a script, a downstream library, an MCP client) with no warning; a deprecation period turns
a hard break into an actionable warning.
