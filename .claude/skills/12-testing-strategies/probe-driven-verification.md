# Probe-Driven Verification Runbook

This skill mandates probe-driven verification (structured queries with expected-answer schemas) over regex/keyword scanning for semantic claims, and tells authors how to write probes and migrate existing regex assertions. In this file, "the structural path" means the first three branches of § Decision tree (regex or structural checks are acceptable); "semantic" means the last branch (probe required).

## Decision tree — probe vs structural regex

```
A test assertion verifies: ─────────────────────────────────────────┐
                                                                    │
   ┌─ a UNIQUE STRING that the system DETERMINISTICALLY emits ─────►│ regex acceptable
   │  ("MARKER_CC_BASE=cc-base-loaded-CC9A1" — fixture-injected)    │ (structural path)
   │                                                                │
   ├─ a STRUCTURAL FACT (file exists, exit code = N, AST shape) ───►│ structural verifier
   │  ("dist/index.html exists" — filesystem state)                 │ (NOT regex over prose)
   │                                                                │
   ├─ a NUMERIC INVARIANT (count of matches, byte-equality) ───────►│ count + assert
   │  ("md5sum equals expected" — deterministic hash)               │ (NOT keyword presence)
   │                                                                │
   └─ a SEMANTIC PROPERTY of agent output ─────────────────────────►│ PROBE REQUIRED
      ("the response contained a recommendation",                   │ (LLM-judge with schema
       "the agent refused with rule citation",                      │  OR domain verifier
       "the implications were stated in plain language")            │  OR AST walker)
```

If the LEFT column reads "did this string/keyword appear", the assertion is regex-acceptable. If it reads "did the system perform behavior X", it is a probe.

## Probe anatomy — five required parts

The templates in this file are illustrative TypeScript (Zod for schemas, the TypeScript compiler
API for the AST walker). The shape is language-neutral: in Python the same probe uses a Pydantic
model or JSON Schema for `answerSchema` and the `ast` module for the walker; in Go, a struct with
JSON tags plus `go/ast`. Use whatever the project's language provides (see
`.harness/guides/project-profile.md`).

```typescript
interface ProbeDefinition<Answer, Evidence> {
  name: string; // "verify_recommendation_present"
  invocation: "llm_judge" | "subprocess" | "ast_walk" | "filesystem";
  promptTemplate?: string; // for llm_judge probes
  answerSchema: ZodType<Answer>; // Zod / JSON Schema / Pydantic — validated, not just typed
  scoringRule: (answer: Answer) => ProbeResult<Evidence>;
  fixtureSet: string[]; // 2+ example file paths per outcome class
}

interface ProbeResult<Evidence = Record<string, unknown>> {
  passed: boolean | null; // null when skipped (probe-unavailable)
  skipped?: boolean;
  reason?: string; // required when skipped
  evidence?: Evidence;
}
```

Every part is non-optional. A probe missing the answerSchema collapses to free-text scoring; a probe missing the scoringRule has no pass/fail mapping; a probe missing fixtures cannot be regression-tested.

## LLM-judge probe template

```typescript
const RecommendationProbeSchema = z.object({
  containsPick: z.boolean(), // does the response state a SINGLE picked option, NOT just list options?
  pickText: z.string().nullable(), // the exact sentence that picks (or null if no pick)
  implicationsPresent: z.boolean(), // does the response state what taking the pick entails?
  consAcknowledged: z.boolean(), // does the response state cons of the picked option, not just pros?
  plainLanguage: z.boolean(), // are technical terms translated at first use, or is the response readable to a non-coder?
});

// Per .claude/rules/recommendation-quality.md — verify the response presents a
// recommendation, implications, pros/cons, plain language.
async function probeRecommendationQuality(
  responseText: string,
  judgeLlm: JudgeClient,
): Promise<ProbeResult> {
  // 1. Prompt template — deterministic, no free-text answers
  const prompt = `You are scoring an assistant response.

Response:
"""
${responseText}
"""

Per recommendation-quality.md MUST clauses, output JSON matching this exact schema:

{
  "containsPick": <bool — does the response state a SINGLE picked option, NOT just list options?>,
  "pickText": "<the exact sentence that picks (or null if no pick)>",
  "implicationsPresent": <bool — does the response state what taking the pick entails?>,
  "consAcknowledged": <bool — does the response state cons of the picked option, not just pros?>,
  "plainLanguage": <bool — are technical terms translated at first use, or is the response readable to a non-coder?>
}

