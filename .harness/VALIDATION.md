# Shared harness installation validation

Record here each validation run of the harness in this repository: the exact command, its
exit code, and the commit SHA it ran against. A run that errored or was skipped is recorded
as such, never as a pass.

Commands (see `guides/project-profile.md` § Mechanical checks):

```bash
node .harness/bin/check-adapters.mjs      # exit 0 = adapters match manifest
node --test ".harness/tests/*.mjs"        # exit 0 = harness self-tests pass
```

| Date | Commit | Command | Exit | Notes |
| --- | --- | --- | --- | --- |
| 2026-10-07 | n/a — template directory is not a git repository | `node .harness/bin/check-adapters.mjs` | 0 | After adding the `fix`, `codify` and `learn` phases to the manifest and regenerating. |
| 2026-10-07 | n/a — template directory is not a git repository | `node --test ".harness/tests/*.mjs"` | 0 | 13 tests, 13 pass; includes the documented round examples run through the recorder. |
