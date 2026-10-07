#!/usr/bin/env node
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { normalizeRound, recordRound, findCheckoutRoot, resolveCitation } from "../lib/redteam-stall.cjs";
import { requireMainCheckout } from "../../.claude/hooks/lib/state-resolver.js";

// 2 = reassess before another round (REPLAN, or the cap's single debug round);
// 3 = stop, a named human must accept each further round.
const EXIT_CODES = { REPLAN: 2, DEBUG_ROUND: 2, ESCALATE_TO_HUMAN: 3 };
const nonempty = (s) => typeof s === "string" && s.trim().length > 0;

// State recorded before the round budget existed kept only the last round's lenses
// and decision record. The branch's earlier round files beside this one still say
// what was cited; recover it — under the same real-location keys the recorder
// stores — so a spent record cannot be re-cited on a debug round just because the
// state predates the cap. The recorder uses this only for a branch whose state
// lacks the budget fields.
function legacySeedFrom(file, round, cwd) {
  const dir = dirname(file);
  const ctx = { roots: [dir, cwd], checkoutRoot: findCheckoutRoot(dir), require: false };
  const replansConsumed = Object.create(null);
  const reviewersSeen = new Set();
  for (const name of readdirSync(dir)) {
    const candidate = join(dir, name);
    if (!/^round-.*\.json$/.test(name) || candidate === file) continue;
    let prior;
    // Only a regular file is read: a FIFO or device under this name would block the recorder.
    try { if (!lstatSync(candidate).isFile()) continue; prior = JSON.parse(readFileSync(candidate, "utf8")); } catch { continue; }
    if (!prior || typeof prior !== "object" || prior.branch !== round.branch ||
        !Number.isSafeInteger(prior.round) || prior.round < 1 || prior.round >= round.round) continue;
    if (nonempty(prior.replan)) {
      let key;
      try { key = resolveCitation(prior.replan, ctx); } catch { key = null; }
      if (key && !(Object.hasOwn(replansConsumed, key) && replansConsumed[key] <= prior.round)) replansConsumed[key] = prior.round;
    }
    if (Array.isArray(prior.expected_reviewers)) for (const id of prior.expected_reviewers) if (nonempty(id)) reviewersSeen.add(id);
  }
  return { replansConsumed, reviewersSeen: [...reviewersSeen].sort() };
}

try {
  if (process.argv.length !== 3) throw new Error("Usage: record-review-round.mjs <round.json>");
  const file = resolve(process.argv[2]);
  const round = normalizeRound(JSON.parse(readFileSync(file, "utf8")));
  const target = requireMainCheckout(process.cwd());
  if (!target.ok) throw new Error(`Cannot resolve shared review state: ${target.reason}`);
  const cwd = process.cwd();
  const outcome = recordRound(target.repoDir, round, { roundDir: dirname(file), cwd, legacySeed: legacySeedFrom(file, round, cwd) });
  console.log(JSON.stringify({ branch: round.branch, round: round.round, ...outcome }));
  if (outcome.next) console.log(outcome.next);
  process.exitCode = EXIT_CODES[outcome.action] ?? 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = EXIT_CODES[error.code] ?? 1;
}
