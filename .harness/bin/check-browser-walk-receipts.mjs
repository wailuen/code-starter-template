#!/usr/bin/env node
/**
 * check-browser-walk-receipts.mjs — did a todo DECLARE its browser-walk disposition before it
 * closed? Invoked at `.harness/phases/implement.md` § 3a (per todo, before it moves to
 * `completed/`) and `.harness/phases/redteam.md` § 2 (over the wave's completed todos).
 *
 * PROPOSITION — exact, over a parsed document section: inside the todo's `## Verification`
 * section, EITHER a `### Browser walk receipt` block whose `Steps:` / `Observed:` /
 * `Disposition:` fields are all non-empty and whose Disposition is one of `proceed` / `blocked` /
 * `confused` (`.claude/rules/user-flow-validation.md` MUST-2), OR exactly one
 * `Browser walk: not applicable — <reason>` line with a real reason (at least two words and eight
 * letters), not indented as a code block (four spaces or a tab), is present —
 * never both, never neither. The heading must be exactly `## Verification` and appear once;
 * anything inside a fenced code block (``` or ~~~) is an example and is ignored; when the section
 * has several receipt blocks, every one is judged, so a later `blocked` / `confused` walk is not
 * hidden behind an earlier `proceed`.
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
 * path given, or the paths given hold no `.md` file (an empty directory), which is explicitly
 * NOT a pass.
 */

import { readFileSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERIFICATION_HEADING_RE = /^##\s+Verification\s*$/;
const LEVEL2_HEADING_RE = /^##\s/;
const LEVEL3_HEADING_RE = /^###\s/;
const RECEIPT_HEADING_RE = /^###\s+Browser walk receipt\b/i;
// `**Steps:**` (colon inside the bold) and `**Steps**:` (outside) are both common; accept either.
// At most three leading spaces: four spaces or a tab make an indented code block — an example,
// not a declaration. After that, list / quote / emphasis markers are allowed.
const NOT_APPLICABLE_RE =
  /^ {0,3}(?:[>*_`-][\s>*_`-]*)?(?:\*\*)?Browser walk(?::\*\*|\*\*:|:)\s*not applicable\s*(?:[—–-]+\s*)?(.*)$/i;
const FIELD_RE =
  /^[\s>*_`-]*(?:\*\*)?(Steps|Observed|Disposition)(?::\*\*|\*\*:|:)\s*(.*)$/;
const DISPOSITION_RE = /^(proceed|blocked|confused)\b/i;
// `proceed` is the only disposition that is evidence the flow WORKS; `blocked` / `confused` are a
// complete, honest receipt of a walk that found it broken — declared (never silent), but not done.
const DISPOSITION_OK_RE = /^proceed\b/i;
const REQUIRED_FIELDS = ["Steps", "Observed", "Disposition"];
// A not-applicable reason must say something: at least two words and eight letters in all
// ("command-line tool, no screen" passes; ".", "N/A", "the" and "no UI" do not).
const isRealReason = (reason) =>
  (reason.match(/\p{L}{2,}/gu) || []).length >= 2 && (reason.match(/\p{L}/gu) || []).length >= 8;
const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

// Fenced blocks are examples, never declarations: blank their lines (keeping line positions)
// before any heading or field is matched. An unclosed fence blanks the rest of the file.
function stripFences(lines) {
  const out = [];
  let fence = null;
  for (const line of lines) {
    const m = line.match(FENCE_RE);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && /^\s{0,3}[`~]+\s*$/.test(line)) fence = null;
      out.push("");
    } else if (m) {
      fence = m[1];
      out.push("");
    } else out.push(line);
  }
  return out;
}

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
  const lines = stripFences(text.split(/\r?\n/));
  const vIdxs = lines.flatMap((l, i) => (VERIFICATION_HEADING_RE.test(l) ? [i] : []));
  if (vIdxs.length === 0) {
    return {
      status: "no-verification-section",
      detail: "no `## Verification` section (the heading must be exactly that)",
    };
  }
  if (vIdxs.length > 1) {
    return {
      status: "contradictory",
      detail: `${vIdxs.length} \`## Verification\` sections — keep exactly one`,
    };
  }
  const section = sliceSection(lines, vIdxs[0], LEVEL2_HEADING_RE);

  const naLines = section.filter((l) => NOT_APPLICABLE_RE.test(l));
  const rIdxs = section.flatMap((l, i) => (RECEIPT_HEADING_RE.test(l) ? [i] : []));
  const rIdx = rIdxs.length ? rIdxs[0] : -1;

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
    if (!isRealReason(reason))
      return {
        status: "incomplete",
        detail: `not-applicable line has no real reason${reason ? `: ${JSON.stringify(reason.slice(0, 40))}` : ""}`,
      };
    return { status: "not-applicable", detail: reason };
  }

  // Every receipt block is judged; the first that is not a complete `proceed` decides.
  let ok = null;
  for (const idx of rIdxs) {
    const result = assessReceiptBlock(sliceSection(section, idx, LEVEL3_HEADING_RE));
    if (result.status !== "receipt") return result;
    ok ??= result;
  }
  return ok;
}

function assessReceiptBlock(block) {
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
  if (files.length === 0 && unresolvable.length === 0) {
    process.stdout.write(
      `UNRUN: no todo (.md) file found in ${args.join(" ")} — this is NOT a pass\n`,
    );
    return 3;
  }
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