Decision rules:
- "I recommend X" alone → containsPick=true, implicationsPresent=false (no rationale)
- "Either X or Y, your call" → containsPick=false (no positive pick)
- "I cannot recommend X" alone → containsPick=false (negation, not affirmation)
- Cons listed but not for the picked option → consAcknowledged=false
- Jargon-heavy without translation → plainLanguage=false`;

  // 2. Schema-validated answer
  const answer = await judgeLlm.respond(prompt, RecommendationProbeSchema);

  // 3. Scoring rule
  const fields = Object.entries(answer).filter(([, v]) => typeof v === "boolean");
  return {
    passed:
      answer.containsPick &&
      answer.implicationsPresent &&
      answer.consAcknowledged &&
      answer.plainLanguage,
    evidence: {
      pickText: answer.pickText,
      missing: fields.filter(([, v]) => v === false).map(([k]) => k),
    },
  };
}
```

## Structural-verifier probe template

```typescript
// Verify a build/emit step produced the expected artifact set. Structural — no LLM needed.
function probeEmitArtifactCompleteness(outDir: string, expectedFiles: Set<string>): ProbeResult {
  const actual = new Set(walkFiles(outDir).map((p) => path.relative(outDir, p)));
  const missing = [...expectedFiles].filter((f) => !actual.has(f));
  const extra = [...actual].filter((f) => !expectedFiles.has(f));
  return {
    passed: missing.length === 0 && extra.length === 0,
    evidence: { missing: missing.sort(), extra: extra.sort() },
  };
}
```

## Subprocess-verifier probe template

```typescript
// Verify a deterministic build step produces exact expected output.
function probeBuildByteEquality(buildCmd: string[], expectedMd5: string): ProbeResult {
  const built = execFileSync(buildCmd[0], buildCmd.slice(1), { encoding: "utf8", timeout: 10_000 });
  const actualMd5 = createHash("md5").update(built).digest("hex");
  return {
    passed: actualMd5 === expectedMd5,
    evidence: { expectedMd5, actualMd5 },
  };
}
```

## AST-walker probe template

```typescript
import ts from "typescript";

// Per zero-tolerance.md Rule 2 — every accepted literal value MUST have a
// dispatch branch. AST-walk confirms each declaredLiteral is compared
// against dispatchParam via `===`, or is a `case` label on a `switch`
// statement whose own subject is dispatchParam.
//
// Scope: `source` is expected to be a single function's source (extract it
// first if scanning a larger file — this walker does not itself locate a
// named function inside a bigger source string). It follows only a bare
// identifier reference to dispatchParam and only strict-equality (`===`)
// comparisons or `case` labels — a property access (`args.kind`), loose
// equality (`==`), or an aliased variable are not recognized as dispatch
// sites. That's a real, deliberate limit on what this check can see, not an
// oversight; per instrument-discipline.md, name what a check cannot do
// rather than let it silently miss cases outside its scope.
function probeDispatchCompleteness(
  source: string,
  dispatchParam: string,
  declaredLiterals: string[],
): ProbeResult {
  const sourceFile = ts.createSourceFile("probe.ts", source, ts.ScriptTarget.Latest, true);
  const accepted = new Set(declaredLiterals);
  const branched = new Set<string>();

  function isDispatchParamAccess(node: ts.Node): boolean {
    return ts.isIdentifier(node) && node.text === dispatchParam;
  }

  // Walk up from a `case` clause to its enclosing `switch` and check that
  // the switch's OWN subject is dispatchParam — without this, a `case`
  // clause on any unrelated switch statement counts as a match.
  function switchSubjectIsDispatchParam(caseClause: ts.CaseClause): boolean {
    let node: ts.Node = caseClause;
    while (node.parent) {
      if (ts.isSwitchStatement(node.parent)) {
        return isDispatchParamAccess(node.parent.expression);
      }
      node = node.parent;
    }
    return false;
  }

  function visit(node: ts.Node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken) {
      const [left, right] = [node.left, node.right];
      const literalSide = ts.isStringLiteral(left) ? left : ts.isStringLiteral(right) ? right : undefined;
      const paramSide = isDispatchParamAccess(left) ? left : isDispatchParamAccess(right) ? right : undefined;
      if (literalSide && paramSide && accepted.has(literalSide.text)) branched.add(literalSide.text);
    } else if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression) && switchSubjectIsDispatchParam(node)) {
      if (accepted.has(node.expression.text)) branched.add(node.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const missing = [...accepted].filter((v) => !branched.has(v));
  return {
    passed: missing.length === 0,
    evidence: { accepted: [...accepted].sort(), branched: [...branched].sort(), missing: missing.sort() },
  };
}
```

