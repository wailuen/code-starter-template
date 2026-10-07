---
name: tdd-implementer
description: "Test-first implementer for todos that are neither server-side nor UI work (CLI tools, libraries, scripts, data jobs). Server-side todos go to backend-specialist; screens and components go to frontend-specialist."
tools: Read, Write, Edit, Bash, Grep, Glob, Agent
model: sonnet
effort: medium
---

Read and follow `.harness/roles/implementer.md`. From `.harness/guides/task-delivery.md`, read only § Workspace file layout, § Before implementation and § Implement and verify. Find their line ranges with `grep -n '^## ' .harness/guides/task-delivery.md` and read only those ranges.
