# Learning status

For `/learn`, report what's been captured but not yet folded into the harness via `/codify`:

1. A **lesson** is a journal entry of type DISCOVERY, GAP or TRADE-OFF in
   `workspaces/<project>/journal/`, or a `.harness/backlog/harness-NN-<slug>.md` item, as they
   are on `main` (`git ls-tree -r main --name-only`; lessons only on an unmerged branch are not
   counted until that branch merges). Look up its full path in `.harness/codify-log.md` on
   `main`; the latest row for that path decides its state:
   - no row → **open**;
   - `folded in` or `declined` → closed (a declined lesson reopens only through a new journal
     entry that adds evidence, which is itself a new lesson);
   - `deferred` → **deferred**: listed separately with its revisit condition, not open, so it
     never starts a run; when the condition is met, a new journal entry or an edit that adds a
     fresh log row reopens it;
   - `awaiting user` → **waiting**: shown separately as needing the user's confirmation, and
     not open, so it never starts an automatic `/codify` run on its own.

   Backlog items that `/codify` itself filed to hold a waiting change are part of that
   waiting lesson, not new lessons. Order lessons by path.
2. Report the open ones grouped by topic, then the waiting ones, then the deferred ones, so
   `/codify` and the user can pick them up. This works with or without a workspace.

This is read-only status — it does not change any file or grant any write authority.

Related: `.harness/phases/codify.md`, `/journal`.
