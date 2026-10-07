"use strict";

// ONE check for every field that must name a person: the convergence receipt's `ratified_by` /
// `accepted_by`, the recorder's `escalation_accepts.acceptor` and `replan_accepts[].acceptor`,
// and the delivery contract's `approved_by`.
//
// It catches HONEST MISTAKES — an agent writing its own name, a model or tool name, a role, a
// review lens or an unfilled placeholder where the user's name belongs. It cannot prove that a
// person approved anything; an invented human name passes. (Described once, in
// `.harness/rules/completion-criterion.md` MUST-1.)
//
// It judges the WHOLE value, never a word inside a name: "Claude Monet", "Jean-Claude",
// "Claudette", "Tan Ai Ling", "Will Self" and "Laurie Main" pass. After normalising — NFKC,
// invisible format characters removed, Cyrillic / Greek / Cherokee lookalike letters and small
// capitals folded to Latin, whitespace collapsed, surrounding punctuation trimmed, lowercased —
// it refuses a value when:
//   - EVERY word in it (version numbers and dates ignored; "gpt-4o", "Claude 3.5", "opus4.5")
//     is an agent, model, vendor, tool, role, lens, placeholder or filler word, compared both as
//     written and with leetspeak digits folded ("Cl4ude"): "Claude Opus", "codex agent",
//     "the user", "Project owner", "User via chat 2026-10-07", "correctness", "pending";
//   - it is a model family name followed by a version ("gpt-6-sol", "claude 4 opus");
//   - it is one word made only of such words run together, or single letters spelled out
//     ("ClaudeCode", "C l a u d e");
//   - it is the name of an agent, role or Codex model this repository ships (read from
//     `.harness/manifest.json` and `.claude/agents/**/*.md`), or any `harness-*` name;
//   - it contains a placeholder bracket (`<…>`, `{…}`, `[…]`), is a no-reply or bot address, an
//     o-series model id ("o3"), or starts with "approved by", "user's" or "user (".
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const DENY_WORDS = new Set([
  // agents, models, vendors, tools
  "agent", "agents", "subagent", "assistant", "bot", "bots", "ai", "llm", "model", "models", "claude", "gpt", "chatgpt",
  "codex", "cursor", "devin", "copilot", "gemini", "bard", "grok", "qwen", "deepseek", "mistral", "mixtral", "llama",
  "anthropic", "openai", "sonnet", "opus", "haiku", "fable", "kimi", "cohere", "jules", "cline", "aider", "windsurf", "code",
  "orchestrator", "harness",
  // roles and seats
  "reviewer", "reviewers", "implementer", "approver", "approvers", "author", "authors", "coauthor", "user", "users",
  "owner", "owners", "operator", "maintainer", "maintainers", "admin", "administrator", "system", "root", "stakeholder",
  "customer", "client", "requester", "requestor", "human", "person", "people", "lead", "manager", "team", "main", "debug",
  "self", "product", "project", "co", "authored", "coauthored",
  // review lenses
  "correctness", "security", "performance", "accessibility", "privacy", "usability", "style",
  // placeholders and pronouns
  "pending", "tbd", "tba", "todo", "na", "null", "unknown", "none", "nobody", "someone", "somebody", "anyone", "anybody", "name",
  "me", "myself", "you", "yourself", "i", "we", "us", "it",
  // filler around a role ("approved by the user via chat, yes")
  "the", "a", "an", "s", "via", "by", "from", "in", "on", "at", "of", "and", "or", "with", "as", "per", "for", "to",
  "independent", "planning", "plan", "chat", "message", "approval", "approved", "approves", "confirmed", "said", "says", "yes", "verbally", "who", "asked",
  "requesting", "request", "session", "this", "current", "my", "our", "your", "repo", "repository", "account",
  "github", "slack", "email",
]);
// Fold these to Latin before anything else (they survive NFKC and lowercasing).
const LOOKALIKES = {
  // Cyrillic
  "а": "a", "в": "b", "е": "e", "ё": "e", "к": "k", "м": "m", "н": "h", "о": "o", "р": "p", "с": "c", "т": "t",
  "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ӏ": "l", "А": "a", "В": "b", "Е": "e", "К": "k",
  "М": "m", "Н": "h", "О": "o", "Р": "p", "С": "c", "Т": "t", "Х": "x", "І": "i", "Ј": "j", "Ѕ": "s",
  // Greek
  "α": "a", "β": "b", "ε": "e", "η": "n", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u",
  "χ": "x", "γ": "y", "ό": "o", "Α": "a", "Β": "b", "Ε": "e", "Η": "h", "Ι": "i", "Κ": "k", "Μ": "m", "Ν": "n",
  "Ο": "o", "Ρ": "p", "Τ": "t", "Χ": "x", "Υ": "y", "Ζ": "z",
  // Cherokee capitals that look like Latin ones
  "Ꭺ": "a", "Ᏼ": "b", "Ꮯ": "c", "Ꭰ": "d", "Ꭼ": "e", "Ꮐ": "g", "Ꮋ": "h", "Ꭻ": "j", "Ꮶ": "k", "Ꮮ": "l", "Ꮇ": "m",
  "Ꮲ": "p", "Ꭱ": "r", "Ꮪ": "s", "Ꭲ": "t", "Ꮩ": "v", "Ꮃ": "w", "Ꮓ": "z",
  // small capitals
  "ᴀ": "a", "ʙ": "b", "ᴄ": "c", "ᴅ": "d", "ᴇ": "e", "ꜰ": "f", "ɢ": "g", "ʜ": "h", "ɪ": "i", "ᴊ": "j", "ᴋ": "k", "ʟ": "l",
  "ᴍ": "m", "ɴ": "n", "ᴏ": "o", "ᴘ": "p", "ǫ": "q", "ʀ": "r", "ꜱ": "s", "ᴛ": "t", "ᴜ": "u", "ᴠ": "v", "ᴡ": "w", "ʏ": "y", "ᴢ": "z",
};
const LEET = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s" };
// A model family name followed by a version is a model id whatever follows ("gpt-6-sol", "claude 4 opus").
const MODEL_FAMILIES = new Set(["claude", "gpt", "chatgpt", "codex", "gemini", "grok", "qwen", "deepseek", "mistral", "mixtral",
  "llama", "sonnet", "opus", "haiku", "fable", "kimi", "cohere", "copilot"]);
