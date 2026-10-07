---
name: start
description: "New user orientation — explains this workflow and how to get started"
---

Present this orientation to the user in a warm, clear, jargon-free way. Adapt tone based on context — if they seem technical, be concise; if they seem new, take more time.

## What is this workflow?

This is a step-by-step way for YOU to direct an AI to build software. The steps always run in the same order: research (`/analyze`), plan (`/todos`), build (`/implement`), test (`/redteam`), save what we learned (`/codify`), and ship (`/deploy`). You don't need to write code. Your job is to:

1. **Describe what you want** (in your own words, as detailed as you like)
2. **Make decisions** when choices come up (we'll always explain the options clearly)
3. **Approve the plan** before building starts
4. **Review the results** to make sure they match your vision

The AI handles all the technical work — writing code, testing, security checks, and deployment.

## The 5 Phases

| Step | Command | What Happens | Your Role |
|------|---------|-------------|-----------|
| 1. Research | `/analyze` | Study your idea — market fit, user needs, competition | Confirm we understood your vision |
| 2. Planning | `/todos` | Create a complete project roadmap | Approve the plan before building starts |
| 3. Building | `/implement` | Build the project one task at a time | Answer questions when choices come up |
| 4. Testing | `/redteam` | Test everything from a real user's perspective | Review results |
| 5. Knowledge | `/codify` | Capture what we learned for future sessions — runs on its own after each wave and at `/wrapup` | Nothing, unless a change would loosen a rule, touch security or git safety, change what you approve, give the AI more freedom, or change an AI model setting; those wait for your OK |

If testing turns up a repeated problem, `/debug` steps back to reconsider the approach before
trying another fix — you won't usually need to run this yourself.

Plus **`/fix`** when something that already works breaks or someone reports a bug,
**`/deploy`** when you're ready to put the application live, and **`/ws`** anytime to check
progress. If the project publishes numbered versions (a library, an app-store app), the
release steps are in `.harness/guides/task-delivery.md` § Releases.

## Getting Started

Walk the user through these steps:

1. **Create a workspace**: Tell the AI the project's name and what you want (e.g., "start a project called my-project: …"). `/analyze` creates `workspaces/my-project/briefs/` and saves your description as the first brief. You can also create that folder yourself.
2. **Write a brief**: Create a file in the briefs folder describing what you want to build — in your own words, as detailed as you like. Include who it's for, what problem it solves, and what success looks like. You can also just tell the AI what you want and ask it to write the brief for you.
3. **Run `/analyze`**: This kicks off the research phase

If the user already has a workspace, show them their current status with `/ws` instead.

## All commands

| Command | What it does |
|---------|--------------|
| `/start` | This orientation |
| `/analyze` | Research the idea and write the specifications |
| `/todos` | Plan the work as small tasks, for your approval |
| `/implement` | Build the next approved task |
| `/redteam` | Independent review and real-user testing of finished work |
| `/debug` | Step back and rethink when reviews keep finding the same problem |
| `/fix` | Fix a reported bug: reproduce it, fix the cause, review, ship |
| `/deploy` | Put the application live, check what's live, or roll back |
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
- **The AI remembers across sessions.** Run `/wrapup` before leaving, and your next session starts right where you left off.
