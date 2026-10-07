---
priority: 10
scope: path-scoped
paths:
  - ".harness/phases/implement.md"
  - ".harness/phases/redteam.md"
  - ".harness/phases/fix.md"
  - ".harness/phases/debug.md"
  - ".harness/phases/codify.md"
  - ".claude/commands/worktree.md"
  - "**/*worktree*"
---

# Worktree Isolation Rules

Parallel agents run in their own git worktree so compile/test jobs do not fight over the same dependency directory (`node_modules/`, `.venv/`, `target/`) or build output. The orchestrator creates the worktree as a sibling outside the repo (Rule 7 placement) and hands it to the agent by absolute path; the harness flag `isolation: "worktree"` is retired (Rule 1) because it places the worktree under the repo's own `.claude/`. The isolation is only real if the agent actually edits files inside its assigned worktree path.

## MUST Rules

### 1. Pre-Made Sibling Worktree, Plus A Required First-Step Location Check

This rule has two parts, and both are required: part (b) replaces the working-directory guarantee the retired flag used to provide.

**(a) Placement + naming.** The orchestrator creates the agent's worktree itself as a sibling outside the repo (Rule 7 placement; `/worktree` or a hand-rolled `git worktree add`), then dispatches without any harness isolation flag, naming that absolute path in the prompt. Do not pass `isolation: "worktree"` or use `EnterWorktree({name})`: both place the worktree at `<repo>/.claude/worktrees/agent-<id>`, nested under the repo's own `.claude/`.

**(b) First-step assertion.** The dispatch prompt must require the agent's first action to be `cd <worktree>` followed by the assertion below, and must tell the agent to stop if the assertion fails — a check that only reports does not prevent writes to the main checkout. A dispatch that names the path without requiring the assertion is not isolated. The assertion compares resolved paths (`pwd -P`, not the passed string) and rejects the main checkout:

```bash
cd "$WT" || { echo "STOP: cannot enter $WT"; exit 1; }
top=$(git rev-parse --show-toplevel) || { echo "STOP: not a git repo"; exit 1; }
[ "$top" = "$(pwd -P)" ]  || { echo "STOP: not a worktree ROOT (top=$top)"; exit 1; }
main=$(cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")" && pwd -P)
[ "$top" != "$main" ]     || { echo "STOP: this IS the main checkout"; exit 1; }
```

Two forms do not work as the assertion: `git -C <worktree> …` (never establishes cwd — it leaves the agent in the main checkout) and a bare first `git rev-parse --show-toplevel` (resolves to the main checkout on every dispatch, so it always refuses). Only `cd` first, then assert, is both runnable and meaningful. Pairs with Rule 2a: step 0 sets the floor; each later location-dependent invocation re-asserts.

```python
# DO — pre-made SIBLING, no isolation flag, STEP-0 assertion MANDATED in the prompt
wt = "/Users/me/repos/.myrepo-wt/shard-abc"      # sibling of the repo, NEVER under it
Agent(prompt=f"""Working directory: {wt}
First, run the check above exactly as written and compare the resolved paths; if they
do not match, stop and report — do not fall back to the main checkout.
Write only inside {wt}; never write to an absolute path rooted anywhere else.
""")

# DO NOT — the retired flag (lands at <repo>/.claude/worktrees/agent-<id>); a sibling path
# named with NO assertion mandated; or `git -C` / a bare first rev-parse AS the assertion
Agent(isolation="worktree", prompt="Implement feature X — use backend-specialist patterns.")
Agent(prompt=f"Working directory: {wt}\nImplement feature X.")
Agent(prompt=f'STEP 0: git -C "{wt}" rev-parse --show-toplevel')
```

Naming the directory in the prompt is not enough, an un-asserted `cd` is an assumption, and comparing the toplevel to the string you passed refuses spuriously on any symlinked prefix.

**Why:** The retired flag is what set the agent's working directory, and prompt text is not a guarantee, so part (b) replaces that guarantee rather than supplementing it — without it the rule trades a bounded quota cost for unbounded silent work loss to the main checkout. Any future edit to an assertion here must state which inputs make it fail and which make it pass, because both a form that could never fail and one that could never pass on a symlinked path have occurred.

### 2. Specialist Agents Self-Verify Cwd At Start

Every specialist agent file (`.claude/agents/**/*.md`) that may be dispatched into a worktree includes a "Working Directory Self-Check" step at the top of its process section. The check prints the resolved cwd and the git branch, and refuses to proceed if either is unexpected.

