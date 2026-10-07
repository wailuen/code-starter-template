---
name: 36-claude-managed-agents
description: "Integration patterns for Claude Managed Agents (server-hosted agent sessions, beta managed-agents-2026-04-01): event-sourced sessions, the custom-tool reverse tunnel, the session state machine, and hardened examples. Use when building or debugging an integration with Managed Agents."
---

# Claude Managed Agents — Integration Patterns

**Claude Managed Agents (CMA)** is Anthropic's **hosted REST agent harness**
(`/v1/agents`, `/v1/environments`, `/v1/sessions`; beta header
`managed-agents-2026-04-01`). It bundles the agent loop + tool execution +
sandbox container + server-side state persistence so you do not build your own
loop. Use it for long-running / async work; use the Messages API when you want
a custom loop.

> **Not Claude Code.** CMA is the Claude API product. Claude Code is the
> CLI/IDE coding agent. They share the model + tool-use vocabulary but are
> distinct products — do not conflate them in code, docs, or consumer guidance.

## Core model (four concepts)

| Concept         | What it is                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent**       | `model` + `system` + `tools` + `mcp_servers` + `skills`. Versioned. `POST /v1/agents` — created ONCE, referenced by ID across sessions. |
| **Environment** | Where sessions run: Anthropic cloud sandbox, or self-hosted sandbox on your infra (`POST /v1/environments`).                            |
| **Session**     | A running agent instance for one task. `POST /v1/sessions` references an agent by ID/version. Created PER RUN.                          |
| **Events**      | The only communication channel. You send `user.*`/`system.*`; you receive `agent.*`/`session.*`/`span.*`.                               |

**Pitfall:** `model`/`system`/`tools`/`mcp_servers`/`skills` belong ONLY on
`agents.create()`, never on `sessions.create()`. Do not call `agents.create()`
per run — create once, store the ID, reuse.

## Sessions speak in events, not request/response

Event types follow a `{domain}.{action}` convention.

**Events you send** → `POST /v1/sessions/{id}/events`

| Type                      | Meaning                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `user.message`            | User message — wakes an idle session                                     |
| `user.custom_tool_result` | Result of a custom tool the agent called (keyed by `custom_tool_use_id`) |
| `user.tool_confirmation`  | Approve / deny a permission-gated tool                                   |
| `user.interrupt`          | Force a running agent back to idle, then redirect with a `user.message`  |
| `system.message`          | Update the agent's system prompt between turns                           |

**Events you receive** ← `GET /v1/sessions/{id}/events/stream` (live SSE) ·
`GET /v1/sessions/{id}/events` (full history)

| Type                    | Meaning                                                 |
| ----------------------- | ------------------------------------------------------- |
| `agent.message`         | Claude's text response                                  |
| `agent.tool_use`        | Claude calls a built-in tool (Bash, file ops, web)      |
| `agent.custom_tool_use` | Claude calls one of YOUR tools (executes on your host)  |
| `agent.mcp_tool_use`    | Claude calls an MCP tool                                |
| `session.status_idle`   | Loop paused — carries `stop_reason`                     |
| `session.error`         | Something failed                                        |
| `span.*`                | Observability spans (incl. `span.outcome_evaluation_*`) |

`session.status_idle` carries `stop_reason.type`:

- `end_turn` — agent finished; awaits the next `user.message`.
- `requires_action` — agent is blocked on a tool; `stop_reason.event_ids[]`
  lists the pending `agent.*_tool_use` events you MUST answer.

Every event carries `processed_at`; `null` = queued (handled after preceding
events finish).

## Session state machine — four statuses

```
        ── user.* event ──→                  ── transient error ──→
   ┌────────┐          ┌──────────┐                ┌──────────────┐
   │  Idle  │          │ Running  │                │ Rescheduling │
   └────────┘ ←────────└──────────┘ ←──────────────└──────────────┘
        ↑  session.status_idle           auto-retry
        (end_turn / requires_action)
                            │ unrecoverable error
                            ↓
                     ┌──────────────┐
                     │  Terminated  │  (terminal — no exit)
                     └──────────────┘
```

