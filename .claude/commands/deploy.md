---
name: deploy
description: "Deploy application code to production. Onboard / execute / check / rollback modes driven by deploy/deployment-config.md."
---

# /deploy - Application Deployment

For applications that ship code to running environments (containers, edge functions, VMs, k8s, mobile stores). Driven by `deploy/deployment-config.md`. The harness assumes a single standalone application repo — no SDK/package-publishing branch and no multi-repo config. The production build command comes from `.harness/guides/project-profile.md` (§ Commands, "Production build").

## Mode Detection

```
/deploy            → Execute mode
/deploy --check    → Check mode (drift detection only, no deploy)
/deploy --onboard  → Onboard mode (create deployment-config.md)
/deploy --rollback → Rollback mode (return production to the last good deployment)
```

## Config keys this command reads

`deploy/deployment-config.md` (full schema: `.claude/skills/10-deployment-git/application-deployment.md`) must declare at least:

| Key | Used in |
| --- | --- |
| `deploy_command` | Step 3 |
| `deploy_check_command` | Step 1, Step 4, Check mode — prints the deployed commit/revision |
| `production_paths` | Step 1, Check mode — what counts as production code |
| gate commands | Step 2 |
| `live_url` | Step 4 — the live address `user_visible_check` fetches |
| `traffic_check_command` | Step 4.2 — exits 0 only when the new revision receives the traffic the deploy strategy declares (platforms with traffic splitting) |
| `user_visible_check`, `smoke_test_command`, `cache_invalidation_command` | Step 4 |
| `deploy_state_file` | Step 4 (typically `deploy/.last-deployed`) |
| `rollback_command` | Rollback mode — returns production to a named earlier revision or commit (for example re-activating the previous revision, or redeploying the previous commit) |
| `rollback_check` | Rollback mode — a command that exits 0 only once the restored revision is live and serving: the revision check plus `user_visible_check` against it. Any data/migration caveat (a rollback that cannot undo a schema migration) is stated beside it in the config |

Onboarding asks for `rollback_command` and `rollback_check` like any other key. A config without them is incomplete: say so, and get them from the human before the first production deploy.

### If `deploy/deployment-config.md` does NOT exist → Onboard Mode

Run the application deployment onboarding process. See `.claude/skills/10-deployment-git/application-deployment.md`.

1. **Detect platform** — read repo for clues: `Dockerfile`, `vercel.json`, `fly.toml`, `app.yaml`, `kubernetes/`, `azure-pipelines.yml`, `containerapps/`, `Procfile`, native binaries
2. **Ask the human** — what platform, what deploy command, what counts as "production code", how to query current deployed state, staging required?
3. **Research current best practices** — web search for platform-specific deploy patterns (Container Apps revisions, Fly machines, Cloud Run revisions, etc.). Do NOT rely on encoded knowledge — cloud platform CLIs change frequently.
4. **Create `deploy/deployment-config.md`** — see schema in `.claude/skills/10-deployment-git/application-deployment.md`
5. **STOP — present to human for review**

### Execute Mode

Read the config and execute. **Print the 5-step DEPLOY CHECKLIST (Steps 1-5) at the start of the response and check off boxes as each step passes. Do NOT report deploy as complete until every box is checked.** The checklist IS the Step 1-5 sequence enumerated below (this command is its single source of truth); deep per-step guidance lives in `.claude/skills/10-deployment-git/application-deployment.md`. If any step fails, say "DEPLOY FAILED AT STEP N: <reason>" — NOT "build succeeded, will redeploy soon".

#### Step 1: Pre-Deploy Verification

1. **Drift check** — run `deploy_check_command` from config. Compare current deployed commit/revision against `git rev-parse HEAD`.
2. **Production paths diff** — `git diff <last_deployed_commit> HEAD -- <production_paths>` to confirm what's actually being shipped.
3. **Present diff summary to human and STOP for approval** if any of: untested changes, schema migrations, secret/config changes, breaking API changes, or a `hotfix/` branch (an urgent, narrowly reviewed fix from `/fix` — deploy its branch head, verify it in Step 4, then merge it into `main` by pull request; `.harness/phases/fix.md` § 7). If the user already approved this exact deploy (same commit, same reason), that approval stands; do not ask again.
4. **Know the way back** — note the currently deployed revision (from the drift check) as the rollback target, and confirm `rollback_command` is declared.

#### Step 2: Pre-Deploy Gates

Run the gate commands from config (typically: tests, lint, security scan). Block on failure unless `--skip-gates` is explicitly set with a documented reason.

**Why each gate exists is documented in `deployment-config.md`. Do not skip gates without reading why they're there.**

#### Step 3: Execute deploy_command

Run the `deploy_command` from config. Stream output. Capture exit status.

If deploy fails, fix the root cause rather than retrying blindly, then re-run from Step 1. If a failed deploy left production broken, run Rollback mode first.

#### Step 4: Post-Deploy Verification (THE MOST IMPORTANT STEP)

**"Deploy command exited 0" is NOT verification.** Users do not interact with your deploy command. They interact with whatever HTTP/CLI/binary surface is in front of the new revision. That is what MUST be verified.

Run ALL of these checks. Each one failing means deploy is NOT done.

