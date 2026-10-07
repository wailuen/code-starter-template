---
name: security-reviewer
description: "Independent security reviewer. Use at a stable checkpoint before merge for any change touching authentication or authorization, input handling, data access, tenant isolation, secrets, or LLM prompt-injection surfaces, and as the security seat in /redteam rounds and /fix reviews. Reports findings; does not edit code."
tools: Read, Grep, Glob, Bash
model: opus
effort: high
---

Read and follow `.harness/roles/security-reviewer.md` and `.harness/guides/task-delivery.md` in full.
