---
name: 16-validation-patterns
description: "Validation sweeps: orphan/reachability audits, type-relaxation review for statically-typed code, and the mechanical gate inventory (project profile). Read before a /redteam or gate-level validation pass."
---

# Validation Patterns

The validation surface for any project built with this harness: how to prove that code which
_looks_ wired is actually reachable, that a relaxed type has not silently removed a guard, and
which mechanical checks exist so a sweep cites a real instrument instead of a guess.

The harness is stack-neutral. Every concrete command a sweep runs comes from
`.harness/guides/project-profile.md` — § Commands for lint, type check, the test tiers and local
CI parity, § Mechanical checks for project-specific guard scripts. Language-specific snippets in
this skill are labeled illustrative; substitute the project's own tooling.

## When To Use

- Running a `/redteam` or `/codify` validation pass and needing the orphan-audit steps.
- Reviewing a change that widens a type (a narrowed union widened to its base type, a generic
  constraint dropped, an added escape hatch such as TypeScript `any`/`as`/`@ts-ignore` or
  Python `Any`/`cast()`/`# type: ignore`).
- Deciding whether a symbol that exists and compiles is actually _called_ in production.
- Needing to cite a check as evidence and having to name what it would print if the claim
  were false (`rules/instrument-discipline.md` MUST-1).

## Progressive Disclosure

| Question                                                             | Read                       |
| -------------------------------------------------------------------- | -------------------------- |
| "Is this class/module actually called, or is it a beautiful orphan?" | `orphan-audit-playbook.md` |
| "This PR widens a type — what do I sweep?"                           | `type-relaxation-sweep.md` |
| "Which mechanical check covers this?"                                | the inventory below        |

## The Mechanical Gate Inventory

The inventory is the project profile, not this file:

- `.harness/guides/project-profile.md` § Commands — lint, type / static check, unit (Tier 1),
  integration (Tier 2), end-to-end (Tier 3), local CI parity.
- `.harness/guides/project-profile.md` § Mechanical checks — every project-specific guard script
  (secret scanning, forbidden-import / dependency-boundary checks, config-example drift,
  generated-file drift) plus the harness's own checks (`node .harness/bin/check-adapters.mjs`,
  `node --test ".harness/tests/*.mjs"`).

Anything not listed there is enforced by review only — say so rather than implying a tool
checked it. A row still marked `<unset>` is not a gate yet; do not cite it as one.

When citing a gate, cite the exact command from the profile and its falsifying result. The
shape every project should be able to fill in:

| Gate (project profile row)       | What it decides                                              | Falsifying result                              |
| -------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Type / static check              | Every import resolves; every type-level contract holds       | a reported type error, non-zero exit           |
| Lint                             | Lint clean with warnings treated as errors                   | any warning or error, non-zero exit            |
| Dependency-boundary check        | Only the database-access module imports the database driver  | a reported dependency violation                |
| Unit tests (Tier 1)              | Pure-logic behaviour, no infrastructure                      | a failing assertion                            |
| Integration tests (Tier 2)       | Behaviour against real, throwaway services                   | a failing assertion                            |
| No-mock check for Tier 2/3       | No mocking inside integration / end-to-end tests             | a flagged mock construct                       |
| Config-example check             | Every referenced env var is declared in `.env.example`       | an undeclared variable                         |
| Secret scan                      | No secret literals in source                                 | a matched literal                              |
| Test collection gate             | The whole test corpus _loads_ (no import/collection errors)  | a module-not-found / collection error, exit ≠ 0 |

Only the rows the project has actually defined exist. Confirm each gate can fail before trusting
that it passed: a test file importing a non-existent module should make the collection gate
exit non-zero; with that file removed the same command should exit 0. The static type check
should catch the same class (an unresolved import). Run both — the type checker sees files the
test runner's discovery globs may exclude, and the test runner sees runtime-only resolution
failures the type checker does not. Illustrative collection gates: `pytest --collect-only -q`
(Python), `npx vitest list` (TypeScript/Vitest), `go test -run '^$' ./...` (Go).

## The Four Validation Classes

### 1. Reachability (orphan audit)

