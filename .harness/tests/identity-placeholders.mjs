// Identity self-tests for placeholder phrases and automation accounts: a value that says the
// approval has NOT happened yet ("Awaiting user", "TBC") or names a CI bot ("github-actions",
// "dependabot") must never pass as the person who approved something.
// Run from the repository root: `node --test ".harness/tests/*.mjs"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { isAgentIdentity } = require("../lib/agent-identity.cjs");

test("placeholder phrases that say nobody has approved yet are refused as an identity", () => {
  for (const v of ["Awaiting user", "Waiting on user", "Not yet approved", "TBC", "To be confirmed",
    "awaiting approval", "Waiting for the user", "to be decided", "yet to confirm", "Unconfirmed", "tbc."]) {
    assert.equal(isAgentIdentity(v), true, v);
  }
});

test("automation accounts and auto-filled agent labels are refused as an identity", () => {
  for (const v of ["github-actions", "GitHub Actions", "dependabot", "Dependabot", "renovate", "Implementer agent (auto)",
    "automated"]) {
    assert.equal(isAgentIdentity(v), true, v);
  }
});

test("real names, including ones that share a word with a placeholder, still pass", () => {
  for (const v of ["Jane Doe", "Wai Luen", "Will Self", "Claude Monet", "Tan Ai Ling", "Notan Lee", "Bea Waiting",
    "Toby Confirmed-Smith", "Otto Auto", "Bean", "Yet Mei", "Annabel Lee"]) {
    assert.equal(isAgentIdentity(v), false, v);
  }
});

test("names that happen to split into filler words are people, not run-together agent labels", () => {
  for (const name of ["Toby", "Anna", "Tobias", "Theo"]) assert.equal(isAgentIdentity(name), false, name);
  for (const label of ["ClaudeCode", "codexagent", "userowner", "theagent", "aibot"]) assert.equal(isAgentIdentity(label), true, label);
});

test("deferred, anonymous and role-abbreviation placeholders are refused as an identity", () => {
  for (const v of ["Owner (verbal)", "owner (chat)", "Owners (verbal)", "PO", "P.O.", "Will confirm", "will approve later",
    "TBD later", "later", "Soon", "no one", "No-one", "noone", "anonymous", "Anon", "same", "Same as above", "PO approved"]) {
    assert.equal(isAgentIdentity(v), true, v);
  }
});

test("real names that share a word with those placeholders still pass", () => {
  // "Will", "Soon" and "Po" are real given names: refused only as the whole value or inside a
  // placeholder phrase, never as one word of a longer name.
  for (const v of ["Toby", "Anna", "Claudia", "Agent Smith", "Will Smith", "Will Self", "Soon-Yi Lee", "Po Chen",
    "Nona", "Simone", "Poon Wai", "Leone", "Will Confirmed-Smith", "Sameer Khan"]) {
    assert.equal(isAgentIdentity(v), false, v);
  }
});
