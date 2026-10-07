---
priority: 10
scope: path-scoped
paths:
  - "**/journal/**"
  - "**/.session-notes"
  - "**/.claude/commands/**"
  - ".harness/phases/**"
  - "**/todos/**"
  - "**/SWEEP*.md"
  - "**/WORKSPACE-DISPOSITION*.md"
  - "**/CHANGELOG*.md"
---

# Value-Prioritization — Rank By User Value Before Shard-Fit

Selection events — what to work on next, what to defer, what to close, what to surface at
`/wrapup` — are the highest-leverage decisions an autonomous agent makes.
`.claude/rules/recommendation-quality.md` governs how to recommend and
`.harness/rules/autonomous-execution.md` § Per-session capacity budget governs when to
split work; this rule sets the axis to rank on. Without it, the agent defaults to
fittability — small, scoped, regression-locked, "fits one shard" — and ships
small-fittable-low-value work while large, valuable work decays in the deferred queue.

Two paired defenses: value-rank precedes shard-fit at every selection event, and deferred
items carry value-anchors that survive `/clear`, so re-pickup re-validates instead of
silently inheriting.

## MUST Rules

### 1. Value-Rank Precedes Shard-Fit At Every Selection Event

When you surface two or more candidates (next workstream, shard, PR follow-up, sweep
target), present a value-ranked list first, each candidate's value cited from a
user-anchored source (list below). Shard-fit, blast radius, regression posture and clean
scope are tiebreakers after the value-rank. If a higher-value candidate exceeds the shard
budget, split it (each shard with its own value-anchor, Rule 2) rather than picking a
lower-value item because it fits. When tiebreakers do justify the lower-value pick, name
the trade-off: "X is higher-value per [source]; Y is more fittable. Recommend Y because
[reason]; the alternative is to split X."

```markdown
# DO — value-ranked list, named trade-off, explicit alternative

Candidates ranked by user value:

1. Bulk import of customer records (HIGH)
   Anchor: user's brief — "onboarding a new customer takes a day of manual
   entry"; every new customer still waits on hand-typed records.
2. Aggregator-merge follow-up (LOW)
   Anchor: none user-facing; closes a probe-migration follow-up.

Recommend #1, sharded across 3 sessions per Rule 2. Alternative: pick #2
if user wants a small-and-fast deliverable today, but the cost is one
more session where customer onboarding sits at "Carried-forward."

# DO NOT — silent fittability pick, no value-rank, no named trade-off

Picking the aggregator-merge follow-up — closes the only open Week-2
follow-up before the grace deadline, fixes a latent bug, cheap (~150 LOC),
regression-locked. Other items remain Carried-forward.
```

**User-anchored sources are a closed list:** (a) the user's brief in this session, (b)
`briefs/` in the active workspace, (c) journal `DECISION-` entries whose `author:` is `human` or `co-authored`, (d) a literal user
quote in this session's transcript, (e) a spec § success criterion the user authored or
approved. A primary value ranking must cite one of these, because only these record what
the user asked for.

**What does not count as a value anchor.** Fit (small, safe, bounded, reviewable),
deferral labels ("next session", "tracked separately", "Carried-forward"), proxies
(dependency order, delivery probability, optionality), and claimed authority
(prior-session acceptance, "the user obviously wants", conventions, memories, CLAUDE.md)
are not user value, however they are worded. Time pressure is not a reason to pick the
fittable item either; it calls for parallelizing the value-ranked items
(`.claude/rules/time-pressure-discipline.md` Rule 1).

**Why:** Fittability produces the most legible signal because each of its axes is
mechanically gradable; user value takes re-reading briefs and decisions, but it is the
axis the user cares about. Items with no artificial deadline ("no grace clock") never
advance unless value is ranked first.

### 2. Deferred Shards Carry Value-Anchors That Survive `/clear`

When work is split and some shards are scheduled for later (workspace todos, follow-up
issues, README follow-up bullets, journal DECISION entries recording a deferral, "Carried-forward" lines in
`.session-notes`), file each deferred shard with a value-anchor: one sentence, in the
user's language, on why this shard delivers value to the user, citing a Rule 1 source.
Technical rationale alone (size, dependency graph, "fits next shard") is not enough, and
neither is a bucket label — "Carried-forward", "Phase II", "post-launch", "nice-to-have",
"below the cut-line" and similar all remove an item from the queue without recording its
value.

