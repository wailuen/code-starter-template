// Self-tests for check-prototype.mjs. Every fixture is a disposable directory.
// Run from the repository root: `node --test ".harness/tests/*.mjs"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync, realpathSync, unlinkSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { checkPrototype } from "../bin/check-prototype.mjs";
import { root } from "../bin/check-adapters.mjs";

function put(dir, path, content) {
  const p = join(dir, path); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content);
}
const SCREENS = `# Screens

| Screen | Phase | File | Serves | States |
| --- | --- | --- | --- | --- |
| Sign in | 0 | \`screens/p0-sign-in.html\` | 03-user-flows/01-join.md | default, error |
| Recipes | 1 | \`screens/p1-recipes.html\` | specs/recipes.md § List | data, empty |

Screen check: passed 2026-10-08 at abc1234
`;
const APPROVAL = `# Prototype approvals

## Approval 1
approved_by: Mei Tan
approved_on: 2026-10-08
approval: "I approve every screen for all phases."
phases: 0, 1
screens: 2
`;

// A complete, valid prototype; each test breaks one thing.
function fixture(t) {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), "proto-")));
  t.after(() => rmSync(ws, { recursive: true, force: true }));
  put(ws, "prototype/index.html", `<link rel="stylesheet" href="styles.css">
<a href="screens/p0-sign-in.html">Sign in</a> <a href="views.html?screen=screens/p0-sign-in.html">sizes</a>
<a href="screens/p1-recipes.html#top">Recipes</a> <a href="https://example.com/help">help</a>`);
  put(ws, "prototype/views.html", `<script>/* frames */</script><a href="index.html">back</a>`);
  put(ws, "prototype/styles.css", `body{margin:0} .logo{background:url("img/logo.svg")}`);
  put(ws, "prototype/img/logo.svg", "<svg/>");
  put(ws, "prototype/SCREENS.md", SCREENS);
  put(ws, "prototype/DESIGN.md", "Calm, warm colours.");
  put(ws, "prototype/screens/p0-sign-in.html", `<link rel="stylesheet" href="../styles.css"><a href="p1-recipes.html">Go</a><a href="p0-sign-in--error.html">error</a>`);
  put(ws, "prototype/screens/p0-sign-in--error.html", `<a href="p0-sign-in.html">back</a>`);
  put(ws, "prototype/screens/p1-recipes.html", `<img src="../img/logo.svg" alt="logo"><a href="#empty">empty</a><a href="mailto:a@b.c">mail</a>`);
  put(ws, "prototype/.screenshots/p0.png", "not scanned");
  return ws;
}
const errorsOf = (ws, opts) => checkPrototype(ws, opts).errors.join("\n");

test("a complete prototype passes, before and after approval", (t) => {
  const ws = fixture(t);
  assert.deepEqual(checkPrototype(ws), { ok: true, screens: 2, approvals: 0, errors: [] });
  put(ws, "prototype/APPROVAL.md", APPROVAL);
  assert.deepEqual(checkPrototype(ws, { requireApproval: true }), { ok: true, screens: 2, approvals: 1, errors: [] });
});

test("a missing required file, a missing screen page and an unlisted page are reported", (t) => {
  const ws = fixture(t);
  unlinkSync(join(ws, "prototype/DESIGN.md"));
  unlinkSync(join(ws, "prototype/screens/p1-recipes.html"));
  put(ws, "prototype/screens/p2-extra.html", "<p>x</p>");
  const e = errorsOf(ws);
  assert.match(e, /missing DESIGN\.md/);
  assert.match(e, /screen file missing or outside prototype\/: screens\/p1-recipes\.html/);
  assert.match(e, /page not listed in SCREENS\.md: screens\/p2-extra\.html/);
});

