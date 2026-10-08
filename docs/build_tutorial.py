"""Builds docs/tutorial.md and docs/tutorial.pdf from the one source below, so the two never drift.

Edit the content in this file, never the generated files, then run:

    pip install reportlab
    python3 docs/build_tutorial.py
"""
import math, os, re
from reportlab import rl_config
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon, Circle

rl_config.invariant = 1  # same input -> byte-identical PDF, so a rebuild with no edits shows no diff
OUT = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- content
# Inline markup: **bold**, *italic*, `code`. Kinds: title, sub, h1, h2, p, bullets, numbered,
# prompt(text, label), decide, tip(text, label), table(rows, widths_mm), fig(name, caption), page.
C = []
add = C.append

add(("title", "Build your first app with Claude Code"))
add(("sub", "A step-by-step guide to code-starter-template for people new to vibe coding"))
add(("p", "You will not write code yourself. Your job is to **describe** what you want, **review** what Claude shows you, and **approve** it. Claude does the building, and the built-in rules in this template make sure the work is planned, tested and reviewed before it reaches your users."))
add(("p", "The example builds a web app with **Next.js** for the screens, **Python** for the logic behind them, and **Postgres** for storing data, running in **Docker Desktop** on your computer. That covers most applications except phone apps sold through an app store."))
add(("h1", "The journey at a glance"))
add(("fig", "journey", "Seven steps from your idea to a live app."))
add(("p", "You approve at a few fixed points: the technology and hosting choice (step 3), the prototype (step 5), each plan (step 6), and each preview and each time the app goes live (step 7). In between, Claude works on its own and reports what it did."))

add(("h2", "What it costs and how long it takes"))
add(("bullets", [
    "**Claude:** you need a paid Claude plan (Pro, Max, Team or Enterprise); the free plan does not include Claude Code. Steps 3 and 7 use a lot. On Pro, expect to pause at the usage limit in the middle of a step, especially in standard mode; Max gives more room. Wait for the reset, then type *Carry on where you stopped.*",
    "**GitHub:** free. Private projects get a monthly allowance of time for the automatic checks; if they stop running, ask *Have we used up the free check time?*",
    "**Docker Desktop:** free for personal use, education and small businesses; larger companies need a paid subscription, so check Docker's terms if you use it at work.",
    "**Hosting** (putting the app on the internet): often $5 to $30 a month, plus about $10 to $20 a year for your own web address. Claude gives the exact figure and a cheaper option, and waits for your OK before buying anything.",
    "**Time:** setting up your computer takes 30 to 60 minutes; each later step takes minutes to hours.",
]))

add(("page",))
add(("h1", "Before you start (once)"))
add(("numbered", [
    "Create a free account at **github.com** and sign in.",
    "Install the **Claude desktop app** from **claude.com/download** and sign in with your Claude account. (Prefer a terminal? See *Using a terminal instead* below.)",
    "In the desktop app, open the **Code** tab, choose **Local**, and pick a folder for your projects, for example *Documents/Projects*. Then type: *Help me install Git, GitHub CLI, Node.js 22 or newer, Python and Docker Desktop on this computer. Go one at a time and tell me when each one works.* (See *What installing looks like* below.)",
    "Type: *Log me in to GitHub, with permission to set up automatic checks.* Claude shows a short one-time code and opens a GitHub page (or gives you its address). Type the code on that page, then click **Authorize**. The permission matters: without it, GitHub refuses the automatic checks the first plan sets up.",
    "Type: *Set my name for saved work to (your name), and use my private GitHub email address.* Git stamps this name on every snapshot; the private address keeps your real email out of the project's history.",
    "On GitHub, open **github.com/wailuen/code-starter-template** and click **Use this template**. Give your new repository your project's name and choose **Private**, so only you (and people you invite) can see it.",
    "Back in Claude, type: *Copy my GitHub repository `<the link to your new repository>` onto this computer.* Claude tells you the folder it made.",
    "Start a **new session** in the Code tab and pick **that** folder. Always open this folder from now on.",
    "Type `/start` for a short orientation, then `/doctor` to check your computer. Before step 3, `/doctor` says some checks are *not filled in yet* — that is normal; run it again after step 3.",
]))
add(("tip", "Installers are not fully automatic. Some open their own window or ask for your computer's password: type the password in that window, never in the chat. On a Mac, the first use of Git may open an Apple window offering to install developer tools; click **Install** and wait, it can take a while. Docker Desktop asks you to accept its terms and may ask you to restart the computer. If Claude asks you to paste something into the **Terminal** app, it tells you exactly what to paste. If an install will not work through Claude, use the official download pages: **git-scm.com/downloads**, **cli.github.com**, **nodejs.org**, **python.org/downloads** and **docker.com/products/docker-desktop**, then tell Claude it is done.", "What installing looks like"))
add(("tip", "`/start` describes the work in six broad stages; this guide's seven steps fit inside them. Follow this guide. This project has its own `/doctor`, which checks your computer for this project, and its own `/design`, which you do not need to type at all; both replace Claude Code's built-in commands with the same names. To run Claude Code's own setup check instead, type `/checkup`. You never need to type a folder or file name either: Claude knows where each file belongs.", "Good to know"))
add(("h2", "Using a terminal instead"))
add(("p", "A *terminal* is a window where you type commands (on a Mac, the **Terminal** app). Install Claude Code with the steps at **code.claude.com/docs/en/quickstart**, then type `cd` followed by your project folder, press Enter, and type `claude`. Everything else in this guide is the same."))
add(("page",))
add(("h2", "Talking to Claude"))
add(("bullets", [
    "Type in the box at the bottom and press **Enter** to send. For a new line without sending, press **Shift+Enter**.",
    "A command starts with `/` as the very first character, for example `/analyze`. Words after it are passed to the command. Type `/` on its own to see the list.",
    "To stop Claude in the middle of something, press **Esc**. To finish a session, type `/exit` or close the window.",
]))
add(("tip", "This template does not pre-approve any commands, so Claude may ask for permission often, especially at first. Most requests are normal building work — installing parts, running tests, saving your work to GitHub — so allow them. If it offers to stop asking for a kind of command, that is fine for routine ones such as `git`, `gh`, `node` or the tests. Say no and ask *Why do you need to do that?* if it wants to delete files outside your project, spend money, change your GitHub account settings or put the app live. If you cannot tell, ask *Explain that in one sentence.* Saying no stops that one step and Claude waits for you.", "When Claude asks for permission"))

