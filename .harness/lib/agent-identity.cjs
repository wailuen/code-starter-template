"use strict";

// ONE denylist for every field that must name a person, not an agent: the convergence
// receipt's `ratified_by` / `accepted_by`, the recorder's `escalation_accepts.acceptor` and
// the delivery contract's `approved_by`. Before this module each tool kept its own list and
// they disagreed — "codex" or "security-reviewer" passed the receipt checker as a human,
// "Claude Opus" passed the recorder.
//
// It refuses (a) generic agent / model / placeholder words, (b) the `harness-` namespace the
// Codex adapter generates, and (c) every agent and role name this repository ships, read from
// `.harness/manifest.json` and `.claude/agents/**/*.md` at load time so a new agent is covered
// without editing this file. It errs both ways — an invented human passes, a human whose name
// contains one of these words ("Ai Weiwei") is refused and must be written differently. It is a
// tripwire against self-authorization, not proof of identity.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
// Matched as whole words, case-insensitive, anywhere in the value.
const AGENT_WORDS = [
  "agent", "agents", "claude", "codex", "gpt", "gemini", "copilot", "opus", "sonnet", "haiku", "fable",
  "llm", "model", "bot", "assistant", "orchestrator", "implementer", "reviewer", "subagent", "self", "ai",
  "n/a", "none", "tbd", "nobody", "team-lead", "lead", "main", "debug",
];
// Matched only as the whole value: words a human's description may contain ("Jane, owner"),
// but which name nobody when they are the entire answer.
const PLACEHOLDERS = new Set(["human", "user", "the user", "owner", "unknown", "someone", "anyone", "me"]);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

function namesFromAgentFiles(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { if (e.code === "ENOENT") return; throw e; }
  for (const e of entries) {
    if (e.isDirectory()) namesFromAgentFiles(path.join(dir, e.name), out);
    else if (e.isFile() && e.name.endsWith(".md")) out.add(e.name.slice(0, -3).toLowerCase());
  }
}

// Every agent and role name this repository ships. A missing source (a Codex-only project
// that deleted `.claude/`) contributes nothing; a malformed manifest is an error, not a skip.
function shippedAgentNames(root = ROOT) {
  const out = new Set();
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(path.join(root, ".harness", "manifest.json"), "utf8")); }
  catch (e) { if (e.code !== "ENOENT") throw e; }
  for (const group of [manifest?.roles, manifest?.codex?.agents]) {
    if (group && typeof group === "object") for (const name of Object.keys(group)) out.add(name.toLowerCase());
  }
  namesFromAgentFiles(path.join(root, ".claude", "agents"), out);
  return [...out].sort();
}

function identityPattern(names) {
  const words = [...new Set([...AGENT_WORDS, ...names])].sort((a, b) => b.length - a.length).map(escape);
  return new RegExp(`(?:^|[^A-Za-z0-9])(?:harness-[a-z0-9-]+|${words.join("|")})(?![A-Za-z0-9])`, "i");
}

const IDENTITY_RE = identityPattern(shippedAgentNames());

/** True when `value` is empty or names an agent, a role or a placeholder rather than a person. */
function isAgentIdentity(value) {
  if (typeof value !== "string" || !value.trim()) return true;
  const v = value.trim();
  return PLACEHOLDERS.has(v.toLowerCase()) || IDENTITY_RE.test(v);
}

module.exports = { isAgentIdentity, shippedAgentNames, AGENT_WORDS };