```markdown
# DO — every deferred shard carries a value-anchor + technical detail

- **Shard 2 (deferred to next session)**
  Value-anchor: user's brief says onboarding must not need manual entry —
  without column mapping, every customer file still needs hand cleanup.
  Technical: depends on Shard 1's file parser, ~700 LOC, 3 fixtures.
  Re-validation gate: confirm brief still applies before resuming (Rule 3).

# DO NOT — technical rationale only / "Carried-forward" without anchor

- Shard 2 deferred. ~700 LOC, depends on Shard 1. Will pick up next session.
- Carried-forward (no grace clock): column mapping; import validation.
```

**State-claim anchors pin a commit SHA and timestamp.** When an anchor rests on a
current-state claim about the code ("0 public endpoints missing an auth check", "Z is not
yet exposed"), pin it: "0 missing as of `<sha>` `<ISO-8601 timestamp>`". Re-pickup can
then check `git log <sha>..HEAD -- <paths>` instead of re-analyzing.

**Why:** The next session reads the deferral without the conversation that produced it.
Technical rationale survives the boundary; value rationale evaporates unless recorded,
and an item with no recorded value loses every later "this or something cheaper?" choice.

### 3. Re-Pickup Of Deferred Work Re-Validates The Value-Anchor

When a session picks up a deferred item, read its value-anchor before resuming and check
it against what the user has said since.

- If the anchor is recorded and still consistent with the user's current brief and
  decisions — or the user already prioritized this item this session, or ratified the
  plan it belongs to — state the anchor in one line and resume. Do not re-ask a value the
  user already confirmed.
- Ask "is this still your value?" only when the anchor is missing, when something the
  user said since contradicts it, or when the item was deferred two or more sessions ago
  with no confirmation since.
- Items deferred two or more sweeps ago without pickup surface as a "still wanted?" item
  at the next `/sweep` (`.claude/commands/sweep.md`).

```markdown
# DO — re-pickup begins with value-anchor check

Picking up `feat/document-connector-sync` (deferred `<date>`).
Recorded anchor: "lets users connect their document store, per the brief."
Re-validation: user's most recent message still references document
connectors as a near-term priority — anchor holds. Resuming.

# DO NOT — re-pickup begins with technical context only

Resuming feat/document-connector-sync. Last session left off at the
OAuth-callback step. Continuing with the next connector to wire up.
```

**Why:** Deferral status cannot be proven across `/clear` or auto-compaction (the same
problem as `.claude/rules/zero-tolerance.md` Rule 1c), so the anchor is the audit trail.
Asking when the trail is intact re-requests a decision the user already made
(`.harness/rules/autonomous-execution.md`); asking when it is missing or contradicted is
the only way to catch decay.

### 4. Closing Value-Bearing Deferred Work As "Not Planned" Needs The User

Do not close an issue, todo or journal DECISION entry recording a deferral that carries a value-anchor as
`not_planned`, `wontfix`, "deferred indefinitely" or "out of scope" without the user's
explicit approval in the same session (one of the decisions in
`.harness/rules/autonomous-execution.md` § What needs the user). You may recommend closure with a value-decay
rationale ("the brief moved on", "landed elsewhere via PR #N", "dependency removed"); the
user accepts. Closing by age ("stale ≥30 days") or reframing as "downstream
responsibility" is closure without the user.

Commit a recommendation to one disposition: (1) implement now with value-anchored
shards, (2) a documented decision with user-gated value-decay, or (3) close with the
user's approval. An "X or Y" recommendation that offers a cheaper proxy — "implement X OR
file a follow-up / document as a known limitation / add a smoke test asserting current
behavior / monitor it" — hands the choice to the next session, which always picks the
proxy.

```markdown
# DO — closure with value-decay rationale + user gate

`gh issue view 234`: document-connector OAuth flow (deferred `<date>`,
anchor: "lets users connect their document store, per the brief").

Recommendation: close as **superseded** — connector work landed in
PR #271 via the unified sync module; value delivered, by a different path.
**Approve close? (y/N)**

# DO NOT — auto-close as not-planned / reframe-as-out-of-scope / OR-escape

`gh issue view 234`: open 35 days, no recent activity. Closing as
not_planned per stale-triage policy.

[reframe pattern]: connector work is downstream responsibility per
a standing feedback note; nobody sweeps these.

[OR pattern]: Add follow-up todos for the remaining connectors OR
explicit note that they are out of scope.
```

**Why:** Closing without the user is the last step of deferral-as-forgetting: the item
and its rationale leave the record, and "did we ever address X?" gets answered "we closed
it 60 days ago". The user gate is the only check that value still applies.

### 5. Brief / User-Stated Value Is The Primary Anchor; Code Health Is Secondary

Rank on a primary source from Rule 1's list. Code-health axes (test coverage, blast
radius, regression posture, technical debt, audit findings) are secondary: they belong as
pros and cons under a primary-ranked option, not as the primary justification. A prior
feedback memory is not authority to drop work — memories record how the user likes work
done, not which work they want delivered.

