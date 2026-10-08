// Self-tests for check-prototype.mjs. Every fixture is a disposable directory.
// Run from the repository root: `node --test ".harness/tests/*.mjs"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, realpathSync, unlinkSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { checkPrototype } from "../bin/check-prototype.mjs";
import { root } from "../bin/check-adapters.mjs";

function put(dir, path, content) {
  const p = join(dir, path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content);
}
const SCREENS = `# Screen list

## Screens

| Screen | Phase | File | Serves | States | Approval |
| --- | --- | --- | --- | --- | --- |
| Sign in | 0 | \`screens/p0-sign-in.html\` | 03-user-flows/01-join.md | default, error | awaiting approval |
| Recipes | 1 | \`screens/p1-recipes.html\` | specs/recipes.md § List | data, empty | awaiting approval |

Screen check: passed 2026-10-08 at abc1234
`;

// A complete, valid prototype; each test breaks one thing.
function fixture(t) {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), "proto-")));
  t.after(() => rmSync(ws, { recursive: true, force: true }));
  put(ws, "prototype/index.html", `<link rel="stylesheet" href="styles.css">
<a href="screens/p0-sign-in.html">Sign in</a> <a href="views.html?screen=screens/p0-sign-in.html">sizes</a>
<a href="screens/p1-recipes.html#top">Recipes</a> <a href="views.html?screen=screens%2Fp1-recipes.html">sizes</a>
<a href="https://example.com/help">help</a>`);
  put(ws, "prototype/views.html", `<script>/* frames */</script><a href="index.html">back</a>`);
  put(ws, "prototype/styles.css", `body{margin:0} .logo{background:url("img/logo.svg")}`);
  put(ws, "prototype/img/logo.svg", `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="#a"/></svg>`);
  put(ws, "prototype/SCREENS.md", SCREENS);
  put(ws, "prototype/DESIGN.md", "Calm, warm colours.");
  put(ws, "prototype/screens/p0-sign-in.html", `<link rel="stylesheet" href="../styles.css"><a href="p1-recipes.html">Go</a><a href="p0-sign-in--error.html">error</a>
<svg xmlns="http://www.w3.org/2000/svg"><use href="#icon"/></svg><script>document.createElementNS("http://www.w3.org/2000/svg", "g")</script>`);
  put(ws, "prototype/screens/p0-sign-in--error.html", `<a href="p0-sign-in.html">back</a>`);
  put(ws, "prototype/screens/p1-recipes.html", `<img src="../img/logo.svg" alt="logo"><a href="#empty">empty</a><a href="mailto:a@b.c">mail</a><a href="?state=error">e</a>`);
  put(ws, "prototype/.screenshots/p0.png", "not scanned");
  return ws;
}
const errorsOf = (ws, opts) => checkPrototype(ws, opts).errors.join("\n");
const hashOf = (ws, phase) => checkPrototype(ws).phases[phase].hash;

// Append an approval record the way prototype.md step 8 does: hashes copied from the checker.
function approve(ws, n, { phases, held = "", by = "Mei Tan", on = "2026-10-08" }) {
  const hashes = phases.map((p) => `${p}=${hashOf(ws, p)}`).join(", ");
  const path = join(ws, "prototype/APPROVAL.md");
  let text = "# Prototype approvals\n";
  try { text = readFileSync(path, "utf8"); } catch { /* first record */ }
  writeFileSync(path, `${text}
## Approval ${n}
approved_by: ${by}
approved_on: ${on}
approval: "I approve these screens."
phases: ${phases.join(", ")}
${held ? `held: ${held}\n` : ""}hashes: ${hashes}
`);
}
// Set each row's Approval cell: `status` maps a phase to its value.
function markScreens(ws, status) {
  const path = join(ws, "prototype/SCREENS.md");
  const text = readFileSync(path, "utf8").replace(/^(\| [^|]+ \| (\w+) \|.*\| )(approved|awaiting approval)( \|)$/gm,
    (all, head, phase, _old, tail) => (status[phase] ? head + status[phase] + tail : all));
  writeFileSync(path, text);
}

