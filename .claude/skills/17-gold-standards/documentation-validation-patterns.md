# Documentation Validation Patterns

The mechanical sweeps behind `gold-documentation.md`'s review checklist, and the operational
depth for the reviewer agent's **Code Example Validation Process**.

A documentation defect is not a cosmetic problem. A code fence teaching a method that does not
exist propagates into every reader's first attempt; a citation pointing at a renumbered section
reads as a governed obligation while pointing at nothing. Both fail silently, because prose does
not have a build step.

Every sweep below names what it prints when the claim is FALSE. Fire each at a known-answer case
before trusting an empty result (`rules/instrument-discipline.md` MUST-3).

## 1. Code-Example Validation

### The process

1. **Extract** every fenced code block from the document.
2. **Materialise** the snippet as written into a scratch file — not a cleaned-up version of it.
   If the snippet omits an import the reader would also omit, that omission is part of the test.
3. **Execute** it with the project's real tooling (`.harness/guides/project-profile.md`
   § Commands): the "Type / static check" command for a compile-only check, the unit-test
   command when the snippet asserts behaviour.
4. **Fix** the document — outdated API, wrong parameter, missing setup step, renamed symbol.
   Fix the doc, not the test.

### Extraction

````bash
# Extract fences of one language from one document (set the fence tags for the project's language)
doc=.claude/skills/17-gold-standards/SKILL.md
lang='ts|typescript'          # e.g. 'py|python', 'go', 'kotlin|kt'
awk -v re='^```('"${lang}"')$' '$0 ~ re {f=1;next} /^```$/{f=0} f' "$doc"
````

Control: run it against a file you know has fences in that language and confirm the output is
non-empty. `17-gold-standards/SKILL.md` carries both TypeScript and Python fences — if a matcher
returns nothing there, the matcher is broken, not the corpus.

### Compile check

Write the extracted block to the scratch directory with the imports the document implies, then:

```bash
# Illustrative compile-only checks — use the project's configured checker and strictness
npx tsc --noEmit --strict <scratch-file>.ts        # TypeScript
mypy --strict <scratch-file>.py                    # Python
go vet ./scratch/...                               # Go
```

Falsifying result: reported type errors and a non-zero exit — for example TypeScript
`TS2305: Module … has no exported member 'X'`, mypy `Module "…" has no attribute "X"`, Go
`undefined: X`. Confirm the checker fires on a deliberately broken snippet before trusting a
clean run.

### The `DO NOT` fence exemption

Blocks demonstrating a **wrong** pattern are supposed to fail. Mark them so a sweep can skip
them, and keep the marker inside the fence where an extractor can see it:

```ts
// DO NOT — resolves in the editor, fails at runtime under NodeNext
import { openTenantSession } from "../db/session";
```

A sweep skips any block whose first line matches `DO NOT`. A block that is _neither_ marked
`DO NOT` nor compilable is the finding.

### What this catches

- A method or export that exists on no surface (the highest-severity class — the reader copies
  it and it fails at runtime)
- A renamed symbol the docs never followed
- A constructor or call signature that drifted
- An import path that changed shape (the language conventions recorded in the project profile
  catch a lot of these)

## 2. Cross-Reference Integrity

Several reference shapes exist in a typical corpus, and each needs its own check.

### (a) Backticked file-path citations

```bash
# Every path under the project's source/test/doc roots cited in a doc, checked for existence
# (set roots from the project profile § Identity)
roots='src|tests|workspaces|docs'
grep -ohE "\`(${roots})/[A-Za-z0-9._/-]+\`" "$doc" | tr -d '`' | sort -u \
  | while read -r p; do [ -e "$p" ] && echo "OK   $p" || echo "MISS $p"; done
