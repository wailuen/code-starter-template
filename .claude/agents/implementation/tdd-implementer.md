---
name: tdd-implementer
description: "Test-first implementer for todos that are neither server-side nor UI work (CLI tools, libraries, scripts, data jobs). Server-side todos go to backend-specialist; screens and components go to frontend-specialist."
tools: Read, Write, Edit, Bash, Grep, Glob, Agent
model: sonnet
effort: medium
---

Read and follow `.harness/roles/implementer.md`. From `.harness/guides/task-delivery.md`, read only § Workspace file layout, § Before implementation and § Implement and verify. Find their line ranges with `grep -n '^## ' .harness/guides/task-delivery.md` and read only those ranges.

## Step 0: Working Directory Self-Check

When dispatched into a worktree, after the dispatch prompt's STEP-0 `cd`, run BARE (no `-C`) before any edit:

```bash
top=$(git rev-parse --show-toplevel)
[ "$top" = "$(pwd -P)" ] || { echo "worktree drift detected — refusing to edit main checkout"; exit 1; }
main=$(cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")" && pwd -P)
[ "$top" != "$main" ] || { echo "worktree drift detected — refusing to edit main checkout"; exit 1; }
git rev-parse --abbrev-ref HEAD
```

Re-assert location in the same command as any test run or patch (`.claude/rules/worktree-isolation.md` Rule 2a).