test("a complete prototype passes, before and after approval", (t) => {
  const ws = fixture(t);
  const before = checkPrototype(ws);
  assert.deepEqual(before.errors, []);
  assert.equal(before.ok, true);
  assert.equal(before.screens, 2);
  assert.equal(before.phases["0"].status, "awaiting approval");
  assert.match(before.phases["0"].hash, /^[0-9a-f]{16}$/);
  stampScreenCheck(ws);
  approve(ws, 1, { phases: ["0", "1"] });
  markScreens(ws, { 0: "approved", 1: "approved" });
  const after = checkPrototype(ws, { requireApproval: true });
  assert.deepEqual(after.errors, []);
  assert.equal(after.approvals, 1);
  assert.equal(after.phases["1"].status, "approved");
  assert.equal(after.screen_check, "passed");
});

test("an approval taken before a page changed does not approve the changed page (H1)", (t) => {
  const ws = fixture(t);
  approve(ws, 1, { phases: ["0", "1"] });
  markScreens(ws, { 0: "approved", 1: "approved" });
  put(ws, "prototype/screens/p0-sign-in--error.html", `<a href="p0-sign-in.html">back, redesigned</a>`);
  const r = checkPrototype(ws, { requireApproval: true });
  assert.equal(r.ok, false);
  assert.equal(r.phases["0"].status, "awaiting approval");
  assert.equal(r.phases["1"].status, "approved");
  assert.match(r.errors.join("\n"), /phase 0: changed since approval 1/);
  // While designing, the row still saying "approved" is caught too.
  assert.match(errorsOf(ws), /"Sign in" says "approved" but phase 0 is awaiting approval/);
});

test("a shared style or start-page change re-opens every phase; a new phase needs its own approval (H1)", (t) => {
  const ws = fixture(t);
  approve(ws, 1, { phases: ["0", "1"] });
  markScreens(ws, { 0: "approved", 1: "approved" });
  put(ws, "prototype/styles.css", `body{margin:0;color:#222} .logo{background:url("img/logo.svg")}`);
  let r = checkPrototype(ws, { requireApproval: true });
  assert.match(r.errors.join("\n"), /phase 0: changed since approval 1/);
  assert.match(r.errors.join("\n"), /phase 1: changed since approval 1/);

  const ws2 = fixture(t);
  approve(ws2, 1, { phases: ["0", "1"] });
  markScreens(ws2, { 0: "approved", 1: "approved" });
  put(ws2, "prototype/SCREENS.md", readFileSync(join(ws2, "prototype/SCREENS.md"), "utf8").replace("\nScreen check",
    "| Share | 2 | `screens/p2-share.html` | specs/share.md | default | awaiting approval |\n\nScreen check"));
  put(ws2, "prototype/screens/p2-share.html", "<p>share</p>");
  put(ws2, "prototype/index.html", readFileSync(join(ws2, "prototype/index.html"), "utf8")
    + `<a href="screens/p2-share.html">Share</a><a href="views.html?screen=screens/p2-share.html">sizes</a>`);
  r = checkPrototype(ws2, { requireApproval: true });
  // index.html changed to link the new screen, so the approved phases need approving again too.
  assert.match(r.errors.join("\n"), /phase 0: changed since approval 1/);
  assert.match(r.errors.join("\n"), /phase 2: no approval record names it/);
  // A phase added without touching a shared file leaves the approved phases approved.
  const ws3 = fixture(t);
  put(ws3, "prototype/index.html", readFileSync(join(ws3, "prototype/index.html"), "utf8")
    + `<a href="screens/p2-share.html">Share</a><a href="views.html?screen=screens/p2-share.html">sizes</a>`);
  put(ws3, "prototype/screens/p2-share.html", "<p>share</p>");
  approve(ws3, 1, { phases: ["0", "1"] });
  put(ws3, "prototype/SCREENS.md", readFileSync(join(ws3, "prototype/SCREENS.md"), "utf8").replace("\nScreen check",
    "| Share | 2 | `screens/p2-share.html` | specs/share.md | default | awaiting approval |\n\nScreen check"));
  r = checkPrototype(ws3, { requireApproval: true });
  assert.equal(r.phases["0"].status, "approved");
  assert.match(r.errors.join("\n"), /phase 2: no approval record names it/);
});