- **Idle** — starting state; waiting for `user.*` (messages or tool confirmations).
- **Running** — agent actively executing the loop.
- **Rescheduling** — transient error; system auto-retries (no client action).
- **Terminated** — unrecoverable error; terminal. The harness will NOT resurrect
  it — wrap `session.error` with your own alert/retry-with-new-session.

## The custom-tool reverse-tunnel (the load-bearing pattern)

A custom tool's schema lives in `agents.create` (`{"type":"custom","name":...,
"input_schema":{...}}`), but the FUNCTION runs on YOUR host. When the cloud
agent calls it, an `agent.custom_tool_use` arrives over the SSE stream you hold
open; you execute locally and POST a `user.custom_tool_result` back. **No
inbound networking** — you hold the outbound pipe open and the request rides it
back (a hanging-GET / reverse tunnel).

```
Cloud agent (Anthropic) ── agent.custom_tool_use  ─→ your host (handleTool)
                        ←─ user.custom_tool_result ──
```

### Canonical example — HARDENED, not happy-path

The naive presentation version interpolates agent-supplied input straight into
a filesystem path and dispatches on a tool name with no default. Both cross the
**cloud→host trust boundary** with unvalidated input. Ship the hardened form:

```typescript
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const DIFF_ROOT = realpathSync("data/diffs");
const SHA_RE = /^[0-9a-f]{7,40}$/; // validate, do not trust

