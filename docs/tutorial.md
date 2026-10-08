# Build your first app with Claude Code and code-starter-template

A step-by-step guide for people new to "vibe coding" — building software by describing what
you want to an AI, then reviewing and approving what it builds.

You will not write code yourself. Your job is to **describe**, **review** and **approve**.
Claude does the building, and the harness inside the template makes sure the work is planned,
tested and reviewed before it reaches your users.

The example in this guide builds a web app with:

- **Next.js** for the screens people see (the frontend)
- **Python** for the logic behind the screens (the backend)
- **Postgres** for storing data (the database), running in **Docker Desktop** on your computer

This covers most kinds of application except phone apps from an app store.

---

## The journey at a glance

```
 1 PRD  ->  2 Phases  ->  3 Tech choices (ADR)  ->  4 Prototype  ->  5 Review & approve
                                                                          |
              7 Build, review, go live  <-  6 Plan the work  <------------+
                       |
                       +--> repeat 6 and 7 for each phase
```

You approve at four points: the **tech choices** (step 3), the **prototype** (step 5), the
**plan** (step 6) and **going live** (step 7).

---

## Before you start (once)

1. Install **Claude Code**, **Git**, **Node.js** (version 22 or newer), **Python** and
   **Docker Desktop**. Open Docker Desktop once so it is running.
2. On GitHub, open https://github.com/wailuen/code-starter-template and click **Use this template**. Give your new repository
   your project's name.
3. Get it onto your computer. The easiest way: open Claude Code in an empty folder and type
   *Clone my repository `<the link to your new repository>` into this folder and open it.*
4. Open Claude Code **inside the project folder**: in a terminal, go to the folder and type
   `claude`. (The Claude desktop app and the VS Code extension work too — just open the folder.)
5. Type `/start` for a short orientation, then `/doctor` to check your computer has everything
   it needs.

**When Claude asks for permission.** Before Claude runs a command or changes a file, it may
ask you to allow it. Read what it wants to do: if it matches what you asked for, allow it. If
you are unsure, choose no and ask *"Why do you need to do that?"* — saying no never breaks
anything.

Words you will see:

| Word | Meaning |
| --- | --- |
| **PRD** | Product requirements document: what the app does, for whom, and why |
| **ADR** | Architecture decision record: a short note of a technical choice and the reason for it |
| **MVP** | Minimum viable product: the smallest version people can actually use |
| **Vertical slice** | A small feature that works end to end — screen, logic and data together |
| **Responsive design** | One layout that rearranges itself to fit a phone, tablet or computer screen |
| **Mobile-first** | Design the phone layout first, then widen it for bigger screens |
| **Wave** | A batch of planned work; one phase becomes one or more waves |
| **Todo** | One piece of work inside a wave, with a clear list of what "done" means |

---

## Step 1 — Write your PRD

Talk the idea through with Claude until it is clear. Start with:

> I would like to create a PRD for the below:
> *(Describe your idea in your own words: who will use it, what problem it solves, the main
> things a user should be able to do, and anything it must never do.)*

Claude will ask questions. Answer them, and ask Claude to explain anything you are unsure
about. When the PRD reads right to you:

> Save this PRD as the project brief.

Claude knows where each file belongs, so you never need to type a folder or file name.

---

## Step 2 — Split the PRD into phases

> Structure the PRD by phase, with the MVP as Phase 0, then Phase 1, Phase 2 and so on. Each
> phase must be a vertical slice: something a user can see and use, with the screens, backend
> and database working together. Keep Phase 0 small. Update the project brief.

**Why vertical slices?** Each phase ends with something you can click through and try, not
just code in the background. A good Phase 0 has one to three things a user can do from
start to finish.

---

## Step 3 — Decide the technology (ADR)

`/analyze` turns your PRD into a proper plan: it researches, writes the specifications and
records the technical decisions.

> /analyze Let's build the ADR. I would like this application to be based on a Next.js
> frontend, a Python backend and Postgres as the database. Everything runs locally in
> development, with Postgres in Docker Desktop. Use the PRD and its phases.

This step takes a while: Claude researches, writes the specifications and has the plan
checked. It will:

- write the decision records (the ADR)
- fill in the project's commands (how to run tests, checks and the app) so later steps never guess
- ask you to choose **light** or **standard** mode:
  - **light** — a one-person prototype or hobby, no real users' data, no money involved; fewer reviews
  - **standard** — anything real people will rely on; full reviews

**You approve:** the technology choices and the mode.

---

## Step 4 — Design the prototype (responsive, mobile-first)

> Use Claude Design to build a prototype of the whole product from the PRD and ADR, phase by
> phase. Make it responsive and mobile-first: show every screen at phone, tablet and desktop
> width. Ask me any questions about the design until you are clear.