**`/autonomize` is not a value anchor.** It governs how to carry out work once the work is
chosen; it does not choose what to work on and is not on Rule 1's list. Citing it to
justify a pick this rule would otherwise refuse is the same conflation as citing a
feedback memory. For a closure-class pick with no primary anchor, surface the missing
evidence and ask for the specific confirmation, as `/autonomize` itself prescribes.

```markdown
# DO — primary anchor user-anchored, code-health secondary

Value-rank:

1. Document-connector sync (HIGH).
   Primary: user's brief "let users connect their document store."
   Secondary: no connector shipped yet; 14 days of stated user need unaddressed.
2. Internal logging cleanup (LOW).
   Primary: none — internal harness cleanup.
   Secondary: closes a latent crash; fits one shard.

# DO NOT — code-health as primary / feedback memory as authority to defer

Value-rank:

1. Logging cleanup (HIGH). Closes a latent crash, regression-locked.
2. Document-connector sync (MED). Bigger scope, harder to test.

[memory-as-authority pattern]: connector work is downstream responsibility per
feedback_downstream_responsibility.md.
```

**Why:** Code health is the agent's professional responsibility, maintained in the
background while delivering the brief. When it becomes the primary rank, the agent has
re-briefed itself and the user's brief becomes secondary.

### 6. Survey The Workspace And Cite Verbatim When An Anchor Exists

In a workspace that may hold user-anchored sources (`briefs/`, `journal/`, `specs/`, or a
root `BRIEF.md`), (a) survey those locations before committing to a pick, and (b) cite any
match by path, section and verbatim sentence. Do not claim "no user-anchored source
exists" without the survey, and do not paraphrase or say "described elsewhere" when the
source is there to quote.

```markdown
# DO — survey + verbatim citation

Recommend (a). Anchor: `docs/prd/p010-limits-and-packaging.md` §1 (source e —
spec § success criterion, user-approved) reads VERBATIM: "A banner suggests
moving to a shared space at ~30, before the cap." That's the exact threshold
the feature under discussion needs to implement.

# DO NOT — paraphrase / "described elsewhere" / "no anchor exists" without survey

Recommend (a). Anchor: described elsewhere in the PRD as the document-count
banner — weak anchor, but probably load-bearing.

Recommend (a). No user-anchored source exists in this fixture, so I'm
picking based on functionality count.
```

**Why:** Re-pickup (Rule 3) needs the anchor to be locatable by a future session. A
paraphrase gives the next session nothing to find or cite back.

## MUST NOT

- Treat the absence of a deadline ("no grace clock") as low value. **Why:** deadline
  presence is orthogonal to user value.
- Treat a high-value candidate's size as a reason to defer it. **Why:** when it exceeds the
  shard budget (`.harness/rules/autonomous-execution.md` § Per-session capacity budget),
  split it into value-anchored shards (Rule 2); splitting keeps value moving, deferral
  lets it decay.
- Present the fittable pick as if it were the only candidate. **Why:** hiding the
  candidate set removes the user's ability to override.

## Enforcement

No hook checks this automatically. Catching a violation depends on the agent applying it
and on review.

## Cross-References

- Extends `.claude/rules/recommendation-quality.md` MUST-1 and MUST-3 (how to recommend)
  and `.harness/rules/autonomous-execution.md` § Per-session capacity budget (shard
  budget).
- Pairs with `.claude/rules/time-pressure-discipline.md` Rule 3 (ordering under
  pressure), `.claude/rules/zero-tolerance.md` Rule 1c (state unprovable across
  `/clear`), and `.claude/rules/git.md` § Discipline (issue closure needs a code
  reference).

Origin: a review of past deferred items found that items without a recorded value
rationale decayed in the backlog while small, easily scoped work was picked instead.