test("a held phase stays awaiting approval; the newest record naming a phase decides (H2)", (t) => {
  const ws = fixture(t);
  approve(ws, 1, { phases: ["0", "1"] });
  put(ws, "prototype/screens/p0-sign-in--error.html", `<a href="p0-sign-in.html">v2</a>`);
  put(ws, "prototype/screens/p1-recipes.html", `<p>v2 recipes</p>`);
  approve(ws, 2, { phases: ["0"], held: "1", on: "2026-10-09" });
  markScreens(ws, { 0: "approved", 1: "awaiting approval" });
  stampScreenCheck(ws);
  const r = checkPrototype(ws, { requireApproval: true });
  assert.deepEqual(r.errors, []);
  assert.deepEqual([r.phases["0"].status, r.phases["0"].approval], ["approved", 2]);
  assert.equal(r.phases["1"].status, "awaiting approval");
  assert.match(r.phases["1"].reason, /held by the user in approval 2/);
  // A held phase marked approved in SCREENS.md is a finding.
  markScreens(ws, { 1: "approved" });
  assert.match(errorsOf(ws), /"Recipes" says "approved" but phase 1 is awaiting approval/);
});

test("--require-approval needs at least one approved phase and a valid record shape", (t) => {
  const ws = fixture(t);
  assert.match(errorsOf(ws, { requireApproval: true }), /missing APPROVAL\.md/);
  put(ws, "prototype/APPROVAL.md", `# Prototype approvals

## Approval 1
approved_by: Mei Tan
approved_on: 2026-10-08
approval: "Hold everything for now."
phases:
held: 0, 1
`);
  assert.match(errorsOf(ws, { requireApproval: true }), /no PRD phase is approved/);
  put(ws, "prototype/APPROVAL.md", `# Prototype approvals

## Approval 1
approved_by: Mei Tan
approved_on: 2026-10-08
approval: "Yes."
phases: 0, 1
hashes: 0=${hashOf(ws, "0")}
`);
  assert.match(errorsOf(ws), /approval 1: hashes has no entry for phase 1/);
});

test("approval records need a person, a real date, quoted words and phase names", (t) => {
  const ws = fixture(t);
  approve(ws, 1, { phases: ["0", "1"] });
  approve(ws, 2, { phases: ["0"], by: "Claude", on: "8 Oct" });
  approve(ws, 3, { phases: ["0"], on: "2026-13-45" });
  approve(ws, 4, { phases: ["0"], on: "2026-02-30" });
  put(ws, "prototype/APPROVAL.md", readFileSync(join(ws, "prototype/APPROVAL.md"), "utf8")
    + `\n## Approval 5\napproved_by: Mei Tan\napproved_on: 2026-10-08\napproval: I approve\nphases: all of them\nhashes: 0=xyz\n`);
  const e = errorsOf(ws);
  assert.match(e, /approval 2: approved_by must name the person/);
  assert.match(e, /approval 2: approved_on must be a real date/);
  assert.match(e, /approval 3: approved_on must be a real date/);
  assert.match(e, /approval 4: approved_on must be a real date/);
  assert.match(e, /approval 5: approval must quote/);
  assert.match(e, /approval 5: phases must list PRD phases/);
  assert.doesNotMatch(e, /approval 1:/);
  put(ws, "prototype/APPROVAL.md", "# Prototype approvals\n");
  assert.match(errorsOf(ws), /no '## Approval <n>' record/);
});

