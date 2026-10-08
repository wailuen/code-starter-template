#!/usr/bin/env node
// Structure and approval check for a workspace's clickable prototype (`.harness/phases/prototype.md`).
//   node .harness/bin/check-prototype.mjs workspaces/<project>                      # while designing
//   node .harness/bin/check-prototype.mjs --require-approval workspaces/<project>   # before merging
// Prints {"ok", "screens", "approvals", "phases": {<phase>: {status, hash, ...}}, "screen_check", "errors"}.
// Exit: 0 ok · 1 findings · 2 usage error or no prototype folder.
//
// Structure: the required files exist; the first table under `## Screens` in SCREENS.md lists every
// screen once, as a page under screens/; every page under screens/ is listed (a state page
// `<listed-stem>--<state>.html` counts as listed); index.html links every screen and its
// `views.html?screen=<file>` view; every local link, script, image and stylesheet resolves to a
// file inside prototype/; nothing is loaded from the internet (an <a href> to an outside site is
// only a link, so it is allowed).
//
// Approval: each PRD phase has a content hash over its SCREENS.md rows, its pages and the shared
// files (styles, images, scripts, DESIGN.md). A phase is "approved" only when the newest
// APPROVAL.md record naming it approved it with the hash it has now; a page or style change, or a
// record that holds the phase, makes it "awaiting approval". The SCREENS.md Approval column must
// agree. --require-approval also needs: every phase approved or held by the user, at least one
// approved phase, and a screen check that passed (or that the user accepted as owed).
// It checks structure only; the screen check and the design critique judge the design itself.
import { readFileSync, existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { resolve, join, dirname, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { isAgentIdentity } from "../lib/agent-identity.cjs";

const REQUIRED = ["index.html", "views.html", "styles.css", "SCREENS.md", "DESIGN.md"];
// Files outside every phase's hash: navigation, records and the no-screens note.
const UNHASHED = new Set(["index.html", "views.html", "SCREENS.md", "APPROVAL.md", "00-no-screens.md"]);
const IGNORED = new Set([".screenshots", ".DS_Store"]); // local-only, never committed
const PHASE = /^[0-9A-Za-z][0-9A-Za-z.]*$/; // 0, 1, 1a, MVP, 2.1
const STATUSES = ["approved", "awaiting approval"];
const REMOTE = /^(https?:)?\/\//i;

function inside(root, path) {
  if (!existsSync(path)) return false;
  const rel = relative(realpathSync(root), realpathSync(path));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

// Every file under dir. A symlink is never followed into a directory; one whose target is not a
// file inside the prototype is reported, so nothing outside it is hashed or served.
function walk(dir, out = [], root = dir, errors = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      if (inside(root, path) && statSync(path).isFile()) out.push(path);
      else errors.push(`symlink leaves prototype/ or is not a file: ${relative(root, path)}`);
    } else if (entry.isDirectory()) walk(path, out, root, errors);
    else out.push(path);
  }
  return out;
}

const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "")
  .split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));

