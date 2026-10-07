## What this phase does

Capture durable, reusable knowledge from the current session into the harness itself — not
into the product. If a rule was wrong, a skill was missing a pattern, or an agent needs a
correction, this is where that gets written down so the next session doesn't rediscover it.
The harness assumes a single operator — no multi-operator lease, coordination log, or
cross-repo proposal routing is included (see `.harness/README.md` § Not included).

## Workflow

### 1. Identify what's worth codifying

Start from `/learn`'s open list (`.harness/phases/learn.md`): the journal entries not yet
folded into the harness. Then look back over this session (or the sessions since the last
`/codify`) for:

- A correction the user gave, especially if they'd have to give it again next session.
- A bug or dead reference in a rule/skill/agent file that this session actually hit.
- A working pattern this session used that would save a future session the same discovery.

Not everything is worth codifying — a one-off mistake isn't a rule. If nothing from this
session clears that bar, say so and stop. Producing no change is a normal, correct outcome.

### 2. Update the real files

Edit the actual file in its real location. Shared policy lives in `.harness/`, so look
there first:

- `.harness/phases/<phase>.md` — a phase procedure (both runtimes read it).
- `.harness/rules/<rule>.md` — a shared rule. `.claude/rules/<same name>.md` is a short
  pointer to it (a few lines, plus `paths:` frontmatter on some): edit the `.harness/rules/`
  file, never the pointer.
- `.harness/roles/<role>.md` — a role brief that agents load.
- `.harness/guides/` — the delivery contract and the project profile.
- `.harness/manifest.json` — phase and role names and descriptions; after changing it run
  `node .harness/bin/check-adapters.mjs --write` and never hand-edit the generated adapters.
- `.claude/rules/` (Claude-loaded rules with no `.harness/` twin), `.claude/skills/*/`,
  `.claude/agents/*/`, and the Claude-only commands in `.claude/commands/`.

Follow the shape of the existing sibling files in that directory (a rule
file's MUST/Why/DO-DO NOT structure, an agent's thin pointer-to-role-file body, a skill's
SKILL.md + supporting files). If nothing existing covers the topic, create a new file in the
same shape rather than bolting the knowledge onto an unrelated file.

Do not invent a new enforcement mechanism (a hook, a trust-level system, a probe suite) to back
the new rule unless the user asked for one — none is configured by default, and an
unenforced rule that says otherwise is worse than an honest one.

### 3. Review the change

Dispatch the agent that matches what changed (see the mapping in `.harness/adapters/claude.md`):

- A rule wording/content change → `gold-standards-validator` for a small fix, `reviewer` for
  anything substantive.
- An agent file change → `reviewer`.
- Anything touching how an agent handles untrusted input, secrets, or file-system access →
  also `security-reviewer`.

For a small, obviously-correct fix (a typo, a dead link), reviewing it yourself is enough —
don't dispatch a subagent for something you can verify by reading the diff.

### 4. Journal the decision

Create a journal entry — `/journal new DECISION <slug>` (or `DISCOVERY` if it's a finding
rather than a change) — recording which file changed and why. See `.claude/rules/journal.md`
for the entry format. Skip only when nothing from this session was journal-worthy.

### 5. Commit

Commit the changed harness file(s) together with the journal entry in one commit, on a
`docs/codify-<slug>` branch merged by pull request (review rounds, if any, use scope
`codify-<slug>`; `.harness/guides/task-delivery.md` § Branches, pull requests and merging), with a message that says why (per
`.claude/rules/git.md`). If you changed `.harness/`, run `node .harness/bin/check-adapters.mjs`
and `node --test ".harness/tests/*.mjs"` first; both must exit 0.