```

Falsifying result: a `MISS` line. Run it against a doc that cites both a real path and a made-up
one (e.g. `` `workspaces/<a-real-project>/briefs/<a-real-file>.md` `` alongside `` `docs/does-not-exist.md` ``) and confirm it
prints exactly one `OK` and one `MISS` before trusting a clean result elsewhere.

For `.claude/`-relative references (`` `rules/…` ``, `` `skills/…` ``, `` `guides/…` ``), check
both the bare path and the `.claude/`-prefixed form:

```bash
grep -ohE '`(rules|skills|guides|agents|commands|hooks)/[A-Za-z0-9._/-]+`' "$doc" | tr -d '`' | sort -u \
  | while read -r p; do
      [ -e "$p" ] || [ -e ".claude/$p" ] && echo "OK   $p" || echo "MISS $p"
    done
```

This sweep is the one that catches deletions. When a rule, skill, or agent is removed, every
reference to it survives silently — the reader follows the link and finds nothing, and an agent
told to load it stalls.

### (b) Relative markdown links

```bash
dir=workspaces/<project>/docs/prd     # any directory with an index README
grep -ohE '\]\([a-z0-9._/-]+\.md[^)]*\)' "$dir/README.md" \
  | sed -E 's/^\]\(//; s/\)$//; s/#.*$//' | sort -u \
  | while read -r l; do [ -e "$dir/$l" ] && echo "OK   $l" || echo "MISS $l"; done
```

Control: add a deliberately broken link to a scratch copy of the README and confirm exactly one
`MISS` before trusting a clean run.

### (c) Section-anchor citations

Once code cites a spec/PRD section (e.g. a table-classification module citing
`specs/data-model.md §2.4`), renumbering the doc breaks the citation silently.
There is no mechanical check for "does §2.4 still mean what the citer thought", so this one is a
read:

```bash
# Find every §-citation of a doc, then read the cited section
grep -rn "\.md §" <source-root>/ <test-root>/ .claude/ workspaces/
```

For each hit, open the cited section and confirm it still carries the claim. A citation that
resolves to a _file_ but not to a _clause_ is a dangling cross-reference — the section moved or
was renumbered and nobody updated the citer.

### (d) After any deletion or extraction

When content moves out of a file, or a file is removed:

```bash
grep -rn "<removed-name>" .claude/ .harness/ workspaces/ <source-root>/ <test-root>/ README.md
```

Update or delete every hit in the same change. An extraction is complete only when every
surviving reference resolves to real content.

## 3. Terminology Consistency

One concept, one name. Drift produces two apparent concepts and a reader who thinks they are
different things.

The right pattern when drift already exists: the glossary names it explicitly (e.g. "the
canonical term is **Space**; older sections still say **shared space**") rather than letting it go
unaddressed. A sweep then confirms whether the drift has spread further than the glossary
accounts for:

```bash
# A term with a documented "canonical vs. still-appearing" pair — sweep for undocumented drift
grep -rniE 'shared space' workspaces/<project>/ | grep -v glossary
```

Checks to run when a term changes:

1. Sweep every doc surface (PRD, ADRs, specs) plus source comments and `.claude/`.
2. Confirm the rename landed in index tables (the PRD/ADR READMEs, `specs/_index.md`, the glossary) not just body files.
3. Confirm identifiers agree with prose: a string literal like `"tenant-scoped"`
   and the doc's prose term must match; if the code says `tenantScoped` and the doc says
   `tenant-scoped`, say so explicitly in the doc rather than letting the reader guess.

A half-completed rename is worse than no rename: the old term keeps appearing, so a reader
concludes both terms are current and picks one.

## 4. Code-Surface Claim Resolution

Beyond file paths, docs make claims about **symbols**: function names, exported types, project
commands, env vars, table names. Each must resolve.

Project commands cited in a doc must exist in the project's task runner, and should match a row
in the project profile § Commands. Illustrative checks for common runners:

```bash
# npm scripts (JavaScript/TypeScript) — cited `npm run X` must exist in package.json
grep -ohE 'npm run [a-z:@-]+' "$doc" | sed 's/^npm run //' | sort -u \
  | while read -r s; do
      node -e "process.exit(require('./package.json').scripts['$s']?0:1)" \
        && echo "OK   npm run $s" || echo "MISS npm run $s"
    done

