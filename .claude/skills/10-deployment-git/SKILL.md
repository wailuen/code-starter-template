---
name: 10-deployment-git
description: "Deploying this application to a live environment: the deploy/deployment-config.md schema and the /deploy onboarding flow, the post-deploy checks that prove users see the new code (revision, traffic, cache, bundle hash), and stable cloud-deployment defaults. Use when onboarding, running, debugging or auditing a deploy."
---

# Deployment

Reference depth for the `/deploy` command.

## Reference Documentation

- **[application-deployment](application-deployment.md)** — the `deploy/deployment-config.md`
  schema, the "committed ≠ deployed" problem it solves, and the `/deploy --onboard` /
  `/deploy --check` flow. Start here for any new deployment target (the project's chosen target
  is recorded in `deploy/deployment-config.md` once `/deploy --onboard` has run).
- **[deployment-cloud](deployment-cloud.md)** — this project's stable cloud defaults (SSO CLI
  access, managed first, right-sizing, monitoring baseline, secrets, container rules). Research
  current provider specifics via web search; this covers only what doesn't change month to month.

GitHub issue/PR practice lives directly in `.claude/agents/management/gh-manager.md` — that
agent file is the current, correct reference for issue filing, CI-check/merge discipline, and
issue-closure conventions. Local todo hygiene lives in `.claude/agents/management/todo-manager.md`
and `.harness/roles/todo-manager.md`. Both are thin and describe only what the harness actually
provides (no GitHub Projects boards, sprints or story points).

## When To Use

- `/deploy --onboard` is invoked and `deploy/deployment-config.md` does not exist yet
- Deciding cloud-platform specifics (SSO auth, sizing, monitoring baseline) for a new deploy target
