---
name: debug
description: "Reassess a stalled review loop (recorder exit 2: REPLAN or DEBUG_ROUND) using the shared harness; use for /debug. A new bug report goes to /fix instead."
---

Read and follow the repository's `.harness/adapters/codex.md`, then
`.harness/phases/debug.md` in full. Resolve paths from the Git repository root.
Treat `$ARGUMENTS` in the shared procedure as the user's phase arguments.
Do not copy policy here; edit the shared files so both runtimes benefit.
