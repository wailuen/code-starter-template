---
name: 12-testing-strategies
description: "Test-design references: probe-driven verification for semantic claims about LLM or agent output (schema-scored probes instead of regex), offline OIDC/JWT sign-verify test vectors, and how to justify a test gap that a lower security layer makes unreachable. Use when writing or auditing tests that judge model output, verify tokens, or omit a cross-tenant case."
---

# Testing Strategies

Three framework-agnostic references:

- **[probe-driven-verification](probe-driven-verification.md)** — how to write structured probes
  (schema + scoring rule) instead of regex/keyword matching for semantic test assertions.
- **[oidc-offline-crypto-test-vectors](oidc-offline-crypto-test-vectors.md)** — deterministic
  offline JWKS/JWT (RS256/ES256/PS256) test vectors + the alg-confusion fail-closed defense.
  Relevant whenever the project verifies tokens from an external identity provider (OIDC/SAML).
- **[impossibility-surface](impossibility-surface.md)** — how to justify (not hand-wave) a
  happy-path test gap that a lower-layer security control makes physically unreachable — e.g. a
  cross-tenant access test that can't run at the app layer because a database-level row-access
  policy blocks it first.
  Narrow: never an excuse to skip error-path, eager-validation, or rejection-behavior tests.
