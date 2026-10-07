---
name: fix
description: "Fix a reported bug in already-built behavior: intake with severity S1-S4, reproduce with a failing test, minimal root-cause fix, one independent review, ship (S1 asks first to roll back). Use for /fix, a bug report, or a production incident."
---

Read and follow the repository's `.harness/adapters/codex.md`, then
`.harness/phases/fix.md` in full. Resolve paths from the Git repository root.
Treat `$ARGUMENTS` in the shared procedure as the user's phase arguments.
Do not copy policy here; edit the shared files so both runtimes benefit.
