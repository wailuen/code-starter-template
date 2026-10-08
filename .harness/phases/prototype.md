## When to run

After `/analyze` and before the first `/todos`, for any product with screens. The prototype
covers the **whole PRD — every phase** — so the user sees and approves the complete product
before any of it is built; planning and building then follow it. Run it again when the user
wants to change the approved design, or when a new brief adds screens.

A product with no screens (an API, CLI, library or data job): write
`prototype/00-no-screens.md` saying why, commit it with the analysis, and go to `/todos`. When a
later brief adds screens, delete `00-no-screens.md` on the prototype branch: the checker treats
it as a finding once any other file sits in `prototype/`.

**A product that already has built screens** (a project adopting this harness part-way, or one
started before `/prototype` existed) does not redraw them. Prototype only the screens the next
work adds or changes; the built screens are the reference for everything else. Ask the user to
confirm that once, in the five-part format, and record it as a journal `DECISION` entry with
`author: human`; `/todos` then plans changes to built screens the prototype does not list
without one.

## Resolve the workspace

Use `workspaces/$ARGUMENTS/` when named; otherwise the most recently modified real
workspace, excluding `instructions` and every leading-underscore directory. Read its briefs
(the PRD and its phases), `specs/_index.md` and the specs, `docs/adr/`, `03-user-flows/`, any
UX copy or design-language notes in `01-analysis/`, and the project profile's application
shape. If the workspace has no spec index, return to `/analyze`; do not invent screens for
requirements that were never analyzed.

Work on a `docs/prototype-<n>` branch cut from `main` (`n` = 1 for the first prototype, the
next number for each revision). It has no review rounds: its gates are the screen check
(step 5) and the user's approval (step 8). It merges into `main` after the user approves. Light
mode is the same. The branch changes only `prototype/` and the spec lines step 8 names; a
change to what the product does (a brief or a spec requirement) goes through `/analyze`
(step 7).

## Output

Everything lives in `workspaces/<project>/prototype/`
(`.harness/guides/task-delivery.md` § Workspace file layout):

| File | What it holds |
| --- | --- |
| `index.html` | The start page: every screen, grouped by PRD phase, each with a link to the screen and to its phone · tablet · desktop view (`views.html?screen=<file>`) |
| `views.html` | Shows one screen (`views.html?screen=<file>`) side by side at 400, 800 and 1280 pixels wide (phone, tablet, desktop — widths the screen check also uses), each in a frame of that true width, scaled down together so all three fit the user's window without sideways scrolling — the user sees all three sizes without browser tools. It accepts only a `screens/…html` value |
| `screens/p<phase>-<slug>.html` | One page per screen, e.g. `screens/p0-sign-in.html` |
| `styles.css` | The shared, mobile-first styles |
| `SCREENS.md` | The screen list (format below), each screen's approval status, and the latest screen-check result |
| `DESIGN.md` | The design language: the user's answers to the design questions, colours, type, spacing, tone of the words |
| `APPROVAL.md` | The user's approval records, append-only (format in step 8) |

`check-prototype.mjs` reads the first table under the `## Screens` heading of `SCREENS.md`
and the `Screen check:` line; the rest of the file is notes, outside every approval
fingerprint (the user approves the pages and the table rows, not the notes). Every screen is
one row. The file is a page under `screens/`,
written as a path relative to `prototype/`, in backticks. The phase is the PRD's phase name
(`0`, `1`, `1a`, `MVP`: letters, digits and dots). Approval reads `awaiting approval` until the
user approves that phase (step 8). It goes back to `awaiting approval` when the phase's pages or
rows change, or any shared file changes: the styles, images, scripts, `DESIGN.md`, `index.html`
or `views.html` (so adding a screen to `index.html` re-opens every phase). Line endings do not
count: a checkout that turns LF into CRLF keeps every approval. The checker fails while this column and the approval records
disagree, so anyone reading the list — `/ws`, `/todos`, the builder — sees which screens may be
built.

```markdown
## Screens

| Screen | Phase | File | Serves | States | Approval |
| --- | --- | --- | --- | --- | --- |
| Sign in | 0 | `screens/p0-sign-in.html` | 03-user-flows/01-join.md; specs/accounts.md § Sign-in | default, error | awaiting approval |
```

Rules for the pages:

- Plain HTML and CSS, opened by double-clicking `index.html`: no build step, no framework,
  nothing loaded from the internet (no outside fonts, scripts or images, and no `<base>` tag).
  A short inline script is fine for a state switcher or for `views.html`; it names no web
  address.
- Mobile-first and responsive: the base styles are the phone layout; wider layouts are added
  with `min-width` media queries. No sideways scrolling at phone width; touch targets at least
  44 pixels; text contrast at least 4.5:1; every control labelled; colour is never the only
  signal.