add(("h1", "Words you will see"))
add(("table", [
    ["Word", "Meaning"],
    ["PRD", "Product requirements document: what the app does, for whom, and why"],
    ["ADR", "Architecture decision record: a short note of a technical choice and the reason for it"],
    ["MVP", "Minimum viable product: the smallest version people can actually use"],
    ["Vertical slice", "A small feature that works end to end: screen, logic and data together"],
    ["Responsive design", "One layout that rearranges itself to fit a phone, tablet or computer screen"],
    ["Mobile-first", "Design the phone layout first, then widen it for bigger screens"],
    ["Prototype", "Clickable pages that look like the finished app but have nothing behind them, for trying the design before it is built"],
    ["Repository", "Your project's folder on GitHub"],
    ["Clone / copy", "Make a copy of the repository on your computer"],
    ["Commit", "Save a snapshot of the project, with a short note of what changed"],
    ["Push", "Copy your snapshots to GitHub"],
    ["Branch", "A separate copy where unfinished work happens, so the main version stays safe"],
    ["Merge", "Join reviewed work into the main version"],
    ["Pull request", "GitHub's page for proposing a merge; Claude opens it for you"],
    ["Wave", "One batch of planned work; a phase is built in one or more waves"],
    ["Todo", "One piece of work inside a wave, with a clear list of what “done” means"],
    ["Deploy", "Put the app on the internet for your users"],
], [34, None]))

add(("page",))
add(("h1", "Step 1 — Write your PRD"))
add(("p", "Talk the idea through with Claude until it is clear. A paragraph is enough to start."))
add(("prompt", "I would like to create a PRD for the below:\n*(Describe your idea in your own words: who will use it, what problem it solves, the main things a user should be able to do, and anything it must never do. Example: a private site where my family can share recipes with photos and find them again easily.)*", "Type this"))
add(("p", "Claude asks questions. Answer them, and ask Claude to explain anything you are unsure about. When the PRD reads right to you:"))
add(("prompt", "Save this PRD as the project brief for my project called *Family Recipes*.", "Type this (use your own project name)"))
add(("h1", "Step 2 — Split the PRD into phases"))
add(("prompt", "Structure the PRD by phase, with the MVP as Phase 0, then Phase 1, Phase 2 and so on. Each phase must be a vertical slice: something a user can see and use, with the screens, backend and database working together. Keep Phase 0 small. Update the project brief.", "Type this"))
add(("fig", "slices", "Each phase cuts through every layer, so every phase ends with something you can click through and try."))
add(("tip", "A good Phase 0 has one to three things a user can do from start to finish. For a family recipe site: family members sign in, add a recipe with a photo, and see everyone's recipes; comments, search and printing wait for Phase 1. If Phase 0 has more than three things, ask *Make Phase 0 smaller.*", "Why"))