test("an owed screen check passes --require-approval only when the user accepted it (M2)", (t) => {
  const ws = fixture(t);
  approve(ws, 1, { phases: ["0", "1"] });
  markScreens(ws, { 0: "approved", 1: "approved" });
  const screens = readFileSync(join(ws, "prototype/SCREENS.md"), "utf8");
  put(ws, "prototype/SCREENS.md", screens.replace(/Screen check: .*/, "Screen check: owed — no browser on this machine"));
  assert.match(errorsOf(ws, { requireApproval: true }), /screen check is owed and no person accepted/);
  assert.equal(checkPrototype(ws).screen_check, "owed");
  put(ws, "prototype/SCREENS.md", screens.replace(/Screen check: .*/, "Screen check: owed — no browser on this machine; accepted by Mei Tan 2026-10-08"));
  assert.deepEqual(errorsOf(ws, { requireApproval: true }), "");
  put(ws, "prototype/SCREENS.md", screens.replace(/Screen check: .*/, "Screen check: owed — no browser; accepted by agent"));
  assert.match(errorsOf(ws, { requireApproval: true }), /screen check is owed and no person accepted/);
  put(ws, "prototype/SCREENS.md", screens.replace(/Screen check: .*\n/, ""));
  assert.match(errorsOf(ws, { requireApproval: true }), /SCREENS\.md has no 'Screen check:' line/);
});

test("a missing required file, a missing screen page and an unlisted page are reported", (t) => {
  const ws = fixture(t);
  unlinkSync(join(ws, "prototype/DESIGN.md"));
  unlinkSync(join(ws, "prototype/screens/p1-recipes.html"));
  put(ws, "prototype/screens/p2-extra.html", "<p>x</p>");
  put(ws, "prototype/screens/.p9-secret.html", "<p>hidden</p>");
  const e = errorsOf(ws);
  assert.match(e, /missing DESIGN\.md/);
  assert.match(e, /screen file missing or outside prototype\/: screens\/p1-recipes\.html/);
  assert.match(e, /page not listed in SCREENS\.md: screens\/p2-extra\.html/);
  assert.match(e, /page not listed in SCREENS\.md: screens\/\.p9-secret\.html/);
});

test("SCREENS.md rows need a phase and a backticked page under screens/, once each", (t) => {
  const ws = fixture(t);
  put(ws, "prototype/SCREENS.md", SCREENS.replace("| 1 | `screens/p1-recipes.html`", "| later on | screens/p1-recipes.html")
    .replace("\nScreen check", "| Again | 0 | `screens/p0-sign-in.html` | x | y | awaiting approval |\n| Sizes | 0 | `views.html` | x | y | awaiting approval |\n\nScreen check"));
  const e = errorsOf(ws);
  assert.match(e, /no file in backticks/);
  assert.match(e, /listed twice: screens\/p0-sign-in\.html/);
  assert.match(e, /screen file must be a page under screens\/: views\.html/);
  put(ws, "prototype/SCREENS.md", SCREENS.replace("| 1 |", "| one! |"));
  assert.match(errorsOf(ws), /"Recipes" has no PRD phase/);
  put(ws, "prototype/SCREENS.md", SCREENS.replace(/ \| Approval \|/, " |").replace(/\| --- \| --- \|\n/, "| --- |\n"));
  assert.match(errorsOf(ws), /SCREENS\.md table needs an Approval column/);
  put(ws, "prototype/SCREENS.md", SCREENS.replace("## Screens", "## List"));
  assert.match(errorsOf(ws), /SCREENS\.md has no '## Screens' heading/);
});

test("SCREENS.md: only the first table under ## Screens is read; alignment rows, escaped pipes and lettered phases are fine (L4, L5)", (t) => {
  const ws = fixture(t);
  put(ws, "prototype/SCREENS.md", SCREENS
    .replace("| --- | --- | --- | --- | --- | --- |", "|:---|:---:|---:|:---|:---|:---|")
    .replace("| Sign in |", "| Sign in \\| out |")
    .replace("| 1 |", "| 1a |")
    + "\n## Screen check history\n\n| Date | Result |\n| --- | --- |\n| 2026-10-08 | passed |\n");
  const r = checkPrototype(ws);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(Object.keys(r.phases).sort(), ["0", "1a"]);
});