1. **Revision check** — Run `deploy_check_command` again and confirm the deployed commit/revision is now `HEAD`. (Catches: deploy command succeeded but didn't actually publish the new artifact.)

2. **Traffic check** — Run `traffic_check_command` from config to confirm the new revision is receiving 100% of traffic (or whatever the deploy strategy declares). For platforms with traffic splitting (Container Apps, Cloud Run, k8s) the config must declare it, and it must query the active traffic distribution, not just the "latest revision". (Catches: new revision exists but old revision still serves all traffic.)

3. **User-visible asset check** — Run `user_visible_check` from config. This MUST fetch the live URL with a fresh, uncached client and verify users see the new code (the live-bundle-hash-vs-expected comparison snippet + per-framework detection live in `.claude/skills/10-deployment-git/application-deployment.md` § deployment-config.md Schema (`user_visible_check`) + § Quick Reference: Bundle Hash Detection By Framework).

   Catches: CDN cache, browser cache headers wrong, service worker stale, traffic split misconfigured, wrong revision activated.

4. **Smoke test** — Run `smoke_test_command` if declared. This is functional verification of the live endpoint, not just asset hash matching.

5. **Cache invalidation** — If the user_visible_check fails on first attempt and cache is suspected, run `cache_invalidation_command` from config (e.g., `aws cloudfront create-invalidation`, `wrangler purge`, etc.) and re-run user_visible_check. If it STILL fails, do NOT mark deploy as complete — investigate routing.

6. **Only after ALL checks pass**: write the deployed commit SHA to `deploy_state_file` from config (typically `deploy/.last-deployed`)

7. **Document**: Update `deploy/deployments/YYYY-MM-DD-HHMMSS.md` with: commit, environment, gates run, all check results (revision/traffic/user-visible/smoke), cache invalidations performed if any.

If the new revision is live but broken for users (smoke test or `user_visible_check` failing, errors users hit), roll back first (Rollback mode, with the human's approval), then diagnose. If `user_visible_check` fails after cache invalidation, deploy is NOT done. See `.claude/skills/10-deployment-git/application-deployment.md` § Cache Layers To Check for the L1-L7 troubleshooting flow.

#### Step 5: Document

Add a `DECISION` journal entry (`/journal new DECISION deploy-<date>`): what was deployed, smoke test result, any cache invalidations performed.

### Check Mode (`/deploy --check`)

Drift detection only — no deployment side effects. Useful for /wrapup, before commits, or after pulling new changes.

1. Run `deploy_check_command` to get currently-deployed commit
2. Compare to `git rev-parse HEAD`
3. Run `git diff <deployed_commit> HEAD -- <production_paths>` to summarize drift
4. Output a clear status:
   - **`✓ in sync`** — deployed commit matches HEAD
   - **`⚠ drift: N production-touching commits behind`** — list the commits, list the production files changed
   - **`✗ unknown`** — config command failed; explain why

`/wrapup` runs this when `deploy/deployment-config.md` exists and lists any drift under Outstanding work, so "committed but not deployed" is caught before the session ends.

### Rollback Mode (`/deploy --rollback`)

Production changes, so confirm with the human first, naming the target revision — unless the user already approved this rollback to this target.

1. **Pick the target** — the last deployment that passed Step 4 (the previous entry in `deploy/deployments/`, or the revision noted at Step 1.4). Never roll back to a revision that was not verified.
2. **Run `rollback_command`** for that target. Stream output and capture exit status.
3. **Verify with `rollback_check`** — run it for the target; it must exit 0, meaning the target revision is live, receiving traffic, and passes `user_visible_check`. `rollback_command` exiting 0 is not verification, exactly as in Step 4.
4. **Record it** — write the target commit to `deploy_state_file`, add `deploy/deployments/YYYY-MM-DD-HHMMSS-rollback.md` (from, to, why, check results), and a `DECISION` journal entry. Open a `/fix` record for the defect that caused the rollback.

If the rollback itself fails, say "ROLLBACK FAILED AT STEP N: <reason>" and stop for the human; do not improvise production changes.

## Critical Rules

There's no separate deploy-hygiene rule file in this starter yet — these principles live here. They apply once `deploy/deployment-config.md` exists:

- **"Committed" is NOT "done."** Only "live in production" is done for production-touching changes.
- **NEVER** end a session with committed-but-not-deployed production code unless the human explicitly defers.
- **NEVER** skip pre-deploy gates without a documented reason.
- **ALWAYS** verify deploy state BEFORE committing further production changes (don't pile on top of un-deployed code).
- **ALWAYS** run `/deploy --check` as part of the commit ritual for production-touching changes.
- **ALWAYS** update `deploy/.last-deployed` on successful deploy or rollback so check mode works.
- **ALWAYS** have a verified way back: `rollback_command` and `rollback_check` declared before the first production deploy.

## Agent Teams

Dispatch **security-reviewer** for a pre-deploy audit if `deploy/`, secrets, or auth code
changed, **testing-specialist** to verify smoke tests run and pass post-deploy, and
**backend-specialist** for server-side deploy work (migrations, environment wiring, health
checks).

## Skill References

- `.claude/skills/10-deployment-git/application-deployment.md` — onboarding flow + deployment-config.md schema
- `.claude/skills/10-deployment-git/deployment-cloud.md` — this project's stable cloud deployment defaults (access, hosting, sizing, secrets, containers)
