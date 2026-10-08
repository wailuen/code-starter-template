---
name: start
description: "New user orientation — explains this workflow and how to get started"
---

Present this orientation to the user in a warm, clear, jargon-free way. Adapt tone based on context — if they seem technical, be concise; if they seem new, take more time.

## What is this workflow?

This is a step-by-step way for YOU to direct an AI to build software. The steps always run in the same order: research (`/analyze`), design the screens (`/prototype`), plan (`/todos`), build (`/implement`), test (`/redteam`), save what we learned (`/codify`), and ship (`/deploy`). You don't need to write code. Your job is to:

1. **Describe what you want** (in your own words, as detailed as you like)
2. **Make decisions** when choices come up (we'll always explain the options clearly)
3. **Approve the plan** before building starts — approving fixes that stretch of work; changing your mind later is fine, it just means re-planning that part
4. **Try the result yourself** before it goes live, and say whether it matches what you wanted

The AI handles all the technical work — writing code, testing, security checks, and deployment.

## The 6 Phases

| Step | Command | What Happens | Your Role |
|------|---------|-------------|-----------|
| 1. Research | `/analyze` | Study your idea — market fit, user needs, competition | Pick between the options it recommends (how to build it, where it runs and what that costs) |
| 2. Design | `/prototype` | Draw every screen of every phase as clickable pages that fit phone, tablet and computer (skipped when there are no screens) | Answer design questions, ask for changes, then approve the screens |
| 3. Planning | `/todos` | Create a complete project roadmap from the approved screens | Approve the plan before building starts |
| 4. Building | `/implement` | Build the project one task at a time | Answer questions when choices come up |
| 5. Testing | `/redteam` | Test everything from a real user's perspective | Try it yourself and say whether it matches what you wanted |
| 6. Knowledge | `/codify` | Improve the AI's own working instructions from what went wrong — runs on its own after each stretch of work, after some bug fixes, and at `/wrapup` | Nothing, except saying yes or no when a change touches the AI's rules, skills, commands or what it may do without you; `/ws` shows those |

If testing turns up a repeated problem, `/debug` steps back to reconsider the approach before
trying another fix — you won't usually need to run this yourself.

Plus **`/fix`** when something that already works breaks or someone reports a bug,
**`/deploy`** when you're ready to put the application live (the first time, the AI recommends
where to host it and what it costs, and walks you through anything only you can do, like
creating an account), and **`/ws`** anytime to see progress and anything waiting for your
answer. If the project publishes numbered versions (a library, an app-store app), just ask for
a release; the AI recommends the version number.

Things the AI always asks you first: approving a plan, putting changes live or undoing them,
spending money, deleting things, publishing a release, and sending messages to people outside the project. The full list is in
`.harness/rules/autonomous-execution.md` § What needs the user. Only you put changes live: the
AI asks you to run `/deploy` when something is ready.

For a small personal project — a prototype or hobby with no real users' data or money —
`/analyze` will suggest **light mode**: fewer review rounds and less paperwork, with the same
tests and the same questions to you. You choose it in `/analyze`, together with the tech stack.

## Getting Started

Walk the user through these steps:

0. **Check the computer is ready**: run `/doctor`. It checks the tools the project needs (git,
   Node.js 22 or newer for the workflow's own checks, a GitHub login, and anything the project
   itself needs, such as Docker for tests) and says how to fix anything missing. The project
   also needs a GitHub repository to hold its work.
1. **Create a workspace**: Tell the AI the project's name and what you want (e.g., "start a project called my-project: …"). `/analyze` creates `workspaces/my-project/briefs/` and saves your description as the first brief. You can also create that folder yourself.
2. **Write a brief**: Create a file in the briefs folder describing what you want to build — in your own words, as detailed as you like. Include who it's for, what problem it solves, and what success looks like. You can also just tell the AI what you want and ask it to write the brief for you.
3. **Run `/analyze`**: This kicks off the research phase
4. **Run `/prototype`** (if the product has screens): see and approve every screen before anything is built

If the user already has a workspace, show them their current status with `/ws` instead.

## All commands

| Command | What it does |
|---------|--------------|
| `/start` | This orientation |
| `/analyze` | Research the idea and write the specifications |
| `/prototype` | Draw every screen as clickable pages, for your approval |
| `/todos` | Plan the work as small tasks, for your approval |
| `/implement` | Build the next approved task |
| `/redteam` | Independent review and real-user testing of finished work |
| `/debug` | Step back and rethink when reviews keep finding the same problem |
| `/fix` | Fix a reported bug: reproduce it, fix the cause, review, ship |
| `/deploy` | Put the application live, check what's live, roll back, or take the product offline for good |
| `/ws` | Show where the project stands |
| `/wrapup` | Save notes so the next session picks up where this one stopped |
| `/sweep` | Full check for anything unfinished before calling a stretch of work done |
| `/journal` | Record or look up decisions and discoveries |
| `/learn` | List lessons not yet built into the workflow |
| `/codify` | Build those lessons into the workflow's own instructions |
| `/validate` | Check the work against the project's standards |
| `/test` | Quick reference for how this project tests |
| `/design` | Quick reference for screen and interface design |
| `/doctor` | Check the computer's tools and accounts are set up |
| `/worktree` | Set up a separate copy of the project for parallel work |
| `/autonomize` | Let the AI work on its own within what you've approved, without asking at each step |

You can always just type a question in plain language instead.

## Tips for Non-Coders

Present these naturally, not as a lecture:

- **You don't need to understand code.** When the AI mentions technical things, ask it to explain in plain language.
- **Your knowledge is the most valuable input.** You know your users, your market, and your vision better than any AI.
- **"I don't understand" is always valid.** The AI will rephrase — no judgment.
- **Approval gates protect you.** Never approve something you don't fully understand. Ask questions first.
- **The AI remembers across sessions.** Run `/wrapup` before leaving, and your next session starts right where you left off. Those notes stay on this computer; decisions are also saved in the project's journal, which travels with the project.