A class that compiles, exports cleanly, and has passing unit tests can still never be called
by anything on the production path. Unit tests prove the thing _can_ do its job; only a call
site plus a Tier 2 test prove the system _asks_ it to. Full protocol:
`orphan-audit-playbook.md` § Detection Protocol.

### 2. Type relaxation

When a constraint that was load-bearing for runtime safety is widened, the compiler stops
objecting at exactly the moment the guard disappears. Extraction sites and render sites are
two distinct inventories. Full protocol: `type-relaxation-sweep.md`.

### 3. Catalogue / invariant checks

When a project guards a security or data invariant with a hand-maintained catalogue checked
against the live system — for example a map classifying every database table (tenant-scoped,
global, audit) diffed against the live schema, or an access-policy catalogue diffed against the
policies actually installed — each check is independently defeatable:

- **Totality.** The check diffs a derived list (from the live system) against the hand-authored
  catalogue. Adding an entry to silence a failure _without deciding the entry's real class_
  defeats the whole mechanism — the check goes green and the item ships under whatever policy
  the wrong entry implies.
- **Shape, not just presence.** A policy check that confirms a policy _exists_ but not that it
  has the expected shape passes a wrong policy.
- **Entry-point conformance.** Every non-HTTP entry point (job, queue consumer, CLI) resolves its
  own security context (tenant, user, scope) rather than assuming an ambient one.

Record these checks in the project profile § Mechanical checks when the project has them.

### 4. Boundary conformance

A dependency-boundary check (for example dependency-cruiser for JavaScript, import-linter for
Python, depguard for Go) enforces that the single database-access module is the only one that
imports the database driver (`skills/17-gold-standards/SKILL.md` § Single Database-Access
Module). It is a structural fence, not a convention, when the connection pool is a private
module-level binding with no exported accessor — "never export the pool" then holds by
construction. When reviewing a change that touches data access, run the boundary check — a new
driver import anywhere else is the finding.

## Instrument Discipline For Every Sweep

Before citing any check in this skill as evidence:

1. **Name the falsifying result.** The table above gives one per gate. A check whose output
   is identical whether the claim is true or false carries zero information
   (`rules/instrument-discipline.md` MUST-1).
2. **Fire the instrument at a known-answer case first.** An empty `grep` result from a pattern
   never shown to match _anything_ here is indistinguishable from a true negative. Run it
   against a file you already know contains the pattern before trusting a zero.
3. **Read the hits, not the tally.** A list of test names piped to `wc -l` counts names; a suite
   count counts files. Neither answers "did the thing I care about run".

```bash
# DO — control first, then the real query, then read the matches
grep -c "openTenantSession" <db-access-module>   # non-zero ⇒ matcher works here
grep -rn "openTenantSession" <entry-point-dir>/  # now read each hit in context

# DO NOT — cite an empty result from a matcher never shown to fire
grep -rn "openTenantSesion" <source-root>/        # typo: silently zero, reads as "no callers"
```

## Common Mistakes

1. **Citing a green unit suite as proof a feature is wired.** It proves the unit implements its
   API. See `orphan-audit-playbook.md` § Detection Protocol step 4.
2. **Treating the static type check as the collection gate.** It is one half. The test runner
   resolves modules at runtime with its own rules; run its collection step too.
3. **Silencing a catalogue check by adding an entry.** That converts a loud failure into a
   silent wrong-policy ship. Decide the class first.
4. **Sweeping only the CI-selected tests after a default changes.** See
   `orphan-audit-playbook.md` § Detection Protocol step 5.
5. **Reporting a count instead of the findings.** A count answers "how many matched", never
   "what did they say".

## Related

- `.harness/guides/project-profile.md` — the commands and mechanical-checks inventory every sweep cites
- `.claude/rules/instrument-discipline.md` — would this check print differently if the claim were false
- `.claude/commands/test.md` — the tiered test model and the real-infrastructure requirement for integration/E2E
- `.claude/rules/zero-tolerance.md` Rule 2 — an unwired symbol left behind a flag is a stub
- `skills/12-testing-strategies/` — test architecture and probe-driven verification
- `skills/17-gold-standards/SKILL.md` — the pattern standards a validation pass checks against
