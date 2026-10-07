"use strict";

// ONE denylist for every field that must name a person, not an agent: the convergence
// receipt's `ratified_by` / `accepted_by`, the recorder's `escalation_accepts.acceptor` and
// `replan_accepts[].acceptor`, and the delivery contract's `approved_by`.
//
// The value is NORMALISED first — NFKC (fullwidth letters become ASCII), invisible format
// characters removed (zero-width spaces), common Cyrillic/Greek lookalike letters folded to
// Latin, whitespace collapsed, punctuation trimmed, lowercased — so "Ｃｌａｕｄｅ", "Сlaude" and
// "Cl​aude" are judged as "claude". It then refuses:
//   (a) agent, model and vendor names, with or without a version ("GPT5", "Sonnet4", "opus4.5",
//       "o3", "ChatGPT", "OpenAI", "Anthropic"), also when run together or spelled out letter
//       by letter ("ClaudeCode", "C l a u d e");
//   (b) the `harness-` namespace and every agent and role name this repository ships, read from
//       `.harness/manifest.json` and `.claude/agents/**/*.md` at load time;
//   (c) bot and no-reply email addresses;
//   (d) a value made only of role and filler words ("the user", "Project owner", "operator",
//       "myself", "User (chat approval)") — a real name alongside them ("Jane, owner") passes.
// It errs both ways — an invented human passes; a person whose name contains a listed word
// ("Ai Weiwei") is refused and must be written differently. It is a tripwire against
// self-authorization, not proof of identity.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
// Whole words (letters-only boundary, so a version suffix such as "gpt5" or "reviewer2" still
// matches; an optional plural "s").
const AGENT_WORDS = [
  "agent", "claude", "codex", "gpt", "chatgpt", "openai", "anthropic", "gemini", "copilot", "opus", "sonnet",
  "haiku", "fable", "grok", "deepseek", "mistral", "llama", "llm", "model", "bot", "assistant", "orchestrator",
  "implementer", "reviewer", "subagent", "self", "ai", "n/a", "none", "tbd", "nobody", "team-lead", "lead",
  "main", "debug",
];
// Distinctive vendor/model names that are also refused INSIDE a run-together or letter-spaced
// value ("claudeopus", "C l a u d e"). Short or name-like words are not in this list.
const EMBEDDED_WORDS = ["claude", "codex", "chatgpt", "gpt", "openai", "anthropic", "gemini", "copilot", "sonnet", "deepseek"];
// Role and filler words: a value made only of these names nobody.
const ROLE_WORDS = new Set(["user", "users", "owner", "owners", "operator", "maintainer", "maintainers", "admin",
  "administrator", "system", "root", "stakeholder", "customer", "client", "requester", "requestor", "human",
  "person", "someone", "anyone", "unknown", "myself", "me", "i", "we", "us", "product", "project", "team",
  "manager", "lead", "the", "a", "an", "via", "by", "from", "in", "on", "of", "and", "or", "with", "as", "per",
  "chat", "message", "approval", "approved", "approves", "confirmed", "said", "says", "requesting", "request",
  "session", "this", "current", "my", "our", "your", "repo", "repository", "account", "github", "slack", "email"]);
// Common Cyrillic and Greek letters that look like Latin ones.
const LOOKALIKES = {
  "а": "a", "в": "b", "е": "e", "ё": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t",
  "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ӏ": "l", "ɡ": "g",
  "α": "a", "β": "b", "ε": "e", "η": "n", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u",
  "χ": "x", "γ": "y", "ό": "o",
};
const BOT_EMAIL_RE = /(?:no-?reply|\[bot\]|(?:^|[^a-z])bot@|@(?:anthropic|openai)\.com\b)/;
const O_SERIES_RE = /(?<![a-z0-9])o[1-9](?:-?(?:mini|pro|preview))?(?![a-z0-9])/;

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
  return new RegExp(`(?<![a-z])(?:harness-[a-z0-9-]+|(?:${words.join("|")})s?)(?![a-z])`);
}

const IDENTITY_RE = identityPattern(shippedAgentNames());

/** The value as it is judged: NFKC, no format characters, lookalikes folded, spaces collapsed, lowercased, trimmed. */
function normalizeIdentity(value) {
  return value.normalize("NFKC").replace(/\p{Cf}/gu, "").toLowerCase()
    .replace(/[Ͱ-ϿЀ-ӿɐ-ʯ]/g, (ch) => LOOKALIKES[ch] ?? ch)
    .replace(/\s+/g, " ").replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "");
}

/** True when `value` is empty or names an agent, a model, a role or a placeholder rather than a person. */
function isAgentIdentity(value) {
  if (typeof value !== "string") return true;
  const v = normalizeIdentity(value);
  if (!v) return true;
  if (IDENTITY_RE.test(v) || O_SERIES_RE.test(v) || BOT_EMAIL_RE.test(v)) return true;
  const compact = v.replace(/[^a-z]/g, "");
  if (EMBEDDED_WORDS.some((w) => compact.includes(w))) return true;
  const tokens = v.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.every((t) => ROLE_WORDS.has(t));
}

module.exports = { isAgentIdentity, normalizeIdentity, shippedAgentNames, AGENT_WORDS };
