#!/usr/bin/env node
// Structure check for a workspace's clickable prototype (`.harness/phases/prototype.md`).
//   node .harness/bin/check-prototype.mjs workspaces/<project>                      # while designing
//   node .harness/bin/check-prototype.mjs --require-approval workspaces/<project>   # after the user approved
// Prints {"ok": bool, "screens": n, "approvals": n, "errors": [...]}.
// Exit: 0 ok · 1 findings · 2 usage error or no prototype folder.
//
// Checks: the required files exist; every SCREENS.md row names a page that exists inside
// prototype/; every page under screens/ is listed (a state page `<listed-stem>--<state>.html`
// counts as listed); index.html links every listed screen; every local link, script, image and
// stylesheet in the pages resolves to a file inside prototype/; nothing is loaded from the
// internet (an <a href> to an outside site is only a link, so it is allowed); each APPROVAL.md
// record names a person (never an agent), a date, the quoted words and the phases.
// It checks structure only; the screen check and the design critique judge the design itself.
import { readFileSync, existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { resolve, join, dirname, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isAgentIdentity } from "../lib/agent-identity.cjs";

const REQUIRED = ["index.html", "views.html", "styles.css", "SCREENS.md", "DESIGN.md"];

function inside(root, path) {
  if (!existsSync(path)) return false;
  const rel = relative(realpathSync(root), realpathSync(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue; // .screenshots and other local-only folders
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out); else out.push(path);
  }
  return out;
}

export function parseScreens(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!/^\s*\|/.test(line) || /^\s*\|\s*-/.test(line)) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells[0].toLowerCase() === "screen") continue;
    rows.push({ name: cells[0], phase: cells[1] ?? "", file: (cells[2] ?? "").match(/^`([^`]+)`$/)?.[1] ?? null, raw: line.trim() });
  }
  return rows;
}

export function parseApprovals(text) {
  return text.split(/^## Approval\b.*$/m).slice(1).map((body) => {
    const field = (name) => body.match(new RegExp(`^${name}:[ \\t]*(.*)$`, "m"))?.[1].trim() ?? "";
    return { approved_by: field("approved_by"), approved_on: field("approved_on"), approval: field("approval"), phases: field("phases") };
  });
}

// Local references a page or stylesheet loads or links to.
function references(text, isCss) {
  const refs = [];
  const add = (kind, value) => refs.push({ kind, value: value.trim() });
  if (!isCss) {
    for (const m of text.matchAll(/<a\b[^>]*?\shref\s*=\s*["']([^"']*)["']/gi)) add("link", m[1]);
    for (const m of text.matchAll(/<(?:script|img|iframe|source|video|audio|embed)\b[^>]*?\ssrc\s*=\s*["']([^"']*)["']/gi)) add("load", m[1]);
    for (const m of text.matchAll(/<link\b[^>]*?\shref\s*=\s*["']([^"']*)["']/gi)) add("load", m[1]);
  }
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add("load", m[1]);
  for (const m of text.matchAll(/@import\s+["']([^"']+)["']/gi)) add("load", m[1]);
  return refs;
}

export function checkPrototype(workspace, { requireApproval = false } = {}) {
  const dir = resolve(workspace, "prototype");
  const errors = [];
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { usage: `No prototype folder at ${dir}` };
  if (existsSync(join(dir, "00-no-screens.md")) && !existsSync(join(dir, "index.html")))
    return { ok: true, screens: 0, approvals: 0, errors, note: "product has no screens (00-no-screens.md)" };

  for (const name of REQUIRED) if (!existsSync(join(dir, name))) errors.push(`missing ${name}`);

  const rows = existsSync(join(dir, "SCREENS.md")) ? parseScreens(readFileSync(join(dir, "SCREENS.md"), "utf8")) : [];
  if (existsSync(join(dir, "SCREENS.md")) && rows.length === 0) errors.push("SCREENS.md lists no screens");
  const listed = new Set();
  for (const row of rows) {
    if (!row.file) { errors.push(`SCREENS.md row has no file in backticks: ${row.raw}`); continue; }
    if (!/^\d+$/.test(row.phase)) errors.push(`SCREENS.md row "${row.name}" has no PRD phase number: ${row.raw}`);
    const path = resolve(dir, row.file);
    if (!inside(dir, path)) errors.push(`screen file missing or outside prototype/: ${row.file}`);
    else if (listed.has(path)) errors.push(`screen file listed twice: ${row.file}`);
    listed.add(path);
  }

  const files = walk(dir);
  const stems = [...listed].map((p) => p.replace(/\.html$/, ""));
  for (const page of files.filter((f) => f.startsWith(join(dir, "screens") + sep) && f.endsWith(".html"))) {
    if (!listed.has(page) && !stems.some((s) => page.startsWith(`${s}--`)))
      errors.push(`page not listed in SCREENS.md: ${relative(dir, page)}`);
  }

  if (existsSync(join(dir, "index.html"))) {
    const linked = new Set(references(readFileSync(join(dir, "index.html"), "utf8"), false)
      .filter((r) => r.kind === "link").map((r) => resolve(dir, r.value.split(/[?#]/)[0])));
    for (const path of listed) if (!linked.has(path)) errors.push(`index.html does not link ${relative(dir, path)}`);
  }

  for (const file of files.filter((f) => /\.(html|css)$/.test(f))) {
    for (const ref of references(readFileSync(file, "utf8"), file.endsWith(".css"))) {
      const v = ref.value;
      if (/^(https?:)?\/\//i.test(v)) {
        if (ref.kind === "load") errors.push(`${relative(dir, file)} loads from the internet: ${v}`);
        continue;
      }
      if (v === "" || /^(#|mailto:|tel:|data:|javascript:)/i.test(v)) continue;
      const target = v.split(/[?#]/)[0];
      if (target === "") continue;
      if (!inside(dir, resolve(dirname(file), decodeURI(target))))
        errors.push(`${relative(dir, file)} points to a missing file or outside prototype/: ${v}`);
    }
  }

  let approvals = [];
  if (existsSync(join(dir, "APPROVAL.md"))) {
    approvals = parseApprovals(readFileSync(join(dir, "APPROVAL.md"), "utf8"));
    if (approvals.length === 0) errors.push("APPROVAL.md has no '## Approval <n>' record");
    approvals.forEach((a, i) => {
      const n = i + 1;
      if (!a.approved_by) errors.push(`approval ${n}: approved_by is empty`);
      else if (isAgentIdentity(a.approved_by)) errors.push(`approval ${n}: approved_by must name the person who approved, not an agent or placeholder: ${JSON.stringify(a.approved_by)}`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.approved_on)) errors.push(`approval ${n}: approved_on must be YYYY-MM-DD`);
      if (!/^".+"$/.test(a.approval)) errors.push(`approval ${n}: approval must quote the user's words`);
      if (!/^\d+(\s*,\s*\d+)*$/.test(a.phases)) errors.push(`approval ${n}: phases must list PRD phase numbers, e.g. 0, 1, 2`);
    });
  } else if (requireApproval) errors.push("missing APPROVAL.md (the user has not approved the prototype)");

  return { ok: errors.length === 0, screens: listed.size, approvals: approvals.length, errors };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const requireApproval = args.includes("--require-approval");
  const rest = args.filter((a) => a !== "--require-approval");
  if (rest.length !== 1 || rest[0].startsWith("-")) {
    console.error("Usage: check-prototype.mjs [--require-approval] workspaces/<project>");
    process.exit(2);
  }
  const result = checkPrototype(rest[0], { requireApproval });
  if (result.usage) { console.error(result.usage); process.exit(2); }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