add(("page",))
add(("h1", "Step 3 — Decide the technology (ADR)"))
add(("p", "`/analyze` turns your brief into a proper plan: it researches, writes the specifications and records the technical decisions."))
add(("prompt", "/analyze Let's build the ADR. I would like this application to be based on a Next.js frontend, a Python backend and Postgres as the database. Everything runs locally in development, with Postgres in Docker Desktop. Use the project brief and its phases.", "Type this"))
add(("p", "This step can take from 30 minutes to a couple of hours. Claude will:"))
add(("bullets", [
    "research similar apps — for a private family or hobby app, add *Keep the market research short* to the prompt;",
    "write the specifications and the decision records (the ADR), and fill in the project's commands so later steps never guess;",
    "recommend where the app will run when it goes live, with its monthly cost;",
    "ask you to choose **light** or **standard** mode. **Light:** only you will use it, nothing important is stored, no money moves — fewer reviews. **Standard:** other people will sign in with their email, or you store real personal data or money — full reviews. If unsure, choose standard.",
]))
add(("p", "It is finished when Claude says the analysis is done and asks you to approve. Claude may upload the plan to GitHub as a *pull request* — that is normal."))
add(("decide", "Approve the technology, where the app will run and what it costs each month, and the mode. If you do not know, say *Recommend one, explain the trade-off in plain words, and I'll go with your recommendation.*"))
add(("p", "Now run `/doctor` again: it can check Python and Docker Desktop this time."))

add(("page",))
add(("h1", "Step 4 — Design every screen (responsive, mobile-first)"))
add(("prompt", "/prototype Design every screen of every phase in the PRD.", "Type this"))
add(("p", "The prototype covers your **whole PRD — every phase** — so you see the complete app before any of it is built. Claude first asks about the look you want: the feel, colours, apps you like, the device your users mostly hold. Answer in your own words, or say *you choose*. Then it lists every screen and builds them as clickable pages, designed for a phone first and rearranging themselves for tablets and computers."))
add(("fig", "screens", "Responsive design: one design that fits every screen size. Mobile-first: the phone layout is designed first."))
add(("p", "Before showing you, Claude checks every screen at several widths, from a small phone to a wide computer screen, in a browser it can control. It may ask to install one first (a large download). If it says the screen check is *owed*, type *Install what you need and run the screen check.* Then it tells you how to open the prototype — or ask *Open the prototype in my browser for me.* The start page lists every screen by phase. Each screen has a **phone · tablet · desktop** link that shows all three sizes side by side. To try it on your real phone, ask *How can I open this on my phone?* If your computer then asks whether to allow incoming connections, allow it: that is how your phone reaches the preview."))
add(("tip", "Claude may use Claude Design (on the Pro, Max, Team and Enterprise plans; on Enterprise, your admin must turn it on). If it says it cannot reach Claude Design, type `/design-login` and finish the sign-in in your browser — or simply carry on: Claude builds the same clickable pages either way, and those pages are what gets approved.", "Good to know"))

add(("page",))
add(("h1", "Step 5 — Review the prototype, then approve it"))
add(("p", "Walk through every screen as if you were a new user. Be specific about what you want changed. Type these two for every app:"))
add(("prompt", "Show me every screen when there is no data yet, while it is loading, and when something goes wrong. Write the messages in plain, friendly words.", "For every app"))
add(("prompt", "Walk me through the app as a brand-new user, from opening it to finishing the main task. Point out any step where I would get stuck or confused, then fix those steps.", "For every app"))
add(("p", "These three are examples — rewrite them about your own screens:"))
add(("prompt", "On the home screen the most important information is hard to find. Make it the first thing I see on a phone, and move the filters below it.", "Example"))
add(("prompt", "Sign-up asks for too much. Keep only name, email and password, and ask for the rest after the first login.", "Example"))
add(("prompt", "On a phone, the menu covers half the screen. Make it a simple menu button that opens a full-screen list, and keep the main buttons within thumb reach at the bottom.", "Example"))
add(("p", "Repeat until you are happy. Changes are cheap now and expensive after the code is built. If a change adds or drops a feature, Claude says so and updates the PRD with your OK."))
add(("h2", "Approve it"))
add(("p", "When you say you are happy, Claude asks you to approve, explaining what yes and no mean. Answer in your own words, for example:"))
add(("prompt", "Yes, I approve every screen for all phases.", "Type this"))
add(("decide", "Approve the prototype. Claude asks your name the first time and records it with the date and your words, and from then on plans and builds the screens to match it; anything that must differ is asked first. You can approve some phases now and the rest later. To change an approved design later, type `/prototype` again."))