test("index.html must link every screen and its phone · tablet · desktop view (L1, L2, L6)", (t) => {
  const ws = fixture(t);
  put(ws, "prototype/index.html", `<a href="screens/p0-sign-in.html">Sign in</a><!-- <a href="screens/p1-recipes.html">x</a> -->`);
  let e = errorsOf(ws);
  assert.match(e, /index\.html does not link screens\/p1-recipes\.html/);
  assert.match(e, /index\.html does not link the phone · tablet · desktop view of screens\/p0-sign-in\.html/);
  // Unquoted and percent-encoded links count.
  put(ws, "prototype/SCREENS.md", SCREENS.replace("p1-recipes.html", "p1 recipes.html"));
  unlinkSync(join(ws, "prototype/screens/p1-recipes.html"));
  put(ws, "prototype/screens/p1 recipes.html", "<p>r</p>");
  put(ws, "prototype/screens/p0-sign-in.html", `<a href="p1%20recipes.html">Go</a><a href="p0-sign-in--error.html">error</a>`);
  put(ws, "prototype/index.html", `<a href=screens/p0-sign-in.html>a</a><a href=views.html?screen=screens/p0-sign-in.html>v</a>
<a href="screens/p1%20recipes.html">b</a><a href='views.html?screen=screens/p1%20recipes.html'>v</a>`);
  e = errorsOf(ws);
  assert.equal(e, "");
});

test("broken links, malformed escapes and paths leaving prototype/ are reported (L3)", (t) => {
  const ws = fixture(t);
  put(ws, "prototype/screens/p0-sign-in.html", `<a href="p9-missing.html">x</a><img src="../../secret.png"><a href="p1%E0.html">bad</a>`);
  put(ws, "secret.png", "outside");
  const e = errorsOf(ws);
  assert.match(e, /p0-sign-in\.html points to a missing file or outside prototype\/: p9-missing\.html/);
  assert.match(e, /points to a missing file or outside prototype\/: \.\.\/\.\.\/secret\.png/);
  assert.match(e, /p0-sign-in\.html has a malformed link: p1%E0\.html/);
});

test("a symlink that escapes prototype/ is refused even though the path looks local", (t) => {
  const ws = fixture(t);
  put(ws, "outside/logo.svg", "<svg/>");
  symlinkSync(join(ws, "outside"), join(ws, "prototype/shared"));
  put(ws, "prototype/screens/p1-recipes.html", `<img src="../shared/logo.svg">`);
  const e = errorsOf(ws);
  assert.match(e, /points to a missing file or outside prototype\/: \.\.\/shared\/logo\.svg/);
  assert.match(e, /symlink leaves prototype\/ or is not a file: shared/);
});