const VERSION_RE = /^v?\d[\d.]*[a-z]?$/; // "4", "3.5", "4o", "v2", a date part
const TRAILING_VERSION_RE = /[\d.]+[a-z]?$/; // "gpt4o" -> "gpt", "opus4.5" -> "opus"
const O_SERIES_RE = /^o\d+(?:[-\s]?(?:mini|pro|preview))?$/;
const BOT_EMAIL_RE = /no-?reply|\[bot\]|(?:^|[^a-z0-9])bot@|@(?:anthropic|openai)\.com\b/;

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
  // The Codex model names this project configures ("gpt-6-sol") are agent names too.
  for (const agent of Object.values(manifest?.codex?.agents ?? {})) {
    if (agent && typeof agent.model === "string" && agent.model.trim()) out.add(agent.model.trim().toLowerCase());
  }
  namesFromAgentFiles(path.join(root, ".claude", "agents"), out);
  return [...out].sort();
}
const SHIPPED = new Set(shippedAgentNames());

/** The value as it is judged: lookalikes folded, NFKC, no format characters, spaces collapsed, lowercased, trimmed. */
function normalizeIdentity(value) {
  return [...value.normalize("NFKC")].map((ch) => LOOKALIKES[ch] ?? ch).join("")
    .replace(/\p{Cf}/gu, "").toLowerCase()
    .replace(/\s+/g, " ").replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, "");
}

const leet = (t) => [...t].map((ch) => LEET[ch] ?? ch).join("");
// A word is denied as written, without a trailing version, or with leetspeak digits folded.
function deniedWord(t) {
  if (DENY_WORDS.has(t)) return true;
  const unversioned = t.replace(TRAILING_VERSION_RE, "");
  if (unversioned && DENY_WORDS.has(unversioned)) return true;
  const folded = leet(t);
  return DENY_WORDS.has(folded) || DENY_WORDS.has(folded.replace(TRAILING_VERSION_RE, ""));
}
// One word made only of denied words run together ("claudecode"); each piece at least 2 letters.
function runTogether(word) {
  const ok = new Array(word.length + 1).fill(false);
  ok[0] = true;
  for (let end = 2; end <= word.length; end++)
    for (let start = 0; start <= end - 2 && !ok[end]; start++)
      if (ok[start] && DENY_WORDS.has(word.slice(start, end))) ok[end] = true;
  return ok[word.length];
}

/** True when `value` is empty, or (as a whole) names an agent, model, tool, role, lens or placeholder rather than a person. */
function isAgentIdentity(value) {
  if (typeof value !== "string") return true;
  if (/[<>{}[\]]/.test(value)) return true;
  const v = normalizeIdentity(value);
  if (!v) return true;
  if (BOT_EMAIL_RE.test(v) || O_SERIES_RE.test(v) || /^harness-/.test(v)) return true;
  if (/^(?:approved by|user['’]s|user \()/.test(v)) return true;
  if (SHIPPED.has(v) || SHIPPED.has(v.replace(/\s+/g, "-")) || SHIPPED.has(v.replace(TRAILING_VERSION_RE, "").replace(/[\s-]+$/, ""))) return true;
  const raw = v.split(/[^\p{L}\p{N}@$]+/u).filter(Boolean);
  if (raw.length >= 2 && MODEL_FAMILIES.has(raw[0]) && VERSION_RE.test(raw[1])) return true;
  const words = raw.filter((t) => !VERSION_RE.test(t));
  if (words.length === 0) return true; // only numbers or punctuation: no name at all
  if (words.every((t) => t.length === 1)) return deniedWord(words.join("")) || runTogether(words.join(""));
  if (words.every(deniedWord)) return true;
  return words.length === 1 && (runTogether(words[0]) || runTogether(leet(words[0]).replace(TRAILING_VERSION_RE, "")));
}

module.exports = { isAgentIdentity, normalizeIdentity, shippedAgentNames, DENY_WORDS };