add(("page",))
add(("h1", "Step 6 — Plan the work"))
add(("prompt", "/todos Plan Phase 0 from the PRD phasing and the approved prototype. Each feature todo must deliver a working vertical slice — screen, backend and database together.", "Type this"))
add(("p", "Claude ties each piece of work to the approved screens it builds, and checks the result against them at phone, tablet and desktop size. A phase may be split into a few batches (*waves*). Claude plans one wave at a time, shows it to you, and asks four questions:"))
add(("bullets", ["Does it cover everything you described?", "Is anything there that you did not ask for?",
                 "Is anything missing that you expected?", "Does the order make sense?"]))
add(("p", "If the plan is hard to read, ask *Explain each item as what I will be able to do when it is finished.* If you cannot judge the order, ask *Why this order?*"))
add(("p", "The first plan also asks to switch on automatic checks on GitHub — say yes. It may mention locking the main version with a paid GitHub plan; you can say no and everything still works. Before a wave starts, Claude may also ask you to get a key from another service (for example a sign-in or email service); it tells you each click and where to put the key safely."))
add(("decide", "Approve the plan. Approving freezes this wave's work. You can still change your mind: say so, and Claude explains what changes and asks you to approve a new plan."))

add(("page",))
add(("h1", "Step 7 — Build, review and go live"))
add(("p", "First open **Docker Desktop** and wait until it says it is running (on a Mac, a whale icon at the top of the screen). Do this at the start of every working session: the tests need it. Then:"))
add(("prompt", "/implement Start with the first todo of the approved plan.", "Type this"))
add(("fig", "loop", "Every wave goes round this loop. Nothing reaches your users until you type /deploy."))
add(("numbered", [
    "**Build** — each todo is built test-first; in standard mode an independent reviewer also checks each todo. Claude says when a todo is done and what changed. Each `/implement` builds one todo; type it again, or say *Carry on with the next todo.*",
    "**Review** — when every todo of the wave is built, Claude runs `/redteam` (or type it yourself). It reviews everything together, security included. This can take a while.",
    "**Preview** — Claude shows you what changed and how to try it, and asks if it matches what you wanted. Answer *yes*, or say what is wrong. Claude joins the work into the main version either way, and that does not put it live. Your *yes* is what lets `/deploy` put this wave live later; after a *no*, `/deploy` refuses until Claude has fixed what you said or you have agreed a change of plan.",
    "**Go live** — the first time, type `/deploy --onboard`. Claude confirms the hosting you chose in step 3, tells you what it costs, walks you through creating the hosting account and adding a payment card, and sets up an alert that reaches you if the site goes down. It may ask you to install the hosting company's tool and log in to it, the same way you logged in to GitHub, and to paste secret keys into the hosting company's website (never into the chat). You will need a card, an email or phone for alerts, and about an hour. After that, type `/deploy` to put the new version live. Only you start a deploy.",
]))
add(("tip", "While Claude builds and reviews, browser windows may open and click by themselves. That is Claude testing the app. Leave them alone until Claude says it is done.", "Good to know"))
add(("h2", "Try it on your computer"))
add(("p", "Before anything goes live, ask *Start the app on my computer so I can try it.* Claude gives you an address such as `http://localhost:3000` — open it in your browser. Only you can see it; it is not on the internet. When you are done, say *Stop the app.*"))
add(("tip", "Do not connect your project to a hosting website on your own, even if the site offers a *Connect GitHub* button. Let `/deploy` set it up, so unreviewed work never goes live. During `/deploy --onboard`, Claude may ask you to click such a button; do it then, as Claude walks you through it step by step.", "Important"))
add(("p", "When a wave is finished, type `/ws`. It tells you whether the next step is `/todos` (plan the next wave of this phase, or the next phase) or `/deploy`."))

add(("h1", "Saving your work (commit and push)"))
add(("p", "Claude commits as it works, on a side copy (a branch), and opens a pull request when the work is ready to join the main version. Still, ask for it whenever you finish something or stop for the day (if a review is running, let it finish first):"))
add(("prompt", "Commit and push my work.", "Type this"))
add(("tip", "**A safety net:** if something goes wrong later, Claude can bring back an earlier snapshot. **A backup:** your work is safe on GitHub even if your computer is lost. **Sharing:** anyone you invite can see the latest version of the project. Pushing does not change your live app: nothing reaches your users until you type `/deploy`.", "Why it matters"))