test("anything loaded from the internet is reported; a plain outside link is not", (t) => {
  const ws = fixture(t);
  put(ws, "prototype/screens/p1-recipes.html", `<script src="https://cdn.example.com/x.js"></script>
<link href="//fonts.example.com/f.css" rel="stylesheet"><a href="https://example.com">ok</a>`);
  put(ws, "prototype/styles.css", `@import "https://fonts.example.com/a.css"; .x{background:url(http://img.example.com/a.png)}`);
  const e = errorsOf(ws);
  assert.match(e, /p1-recipes\.html loads from the internet: https:\/\/cdn\.example\.com\/x\.js/);
  assert.match(e, /loads from the internet: \/\/fonts\.example\.com\/f\.css/);
  assert.match(e, /styles\.css loads from the internet: https:\/\/fonts\.example\.com\/a\.css/);
  assert.match(e, /styles\.css loads from the internet: http:\/\/img\.example\.com\/a\.png/);
  assert.doesNotMatch(e, /example\.com"?$/m);
  assert.doesNotMatch(e, /w3\.org/);
});

test("less common ways to load from the internet are reported too (M9, L7)", (t) => {
  const cases = {
    "unquoted script": `<script src=https://cdn.example.com/x.js></script>`,
    "unquoted stylesheet": `<link rel=stylesheet href=https://fonts.example.com/f.css>`,
    "img srcset": `<img src="../img/logo.svg" srcset="../img/logo.svg 1x, https://img.example.com/a.png 2x">`,
    "picture source srcset": `<picture><source srcset="https://img.example.com/a.webp"><img src="../img/logo.svg"></picture>`,
    "object data": `<object data="https://x.example.com/a.svg"></object>`,
    "svg image href": `<svg><image href="https://x.example.com/a.png"/></svg>`,
    "svg xlink:href": `<svg><image xlink:href="https://x.example.com/b.png"/></svg>`,
    "video poster": `<video poster="https://x.example.com/p.jpg"></video>`,
    "meta refresh": `<meta http-equiv="refresh" content="0;url=https://x.example.com">`,
    "inline fetch": `<script>fetch("https://x.example.com/data.json")</script>`,
    "base tag": `<base href="https://cdn.example.com/"><img src="../img/logo.svg">`,
  };
  for (const [name, page] of Object.entries(cases)) {
    const ws = fixture(t);
    put(ws, "prototype/screens/p1-recipes.html", page);
    const e = errorsOf(ws);
    assert.match(e, name === "base tag" ? /p1-recipes\.html uses <base>/ : /p1-recipes\.html (loads from|script refers to) the internet/, name);
  }
  const ws = fixture(t);
  put(ws, "prototype/app.js", `import "https://cdn.example.com/lib.js"; // see http://notes`);
  put(ws, "prototype/a.svg", `<svg xmlns="http://www.w3.org/2000/svg"><image href="https://x.example.com/a.png"/></svg>`);
  put(ws, "prototype/screens/p1-recipes.html", `<script type="module" src="../app.js"></script><img src="../a.svg">`);
  const e = errorsOf(ws);
  assert.match(e, /app\.js script refers to the internet: https:\/\/cdn\.example\.com\/lib\.js/);
  assert.match(e, /a\.svg loads from the internet: https:\/\/x\.example\.com\/a\.png/);
  assert.doesNotMatch(e, /http:\/\/notes/);
});

test("a product with no screens passes with only 00-no-screens.md", (t) => {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), "proto-")));
  t.after(() => rmSync(ws, { recursive: true, force: true }));
  put(ws, "prototype/00-no-screens.md", "An API only; no screens.");
  const r = checkPrototype(ws, { requireApproval: true });
  assert.equal(r.ok, true);
  assert.match(r.note, /no screens/);
});

test("00-no-screens.md next to screen pages is a finding, not a pass (H4)", (t) => {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), "proto-")));
  t.after(() => rmSync(ws, { recursive: true, force: true }));
  put(ws, "prototype/00-no-screens.md", "An API only; no screens.");
  put(ws, "prototype/SCREENS.md", SCREENS);
  put(ws, "prototype/screens/p0-sign-in.html", `<script src="https://cdn.example.com/x.js"></script>`);
  const e = errorsOf(ws, { requireApproval: true });
  assert.match(e, /00-no-screens\.md sits next to screen files/);
  assert.match(e, /missing APPROVAL\.md/);
  assert.match(e, /loads from the internet/);
});

test("the CLI exits 0 clean, 1 on findings and 2 on a usage error or missing folder", (t) => {
  const ws = fixture(t);
  const run = (...args) => spawnSync(process.execPath, [join(root, ".harness/bin/check-prototype.mjs"), ...args], { encoding: "utf8" });
  assert.equal(run(ws).status, 0);
  assert.equal(run("--require-approval", ws).status, 1);
  assert.equal(run().status, 2);
  assert.equal(run(join(ws, "nope")).status, 2);
  put(ws, "prototype/screens/p0-sign-in.html", `<a href="x%E0.html">bad</a>`);
  let r = run(ws);
  assert.equal(r.status, 1);
  assert.match(JSON.parse(r.stdout).errors.join("\n"), /malformed link/);
  unlinkSync(join(ws, "prototype/views.html"));
  r = run(ws);
  assert.equal(r.status, 1);
  assert.match(JSON.parse(r.stdout).errors.join("\n"), /missing views\.html/);
});

