# Codify log

Append-only record of what happened to each lesson `/codify` considered
(`.harness/phases/codify.md` § Automatic runs). `/learn` and `/ws` read it to decide which
lessons are still open (`.harness/phases/learn.md` step 1). Name each lesson by its full
repository-relative path, never by number alone. Add rows; never rewrite or delete one — a
later row for the same lesson supersedes an earlier one. Outcomes: `folded in`, `declined`,
`deferred` (with the revisit condition) and `awaiting user` (with the holding backlog item);
only the user's answer may supersede an `awaiting user` row.

| Date | Run (branch / pull request) | Lesson (path) | Outcome | Detail |
| --- | --- | --- | --- | --- |