add(("h1", "Tips for beginners"))
add(("bullets", [
    "**Just tell Claude what you want, in your own words.** You do not need technical terms; Claude asks when something is unclear.",
    "**Do not be afraid to make mistakes.** Code changes can be undone — say *That's not what I meant, undo it* and try again. Claude asks you first before anything that cannot be undone, such as deleting data, spending money or putting the app live.",
    "**Be specific.** “Make the button bigger and green, at the bottom of the screen” beats “make it nicer”.",
    "**Ask “why?”** Claude must explain its choices in plain words. If you do not understand, say so.",
    "**Try it yourself** at every preview, on your phone as well as your computer.",
    "**Keep phases small.** A small working app beats a big unfinished one.",
    "**Never paste passwords or secret keys into the chat.** Claude tells you where they go safely.",
]))

add(("page",))
add(("h1", "When you are stuck"))
add(("table", [
    ["Situation", "What to do"],
    ["Something is broken on the live site", "Type `/fix` and say what went wrong. If the site is down or data is at risk, it first asks whether to undo the last update"],
    ["Claude shows an error you do not understand", "*What does this mean for me, and what should I do?*"],
    ["Claude asks a question you cannot answer", "*I don't know — recommend one and explain why.*"],
    ["You reached your usage limit", "Wait for it to reset, then *Carry on where you stopped.*"],
    ["Where am I? What is waiting for me?", "`/ws`"],
    ["You want to change direction", "Say so in plain words; Claude explains the impact and asks before changing the plan"],
    ["Claude asks to change its own working rules", "After each wave Claude improves its own rules from what went wrong, and some changes wait for your OK. Ask *What changes for me if I say yes?* If it only makes Claude more careful, say yes; if you are unsure, say *not now*"],
    ["Ending a working session", "*Commit and push my work*, then `/wrapup` (it saves notes on this computer for your next session, in that order so it can also save lessons). It can take a few minutes and may open a pull request on GitHub"],
    ["Starting a new session", "Open Docker Desktop, open the project folder, and type *Where did we leave off?* (or `/ws`). Claude waits for your first message before it reads its notes. To reopen an earlier conversation, pick it from the list in the desktop app (in a terminal: `claude --continue` inside the project folder)"],
], [62, None]))

# ---------------------------------------------------------------- markdown output
FIG_MD = {
    "journey": "```\n 1 PRD -> 2 Phases -> 3 Tech (ADR) -> 4 Prototype -> 5 Review & approve\n                                                         |\n          7 Build, review, go live  <-  6 Plan  <---------+\n                     |\n                     +--> repeat 6 and 7 for each wave and phase\n```",
    "slices": "```\n              Phase 0   Phase 1   Phase 2\n Screens        |##|      |##|      |##|\n Logic          |##|      |##|      |##|\n Data           |##|      |##|      |##|\n```",
    "screens": "```\n  Phone        Tablet            Desktop\n  [====]     [==========]     [====================]\n  [ ## ]     [ ## ][ ## ]     [  ][ ## ][ ## ][ ## ]\n  [ ## ]     [ ## ][ ## ]     [  ][ ############ ]\n  [ ## ]     [##########]     [  ][              ]\n  [btn ]\n```",
    "loop": "```\n Build -> Review -> Preview (you try it) -> merged (not live) -> your yes + /deploy -> live\n   ^                                                                                  |\n   +----------------------------- next wave: /todos ----------------------------------+\n```",
}

def to_md():
    out = ["<!-- Generated by docs/build_tutorial.py — edit that file, not this one, then rebuild. -->\n"]
    for item in C:
        k = item[0]
        if k == "title": out.append(f"# {item[1]}\n")
        elif k == "sub": out.append(f"*{item[1]}*\n")
        elif k == "h1": out.append(f"## {item[1]}\n")
        elif k == "h2": out.append(f"### {item[1]}\n")
        elif k == "p": out.append(f"{item[1]}\n")
        elif k == "bullets": out.append("\n".join(f"- {b}" for b in item[1]) + "\n")
        elif k == "numbered": out.append("\n".join(f"{i}. {b}" for i, b in enumerate(item[1], 1)) + "\n")
        elif k == "prompt":
            body = "\n".join(f"> {l}" for l in item[1].split("\n"))
            out.append(f"**{item[2]}:**\n\n{body}\n")
        elif k == "decide": out.append(f"> **You decide:** {item[1]}\n")
        elif k == "tip": out.append(f"> **{item[2]}:** {item[1]}\n")
        elif k == "table":
            rows = item[1]
            out.append("| " + " | ".join(rows[0]) + " |\n| " + " | ".join("---" for _ in rows[0]) + " |\n" +
                       "\n".join("| " + " | ".join(r) + " |" for r in rows[1:]) + "\n")
        elif k == "fig": out.append(f"{FIG_MD[item[1]]}\n\n*{item[2]}*\n")
        elif k == "page": out.append("---\n")
    return "\n".join(out)

