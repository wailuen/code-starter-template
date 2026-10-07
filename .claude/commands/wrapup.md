---
name: wrapup
description: "Write .session-notes so the next session resumes without re-discovering context."
---

The only deliverable is a `.session-notes` file at the repo root that lets a fresh session
start producing work within a couple of minutes of reading it, without re-exploring the
codebase.

**Before running:** if a significant decision, discovery, or risk from this session isn't yet
in `workspaces/<project>/journal/`, run `/journal new DECISION|DISCOVERY|RISK <topic>` first — `.session-notes` gets
overwritten every time, so it is not where decisions live.

## What the next session already has for free

Don't duplicate what the next session can read directly: commits and diffs (`git log` /
`status` / `diff`), outstanding product work (`workspaces/<project>/todos/active/`, once a
workspace exists), pending todo proposals (`workspaces/<project>/todos/parked/`), open bug fixes (`workspaces/<project>/fixes/`), decisions and discoveries
(`workspaces/<project>/journal/`), project context (`.claude/CLAUDE.md` / `AGENTS.md`, which tell every
new session to read `.session-notes` first).

## What only wrapup provides

1. **Priority ordering** — out of everything in the repo, which files the next session should
   read first, and why.
2. **In-flight state** — what's true right now that isn't yet committed, journaled, or filed as
   a todo.
3. **Traps** — specific pitfalls the next session will walk into without warning.
4. **Outstanding work** — a short list of what's open, so nothing silently drops between
   sessions.

If content doesn't fit one of those four, it belongs in the journal or a todo instead — put it
there before running `/wrapup`.

**Deploy drift:** if `deploy/deployment-config.md` exists, run `/deploy --check` and put any
drift ("N production-touching commits not deployed") under Outstanding work.

**Lessons:** run `/learn`. If it reports open lessons and the moment is right
(`.harness/phases/codify.md` § When it runs — the right moment and what counts), run
`/codify` before writing the notes. Otherwise don't codify: list the open lessons under
Outstanding work so the next session runs `/codify` first. List waiting lessons (awaiting the
user's confirmation) under Outstanding work too, as questions for the user.

## Format

Overwrite `.session-notes` at the repository root — the one location every command reads
(never a per-workspace copy). Only the latest version matters. Omit a section
only when it's genuinely empty, and say so explicitly ("None") rather than leaving it out
silently; an absent section reads as a forgotten one.

```markdown
# Session Notes — <YYYY-MM-DD>

## Where we are

One short paragraph (2-4 lines): current work, current phase, last concrete change — enough
for the next session to orient, not a history.

## Read first

1. `path/to/file` — why it matters (one line)
2. `path/to/file` — why it matters
   (3-6 files, priority-ordered)

## In-flight state

- Uncommitted decisions, half-done refactors, mid-migration state — facts true NOW but not yet
  in git/todos/journal.
  (write "None" if there isn't any)

## Outstanding work

- Short list of what's open and its rough status (blocked on X / in progress / queued).
  (write "None" if the queue is empty)

## Traps

- Concrete pitfalls the next session will hit. One line each; link to the fix if you know it.
  (omit if none)

## Open questions for the user

(omit if none)
```

## Rules

- **Memory only.** Write the notes from what actually happened this session. If you're unsure
  whether a claim is still true, omit it — the next session can discover it from git.
- **No accomplishments list.** The next session reads `git log` for what happened in this repo.
  The one exception: a consequential action OUTSIDE this repo (a PR on another repo, a release
  cut, an issue filed elsewhere) that `git log` here can't show — note that under "Where we are"
  if it matters to what comes next.
- **No itemized todo list.** That's what `todos/active/` is for, once a workspace exists —
  "Outstanding work" here is a short pointer list, not a duplicate of it.
- **No unverified numbers.** Don't write "14 tests passing" or "3 files changed" — a number
  written from memory goes stale the moment the next commit lands. Point at the command that
  produces the real number instead (`git diff --stat`, the test command).
- **"Read first" is the one section that must be present.** Without it, the next session has no
  entry point. If you can't produce a useful list, point at `.claude/CLAUDE.md` as the entry point and
  say why nothing more specific applies yet.

`.session-notes` is a pointer file, not a report — its job is to save the next session's
discovery time. Prefer "see `todos/active/`" over a count that could go stale.