test("the CLI still runs when started through a symlink with --preserve-symlinks-main", (t) => {
  const ws = fixture(t);
  // Same layout as .harness/, so the checker's relative import of ../lib still resolves.
  mkdirSync(join(ws, "tools/bin"), { recursive: true });
  symlinkSync(join(root, ".harness/lib"), join(ws, "tools/lib"));
  const link = join(ws, "tools/bin/check-link.mjs");
  symlinkSync(join(root, ".harness/bin/check-prototype.mjs"), link);
  const r = spawnSync(process.execPath, ["--preserve-symlinks-main", link, ws], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).ok, true);
});

// Write the passed screen-check line the way prototype.md step 5 does: with the checker's pages hash.
function stampScreenCheck(ws) {
  const path = join(ws, "prototype/SCREENS.md");
  writeFileSync(path, readFileSync(path, "utf8").replace(/Screen check: .*/,
    `Screen check: passed 2026-10-08 at abc1234; pages ${checkPrototype(ws).pages_hash}`));
}

test("line-ending conversion (CRLF) keeps every approval and the passed screen check (RR-1)", (t) => {
  const ws = fixture(t);
  stampScreenCheck(ws);
  approve(ws, 1, { phases: ["0", "1"] });
  markScreens(ws, { 0: "approved", 1: "approved" });
  assert.deepEqual(checkPrototype(ws, { requireApproval: true }).errors, []);
  for (const f of ["index.html", "views.html", "styles.css", "img/logo.svg", "SCREENS.md", "DESIGN.md", "APPROVAL.md",
    "screens/p0-sign-in.html", "screens/p0-sign-in--error.html", "screens/p1-recipes.html"]) {
    const p = join(ws, "prototype", f);
    writeFileSync(p, readFileSync(p, "utf8").replace(/\r?\n/g, "\r\n"));
  }
  const r = checkPrototype(ws, { requireApproval: true });
  assert.deepEqual(r.errors, []);
  assert.equal(r.phases["0"].status, "approved");
  assert.equal(r.screen_check, "passed");
});

test("an owed screen check needs a real person and a date: 'nobody yet' is refused (RR-2)", (t) => {
  const ws = fixture(t);
  approve(ws, 1, { phases: ["0", "1"] });
  markScreens(ws, { 0: "approved", 1: "approved" });
  const screens = readFileSync(join(ws, "prototype/SCREENS.md"), "utf8");
  for (const by of ["nobody yet", "nobody", "no one 2026-10-08", "Nobody 2026-10-08", "TBD 2026-10-08", "Mei Tan", "Claude 2026-10-08"]) {
    put(ws, "prototype/SCREENS.md", screens.replace(/Screen check: .*/, `Screen check: owed — no browser (accepted by ${by})`));
    assert.match(errorsOf(ws, { requireApproval: true }), /screen check is owed and no person accepted/, by);
  }
  put(ws, "prototype/SCREENS.md", screens.replace(/Screen check: .*/, "Screen check: owed — no browser; accepted by Mei Tan 2026-10-08"));
  assert.equal(errorsOf(ws, { requireApproval: true }), "");
});

test("a passed screen check counts only for the pages it checked (RR-3)", (t) => {
  const ws = fixture(t);
  stampScreenCheck(ws);
  approve(ws, 1, { phases: ["0", "1"] });
  markScreens(ws, { 0: "approved", 1: "approved" });
  assert.equal(errorsOf(ws, { requireApproval: true }), "");
  // A revision changes a page and is approved again, but the old passed line stays.
  put(ws, "prototype/screens/p1-recipes.html", `<p>recipes, redesigned</p>`);
  approve(ws, 2, { phases: ["1"], on: "2026-10-09" });
  let r = checkPrototype(ws, { requireApproval: true });
  assert.equal(r.screen_check, "stale");
  assert.match(r.errors.join("\n"), /screen check passed for other pages/);
  // A passed line with no pages hash is not tied to any pages, so it is owed too.
  put(ws, "prototype/SCREENS.md", readFileSync(join(ws, "prototype/SCREENS.md"), "utf8")
    .replace(/Screen check: .*/, "Screen check: passed 2026-10-08 at abc1234"));
  r = checkPrototype(ws, { requireApproval: true });
  assert.equal(r.screen_check, "stale");
  stampScreenCheck(ws);
  assert.equal(errorsOf(ws, { requireApproval: true }), "");
});