# ---------------------------------------------------------------- PDF output
W, H = A4; CW = W - 36 * mm
INK = colors.HexColor("#1f2933"); MUTED = colors.HexColor("#52606d")
BLUE = colors.HexColor("#2563eb"); BLUE_L = colors.HexColor("#dbeafe")
GREEN = colors.HexColor("#15803d"); GREEN_L = colors.HexColor("#dcfce7")
AMBER = colors.HexColor("#b45309"); AMBER_L = colors.HexColor("#fef3c7")
GREY_L = colors.HexColor("#f1f5f9"); LINE = colors.HexColor("#cbd5e1")
ss = getSampleStyleSheet()
TITLE = ParagraphStyle("t", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=24, leading=29, textColor=INK, alignment=0)
SUB = ParagraphStyle("s", parent=ss["Normal"], fontName="Helvetica", fontSize=12, leading=17, textColor=MUTED, spaceAfter=14)
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=INK, spaceBefore=4, spaceAfter=6)
H2 = ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=INK, spaceBefore=8, spaceAfter=4)
BODY = ParagraphStyle("b", parent=ss["Normal"], fontName="Helvetica", fontSize=10.5, leading=15, textColor=INK, spaceAfter=5)
BUL = ParagraphStyle("bl", parent=BODY, leftIndent=14, bulletIndent=2, spaceAfter=3)
PROMPT = ParagraphStyle("p", parent=BODY, spaceAfter=0)
SMALL = ParagraphStyle("sm", parent=BODY, fontSize=9, leading=12.5, textColor=MUTED)
CAP = ParagraphStyle("cap", parent=SMALL, alignment=1)

def x(t):
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"\*([^*]+)\*", r"<i>\1</i>", t)
    return t.replace("\n", "<br/>")

def box(text, bg, border, label):
    inner = [Paragraph(f'<font name="Helvetica-Bold" color="{border.hexval()}">{x(label)}</font>', SMALL), Paragraph(x(text), PROMPT)]
    t = Table([[inner]], colWidths=[CW])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.8, border),
                           ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                           ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    return KeepTogether([t, Spacer(1, 7)])

def arrow(d, x1, y1, x2, y2, color=MUTED, w=1.4):
    d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=w))
    a = math.atan2(y2 - y1, x2 - x1); s = 6
    d.add(Polygon([x2, y2, x2 - s * math.cos(a - 0.4), y2 - s * math.sin(a - 0.4), x2 - s * math.cos(a + 0.4), y2 - s * math.sin(a + 0.4)], fillColor=color, strokeColor=color))

def node(d, x0, y, w, h, num, title, sub, fill, stroke, star=False):
    d.add(Rect(x0, y, w, h, rx=7, ry=7, fillColor=fill, strokeColor=stroke, strokeWidth=1.2))
    d.add(Circle(x0 + 13, y + h - 13, 9, fillColor=stroke, strokeColor=stroke))
    d.add(String(x0 + 13, y + h - 16.5, str(num), fontName="Helvetica-Bold", fontSize=10, fillColor=colors.white, textAnchor="middle"))
    d.add(String(x0 + w / 2 + 6, y + h - 17, title, fontName="Helvetica-Bold", fontSize=10, fillColor=INK, textAnchor="middle"))
    for i, line in enumerate(sub):
        d.add(String(x0 + w / 2, y + h - 32 - i * 11, line, fontName="Helvetica", fontSize=8, fillColor=MUTED, textAnchor="middle"))
    if star:
        d.add(Rect(x0 + w - 50, y - 9, 50, 15, rx=7, ry=7, fillColor=AMBER, strokeColor=AMBER))
        d.add(String(x0 + w - 25, y - 4.5, "you approve", fontName="Helvetica-Bold", fontSize=7, fillColor=colors.white, textAnchor="middle"))