- Clickable: buttons and links lead to the next screen of the flow, so the user can walk every
  flow in `03-user-flows/` from start to end.
- Every state the user can meet — with data, empty, loading, error, and success where it
  applies — reachable from the screen (a state switcher at the top, or one page per state).
- Words in plain language. When the workspace has a UX copy document, use its words exactly.
  Sample content is realistic and clearly sample ("Aunt May's lasagne"). The prototype is a
  design drawing, never shipped: product code never copies its sample content
  (`.claude/rules/zero-tolerance.md` Rule 2 applies to the product, not to this drawing).

## Workflow

1. **List every screen.** From the PRD phases, the user flows and the specs, list every screen
   a user sees in every phase, with the states it needs, in `SCREENS.md`. Check every brief
   requirement a user sees or touches has a screen; a requirement with none is BLOCKING, the
   same as `/analyze` § 6 brief traceability.
2. **Ask the design questions.** Ask only what the briefs, the decision records and earlier
   answers do not settle — for example the feel (calm, playful, professional), brand colours
   or a logo, apps whose look the user likes, the device their users mostly hold, languages,
   accessibility needs. Put them in one message, each with your recommendation and "or say
   *you choose*" (`.claude/rules/recommendation-quality.md`). Keep asking until the answers
   are clear, then record them, quoted, in `DESIGN.md`.
3. **Design and build.** Settle the layout and navigation first, then the screens, phase by
   phase, until every row in `SCREENS.md` exists. Follow `.claude/skills/23-uiux-design-principles/SKILL.md`,
   and `.claude/skills/25-ai-interaction-patterns/SKILL.md` for any screen where a user talks to
   an AI model. The runtime adapter says whether a design tool may be used; whatever the tool,
   the approved design is the copy saved in `prototype/`.
4. **Check the structure.** Run `node .harness/bin/check-prototype.mjs workspaces/<project>`;
   fix everything it reports (missing screen files, broken links, anything loaded from the
   internet, an Approval cell that no longer matches the records) until it exits 0.
5. **Screen check.** Run `.harness/guides/task-delivery.md` § Screen red-team before the owner
   sees it over every screen and state: the headed browser pass at every width it names, plus
   360 pixels (a small phone), then a design critique. Use the project profile's E2E runner
   when it is set; before that, a headed browser the runtime can drive. Fix and re-run until it
   passes. Keep the screenshots in `prototype/.screenshots/` (not committed) and write the
   one-line result at the end of `SCREENS.md`:
   `Screen check: passed <YYYY-MM-DD> at <commit>; pages <pages_hash>`, copying `pages_hash`
   from the step-4 checker output for the pages you checked. The pass counts only for those
   pages: once a page, row or shared file changes, `--require-approval` reports the check as
   owed until it runs again and the line names the new `pages_hash`.
   If no browser can run, the prototype does not go to the user yet. Tell them plainly what is
   unchecked (contrast, text that overflows, the phone layout) and ask, in the five-part format,
   whether to show it unchecked. Only if they say yes, write
   `Screen check: owed — <reason>; accepted by <their name> <YYYY-MM-DD>` (the checker refuses an
   agent, a placeholder such as "nobody yet", or a missing date) and quote their words in
   the approval's journal entry. An owed check stays owed until it runs: `/ws` lists it, and
   `/todos` stops and sends the work back here, where the check runs on a new
   `docs/prototype-<n>` branch and any page it changed is approved again.
6. **Show the user.** Say in plain words what is there (how many screens, in which phases) and
   how to look at it: offer to open `index.html` in their browser; each screen's phone · tablet ·
   desktop link shows the three sizes (400, 800 and 1280 pixels). To try it on their own phone,
   offer to start a temporary preview on this computer that phones on the same Wi-Fi can open —
   ask first, because other people on that network could open it too — and stop it when they
   are done. Ask them to walk the main flow as a new user and say what to change.
7. **Change it until the user is happy.** Apply each change request, update `SCREENS.md` and
   `DESIGN.md`, re-run steps 4 and 5 for the changed screens, and say what changed. A request
   that adds, drops or changes a feature (not just its look) changes the PRD: say so, and with
   the user's OK run `/analyze` for that change on its own `docs/<slug>` branch, so the brief
   and spec edits get the same review and brief traceability as any analysis. Do not edit
   briefs or spec requirements on the prototype branch. Hold the affected phases (step 8)
   until that analysis has merged, then redraw their screens.
