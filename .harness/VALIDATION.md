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