def fig_journey():
    dw, dh = CW, 204; d = Drawing(dw, dh); w, h = 112, 62; gap = (CW - 4 * w) / 3
    top = [(1, "PRD", ["what & who", "you describe"], False), (2, "Phases", ["MVP = Phase 0", "vertical slices"], False),
           (3, "Tech (ADR)", ["/analyze", "stack & hosting"], True), (4, "Prototype", ["/prototype", "every screen"], False)]
    bot = [(5, "Review", ["adjust & approve", "the prototype"], True), (6, "Plan", ["/todos", "one wave at a time"], True),
           (7, "Build & ship", ["/implement /redteam", "/deploy"], True)]
    ty = dh - h - 8
    for i, (n, t, s, st) in enumerate(top):
        x0 = i * (w + gap); node(d, x0, ty, w, h, n, t, s, BLUE_L, BLUE, st)
        if i < 3: arrow(d, x0 + w + 2, ty + h / 2, x0 + w + gap - 2, ty + h / 2)
    by = 44; xs = [3 * (w + gap), 2 * (w + gap), 1 * (w + gap)]
    arrow(d, xs[0] + w / 2, ty - 12, xs[0] + w / 2, by + h + 3)
    for i, (n, t, s, st) in enumerate(bot):
        last = n == 7; node(d, xs[i], by, w, h, n, t, s, GREEN_L if last else BLUE_L, GREEN if last else BLUE, st)
        if i < 2: arrow(d, xs[i] - 2, by + h / 2, xs[i + 1] + w + 2, by + h / 2)
    lx7, lx6, ly = xs[2] + 30, xs[1] + 30, by - 26
    d.add(Line(lx7, by, lx7, ly, strokeColor=GREEN, strokeWidth=1.2)); d.add(Line(lx7, ly, lx6, ly, strokeColor=GREEN, strokeWidth=1.2))
    arrow(d, lx6, ly, lx6, by - 1, GREEN, 1.2)
    d.add(String((lx6 + lx7) / 2, ly - 12, "repeat 6 and 7 for each wave and phase", fontName="Helvetica-Oblique", fontSize=8, fillColor=GREEN, textAnchor="middle"))
    return d

def fig_slices():
    dw, dh = CW, 150; d = Drawing(dw, dh); lw = 110; lh, top = 38, dh - 30
    for i, (name, fill) in enumerate([("Screens (Next.js)", BLUE_L), ("Logic (Python)", GREY_L), ("Data (Postgres)", GREEN_L)]):
        y = top - (i + 1) * lh
        d.add(Rect(lw, y, dw - lw, lh - 4, fillColor=fill, strokeColor=LINE))
        d.add(String(0, y + lh / 2 - 5, name, fontName="Helvetica-Bold", fontSize=9, fillColor=INK))
    sw = 46; x0 = lw + 30; step = (dw - lw - 60) / 3
    for i, (name, c) in enumerate([("Phase 0  (MVP)", BLUE), ("Phase 1", GREEN), ("Phase 2", AMBER)]):
        xx = x0 + i * step
        d.add(Rect(xx, top - 3 * lh, sw, 3 * lh - 4, fillColor=c, strokeColor=c, fillOpacity=0.35, strokeWidth=1.5))
        d.add(String(xx + sw / 2, top + 6, name, fontName="Helvetica-Bold", fontSize=9, fillColor=c, textAnchor="middle"))
    return d

def fig_loop():
    dw, dh = CW, 120; d = Drawing(dw, dh)
    steps = [("Build", "/implement", BLUE), ("Review", "/redteam", BLUE), ("Preview", "you try it", AMBER),
             ("Merged", "not live yet", BLUE), ("Live", "your yes + /deploy", GREEN)]
    n = len(steps); gap = 16; w = (dw - gap * (n - 1)) / n; h = 40; y = dh - h - 10
    for k, (t, sub, c) in enumerate(steps):
        x0 = k * (w + gap)
        d.add(Rect(x0, y, w, h, rx=8, ry=8, fillColor=colors.white, strokeColor=c, strokeWidth=1.4))
        d.add(String(x0 + w / 2, y + h - 16, t, fontName="Helvetica-Bold", fontSize=9.5, fillColor=INK, textAnchor="middle"))
        d.add(String(x0 + w / 2, y + 9, sub, fontName="Helvetica", fontSize=7.5, fillColor=MUTED, textAnchor="middle"))
        if k < n - 1: arrow(d, x0 + w + 2, y + h / 2, x0 + w + gap - 2, y + h / 2)
    xl = (n - 1) * (w + gap) + w / 2; xb = w / 2; ly = y - 28
    d.add(Line(xl, y - 1, xl, ly, strokeColor=GREEN, strokeWidth=1.3)); d.add(Line(xl, ly, xb, ly, strokeColor=GREEN, strokeWidth=1.3))
    arrow(d, xb, ly, xb, y - 1, GREEN, 1.3)
    d.add(String(dw / 2, ly - 13, "next wave: plan it with /todos, then round the loop again", fontName="Helvetica-Oblique", fontSize=8.5, fillColor=GREEN, textAnchor="middle"))
    return d