function handleTool(name: string, args: Record<string, unknown>): string {
  // RT-2: default-DENY dispatch — unknown tool name throws, never falls through
  if (name === "get_metrics") {
    return readFileSync("data/metrics.json", "utf8"); // no leaked fd
  }
  if (name === "get_recent_deploys") {
    return readFileSync("data/deploys.json", "utf8");
  }
  if (name === "get_diff") {
    const sha = String(args.sha ?? "");
    if (!SHA_RE.test(sha)) {
      throw new Error(`invalid sha: ${JSON.stringify(sha)}`); // RT-1: reject crafted sha
    }
    const target = realpathSync(path.join(DIFF_ROOT, `${sha}.diff`));
    // RT-1: path containment — both sides resolved through the same resolver
    // (realpathSync) before comparing, per .claude/rules/security.md § Path Containment.
    if (target !== DIFF_ROOT && !target.startsWith(DIFF_ROOT + path.sep)) {
      throw new Error("path escapes diff root");
    }
    return readFileSync(target, "utf8");
  }
  throw new Error(`unknown tool: ${JSON.stringify(name)}`); // RT-2: deny-by-default
}
```

> **RT-8 — custom-tool RESULTS are a host→cloud egress surface.** Inbound
> hardening (RT-1/RT-2) guards what the cloud agent can ASK for; it does not
> bound what leaves. Whatever `handleTool` RETURNS — file contents, query
> rows, the thrown error's message — is sent to Anthropic's cloud. Scope what each
> tool can read (the `DIFF_ROOT` containment also bounds egress), and never
> return secrets / PII / regulated data in a tool result (`.claude/rules/security.md`
> § MUST NOT, "No secrets in logs"). This is the outbound twin of the vault caveat below.

```typescript
// RT-3: open the stream BEFORE sending -- events that resolve your message can
// be emitted before a late-attached stream, and SSE has NO replay. `stream(...)`
// returns a Promise of the async-iterable stream, not the stream itself -- awaiting
// it is what opens the connection; a missing `await` here throws
// "stream is not async iterable" the moment the loop starts.
async function* runSession(sessionId: string, q: string) {
  const stream = await client.beta.sessions.events.stream(sessionId); // open FIRST
  await client.beta.sessions.events.send(sessionId, {                 // THEN send
    events: [{ type: "user.message", content: [{ type: "text", text: q }] }],
  });
  for await (const ev of stream) {
    if (ev.type === "agent.custom_tool_use") {                  // cloud -> you
      // RT-8 continued: a tool call the cloud agent is waiting on MUST always
      // get a result, even when handleTool rejects the input -- an uncaught
      // throw here leaves that tool_use permanently unanswered, and per RT-4
      // below, an unanswered pending tool call deadlocks the session.
      let result: string;
      let isError = false;
      try {
        result = handleTool(ev.name, ev.input);
      } catch (e) {
        result = e instanceof Error ? e.message : String(e);
        isError = true;
      }
      await client.beta.sessions.events.send(sessionId, {       // you -> cloud
        events: [{
          type: "user.custom_tool_result",
          custom_tool_use_id: ev.id,                             // correlation id
          content: [{ type: "text", text: result }],
          is_error: isError,
        }],
      });
    }
    yield ev;
  }
}
```

### Reconnect contract (RT-4 — the slides omit this; you must not)

SSE has **no replay**. On disconnect:

1. `GET /v1/sessions/{id}/events/stream` — open a NEW stream.
2. `GET /v1/sessions/{id}/events` — fetch full history.
3. **Dedupe by event ID.**
4. Resolve any pending tool_use (`agent.tool_use`/`agent.mcp_tool_use` →
   `user.tool_confirmation`; `agent.custom_tool_use` → `user.custom_tool_result`)
   or the session **deadlocks** on a response the dropped stream consumed.

HTTP-library timeouts reset PER CHUNK — track wall-clock explicitly; prefer the
SDK `stream()`/`list()` helpers over a raw socket.

## Beta features (one-line each)

| Feature                    | Shape                                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subagents / multiagent** | `multiagent:{type:"coordinator", agents:[...]}`; coordinator threads via `session.threads`; tool-confirmations cross-post across threads.                                                                                   |
| **Memory stores**          | `memory_store` session resource; mounted into the container; carries preconditions, versions, redaction; persists ACROSS sessions.                                                                                          |
| **Outcomes**               | Structured deliverable artifact, separate from the event trace. `user.define_outcome` + grader; `span.outcome_evaluation_*` in stream.                                                                                      |
| **Vaults**                 | Per-user credentials registered once, referenced via `vault_ids`. Types: `mcp_oauth` (auto-refreshed), `static_bearer`, `environment_variable` (egress-injected, not visible in sandbox). MCP servers carry NO inline auth. |
| **MCP servers**            | `mcp_servers:[{type,name,url}]` on the agent; per-server `mcp_toolset` subset selector.                                                                                                                                     |
| **Permission policies**    | `always_ask` per-tool → loop pauses (`requires_action`) for `user.tool_confirmation`.                                                                                                                                       |
| **Webhooks**               | Console-registered; thin-payload + fetch; HMAC-verified; fire on `session.status_idled`.                                                                                                                                    |
| **Scheduled deployments**  | `POST /v1/deployments` cron-recurring runs; pause / auto-pause.                                                                                                                                                             |
| **Console agent builder**  | Interactive config iteration before dropping to the API / `ant beta:agents create < agent.yaml`.                                                                                                                            |

## Constraints (hard)

- **Beta.** `managed-agents-2026-04-01`. Wire shapes may change between
  releases — verify field names against `platform.claude.com/docs/en/managed-agents`
  before relying on any shape here.
- **No ZDR / no HIPAA BAA.** CMA persists sessions + sandbox state + history
  server-side. Regulated-data workflows MUST use a **self-hosted sandbox**
  (`ANTHROPIC_ENVIRONMENT_KEY` + `EnvironmentWorker.run()` / `ant beta:worker
poll`), not the cloud sandbox. Sessions + files are deletable via API.
- **Vault secrets are defense-in-depth, not a leak guarantee.** The agent CANNOT
  read an `environment_variable` credential from the sandbox env, but it CAN
  print a secret it is authorized to USE — treat agent OUTPUT as a disclosure
  surface (`.claude/rules/security.md` § MUST NOT, "No secrets in logs").

## Sources

**Verified 2026-06-11** against the beta docs below. This skill is pinned to
`managed-agents-2026-04-01`; re-verify field/event/endpoint shapes against the
live docs before relying on any shape, and refresh this date on each check.

- `platform.claude.com/docs/en/managed-agents/overview`
- `platform.claude.com/docs/en/managed-agents/events-and-streaming`
- `github.com/anthropics/skills` · `skills/claude-api/shared/managed-agents-*`

Origin: written against Anthropic's Claude Managed Agents beta docs (2026-06-11), with the
custom-tool reverse-tunnel example hardened against the trust-boundary issues named RT-1
through RT-8 inline above (unvalidated path/name input from the cloud agent, and tool results
as an uncontrolled egress surface).