test("SCREENS.md rows need a phase number and a backticked file, once each", (t) => {
  const ws = fixture(t);
  put(ws, "prototype/SCREENS.md", SCREENS.replace("| 1 | `screens/p1-recipes.html`", "| later | screens/p1-recipes.html")
    + "| Again | 0 | `screens/p0-sign-in.html` | x | y |\n");
  const e = errorsOf(ws);
  assert.match(e, /no file in backticks/);
  assert.match(e, /listed twice: screens\/p0-sign-in\.html/);
  put(ws, "prototype/SCREENS.md", SCREENS.replace("| 1 |", "| one |"));
  assert.match(errorsOf(ws), /"Recipes" has no PRD phase number/);
});

test("index.html must link every screen", (t) => {
  const ws = fixture(t);
  put(ws, "prototype/index.html", `<a href="screens/p0-sign-in.html">Sign in</a>`);
  assert.match(errorsOf(ws), /index\.html does not link screens\/p1-recipes\.html/);
});

test("broken links and paths leaving prototype/ are reported", (t) => {
  const ws = fixture(t);
  put(ws, "prototype/screens/p0-sign-in.html", `<a href="p9-missing.html">x</a><img src="../../secret.png">`);
  put(ws, "secret.png", "outside");
  const e = errorsOf(ws);
  assert.match(e, /p0-sign-in\.html points to a missing file or outside prototype\/: p9-missing\.html/);
  assert.match(e, /points to a missing file or outside prototype\/: \.\.\/\.\.\/secret\.png/);
});

test("a symlink that escapes prototype/ is refused even though the path looks local", (t) => {
  const ws = fixture(t);
  put(ws, "outside/logo.svg", "<svg/>");
  symlinkSync(join(ws, "outside"), join(ws, "prototype/shared"));
  put(ws, "prototype/screens/p1-recipes.html", `<img src="../shared/logo.svg">`);
  assert.match(errorsOf(ws), /points to a missing file or outside prototype\/: \.\.\/shared\/logo\.svg/);
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
  assert.doesNotMatch(e, /https:\/\/example\.com"?$/m);
});

test("approval records need a person, a date, quoted words and phase numbers", (t) => {
  const ws = fixture(t);
  assert.match(errorsOf(ws, { requireApproval: true }), /missing APPROVAL\.md/);
  put(ws, "prototype/APPROVAL.md", APPROVAL + `
## Approval 2
approved_by: Claude
approved_on: 8 Oct
approval: I approve
phases: all
`);
  const e = errorsOf(ws);
  assert.match(e, /approval 2: approved_by must name the person/);
  assert.match(e, /approval 2: approved_on must be YYYY-MM-DD/);
  assert.match(e, /approval 2: approval must quote/);
  assert.match(e, /approval 2: phases must list PRD phase numbers/);
  assert.doesNotMatch(e, /approval 1:/);
  put(ws, "prototype/APPROVAL.md", "# Prototype approvals\n");
  assert.match(errorsOf(ws), /no '## Approval <n>' record/);
});

test("a product with no screens passes with only 00-no-screens.md", (t) => {
  const ws = realpathSync(mkdtempSync(join(tmpdir(), "proto-")));
  t.after(() => rmSync(ws, { recursive: true, force: true }));
  put(ws, "prototype/00-no-screens.md", "An API only; no screens.");
  assert.equal(checkPrototype(ws, { requireApproval: true }).ok, true);
});

test("the CLI exits 0 clean, 1 on findings and 2 on a usage error or missing folder", (t) => {
  const ws = fixture(t);
  const run = (...args) => spawnSync(process.execPath, [join(root, ".harness/bin/check-prototype.mjs"), ...args], { encoding: "utf8" });
  assert.equal(run(ws).status, 0);
  assert.equal(run("--require-approval", ws).status, 1);
  assert.equal(run().status, 2);
  assert.equal(run(join(ws, "nope")).status, 2);
  unlinkSync(join(ws, "prototype/views.html"));
  const r = run(ws);
  assert.equal(r.status, 1);
  assert.match(JSON.parse(r.stdout).errors.join("\n"), /missing views\.html/);
});
