#!/usr/bin/env node
/**
 * check-browser-walk-receipts.mjs — did a todo DECLARE its browser-walk disposition before it
 * closed? Invoked at `.harness/phases/implement.md` § 7a (per todo, before it moves to
 * `completed/`) and `.harness/phases/redteam.md` § 2 (over the wave's completed todos).
 *
 * PROPOSITION — exact, over a parsed document section: inside the todo's `## Verification`
 * section, EITHER a `### Browser walk receipt` block whose `Steps:` / `Observed:` /
 * `Disposition:` fields are all non-empty and whose Disposition is one of `proceed` / `blocked` /
 * `confused` (`.claude/rules/user-flow-validation.md` MUST-2), OR exactly one
 * `Browser walk: not applicable — <reason>` line with a non-empty reason, is present — never
 * both, never neither.
 *
 * NOT ASSERTED, deliberately: whether the walk was headed, navigated as a real user, or honest;
 * whether an N/A reason is true. Those are semantic and belong to the reviewer at `/redteam` —
 * this script only closes the SILENT omission, the failure mode that let user-observable work
 * close with no walk declaration at all.
 *
 * Falsifying result (`.claude/rules/instrument-discipline.md` MUST-1): a todo with no declaration
 * prints `FAIL <file>: ...` and the process exits 1; a declared not-applicable line exits 0.
 * `.harness/tests/shared-adapters.mjs` pins both, plus a declaration that says both at once.
 *
 * Exit: 0 every file declared · 1 one or more findings · 2 usage error · 3 UNRUN — no todo
 * file resolved, which is explicitly NOT a pass.
 */

import { readFileSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERIFICATION_HEADING_RE = /^##\s+Verification\b/;
const LEVEL2_HEADING_RE = /^##\s/;
const LEVEL3_HEADING_RE = /^###\s/;
const RECEIPT_HEADING_RE = /^###\s+Browser walk receipt\b/i;
// `**Steps:**` (colon inside the bold) and `**Steps**:` (outside) are both common; accept either.
const NOT_APPLICABLE_RE =
  /^[\s>*_`-]*(?:\*\*)?Browser walk(?::\*\*|\*\*:|:)\s*not applicable\s*(?:[—–-]+\s*)?(.*)$/i;
const FIELD_RE =
  /^[\s>*_`-]*(?:\*\*)?(Steps|Observed|Disposition)(?::\*\*|\*\*:|:)\s*(.*)$/;
const DISPOSITION_RE = /^(proceed|blocked|confused)\b/i;
// `proceed` is the only disposition that is evidence the flow WORKS; `blocked` / `confused` are a
// complete, honest receipt of a walk that found it broken — declared (never silent), but not done.
const DISPOSITION_OK_RE = /^proceed\b/i;
const REQUIRED_FIELDS = ["Steps", "Observed", "Disposition"];

function sliceSection(lines, startIdx, endRe) {
  const out = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (endRe.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

function parseReceiptFields(blockLines) {
  const fields = {};
  let current = null;
  for (const line of blockLines) {
    const m = line.match(FIELD_RE);
    if (m) {
      current = m[1];
      fields[current] = (fields[current] || "") + m[2].trim();
      continue;
    }
    if (current && line.trim()) fields[current] += "\n" + line.trim();
  }
  return fields;
}

/**
 * @param {string} text the full todo markdown
 * @returns {{status: "receipt"|"not-applicable"|"walk-blocked"|"undeclared"|"contradictory"|"incomplete"|"no-verification-section", detail: string}}
 */
export function assessTodoText(text) {
  if (typeof text !== "string")
    return { status: "no-verification-section", detail: "not a string" };
  const lines = text.split(/\r?\n/);
  const vIdx = lines.findIndex((l) => VERIFICATION_HEADING_RE.test(l));
  if (vIdx === -1) {
    return {
      status: "no-verification-section",
      detail: "no `## Verification` section",
    };
  }
  const section = sliceSection(lines, vIdx, LEVEL2_HEADING_RE);

  const naLines = section.filter((l) => NOT_APPLICABLE_RE.test(l));
  const rIdx = section.findIndex((l) => RECEIPT_HEADING_RE.test(l));

  if (rIdx !== -1 && naLines.length > 0) {
    return {
      status: "contradictory",
      detail: "both a receipt block and a not-applicable line",
    };
  }
  if (rIdx === -1 && naLines.length === 0) {
    return {
      status: "undeclared",
      detail:
        "no `### Browser walk receipt` and no `Browser walk: not applicable — <reason>`",
    };
  }
  if (rIdx === -1) {
    if (naLines.length > 1) {
      return {
        status: "contradictory",
        detail: `${naLines.length} not-applicable lines`,
      };
    }
    const reason = (naLines[0].match(NOT_APPLICABLE_RE)[1] || "").trim();
    if (!reason)
      return {
        status: "incomplete",
        detail: "not-applicable line has no reason",
      };
    return { status: "not-applicable", detail: reason };
  }

  const block = sliceSection(section, rIdx, LEVEL3_HEADING_RE);
  const fields = parseReceiptFields(block);
  const missing = REQUIRED_FIELDS.filter((f) => !(fields[f] || "").trim());
  if (missing.length) {
    return {
      status: "incomplete",
      detail: `receipt missing/empty: ${missing.join(", ")}`,
    };
  }
  if (!DISPOSITION_RE.test(fields.Disposition.trim())) {
    return {
      status: "incomplete",
      detail: `Disposition must start with proceed|blocked|confused, got: ${fields.Disposition.trim().slice(0, 40)}`,
    };
  }
  const disposition = fields.Disposition.trim().split("\n")[0];
  if (!DISPOSITION_OK_RE.test(disposition)) {
    return {
      status: "walk-blocked",
      detail: `walk declared but the flow did not work: ${disposition.slice(0, 60)} — fix it before closing (user-flow-validation.md MUST-1)`,
    };
  }
  return { status: "receipt", detail: disposition };
}

export const OK_STATUSES = new Set(["receipt", "not-applicable"]);

/** Returns { files, unresolvable } — an argument that resolves to nothing is a FINDING, never a silent skip. */
function resolveTodoFiles(args) {
  const files = [];
  const unresolvable = [];
  for (const a of args) {
    const p = resolve(a);
    let st;
    try {
      st = statSync(p);
    } catch {
      unresolvable.push(a);
      continue;
    }
    if (st.isDirectory()) {
      for (const f of readdirSync(p))
        if (f.endsWith(".md")) files.push(join(p, f));
    } else if (st.isFile()) {
      files.push(p);
    } else {
      unresolvable.push(a);
    }
  }
  return { files, unresolvable };
}

export function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--"));
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(
      "usage: check-browser-walk-receipts.mjs <todo.md | todos-dir> [...]\n" +
        "exit 0 declared · 1 findings · 2 usage · 3 UNRUN (no files)\n",
    );
    return 2;
  }
  if (args.length === 0) {
    process.stdout.write("UNRUN: no todo path given — this is NOT a pass\n");
    return 3;
  }
  const { files, unresolvable } = resolveTodoFiles(args);
  let findings = 0;
  for (const a of unresolvable) {
    findings++;
    process.stdout.write(
      `FAIL ${a}: unresolvable — no such file or directory\n`,
    );
  }
  for (const f of files) {
    const { status, detail } = assessTodoText(readFileSync(f, "utf8"));
    if (OK_STATUSES.has(status)) {
      process.stdout.write(`ok   ${f}: ${status} — ${detail}\n`);
    } else {
      findings++;
      process.stdout.write(`FAIL ${f}: ${status} — ${detail}\n`);
    }
  }
  process.stdout.write(
    `browser-walk receipts: ${files.length - (findings - unresolvable.length)} declared, ${findings} finding(s) across ${files.length} todo(s)${unresolvable.length ? ` + ${unresolvable.length} unresolvable path(s)` : ""}\n`,
  );
  return findings > 0 ? 1 : 0;
}

const isMain =
  !!process.argv[1] &&
  realpathSync(process.argv[1]) ===
    realpathSync(fileURLToPath(import.meta.url));
if (isMain) process.exit(main(process.argv.slice(2)));