# Make targets — cited `make X` must be a defined target
grep -ohE 'make [a-z][a-z0-9_-]*' "$doc" | sed 's/^make //' | sort -u \
  | while read -r t; do
      make -n "$t" >/dev/null 2>&1 && echo "OK   make $t" || echo "MISS make $t"
    done
```

Falsifying result: a `MISS` line naming a command that does not exist.

```bash
# Exported symbols cited in backticks (adjust the declaration pattern to the language:
# TS `export .*\bX\b`, Python `^(class|def) X\b`, Go `^func X\b|^type X\b`)
grep -ohE '`[A-Z][A-Za-z0-9]+`' "$doc" | tr -d '`' | sort -u \
  | while read -r s; do
      grep -rqE "(export .*|class |def |func |type )\b${s}\b" <source-root>/ && echo "OK   $s" || echo "CHECK $s"
    done
```

`CHECK` is not automatically a finding — the symbol may be a type from a dependency, or a
conceptual name. Read each one. This is a case where the tally is meaningless and only the hits
carry information.

## 5. The Combined Pre-Merge Sweep

```bash
#!/usr/bin/env bash
# Run against every doc the change touched.
set -uo pipefail
fail=0

for doc in "$@"; do
  echo "=== $doc ==="

  # (a) path citations (roots from the project profile § Identity)
  grep -ohE '`(src|tests|workspaces)/[A-Za-z0-9._/-]+`' "$doc" | tr -d '`' | sort -u \
    | while read -r p; do [ -e "$p" ] || { echo "MISS path: $p"; exit 1; }; done || fail=1

  # (b) .claude-relative citations
  grep -ohE '`(rules|skills|guides|agents|commands|hooks)/[A-Za-z0-9._/-]+`' "$doc" | tr -d '`' | sort -u \
    | while read -r p; do
        [ -e "$p" ] || [ -e ".claude/$p" ] || { echo "MISS artifact: $p"; exit 1; }
      done || fail=1

  # (c) project commands — plug in the runner check from § 4 for the project's task runner

  # (d) split-state framings in specs
  case "$doc" in
    */specs/*) grep -niE 'phase ?1.*phase ?2|promised.*current|scaffold.*later|\bTBD\b|to be wired' "$doc" \
                 && { echo "SPLIT-STATE framing in a spec"; fail=1; } ;;
  esac
done

exit "$fail"
```

Run it, then run the code-example check separately (it needs a scratch compile and cannot be a
pure grep). Both together are the doc-side equivalent of the project's type check.

## 6. Findings Categorisation

| Finding                                                 | Category    | Action                                                            |
| ------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| Code fence teaching a non-existent API                  | BUG         | Fix in this change                                                |
| Citation to a deleted file, rule, or skill              | BUG         | Fix in this change                                                |
| Project command cited that does not exist               | BUG         | Fix in this change                                                |
| Split-state framing inside a spec                       | BUG         | Move to todos, delete from the spec                               |
| New file missing from its index table                   | BUG         | Add the row                                                       |
| Section anchor that resolves to a file but not a clause | BUG         | Re-point or restore the clause                                    |
| Half-completed terminology rename                       | BUG         | Finish the sweep in this change                                   |
| Prose could be clearer                                  | INCREMENTAL | Defer with a value-anchor per `.harness/rules/product-completion-first.md` |

Category, not severity, gates the lane. A one-character wrong path is a BUG because the reader
following it gets nothing.

## Related

- `gold-documentation.md` — the standards these sweeps check
- `SKILL.md` — the code patterns docs describe
- `skills/16-validation-patterns/SKILL.md` — the mechanical gate inventory
- `.claude/rules/instrument-discipline.md` — name the falsifying result; read the hits, not the tally
- `.claude/rules/spec-accuracy.md` — every citation resolves; no split-state framings