8. **Approval.** Ask in the five-part format (`.claude/rules/communication.md` § Asking the
   user to decide): what they approve (every screen of every PRD phase), what happens if yes
   (planning and building follow these screens; any later difference is asked first), what
   happens if no (nothing is planned from it; say what to change), your recommendation, and how
   to answer. The user may approve some phases and hold the rest. After the user answers yes,
   and only then:
   - run `node .harness/bin/check-prototype.mjs workspaces/<project>` on the exact pages the user
     saw. Its `phases` output gives each phase a `hash`: a fingerprint of that phase's rows, its
     pages, and the shared files (styles, images, scripts, `DESIGN.md`, `index.html`,
     `views.html`). Append to `APPROVAL.md` (never edit or remove an earlier record), copying the
     hash of every approved phase. Each record quotes what the user said this time: the checker
     refuses a record whose quoted words and date both repeat an earlier record's.

     ```markdown
     ## Approval <n>
     approved_by: <the user's name>
     approved_on: <YYYY-MM-DD>
     approval: "<the user's approving words, quoted>"
     phases: <the PRD phases approved, e.g. 0, 1, 2>
     held: <the phases the user held, e.g. 3; leave the line out when none>
     hashes: <phase>=<hash> for every approved phase, e.g. 0=3f9a0c1d2e3b4a59, 1=7c21…
     ```

   - set the Approval cell in `SCREENS.md` to `approved` for every screen in an approved phase;
     held phases stay `awaiting approval`;
   - write a journal `DECISION` entry with `author: human` quoting the user's words and naming
     any held phases;
   - update the specs only where the behavior is not built yet. In a spec file that still
     carries `Status: approved design`, each section a screen serves names the screen's file and
     the words it shows (`.claude/rules/spec-accuracy.md` § Exceptions item 4). A spec already
     reconciled to built code is not edited here: a design change to a built screen goes in the
     todo that rebuilds it, and the spec changes when that wave's reconciliation runs;
   - run `node .harness/bin/check-prototype.mjs --require-approval --base origin/main workspaces/<project>`
     (`--base main` when the repository has no remote). It exits 0 only when every phase is
     approved for the pages it has now, or held by the user; the screen check passed for these
     pages (or a named person accepted it as owed); and `APPROVAL.md` starts with the base
     branch's `APPROVAL.md` unchanged, so earlier records were only appended to. Commit, open the pull
     request into `main`, and merge it under `.harness/guides/task-delivery.md` § Branches,
     pull requests and merging. While the project profile's Local CI parity row reads
     `n/a — no code yet`, say "no code yet" in the commit body, as `/analyze` does. Once code
     exists, run Local CI parity before the first push (`.claude/rules/git.md` § Pre-FIRST-Push
     CI Parity Discipline).
9. **Next step.** Tell the user the next step is `/todos`, which plans the work from the
   approved phases. Name any held phase: it is not planned until the user approves it.

## Changing an approved prototype

Run `/prototype` again on the next `docs/prototype-<n>` branch. Changing a phase's pages, or a
shared file (styles, `DESIGN.md`, `index.html`, `views.html`), turns the affected phases back to
`awaiting approval` and makes the screen check owed again: the earlier approval no
longer counts for them. Show the user only what changes, and take a new approval (a new
`## Approval <n>` section; earlier ones stay, and the newest record naming a phase decides it).
Then route the work the change affects:

- A wave still open (planned or being built, not yet merged into `main`): name the todos the
  change affects and route them through `.harness/phases/todos.md` § Changing or cancelling
  approved scope.
- A screen already built and merged into `main`: write one proposal per affected screen in
  `todos/parked/` (first line `Parked: <date> — design change, approval <n>`) naming the changed
  `SCREENS.md` files. The next `/todos` ranks them with the rest of the work. The built screen
  and its spec stay as they are until that todo is built.

## Agent teams

Dispatch **uiux-designer** to write the screen list, the design language and the pages, and to
write the design critique from the screenshots. The designer only reads and writes files, so
the orchestrator does the rest: it asks the user the design questions (step 2) and passes the
answers on, runs `check-prototype.mjs` (step 4) and the headed browser pass (step 5), hands the
designer the checker output and the screenshot paths to fix and critique, and shows the
prototype to the user and takes the approval (steps 6–8). The prototype contains no product
code, so the implementation specialists are not used. One designer working phase by phase
keeps the look consistent; split the work only for a large PRD, and then give every designer
the same `DESIGN.md` and `styles.css`.

## Journal (MUST — phase-complete gate)

The approval's `DECISION` entry is required. Add a `DISCOVERY` or `GAP` entry for anything the
design work uncovered — a flow that did not hold together, a requirement that turned out
unclear. These are product entries: do not tag them `harness`.

## Completion gate

`/prototype` is complete only when
`check-prototype.mjs --require-approval --base origin/main workspaces/<project>` (`--base main`
with no remote) exits 0 (every phase approved for its current pages or held by the user; a
screen check passed for these pages, or an owed one the user accepted by name and date; earlier
approval records unchanged), and the branch has merged into `main`. `/todos`
reads each phase's approval from `main`.