def fig_screens():
    dw, dh = CW, 158; d = Drawing(dw, dh)
    def frame(x0, y, w, h, label):
        d.add(Rect(x0, y, w, h, rx=6, ry=6, fillColor=colors.white, strokeColor=INK, strokeWidth=1.3))
        d.add(String(x0 + w / 2, y - 13, label, fontName="Helvetica-Bold", fontSize=9, fillColor=INK, textAnchor="middle"))
    def blk(x0, y, w, h, c): d.add(Rect(x0, y, w, h, rx=2, ry=2, fillColor=c, strokeColor=c))
    base = 22; px, pw, ph = 10, 62, 128
    frame(px, base, pw, ph, "Phone"); blk(px + 5, base + ph - 14, pw - 10, 8, BLUE); blk(px + pw - 14, base + ph - 13, 7, 6, colors.white)
    for i in range(3): blk(px + 5, base + ph - 36 - i * 26, pw - 10, 20, BLUE_L)
    blk(px + 5, base + 6, pw - 10, 12, GREEN)
    tx, tw, th = 120, 150, 118
    frame(tx, base, tw, th, "Tablet"); blk(tx + 6, base + th - 15, tw - 12, 9, BLUE)
    for i in range(2):
        for j in range(2): blk(tx + 6 + j * (tw - 12) / 2 + (2 if j else 0), base + th - 52 - i * 34, (tw - 12) / 2 - 2, 28, BLUE_L)
    blk(tx + 6, base + 8, tw - 12, 12, GREEN)
    dx, dwid, dht = 305, CW - 315, 112
    frame(dx, base, dwid, dht, "Desktop"); blk(dx + 6, base + dht - 15, dwid - 12, 9, BLUE); blk(dx + 6, base + 8, 34, dht - 28, GREY_L)
    cw = (dwid - 58) / 3
    for j in range(3): blk(dx + 46 + j * (cw + 3), base + dht - 56, cw, 36, BLUE_L)
    blk(dx + 46, base + 8, dwid - 52, 30, BLUE_L)
    return d

FIGS = {"journey": fig_journey, "slices": fig_slices, "loop": fig_loop, "screens": fig_screens}

def to_pdf(path):
    s = []
    for item in C:
        k = item[0]
        if k == "title": s += [Spacer(1, 26), Paragraph(x(item[1]), TITLE), Spacer(1, 6)]
        elif k == "sub": s.append(Paragraph(x(item[1]), SUB))
        elif k == "h1": s.append(Paragraph(x(item[1]), H1))
        elif k == "h2": s.append(Paragraph(x(item[1]), H2))
        elif k == "p": s.append(Paragraph(x(item[1]), BODY))
        elif k == "bullets": s += [Paragraph(x(b), BUL, bulletText="•") for b in item[1]]
        elif k == "numbered": s += [Paragraph(x(b), BUL, bulletText=f"{i}.") for i, b in enumerate(item[1], 1)]
        elif k == "prompt": s.append(box(item[1], BLUE_L, BLUE, item[2]))
        elif k == "decide": s.append(box(item[1], AMBER_L, AMBER, "You decide"))
        elif k == "tip": s.append(box(item[1], GREEN_L, GREEN, item[2]))
        elif k == "table":
            rows, widths = item[1], item[2]
            w0 = widths[0] * mm; colw = [w0, CW - w0]
            data = [[Paragraph(f"<b>{x(c)}</b>" if i == 0 else x(c), BODY if i == 0 else SMALL) for c in r] for i, r in enumerate(rows)]
            t = Table(data, colWidths=colw, repeatRows=1)
            t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), GREY_L), ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 6),
                                   ("RIGHTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 4),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
            s += [t, Spacer(1, 10)]
        elif k == "fig": s.append(KeepTogether([Spacer(1, 4), FIGS[item[1]](), Spacer(1, 4), Paragraph(x(item[2]), CAP), Spacer(1, 10)]))
        elif k == "page": s.append(PageBreak())
    def footer(c, doc):
        c.saveState(); c.setFont("Helvetica", 8); c.setFillColor(MUTED)
        c.drawString(18 * mm, 10 * mm, "Build your first app with Claude Code — code-starter-template")
        c.drawRightString(W - 18 * mm, 10 * mm, str(doc.page)); c.restoreState()
    SimpleDocTemplate(path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                      title="Build your first app with Claude Code", author="code-starter-template").build(s, onFirstPage=footer, onLaterPages=footer)

if __name__ == "__main__":
    with open(os.path.join(OUT, "tutorial.md"), "w", encoding="utf-8") as f:
        f.write(to_md())
    to_pdf(os.path.join(OUT, "tutorial.pdf"))
    print("wrote docs/tutorial.md and docs/tutorial.pdf")