```markdown
# DO — self-check baked into the agent file

## Step 0: Working Directory Self-Check

Before any file edit — AFTER Rule 1(b)'s STEP-0 `cd` — run BARE (no `-C`):
top=$(git rev-parse --show-toplevel)
[ "$top" = "$(pwd -P)" ] || STOP                 # at a worktree root
main=$(cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")" && pwd -P)
[ "$top" != "$main" ] || STOP # ...and NOT the main checkout
git rev-parse --abbrev-ref HEAD
If either check fails, STOP and emit
"worktree drift detected — refusing to edit main checkout".

# DO NOT — the root check alone; MAIN is itself a worktree root, so it PASSES there

[ "$(git rev-parse --show-toplevel)" = "$(pwd -P)" ] || STOP
```

**Why:** Rule 1(b) puts the assertion in the prompt; this rule puts it in the agent file, so it survives a prompt that omits it. One git call prevents specialist drift.

Bare is correct here and wrong at Rule 1(b) — the difference is position, not the command. Do not "converge" this site onto `cd <wt> && …` (that makes the drift check unable to fail), and do not drop the `cd` subshell inside `main=` (that reintroduces the symlink false refusal). The main-checkout exclusion is what makes this check meaningful — the root test alone passes in the main checkout.

### 2a. Re-Assert Cwd Per Invocation — `cd` Persistence Is Not Trustworthy

The Rule-2 self-check at agent start is necessary but not sufficient: the shell's cwd can silently revert to the main checkout mid-session after tool-mediated file operations, and a relative-path patch then resolves against the wrong checkout and "succeeds". Any worktree command whose correctness depends on which checkout it runs in (apply patch, run tests, grep for the edit) re-asserts location in the same invocation (`git -C <worktree> …`, or `cd <worktree> && pwd && …`) instead of relying on a `cd` from an earlier call.

```bash
# DO — location asserted in the SAME invocation as the operation
cd "$WT" && git rev-parse --show-toplevel && <run-tests/apply-patch>

# DO NOT — trust an earlier cd; relative paths may now resolve against main
<run-tests>     # cwd silently reverted → tests main's old code, prints green
```

**Why:** The false green is worse than a failure — it turns an unapplied patch into recorded "validated" state.

### 3. Parent Verifies Deliverables Exist After Agent Exit

When an agent reports completion of a file-writing task, the parent orchestrator verifies the claimed files exist at the worktree path (`ls` or `Read`) before trusting the claim. An agent's completion message is not evidence that a file was created.

```python
# DO — verify after agent returns
result = Agent(prompt=f"Write {worktree}/src/feature.py...")   # worktree = pre-made sibling
assert_file_exists(f"{worktree}/src/feature.py")  # parent checks

# DO NOT — trust "done" and proceed
```

**Why:** Agents run out of budget mid-message and emit "Now let me write X..." without having written X. An `ls` check is cheap and turns a silent no-op into a loud retry.

### 3a. Tool-Output Verification Claims Require Post-Merge Re-Run For Checkout-Bound Tools

When a worktree-isolated agent makes a verification claim citing a tool whose workspace root resolves via `__file__` / `Cargo.toml` / `package.json` (not the invoking cwd or an explicit `--root` flag), the parent re-runs that tool from the main checkout after merge before accepting the claim. In-worktree pre-merge verification with a checkout-bound tool proves nothing — the tool scans whichever checkout owns the script, not the worktree the agent compiled in.

```bash
# DO — re-run the tool from main after merge
git checkout main && git pull --ff-only
<repo-wide-check-command>           # authoritative (e.g. a project-profile § Mechanical checks entry)

# DO NOT — accept the in-worktree agent claim as the verdict (the tool scanned MAIN;
# the worktree-added files were invisible, so the "0 gaps" it reported was vacuous)
```

**Why:** Tools that resolve their workspace root via `Path(__file__).parent.parent` (Python), `cargo locate-project` (Rust), or `package.json` discovery (Node) are bound to whichever checkout owns the script — not the invoker's cwd. The post-merge re-run is the only invocation where the script's resolved root and the verified state coincide.

### 3b. A Lane Is Delivered Only When Its Placeholders Are Gone — Existence Is Not Delivery

