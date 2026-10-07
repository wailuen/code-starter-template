# Codex native custom-agent selection unavailable in the installed client

Status: runtime capability follow-up; configuration and generic delegation implemented.

User value: the user requested Codex delivery connected end to end like Claude, with the
right agent and reasoning level per task. Native custom-type selection is necessary to
satisfy the existing security-specialist convergence gate without fabricating evidence.

On 2026-10-07, Codex CLI 0.160.1 discovered all 20 generated project skills. A live
read-only capability probe exposed collaboration.spawn_agent parameters task_name, message,
fork_turns, model and reasoning_effort, with no custom-type selector. An invocation-only
multi_agent_v2 probe gave the same result. No global settings or feature flags were changed.

The Codex adapter supports explicit generic role instructions/settings and clearly blocks
native certification when a selector is absent. Do not rename a generic task to fake a
native type, or weaken the shared Claude/Codex convergence verifier.

Owner: Codex harness maintainer. Revisit when the client/tool interface changes or before
using this template for native wave certification. Resolution: in a fresh supported client,
select harness-reviewer and harness-security-reviewer through native custom-agent dispatch,
observe real returned identities and settings, and run a real two-round pinned review
through the unchanged receipt checker. A generated file or synthetic fixture is insufficient.

Evidence: .harness/codex-validation.md § Native client walk (historical record).
