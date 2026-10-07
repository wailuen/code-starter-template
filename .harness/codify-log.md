# Codify log

Append-only record of what happened to each lesson `/codify` considered
(`.harness/phases/codify.md` § Automatic runs). `/learn` and `/ws` read it to decide which
lessons are still open (`.harness/phases/learn.md` step 1). Name each lesson by its full
repository-relative path, never by number alone. Add rows; never rewrite or delete one — a
later row for the same lesson supersedes an earlier one. Outcomes: `folded in`, `declined`,
`deferred` (with the revisit condition) and `awaiting user` (with the waiting
`docs/codify-<slug>-ask` branch or pull request). Only a row quoting the user's answer, written in the session they gave
it, may supersede an `awaiting user` row (`.harness/phases/codify.md` § Automatic runs).

| Date | Run (branch / pull request) | Lesson (path) | Outcome | Detail |
| --- | --- | --- | --- | --- |