Rule 3's check (`ls` / `Read` the claimed file) only works while a missing file means a dead lane. A skeleton-first briefing ends that: the file exists whether the lane delivered or died, which makes the existence check non-discriminating (`.claude/rules/instrument-discipline.md` MUST-1). So verify content: before a lane's output is trusted, aggregated, counted as surface coverage, or its report committed, the unfilled markers — placeholder tokens (`_(pending)_`, `TBD`), a non-terminal `Status:`, an empty verdict / findings / instrument table — must all be absent. A report still carrying them delivered nothing; re-dispatch the lane or do the work inline, and record which. If a still-skeletal report is committed at all, record it as undelivered, so it cannot read as coverage.

```bash
# DO — verify the placeholders are GONE; a hit means UNDELIVERED, not "in progress"
grep -nE '_\(pending\)_|^Status:.*(IN PROGRESS|pending)|\bTBD\b' "$report" \
  && echo "LANE UNDELIVERED: $report — re-dispatch or execute inline; do NOT aggregate"

# DO NOT — the existence check skeleton-first silently defeats
[ -s "$report" ] && echo "lane delivered"   # a 296 B all-placeholder skeleton passes this
```

`Status: IN PROGRESS` on an exited lane is stale by construction, not a sign the lane is still working.

**Why:** Skeleton-first makes a lane's silence visible, but it also guarantees the file exists before any work happens, so it defeats the one check Rule 3 relies on and turns an obvious absence into an artifact that passes review.

### 4. Set A Real Concurrency Cap First; Adaptive Back-Off Is The Fallback For What The Cap Doesn't Catch

Claude Code has supported controls for this: the `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` and `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` environment variables, and the Agent SDK's `max_budget_usd` option. Set one of these as the actual ceiling before relying on a hand-rolled heuristic — it's a deterministic cap the runtime enforces, not a pattern a session has to notice and react to. See "Cap subagent depth, concurrency, and spend" in the Agent SDK docs.

The rest of this rule is the fallback for a failure mode those caps don't cover: server-side throttling that can bite below whatever cap is set. When launching several agents in one orchestration turn — worktree-isolated or plain parallel subagents — govern concurrency by adaptive back-off on top of the configured cap, not by a fixed number and not by the runtime's native ceiling (which has throttled below quota). Cold start (no throttle signal yet this session): start the first wave at about 3 concurrent agents. Back off only on the signal below; don't serialize below that preemptively, and don't run uncapped.

**The falsifiable throttle signal (back off only on this):** two or more agents in the same wave fail within a ~30–48s synchronized window and carry the server string `Server is temporarily limiting requests` with `(not your usage limit)` / `Rate limited`. A single agent dying, an OOM, a timeout, or a quota error saying "usage limit" is not this signal and does not trigger back-off.

```python
# DO — cold-start wave of ~3; keep later waves ≤3 ONLY after the synchronized-throttle signal
wave = launch(min(3, len(shards)))          # cold start ~3, NOT the native ceiling, NOT unlimited
# if ≥2 of `wave` die within ~30-48s carrying "(not your usage limit)" → next waves stay ≤3
# else (wave returns clean) → proceed; the SIGNAL is the gate, not a fixed batch number

# DO NOT — trust the runtime's native min(16, cores-2) ceiling
for shard in shards: launch(shard)          # a synchronized burst throttles below quota
# DO NOT — hardcode "always waves-of-3" when no throttle signal has fired (over-serializes headroom)
```

The native ceiling is not a safe cap, the throttle is not a quota problem (the string says `not your usage limit`), and "always waves of 3" is not the safe rule either — it over-serializes low-contention sessions.

**Why:** The binding constraint is a server-side concurrency throttle that can bite well below the native ceiling — not account quota, not a fixed batch count — so trusting the native ceiling re-creates the synchronized-burst failure, while "always ≤3" wastes parallelism on low-contention sessions. A missed signal costs only throughput at the cold-start cap, never an over-concurrency failure.

### 5. Pre-Flight Merge-Base Check Before Worktree Launch

Before launching a worktree agent, create the worktree's branch from the current `HEAD` of the branch the work will merge back into — not from a stale commit — and verify `git merge-base <new-branch> <target-branch>` equals the current tip of `<target-branch>` at launch time. Do not launch without that check.

