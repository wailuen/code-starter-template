---
name: validate
description: "Check a change against this project's standards: security, no stubs or placeholders, secrets from the environment, testing policy and git hygiene, then the gold-standards and validation-pattern sweeps (reachability, type relaxation, documentation). Use before a review gate or when asked whether work is compliant."
---

# /validate - Project Compliance Validation

## Purpose

Run compliance checks against this project's standards: the always-on rule corpus first, then the project's own code and documentation patterns.

## Step 1: Rule-Corpus Checks

These apply to every change:

| Check          | Rule Source                        | What It Validates                                                               |
| -------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| Security       | `.claude/rules/security.md`         | No hardcoded secrets, parameterized queries, input validation, output encoding  |
| No Stubs       | `.claude/rules/zero-tolerance.md`   | No TODOs, placeholders, NotImplementedError, simulated data in production code  |
| Env Variables  | `.claude/rules/security.md` § No Hardcoded Secrets | API keys and model names from `.env` only, never hardcoded (no separate rule file for this yet) |
| Testing Policy | `.harness/roles/implementer.md` § 3-Tier Test Strategy (quick reference: `.claude/commands/test.md`) | Real infrastructure required in Tier 2-3 tests |
| Git Hygiene    | `.claude/rules/git.md`              | Conventional commits, no secrets in history, atomic commits                     |

### Rule-Corpus Checklist

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] No SQL/code injection vulnerabilities
- [ ] All user input validated at system boundaries
- [ ] No TODOs, stubs, or placeholder code in production files
- [ ] API keys and model names sourced from `.env`
- [ ] No mocking in integration/E2E tests
- [ ] Error handling present (no silent `except: pass`)
- [ ] No secrets in git history

## Step 2: Project Standards Checks

Load both skills, then check the change against them:

- `.claude/skills/17-gold-standards/SKILL.md` — code and documentation pattern standards
- `.claude/skills/16-validation-patterns/SKILL.md` — the validation sweeps and the mechanical gate inventory

| Check                  | What It Validates                                                         | Mechanical gate                                 |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| Static checks          | Lint and type/static analysis clean                                       | Project profile § Commands: Lint, Type / static check |
| Data-access choke point | The database client is reached only through the one data-access module the architecture names | Project profile § Mechanical checks (dependency-boundary check), else review |
| Tenant isolation       | When the project is multi-tenant: every scoped table/collection carries the isolation mechanism the architecture chose, and every entry point resolves its own tenant | Project profile § Mechanical checks, else review |
| Project guard scripts  | Every other check the project lists                                       | Project profile § Mechanical checks             |
| Reachability           | No exported symbol without a production call site                         | `orphan-audit-playbook.md` § Detection Protocol |
| Type relaxation        | Widened constraints swept at extraction sites, not only render sites      | `type-relaxation-sweep.md`                      |
| Documentation          | Code-surface claims resolve; no split-state framing in specs              | `documentation-validation-patterns.md`          |

## Quick Subcommands

```
/validate                → Full check (rule corpus + project standards)
/validate security       → Secrets, injection, input validation
/validate testing        → Mocking policy, test organization
/validate stubs          → TODOs, placeholders, fake data
/validate env            → Hardcoded API keys, model names
/validate tenancy        → Tenant isolation coverage (multi-tenant projects only)
/validate orphans        → Reachability sweep — exported but never called
/validate docs           → Code examples, cross-references, terminology
```

## Agent Teams

Deploy these agents for validation:

- **security-reviewer** — security audit (always include it: every change is checked for security)
- **gold-standards-validator** — Compliance check against project standards
- **testing-specialist** — verify the real-infrastructure policy for Tier 2-3 tests and test organization

## Related Commands

- `/test` - Testing strategies

- `/design` - UI/UX principles; for a design audit dispatch the `uiux-designer` agent

## Skill References

- Rules: `.claude/rules/security.md`, `.claude/rules/zero-tolerance.md`, `.claude/rules/git.md`
- Skills: `.claude/skills/17-gold-standards/SKILL.md`, `.claude/skills/16-validation-patterns/SKILL.md`