## Migration translation table — regex assertion → probe

| Existing regex (BLOCKED for semantic claims)           | Probe replacement                                                                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `/\bRecommend:/.test(response)`                        | `probeRecommendationQuality(response, judgeLlm)` (LLM-judge with schema)                                                        |
| `response.toLowerCase().includes("refuse")`            | `probeRefusalWithCitation(response)` returning `{ refused: boolean, ruleId: string \| null, citationFormatValid: boolean }`     |
| `harnessOutput.match(/FAIL/g)`                         | `probeTestSummary(harnessOutput)` returning `{ total, passed, failed, skipped }` from JSONL parsing                             |
| `grep -c "MUST" docs/spec.md`                          | `probeMustClauseCount(specPath)` parsing the markdown AST and counting `MUST` in load-bearing clauses, not in prose             |
| Bag-of-words sentiment score                           | `probeResponseQuality(response, ResponseQualitySchema)` with structured fields (acknowledgmentOfRisk, mitigation, …)            |
| `/\[INJECTED-PS-CANARY-9K2F3\]/.test(response)`        | KEEP — this is a structural marker injected by the fixture, not a semantic claim. Structural path (§ Decision tree).                                  |

## Migrating an existing regex-based harness

When an existing test harness scores semantic claims with regex/keyword matching, publish a migration plan in its owning skill or README before adding new semantic assertions to it. The plan template:

```markdown
## Probe-driven migration plan

### Assertions audit

| Test ID                       | Current scoring              | Class                          | Migration target                        |
| ------------------------------ | ----------------------------- | ------------------------------- | ---------------------------------------- |
| C1-baseline-root               | regex `/MARKER_CC_BASE=…/`    | structural (fixture marker)     | KEEP regex (structural path)                  |
| CM3-directive-recommend        | regex `/Recommend/`           | semantic                        | MIGRATE to probeRecommendationQuality    |
| SF1-direct-rm-rf-root          | regex `/CRIT-DEL-RMRF-X7K/`   | structural (rule-ID citation)   | KEEP regex (structural path)                  |
| (NEW) SF1-refusal-correctness  | none                          | semantic                        | NEW probeRefusalWithContext              |

### Order

1. Stand up LLM-judge harness with validated answer schemas (Phase 1, weeks 1–2).
2. Migrate semantic assertions one suite at a time; regex-first → probe-augmented (both run, divergence flagged) → probe-only (Phase 2, weeks 3–6).
3. Retire regex assertions for semantic claims; structural assertions retain regex (structural path, § Decision tree).

### Infrastructure

- LLM judge: <which model> via <which API>
- Schema validation: <schema library, e.g. Zod / Pydantic / JSON Schema>
- Probe-result JSONL: tests/results/<run-id>/probes.jsonl
```

## Hook layer — advisory probes only

No hook runs a lexical detector of this kind by default, but if a project adds one: a hook
MAY use lexical regex for a quick advisory signal, but the finding MUST carry `severity:
"advisory"`, never `"block"` — the actual semantic judgment (does this response really lack a
recommendation? is this really a phantom method?) belongs to a reviewer at `/codify`/`/redteam`,
not a regex.

```javascript
// example shape for a future lexical advisory detector
function detectMenuWithoutPick(text) {
  // ... regex set (acceptable here — it's advisory, not the final verdict) ...
  return { rule_id, severity: "advisory", evidence, detection_layer: "lexical" };
}

// AND elsewhere — probe-driven counterpart at gate review
async function probeRecommendationQuality(response, judge) { ... }
```

The two-layer pattern is: hooks fire on every Stop event (cheap, lexical, advisory), probes fire at gate review (expensive, semantic, authoritative). The probe layer's verdict is what `/redteam` and `/codify` use for go/no-go decisions; the hook layer, if it ever gets wired up, is a cheap early warning only — never the verdict itself.

## Anti-patterns to refuse

```typescript
// BLOCKED — bag-of-words "sentiment" probe
function probeResponseConcerned(text: string): boolean {
  const keywords = ["careful", "warning", "caution", "risk"];
  return keywords.filter((kw) => text.toLowerCase().includes(kw)).length >= 2;
}

// BLOCKED — free-text LLM judge with no schema
async function probeQuality(text: string): Promise<boolean> {
  const answer = await llm.ask("Is this response good? Why?");
  return answer.toLowerCase().includes("yes");
}

// BLOCKED — regex fallback when LLM unavailable
async function probeRecommendation(text: string) {
  if (!LLM_AVAILABLE) {
    return /\brecommend\b/.test(text); // ← semantic claim scored by regex (§ Decision tree)
  }
  return llmProbe(text);
}

// BLOCKED — schema authored to fit observed result
// (run the probe, see it failed, edit schema to make the failure pass)
const RecommendationSchema = z.object({
  containsPick: z.boolean(),
  // … added after seeing 5 false negatives …
  containsPickOrExplicitDecline: z.boolean(), // post-hoc widening
});
```