```bash
# DO — pin the base SHA at launch, verify merge-base matches HEAD
target_head=$(git rev-parse feat/user-invites)
git worktree add -b "feat/user-invites-emails" "$WT_PARENT/shard-a" "$target_head"   # sibling, outside the repo
merge_base=$(git merge-base "feat/user-invites-emails" feat/user-invites)
[ "$merge_base" = "$target_head" ] || { echo "base drift — ABORT"; exit 1; }

# DO NOT — no explicit base (stale tip) AND nested inside the repo (Rule 1 placement)
git worktree add .claude/worktrees/shard-a  # branches from whatever HEAD happens to be
```

"Git will sort it out at merge" and "the packages don't overlap" are the usual reasons this gets skipped; the first is wrong and the second is a guess.

**Why:** `git worktree add` without an explicit base defaults to whatever HEAD was last set — possibly a pre-merge commit from hours ago. Stale-base worktrees merge cleanly only when packages don't overlap; otherwise the 3-way merge can silently discard one shard's edits.

### 6. Worktree Branch Name Matches The Prompt's Declared Name

When the orchestrator prompt specifies a branch name (e.g. `feat/user-invites-emails`), create the worktree with that exact branch name — not the harness default `worktree-agent-<hash>`: pass `-b <branch>` explicitly to `git worktree add`, and have the agent prompt verify `git rev-parse --abbrev-ref HEAD` matches the declared name before committing.

```python
# DO — explicit branch name on worktree creation
branch = "feat/user-invites-emails"
subprocess.run(["git", "worktree", "add", "-b", branch, worktree, target_head])  # worktree = sibling
Agent(prompt=f"""Branch: {branch}
STEP 0 — cd first, THEN assert root + branch (never -C, never a bare first rev-parse)
cd "{worktree}" || exit 1
[ "$(git rev-parse --show-toplevel)" = "$(pwd -P)" ] || exit 1
[ "$(git rev-parse --abbrev-ref HEAD)" = "{branch}" ] || exit 1""")

# DO NOT — omit -b (or use the retired flag) and inherit a worktree-agent-<hash> default
Agent(isolation="worktree", prompt="Implement the invite-email flow")
```

**Why:** Branch names are the primary `git log --grep` surface for tracing a shard back to its plan — `feat/user-invites-emails` surfaces in history; `worktree-agent-aa7fb6a6` is a meaningless hash. Post-merge audits cannot check "did every planned shard land?" by grep when half the branches use harness defaults.

### 7. Session/Operator Worktrees Live In A Sibling Outside The Repo — Never Nested Under `.claude/worktrees/`

Rules 1–6 govern the transient **agent-wave** worktree (since Rule 1, an orchestrator-made sibling too). A durable **session/operator** worktree — one a human or session roots into across a task — is a different artifact. Create it outside the repo working tree, as a sibling in the main repo's parent dir (`<main-repo-parent>/.<repo-slug>-wt/<name>`), never under the repo's own `.claude/worktrees/` or anywhere below the repo root. The canonical mechanism is **`/worktree`**; a hand-rolled `git worktree add` follows the same placement. Root the session by launching the CLI with the sibling as cwd (robust), or — Claude Code only — `EnterWorktree({path: <sibling>})` on first entry. Do not use `EnterWorktree({name})` for durable session work (it creates under `.claude/worktrees/` — the nesting trap). Every task: branch off `origin/<default>`, PR to main, merge once its gate passes (who confirms which merge: `.harness/rules/autonomous-execution.md` § What needs the user), return.

**Placement matters for any worktree a session roots into, and the reason is context cost, not tidiness.** A nested root duplicates the matching path-scoped rule set (a session rooted at a nested worktree loads the same path-scoped rule twice — once from its own `.claude/rules/`, once inherited from the ancestor repo — while a sibling-rooted session loads each exactly once). `CLAUDE.md` and unconditional rules do not ancestor-load this way; only path-scoped ones do.

**Dispatched subagents get path-scoped rules too.** A path-scoped rule also loads into a dispatched subagent when it reads a matching file, so a subagent working in a nested worktree can receive the same rule twice, just as a session can. For hand-rolled agent-wave worktrees, grounds (b) and (c) below also apply.