// The first table under a `## Screens` heading. Returns { rows, approvalColumn, problem }.
export function parseScreens(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^#{1,6}\s+Screens\s*$/i.test(l));
  if (start === -1) return { rows: [], approvalColumn: false, problem: "SCREENS.md has no '## Screens' heading" };
  let i = start + 1;
  while (i < lines.length && !/^\s*\|/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i])) i++;
  if (i >= lines.length || !/^\s*\|/.test(lines[i])) return { rows: [], approvalColumn: false, problem: "SCREENS.md lists no screens" };
  const header = splitRow(lines[i]).map((c) => c.toLowerCase());
  const col = (name) => header.indexOf(name);
  const rows = [];
  for (i += 1; i < lines.length && /^\s*\|/.test(lines[i]); i++) {
    if (/^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(lines[i])) continue; // separator, with or without alignment
    const cells = splitRow(lines[i]);
    const at = (name) => (col(name) === -1 ? "" : cells[col(name)] ?? "");
    rows.push({
      name: at("screen"), phase: at("phase"), file: at("file").match(/^`([^`]+)`$/)?.[1] ?? null,
      approval: at("approval").toLowerCase(), raw: lines[i].trim(),
      // What the user saw for this row, without the Approval cell (that cell follows the records).
      content: cells.filter((_, k) => k !== col("approval")).join(" | "),
    });
  }
  return { rows, approvalColumn: col("approval") !== -1, problem: rows.length ? null : "SCREENS.md lists no screens" };
}

const list = (value) => value.split(",").map((s) => s.trim()).filter(Boolean);

export function parseApprovals(text) {
  return text.split(/^## Approval\b.*$/m).slice(1).map((body) => {
    const field = (name) => body.match(new RegExp(`^${name}:[ \\t]*(.*)$`, "m"))?.[1].trim() ?? "";
    const hashes = {};
    for (const pair of list(field("hashes"))) { const [p, h = ""] = pair.split("=").map((s) => s.trim()); hashes[p] = h; }
    return { approved_by: field("approved_by"), approved_on: field("approved_on"), approval: field("approval"),
      phases: field("phases"), held: field("held"), hashes };
  });
}

function realDate(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// References a page, stylesheet, SVG or script loads or links to.
// kind: "link" (only navigates), "load" (fetched to show the page), "base", "script-url".
function references(text, type) {
  const refs = [];
  const add = (kind, value) => refs.push({ kind, value: value.trim() });
  if (type === "markup") {
    const markup = text.replace(/<!--[\s\S]*?-->/g, "");
    for (const tag of markup.matchAll(/<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
      const name = tag[1].toLowerCase();
      const attrs = {};
      for (const a of tag[2].matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g))
        attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? "";
      const href = attrs.href ?? attrs["xlink:href"];
      if (name === "base") { add("base", href ?? ""); continue; }
      if (href !== undefined) add(["a", "area"].includes(name) ? "link" : "load", href);
      if (attrs.src !== undefined) add("load", attrs.src);
      if (attrs.poster !== undefined) add("load", attrs.poster);
      if (name === "object" && attrs.data !== undefined) add("load", attrs.data);
      if (attrs.srcset !== undefined)
        for (const c of attrs.srcset.matchAll(/(?:^|,)\s*([^\s,][^\s]*?),?(?=\s|$)/g)) add("load", c[1]);
      if (name === "meta" && /^refresh$/i.test(attrs["http-equiv"] ?? "")) {
        const url = (attrs.content ?? "").match(/url\s*=\s*['"]?([^'"]+)/i)?.[1];
        if (url) add("load", url);
      }
    }
    for (const s of markup.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) refs.push(...references(s[1], "script"));
  }
  if (type === "script") {
    for (const m of text.matchAll(/["'`]((?:https?:)?\/\/[^"'`\s]+)/gi))
      if (!/^https?:\/\/www\.w3\.org\//i.test(m[1])) add("script-url", m[1]);
    return refs;
  }
  for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add("load", m[1]);
  for (const m of text.matchAll(/@import\s+["']([^"']+)["']/gi)) add("load", m[1]);
  return refs;
}

// The local file a reference points to, or { malformed } / { skip }.
function localTarget(value, baseDir) {
  if (value === "" || /^(#|\?|mailto:|tel:|data:|javascript:)/i.test(value)) return { skip: true };
  const target = value.split(/[?#]/)[0];
  if (target === "") return { skip: true };
  try { return { path: resolve(baseDir, decodeURI(target)) }; } catch { return { malformed: true }; }
}

const sha = (data) => createHash("sha256").update(data).digest("hex");

export function checkPrototype(workspace, { requireApproval = false } = {}) {
  const dir = resolve(workspace, "prototype");
  const errors = [];
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { usage: `No prototype folder at ${dir}` };
  const files = walk(dir, [], dir, errors);
  const noScreens = join(dir, "00-no-screens.md");
  if (existsSync(noScreens)) {
    if (files.length === 1 && errors.length === 0) return { ok: true, screens: 0, approvals: 0, phases: {}, errors, note: "product has no screens (00-no-screens.md)" };
    errors.push("00-no-screens.md sits next to screen files: the product now has screens, so delete it and approve the prototype");
  }

  for (const name of REQUIRED) if (!existsSync(join(dir, name))) errors.push(`missing ${name}`);

  const screensDir = join(dir, "screens") + sep;
  let rows = [];
  let screensText = "";
  if (existsSync(join(dir, "SCREENS.md"))) {
    screensText = readFileSync(join(dir, "SCREENS.md"), "utf8");
    const parsed = parseScreens(screensText);
    rows = parsed.rows;
    if (parsed.problem) errors.push(parsed.problem);
    else if (!parsed.approvalColumn) errors.push("SCREENS.md table needs an Approval column (approved / awaiting approval)");
  }
  const listed = new Map(); // page path -> row
  for (const row of rows) {
    if (!row.file) { errors.push(`SCREENS.md row has no file in backticks: ${row.raw}`); continue; }
    if (!PHASE.test(row.phase)) errors.push(`SCREENS.md row "${row.name}" has no PRD phase (0, 1, 1a …): ${row.raw}`);
    const path = resolve(dir, row.file);
    if (!path.startsWith(screensDir) || !path.endsWith(".html")) { errors.push(`screen file must be a page under screens/: ${row.file}`); continue; }
    if (!inside(dir, path)) errors.push(`screen file missing or outside prototype/: ${row.file}`);
    else if (listed.has(path)) errors.push(`screen file listed twice: ${row.file}`);
    if (!listed.has(path)) listed.set(path, row);
  }

  // Which phase each page belongs to: the listed page and its `--<state>` pages.
  const pagePhase = new Map();
  for (const page of files.filter((f) => f.startsWith(screensDir) && f.endsWith(".html"))) {
    const owner = listed.get(page) ?? [...listed].find(([p]) => page.startsWith(`${p.replace(/\.html$/, "")}--`))?.[1];
    if (owner) pagePhase.set(page, owner.phase);
    else errors.push(`page not listed in SCREENS.md: ${relative(dir, page)}`);
  }

  if (existsSync(join(dir, "index.html"))) {
    const linked = new Set();
    const viewed = new Set();
    for (const r of references(readFileSync(join(dir, "index.html"), "utf8"), "markup").filter((x) => x.kind === "link")) {
      const t = localTarget(r.value, dir);
      if (!t.path) continue;
      linked.add(t.path);
      if (t.path === join(dir, "views.html")) {
        const screen = new URLSearchParams(r.value.split("#")[0].split("?")[1] ?? "").get("screen");
        if (screen) viewed.add(resolve(dir, screen));
      }
    }
    for (const path of listed.keys()) {
      if (!linked.has(path)) errors.push(`index.html does not link ${relative(dir, path)}`);
      if (!viewed.has(path)) errors.push(`index.html does not link the phone · tablet · desktop view of ${relative(dir, path)} (views.html?screen=${relative(dir, path)})`);
    }
  }

  for (const file of files) {
    const type = /\.(html?|svg)$/i.test(file) ? "markup" : /\.css$/i.test(file) ? "css" : /\.m?js$/i.test(file) ? "script" : null;
    if (!type) continue;
    const name = relative(dir, file);
    for (const ref of references(readFileSync(file, "utf8"), type)) {
      const v = ref.value;
      if (ref.kind === "base") { errors.push(`${name} uses <base>, which changes where every link points; remove it: ${v}`); continue; }
      if (ref.kind === "script-url") { errors.push(`${name} script refers to the internet: ${v}`); continue; }
      if (REMOTE.test(v)) {
        if (ref.kind === "load") errors.push(`${name} loads from the internet: ${v}`);
        continue;
      }
      const t = localTarget(v, dirname(file));
      if (t.malformed) errors.push(`${name} has a malformed link: ${v}`);
      else if (t.path && !inside(dir, t.path)) errors.push(`${name} points to a missing file or outside prototype/: ${v}`);
    }
  }

  // One content hash per phase: its rows, its pages and every shared design file.
  const shared = files.filter((f) => !pagePhase.has(f) && !(f.startsWith(screensDir) && f.endsWith(".html"))
    && !UNHASHED.has(relative(dir, f)));
  const phases = {};
  for (const phase of [...new Set(rows.filter((r) => r.file).map((r) => r.phase))]) {
    const parts = rows.filter((r) => r.phase === phase).map((r) => `row\0${r.content}`);
    for (const f of [...shared, ...[...pagePhase].filter(([, p]) => p === phase).map(([f]) => f)])
      parts.push(`file\0${relative(dir, f).split(sep).join("/")}\0${sha(readFileSync(f))}`);
    phases[phase] = { status: "awaiting approval", hash: sha(parts.sort().join("\n")).slice(0, 16), reason: "no approval record names it" };
  }

  let approvals = [];
  if (existsSync(join(dir, "APPROVAL.md"))) {
    approvals = parseApprovals(readFileSync(join(dir, "APPROVAL.md"), "utf8"));
    if (approvals.length === 0) errors.push("APPROVAL.md has no '## Approval <n>' record");
    approvals.forEach((a, i) => {
      const n = i + 1;
      if (!a.approved_by) errors.push(`approval ${n}: approved_by is empty`);
      else if (isAgentIdentity(a.approved_by)) errors.push(`approval ${n}: approved_by must name the person who approved, not an agent or placeholder: ${JSON.stringify(a.approved_by)}`);
      if (!realDate(a.approved_on)) errors.push(`approval ${n}: approved_on must be a real date, YYYY-MM-DD`);
      if (!/^".+"$/.test(a.approval)) errors.push(`approval ${n}: approval must quote the user's words`);
      const approved = list(a.phases);
      const held = list(a.held).filter((p) => p.toLowerCase() !== "none");
      if (approved.length + held.length === 0 || ![...approved, ...held].every((p) => PHASE.test(p)))
        errors.push(`approval ${n}: phases must list PRD phases, e.g. 0, 1, 2 (and held: the phases the user held)`);
      for (const p of approved) {
        if (held.includes(p)) errors.push(`approval ${n}: phase ${p} is both approved and held`);
        if (!/^[0-9a-f]{16}$/.test(a.hashes[p] ?? "")) errors.push(`approval ${n}: hashes has no entry for phase ${p} (copy it from this checker's output)`);
      }
      for (const p of approved) if (phases[p]) {
        phases[p] = a.hashes[p] === phases[p].hash
          ? { status: "approved", hash: phases[p].hash, approval: n }
          : { status: "awaiting approval", hash: phases[p].hash, reason: `changed since approval ${n}` };
      }
      for (const p of held) if (phases[p]) phases[p] = { status: "awaiting approval", hash: phases[p].hash, reason: `held by the user in approval ${n}`, held: true };
    });
  } else if (requireApproval) errors.push("missing APPROVAL.md (the user has not approved the prototype)");

  for (const row of rows) {
    const phase = phases[row.phase];
    if (!phase || !row.file) continue;
    if (!STATUSES.includes(row.approval)) errors.push(`SCREENS.md row "${row.name}" Approval must be "approved" or "awaiting approval": ${row.raw}`);
    else if (row.approval !== phase.status)
      errors.push(`SCREENS.md row "${row.name}" says "${row.approval}" but phase ${row.phase} is ${phase.status}${phase.reason ? ` (${phase.reason})` : ""}`);
  }

  const checkLine = [...screensText.matchAll(/^Screen check:[ \t]*(.*)$/gm)].pop()?.[1] ?? null;
  const screen_check = checkLine === null ? "missing" : /^passed\b/i.test(checkLine) ? "passed" : /^owed\b/i.test(checkLine) ? "owed" : "unknown";
  if (requireApproval) {
    for (const [p, s] of Object.entries(phases))
      if (s.status !== "approved" && !s.held) errors.push(`phase ${p}: ${s.reason}; show the user and take a new approval (or record the phase as held)`);
    if (approvals.length && !Object.values(phases).some((s) => s.status === "approved")) errors.push("no PRD phase is approved");
    if (screen_check === "missing") errors.push("SCREENS.md has no 'Screen check:' line");
    else if (screen_check === "owed") {
      const by = checkLine.match(/accepted by\s+(.+?)(?:\s+\d{4}-\d{2}-\d{2})?\s*$/i)?.[1] ?? "";
      if (!by || isAgentIdentity(by)) errors.push("screen check is owed and no person accepted that: run it, or add '; accepted by <name> <date>' after the user agrees");
    } else if (screen_check !== "passed") errors.push(`Screen check line must start with "passed" or "owed": ${checkLine}`);
  }

  return { ok: errors.length === 0, screens: listed.size, approvals: approvals.length, phases, screen_check, errors };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
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
