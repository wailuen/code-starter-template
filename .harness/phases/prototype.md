## When to run

After `/analyze` and before the first `/todos`, for any product with screens. The prototype
covers the **whole PRD — every phase** — so the user sees and approves the complete product
before any of it is built; planning and building then follow it. Run it again when the user
wants to change the approved design, or when a new brief adds screens.

A product with no screens (an API, CLI, library or data job): write
`prototype/00-no-screens.md` saying why, commit it with the analysis, and go to `/todos`.

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
mode is the same.

## Output

Everything lives in `workspaces/<project>/prototype/`
(`.harness/guides/task-delivery.md` § Workspace file layout):

| File | What it holds |
| --- | --- |
| `index.html` | The start page: every screen, grouped by PRD phase, each with a link to the screen and to its phone · tablet · desktop view |
| `views.html` | Shows one screen (`views.html?screen=<file>`) side by side at 390, 820 and 1280 pixels wide, each in a frame of that true width, scaled down together so all three fit the user's window without sideways scrolling — the user sees all three sizes without browser tools. It accepts only a `screens/…html` value |
| `screens/p<phase>-<slug>.html` | One page per screen, e.g. `screens/p0-sign-in.html` |
| `styles.css` | The shared, mobile-first styles |
| `SCREENS.md` | The screen list (format below) and the latest screen-check result |
| `DESIGN.md` | The design language: the user's answers to the design questions, colours, type, spacing, tone of the words |
| `APPROVAL.md` | The user's approval records, append-only |

`SCREENS.md` holds one table that `check-prototype.mjs` reads. Every screen is one row; the
file is a path relative to `prototype/`, in backticks:

```markdown
| Screen | Phase | File | Serves | States |
| --- | --- | --- | --- | --- |
| Sign in | 0 | `screens/p0-sign-in.html` | 03-user-flows/01-join.md; specs/accounts.md § Sign-in | default, error |
```

Rules for the pages:

- Plain HTML and CSS, opened by double-clicking `index.html`: no build step, no framework,
  nothing loaded from the internet (no outside fonts, scripts or images). A short inline
  script is fine for a state switcher or for `views.html`.
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
   internet) until it exits 0.
5. **Screen check.** Run `.harness/guides/task-delivery.md` § Screen red-team before the owner
   sees it over every screen and state: the headed browser pass at every width it names, then a
   design critique. Use the project profile's E2E runner when it is set; before that, a headed
   browser the runtime can drive. Fix and re-run until it passes. Keep the screenshots in
   `prototype/.screenshots/` (not committed) and write the one-line result, with the date and
   the commit, at the end of `SCREENS.md`. If no browser can run, tell the user plainly, write
   `Screen check: owed — <reason>` there, and do not call the prototype checked.
6. **Show the user.** Say in plain words what is there (how many screens, in which phases) and
   how to look at it: offer to open `index.html` in their browser; each screen's phone · tablet ·
   desktop link shows the three sizes. To try it on their own phone, offer to start a
   temporary preview on this computer that phones on the same Wi-Fi can open — ask first,
   because other people on that network could open it too — and stop it when they are done.
   Ask them to walk the main flow as a new user and say what to change.
7. **Change it until the user is happy.** Apply each change request, update `SCREENS.md` and
   `DESIGN.md`, re-run steps 4 and 5 for the changed screens, and say what changed. A request
   that adds, drops or changes a feature (not just its look) changes the PRD: say so, and with
   the user's OK update the brief and the specs too.
8. **Approval.** Ask in the five-part format (`.claude/rules/communication.md` § Asking the
   user to decide): what they approve (every screen of every PRD phase), what happens if yes
   (planning and building follow these screens; any later difference is asked first), what
   happens if no (nothing is planned from it; say what to change), your recommendation, and how
   to answer. The user may approve some phases and hold the rest; the record names the phases
   approved. After the user answers yes, and only then:
   - append to `APPROVAL.md` (never edit an earlier record):

     ```markdown
     ## Approval <n>
     approved_by: <the user's name>
     approved_on: <YYYY-MM-DD>
     approval: "<the user's approving words, quoted>"
     phases: <the PRD phases approved, e.g. 0, 1, 2, 3>
     screens: <how many screens>
     ```

   - write a journal `DECISION` entry with `author: human` quoting the user's words;
   - update the specs: each spec section a screen serves names the screen's file and the
     behavior and words it shows (the spec keeps its `Status: approved design` line —
     `.claude/rules/spec-accuracy.md` § Exceptions item 4);
   - run `node .harness/bin/check-prototype.mjs --require-approval workspaces/<project>`, commit, open
     the pull request into `main`, and merge it under `.harness/guides/task-delivery.md`
     § Branches, pull requests and merging. There is no code yet, so say "no code yet" in
     the commit body instead of running Local CI parity, as `/analyze` does.
9. **Next step.** Tell the user the next step is `/todos`, which plans the work from these
   screens.

## Changing an approved prototype

Run `/prototype` again on the next `docs/prototype-<n>` branch. Show the user only what
changes, and take a new approval (a new `## Approval <n>` section; earlier ones stay). If an
approved wave plan was built on the old design, name the todos the change affects and route
them through `.harness/phases/todos.md` § Changing or cancelling approved scope.

## Agent teams

Dispatch **uiux-designer** for the screen list, the design language, the pages and the design
critique. The prototype contains no product code, so the implementation specialists are not
used. One designer working phase by phase keeps the look consistent; split the work only for a
large PRD, and then give every designer the same `DESIGN.md` and `styles.css`.

## Journal (MUST — phase-complete gate)

The approval's `DECISION` entry is required. Add a `DISCOVERY` or `GAP` entry for anything the
design work uncovered — a flow that did not hold together, a requirement that turned out
unclear. These are product entries: do not tag them `harness`.

## Completion gate

`/prototype` is complete only when `check-prototype.mjs --require-approval workspaces/<project>`
exits 0, `SCREENS.md` ends with a passed screen-check line (or the user has
been told it is owed), and the branch has merged into `main`. `/todos` reads the approval
record from `main`.
