# Human-Behavior Testing Layer

Pipeline: **scanner → detectors → behavior engine → logic engine → judgment engine → results**

Simulates real user testing and detects behavioral, logical, and interaction bugs.

---

## Folder structure

```
src/lib/behaviorEngine/
├── types.ts              # BehaviorContext, ExploredFlow, EdgeCase, StateRule, Expectation, Inconsistency, BehaviorFinding
├── explorer.ts           # Discovers user flows (nav, form, interaction)
├── edgeCaseTester.ts     # Generates edge cases for forms (empty, invalid, boundary, special chars)
├── stateTester.ts        # Derives state rules (e.g. required empty → invalid)
├── expectationValidator.ts # Builds and validates expectations (interaction, logic, a11y)
├── inconsistencyDetector.ts # Finds contradictions (duplicate href, password in GET, etc.)
├── judgmentEngine.ts     # Consolidates into BehaviorFinding[] with severity
├── structureBuilder.ts  # Optional: build PageStructure from HTML
├── adapter.ts           # BehaviorFinding → QAIssue for merging
├── index.ts             # runBehaviorPipeline(context)
└── README.md
```

---

## Pipeline order

1. **Behavior engine**: explorer → edgeCaseTester → stateTester  
2. **Logic engine**: expectationValidator, inconsistencyDetector  
3. **Judgment engine**: judge(flows, edgeCases, stateRules, expectations, inconsistencies) → findings  

---

## Module roles

| Module | Purpose | Pure |
|--------|---------|------|
| **explorer** | From context (issues + optional structure), enumerate nav links, forms, buttons | ✓ |
| **edgeCaseTester** | For each form flow, generate edge cases (empty, invalid, boundary, specialChars) | ✓ |
| **stateTester** | From flows + edge cases, derive state rules (initial → invalid, valid_input → submitted) | ✓ |
| **expectationValidator** | From context + flows + state rules + edge cases, produce expectations (validated or not) | ✓ |
| **inconsistencyDetector** | From context + flows, find inconsistencies (duplicate href, password in GET, broken links) | ✓ |
| **judgmentEngine** | Turn inconsistencies, unvalidated expectations, and state rules into BehaviorFinding[] | ✓ |

---

## Usage

```ts
import { runBehaviorPipeline, buildStructureFromHTML, behaviorFindingsToQAIssues } from '@/lib/behaviorEngine';

const context = {
  issues: result.issues,
  structure: html ? await buildStructureFromHTML(html, baseUrl) : undefined,
  baseUrl,
};

const { findings, flows, edgeCases, expectations, inconsistencies } = runBehaviorPipeline(context);

const behaviorIssues = behaviorFindingsToQAIssues(findings);
const allIssues = [...result.issues, ...behaviorIssues];
```

---

## Constraints

- Independent, pure where possible, testable, deterministic.
- No detector changes; consumes detector output (issues + optional structure).