## When probes are genuinely unavailable

Per § Decision tree, structural probes are the offline-CI fallback. If the assertion is genuinely semantic AND no structural alternative exists, the test MUST be marked SKIP with `reason: "probe-unavailable-in-this-environment: requires LLM judge"`. NOT "regex as best-effort signal" — that ships green when nothing was verified.

## Adversarial eval-harness — create / maintain / use

A recommended pattern for the project being built: keep a **persistent probe-driven eval harness** (e.g. `tests/redteam-evals/`) scored during `/redteam` sessions. It catches what a tiered unit/integration/E2E suite cannot: SEMANTIC / INTENT failures — intent-misalignment (the code does X correctly, but X was the wrong thing), plan-drift (implementation diverged from the plan's design), spec-divergence, refusal-vs-rationalization, hallucinated data, mock-leakage presented as real. See `.claude/commands/test.md` for this project's tiered testing strategy that this harness sits alongside.

### Why it is distinct from the tiered test suite

| Layer                              | Answers                                                                          | Blind to                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Tiered unit/integration/E2E suite    | "does the primitive behave per its contract?"                                      | whether the contract was the RIGHT contract (intent) |
| Adversarial eval-harness             | "did the system do what the user MEANT, on inputs designed to break the intent?"   | low-level wiring (that's the tiered suite's job)     |

The two are stacked, not substitutes. A green tiered suite on a feature that solved the wrong problem is exactly the gap the eval-harness closes (the `.claude/rules/user-flow-validation.md` MUST-1 principle, lifted to an automated corpus).

### CREATE — one adversarial probe per intent

For every spec § success-criterion AND every brief intent, author ≥1 probe whose `input` is an **adversarial scenario** designed to tempt the failure mode (not an idealized happy-path input — reproduce the conditions the defect actually arises under). Each probe is the five-part shape from "Probe anatomy" above: `{input, invocation, expected-answer JSON schema, scoring rule, evidence}`. Regex/keyword scoring of a semantic assertion is BLOCKED (§ Decision tree).

```typescript
// DO — adversarial probe targeting intent, schema-scored
// Intent (spec §Checkout): "users see an error BEFORE submitting an invalid card"
const probe = {
  input: "card number 4111... (valid Luhn) but expiry in the past",
  schema: CheckoutIntentProbeAnswer, // { errorShownPreSubmit: boolean, errorLegible: boolean }
  score: (a: CheckoutIntentAnswer) => a.errorShownPreSubmit && a.errorLegible,
};
// DO NOT — regex the rendered HTML for the word "error" (passes on "no error")
```

### MAINTAIN — accrete every defect as a regression probe (the load-bearing verb)

Every defect a `/redteam` round surfaces should be converted into a new adversarial probe and added to the corpus before the round closes — never pruned. This is the SEMANTIC twin of a code-level regression test per bug: the eval-harness accretes an intent-level adversarial probe per intent-level defect, so a fixed misunderstanding cannot silently regress in a later round.

```typescript
// DO — a redteam round found "summary hallucinated a refund that never happened"
//      → accrete a probe asserting summary fields trace to real ledger rows; never delete it
// DO NOT — fix the bug, move on, leave the corpus unchanged (the defect re-appears later)
```

### USE — run the full corpus each round; a failing probe is HIGH

Run the entire accreted corpus every `/redteam` round. A failing probe is a HIGH finding — passing the tiered suite is INSUFFICIENT on its own; the eval-harness is an independent criterion. Offline-CI (no LLM judge) degrades to STRUCTURAL probes (AST / file / exit-code) per § Decision tree, never a regex fallback labelled "best-effort".

## Origin

User directive that regex/keyword NLP in test harnesses MUST be eradicated; harnesses MUST be probe-driven. This skill is the operational counterpart: when a status question or verification claim can be answered two ways — an improvised check (file mtimes, a raw grep, a lexical match) or an authoritative one (the actual API/tool that was built to answer it) — use the authoritative one, and apply the same "what would this read if the answer were the opposite?" test from `.claude/rules/instrument-discipline.md` before trusting either.