Claude Design is included with some Claude plans. If Claude asks you to sign in to it, type
`/design-login` and try again. If your plan does not include it, use this instead:

> Build the prototype as plain web pages that I can open in my browser. Make them responsive and mobile-first, and show me how to
> view each screen at phone, tablet and desktop width.

---

## Step 5 — Review the prototype, then approve it

Look at every screen as if you were the user, on your phone and on your computer. Be
specific about what you want changed. Example prompts:

1. > On the home screen the most important information is hard to find. Make it the first
   > thing I see on a phone, and move the filters below it.
2. > Sign-up asks for too much. Keep only name, email and password, and ask for the rest after
   > the first login.
3. > Show me every screen when there is no data yet, while it is loading, and when something
   > goes wrong. Write the messages in plain, friendly words.
4. > On a phone, the menu covers half the screen. Make it a simple menu button that opens a
   > full-screen list, and keep the main buttons within thumb reach at the bottom.
5. > Walk me through Phase 0 as a brand-new user, from opening the app to finishing the main
   > task. Point out any step where I would get stuck or confused, then fix those steps.

Repeat until you are happy. Changes are cheap now and expensive after the code is built.

**Approve formally.** When the prototype is right, record your approval so the next steps
follow exactly this design:

> I approve this prototype for Phase 0 *(or: for all phases)*. Record my approval with my
> name, today's date and these words. From now on, plan and build the screens to match this
> approved prototype; if anything needs to differ, ask me first.

---

## Step 6 — Plan the work

> /todos Plan Phase 0 from the PRD phasing and the approved prototype. Each todo must
> deliver a working vertical slice — screen, backend and database together — that matches the
> approved screens at phone, tablet and desktop width.

Claude will show you the plan and ask four questions:

- Does it cover everything you described?
- Is anything there that you did not ask for?
- Is anything missing that you expected?
- Does the order make sense?

**You approve:** the plan. Approving freezes that phase's scope. You can still change your
mind later — just say so, and Claude will explain what changes and ask you to approve a new plan.

---

## Step 7 — Build, review and go live

> /implement Start with the first todo of the approved plan.

Make sure Docker Desktop is running first. What happens next:

1. **Build** — each todo is built test-first; in standard mode an independent reviewer also
   checks each todo. When one todo is done, type `/implement` again for the next.
2. **Review the whole phase** — when every todo of the phase is built, Claude runs `/redteam`
   (or type `/redteam` yourself). It reviews everything together, security included, then
   merges it.
3. **Preview** — Claude shows you what changed and asks if it may go live. Try it yourself first.
4. **Go live** — the first time, type `/deploy --onboard`: Claude recommends where to host the
   app, tells you what it costs, and sets up alerts that tell you if the site goes down. After
   that, typing `/deploy` puts the new version live. **Only you** start a deploy.

Then go back to step 6 for Phase 1, and repeat for each phase.

---

## Saving your work (commit and push)

Two words you will hear a lot:

- **Commit** — save a snapshot of the project on your computer, with a short note of what changed.
- **Push** — copy those snapshots to GitHub.

Claude commits as it works. Still, ask for it whenever you finish something or stop for the day:

> Commit and push my work.

**Why it matters:**

- **A safety net.** If something goes wrong later, Claude can bring back any earlier snapshot.
- **A backup.** Your work is safe on GitHub even if your computer is lost or broken.
- **Sharing.** Anyone you invite can see and try the latest version.

Claude keeps unfinished work on a separate copy (a *branch*) and only merges it into the main
version once it has been reviewed, so pushing never puts unreviewed work live.

## Along the way

| Situation | What to type |
| --- | --- |
| Something is broken | `/fix` — if the live site is down, it first asks whether to undo the last update |
| Where am I? What is waiting for me? | `/ws` |
| Ending a working session | `/wrapup`, then *Commit and push my work* — the next session picks up from the notes |
| You want to change direction | Say so in plain words; Claude explains the impact and asks before changing the plan |
| Starting a new session | Open Claude Code in the project folder; Claude reads where you left off. To reopen your last conversation, type `claude --continue` |

## Tips for beginners

- **Just tell Claude what you want, in your own words.** You do not need technical terms; Claude
  asks when something is unclear.
- **Do not be afraid to make mistakes.** Every step is saved and reviewed, so a wrong turn can
  always be undone. Say *"That's not what I meant — undo it"* and try again.
- **Be specific.** "Make the button bigger and green, at the bottom of the screen" beats "make it nicer".
- **Ask "why?"** Claude must explain its choices in plain words. If you do not understand, say so.
- **Try it yourself** at every preview, on your phone as well as your computer.
- **Keep phases small.** A small working app beats a big unfinished one.
- **Never paste passwords or secret keys into the chat.** Claude will tell you where they go safely.
