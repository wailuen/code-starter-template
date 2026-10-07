---
name: 18-security-patterns
description: "Worked security patterns that deepen .claude/rules/security.md — currently multi-site parameter plumbing. Use when a security-relevant parameter (classification policy, tenant or clearance scope, audit id) is threaded through more than one call site."
---

# Security Patterns

- **[multi-site-parameter-plumbing](multi-site-parameter-plumbing.md)** — depth for
  `.claude/rules/security.md` § "Multi-Site Parameter Plumbing": when a security-relevant
  parameter (classification, tenant scope, audit ID) is threaded through a helper, every call
  site MUST be updated in the same PR.

Language- and framework-specific security depth is deliberately not included — the harness is
stack-neutral (see `.harness/guides/project-profile.md`). The general principles (parameterized
queries, secrets, input validation, output encoding, path containment) live directly in
`.claude/rules/security.md`; the alg-confusion defense for token verification lives in
`.claude/skills/12-testing-strategies/oidc-offline-crypto-test-vectors.md`.