test("views.html and index.html are inside every phase's fingerprint (RR-4)", (t) => {
  for (const file of ["views.html", "index.html"]) {
    const ws = fixture(t);
    approve(ws, 1, { phases: ["0", "1"] });
    markScreens(ws, { 0: "approved", 1: "approved" });
    put(ws, `prototype/${file}`, readFileSync(join(ws, `prototype/${file}`), "utf8") + "<p>new text</p>");
    const e = errorsOf(ws, { requireApproval: true });
    assert.match(e, /phase 0: changed since approval 1/, file);
    assert.match(e, /phase 1: changed since approval 1/, file);
  }
  // Text in SCREENS.md outside the screens table is not part of the fingerprint (documented).
  const ws = fixture(t);
  const before = checkPrototype(ws).phases;
  put(ws, "prototype/SCREENS.md", readFileSync(join(ws, "prototype/SCREENS.md"), "utf8") + "\nNotes: a later idea.\n");
  assert.deepEqual(checkPrototype(ws).phases, before);
});

test("a record that repeats an earlier record's quoted words and date is refused (RR-4)", (t) => {
  const ws = fixture(t);
  approve(ws, 1, { phases: ["0", "1"] });
  approve(ws, 2, { phases: ["0"] });
  assert.match(errorsOf(ws), /approval 2: repeats the quoted words and date of approval 1/);
  approve(ws, 3, { phases: ["0"], on: "2026-10-09" });
  assert.doesNotMatch(errorsOf(ws), /approval 3: repeats/);
});

test("--base: APPROVAL.md must start with the base branch's text unchanged (RR-4)", (t) => {
  const ws = fixture(t);
  const git = (...a) => spawnSync("git", ["-C", ws, ...a], { encoding: "utf8" });
  const commit = (m) => git("-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-qm", m);
  git("init", "-q", "-b", "main");
  approve(ws, 1, { phases: ["0", "1"] });
  git("add", "-A");
  commit("base");
  // Appending is fine.
  put(ws, "prototype/screens/p1-recipes.html", `<p>v2</p>`);
  approve(ws, 2, { phases: ["1"], on: "2026-10-09" });
  assert.doesNotMatch(errorsOf(ws, { base: "main" }), /APPROVAL\.md/);
  // Editing an earlier record's hash in place is refused.
  const path = join(ws, "prototype/APPROVAL.md");
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace(/hashes: 0=[0-9a-f]+/, "hashes: 0=0000000000000000"));
  assert.match(errorsOf(ws, { base: "main" }), /APPROVAL\.md changes or drops an earlier record/);
  // CRLF on one side only is not a change.
  writeFileSync(path, text.replace(/\n/g, "\r\n"));
  assert.doesNotMatch(errorsOf(ws, { base: "main" }), /APPROVAL\.md/);
  // A base with no APPROVAL.md (the first prototype) accepts any records.
  git("rm", "-q", "--cached", "prototype/APPROVAL.md");
  commit("no approvals");
  assert.doesNotMatch(errorsOf(ws, { base: "main" }), /APPROVAL\.md/);
  // An unknown base is a usage error, not a pass.
  assert.match(checkPrototype(ws, { base: "no-such-ref" }).usage ?? "", /not a commit/);
  const cli = spawnSync(process.execPath, [join(root, ".harness/bin/check-prototype.mjs"), "--base", "no-such-ref", ws], { encoding: "utf8" });
  assert.equal(cli.status, 2);
});