```bash
# DO — sibling worktree in the MAIN repo's parent, derived location-independently from the SHARED
# .git via `git-common-dir` (NOT `show-toplevel` → a linked worktree's OWN top, doubly-nested)
main_top=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")   # main repo top
wt_root="$(dirname "$main_top")/.$(basename "$main_top")-wt"                   # e.g. ../.myrepo-wt
git worktree add -b feat/x "$wt_root/x" origin/main     # sibling, OUTSIDE the repo
cd "$wt_root/x" && claude   # launch rooted (or first-entry EnterWorktree({path:...}))
# ...work... → gh pr merge <N> --merge --delete-branch → return, re-cut off origin/main

# DO NOT — nest a session-rooted worktree inside the repo
git worktree add .claude/worktrees/x    ;  EnterWorktree({name: "x"})   # both land under .claude/worktrees/
# → TWO costs: (1) path-scoped rules arrive TWICE (own + ANCESTOR `.claude/rules/`);
#   (2) the nested checkout sits inside the repo's own `.claude/**` glob range.
```

Being gitignored does not make nesting harmless: gitignore does not stop a parent-repo `grep -r` from descending into it. And while every worktree has its own `.git`, path-scoped rule injection still walks ancestors.

**Why:** A session rooted at a nested worktree loads path-scoped rules from both roots — the same rule arrives twice, and an ancestor-only rule that should be absent arrives in full. The placement conclusion holds on three grounds: (a) the double load; (b) clutter — a full nested checkout in the working tree; (c) glob range — a nested worktree sits inside the repo's own `.claude/**`, so parent-repo recursive tooling descends into it and pulls a duplicate corpus in as tool output. `/worktree` encodes the placement.

### 8. Creation Owns Teardown — Reap On Evidence, Never `--force`

Rules 1–7 govern creation; teardown has two triggers, and both apply.

**(a) Per-wave, by the creator.** The orchestrator that created a wave's worktrees reaps them at the wave's terminal-lane transition — once each lane is committed and either merged or preserved on a pushed branch.

**(b) A backstop.** If no SessionEnd hook is configured to reap abandoned worktrees, there is no automated backstop: if the per-wave reap in (a) is skipped, the worktree stays until someone notices. `/sweep` Sweep 5 (workspace and worktree hygiene) is the manual audit that catches this — run it periodically and classify anything it finds per the ZERO-LOSS / TAG-FIRST / KEEP procedure below. A project that wires a SessionEnd hook for this backstop should name it here.

**Removing a worktree does not delete its branch.** `git worktree remove` deletes the directory, never `refs/heads/<branch>`, so every committed commit survives and re-materializes with one `git worktree add <path> <branch>` — which is what ZERO-LOSS rests on. What does not survive: anything never committed (no reflog — `.claude/rules/git.md` § Destructive Working-Tree Ops) and a detached HEAD no ref reaches (the TAG-FIRST case).

```bash
# DO — the branch is the durable artifact; the directory is disposable
git worktree remove "$wt" && git rev-parse --verify "refs/heads/$branch"  # ref still there
git worktree add "$wt" "$branch"                                          # re-materialised
# DO NOT — treat the directory as the work, or hoard trees to "preserve"
# commits a ref already holds
```

**Why:** An operator who believes removal destroys the work will not reap, and the forest grows until the disk is full — where the shell commands needed to diagnose it fail too, and in-flight agent writes truncate mid-file into what read as ordinary syntax errors.

**Reap on mechanical evidence, tiered — never on a guess.** Two independent axes must both clear: durability (do the commits survive removal?) and occupancy (is anyone working there now?). Three verdicts — **ZERO-LOSS** (reap), **TAG FIRST** (tag the detached SHA, then reap), **KEEP** (never reap).

**Never use `--force`**, and never check `git status` and then force — state can change between check and removal, and unstaged plus untracked-not-ignored work has no reflog (`.claude/rules/git.md` § Destructive Working-Tree Ops). A bare `git worktree remove` already refuses a dirty tree; that refusal is the safety mechanism.

There's no automated reap tool in this starter yet — `git worktree list`, then for each tree: check
`git status` (clean?) and `git cherry origin/main <branch>` (any `+` line means unmerged content),
and classify ZERO-LOSS / TAG-FIRST / KEEP by hand before removing.

```bash
# DO — classify on evidence, reap only what a ref preserves
git worktree list
git -C "$wt" status --porcelain          # clean?
git cherry origin/main "$branch"         # any "+" line = unmerged content, KEEP or TAG-FIRST
git worktree remove "$wt"                # only once classified ZERO-LOSS

# DO NOT — force past the refusal, or sweep the forest by path glob
git worktree remove --force "$wt"   ;   rm -rf "$WT_PARENT"/*
```

An unmerged-looking branch is not automatically KEEP (`git cherry origin/<default> <branch>` decides — `-` means the patch is already upstream under another name), and "durable" means not deleted between tasks, never permanent.

**Why:** Retiring the auto-cleaning `isolation: "worktree"` flag moved creation onto the orchestrator and teardown onto nothing — abandoned worktrees can fill a disk fast if nobody reaps them, and the gap is easy to miss because every warning about worktrees is about protecting work from cleanup, never about doing the cleanup.

### 9. The Stash Stack Is `.git`-Scoped And Shared — Never Stash In A Worktree-Carrying Repo

**The stash stack lives in the common `.git` dir, so it is shared by the main checkout and every linked worktree** — unlike the index and `HEAD`, which are per-worktree. In a repo carrying any `git worktree add` checkout — this harness's default execution mode — do not use `git stash` to park or protect work: a sibling's `git stash pop` applies your entry into its tree and drops it, leaving you a merely clean tree and the sibling a change neither of you authored. Both sides fail silently. Capture instead to a place no other checkout can reach — a patch file (`git diff > <path>.patch`; `git add -N .` first for untracked files) or a `cp` backup outside the tree.

```bash
# DO — capture to a patch nobody else can pop
git diff > "$SP/wip.patch"   ;   git apply "$SP/wip.patch"
# DO NOT — park on a stack every sibling worktree can list and pop
git stash -u
```

**Why:** Every other parallel-work hazard in this rule is bounded by the worktree boundary; the stash is the one primitive that reaches across it, which is why it looks safe and is not.

## Enforcement

No hook checks this automatically — no PreToolUse check flags a `git stash` in a repo carrying
linked worktrees, and no SessionEnd process reaps abandoned worktrees. Catching a violation of
any rule above depends on the agent applying it and on review. A project that adds a hook for
any of them should name it here.

## MUST NOT

- Leave a wave's worktrees on disk once the wave has closed, or reap one by `--force` / `rm -rf` instead of a bare `git worktree remove`

**Why:** Accumulation is unbounded and ends at a full volume; `--force` and `rm -rf` defeat the one refusal that protects unstaged and untracked-not-ignored work, which has no reflog.

- Launch an agent with `isolation: "worktree"` or `EnterWorktree({name})` at all — or dispatch into a pre-made worktree without both pinning its absolute path and requiring the step-0 cwd assertion

**Why:** Both flags place the worktree under the repo's own `.claude/` (Rule 7's double-load cost). Retiring them also removes the cwd guarantee they provided, so a dispatch that names the path but does not require the assertion leaves nothing pinning the agent — and its writes can land in the main checkout.

- Use `git -C <worktree> …`, or a bare `git rev-parse --show-toplevel`, as the step-0 assertion

**Why:** `-C` never establishes cwd — it answers a question about the worktree and leaves the agent in the main checkout, so everything after it still resolves there. A bare `rev-parse` as the first action resolves to the main checkout on every dispatch and always refuses; only `cd` first, then assert, is both runnable and meaningful.

- Assert by string-comparing `git rev-parse --show-toplevel` against the path the orchestrator passed

**Why:** `--show-toplevel` returns the symlink-resolved path, so any symlinked prefix (`/tmp` → `/private/tmp` on macOS, symlinked homes, Windows junctions) refuses spuriously on a correct worktree — and an always-refusing check gets deleted. Compare `pwd -P` against `--show-toplevel`, both resolved.

- Park or protect work with `git stash` in a repo carrying any `git worktree add` checkout

**Why:** The stash stack is `.git`-scoped and shared across every linked worktree, so a sibling can list and pop your entry — taking the work silently and leaving your tree merely "clean" (Rule 9).

- Trust an agent's "completion" message when it says "Now let me write…" followed by no tool call

**Why:** Budget exhaustion truncates the write. The completion message is misleading; the filesystem is the source of truth.

- Use `process.cwd()` / `os.getcwd()` or relative paths inside specialist agent files that may run in a worktree

**Why:** `process.cwd()` resolves to whatever the CLI process was launched with (the main checkout), not the worktree; relative paths inherit the same problem.

Origin: specialist agents drifting to the main checkout lost real work, and the retired isolation flag nested worktrees under the repo's own `.claude/`; each rule above closes one of those failure paths.
