# Decision Intelligence Layer

Pipeline: **detectors → intelligence engine → prioritizer → results**

Reduces false positives, ranks issues like a human QA, and filters harmless warnings.

---

## Folder structure

```
src/lib/intelligence/
├── types.ts           # Issue, EnrichedIssue, OptimizedResults, ElementAttrs
├── intentAnalyzer.ts  # Mark intentional/harmless (aria-hidden, role=presentation, etc.)
├── contextValidator.ts# Infer userImpact (heuristic when no real interaction)
├── issueJudge.ts     # Verdict: report | ignore | downgrade + reason
├── importanceRanker.ts # importanceScore = f(severity, userImpact, intent); sort
├── resultOptimizer.ts  # Merge duplicates, split critical/warnings/ignored, stats
├── adapter.ts        # QAIssue ↔ Issue, enrichIssuesWithElementAttrs
├── integration.ts    # runIntelligencePipeline(qaIssues, { html? })
├── index.ts          # runIntelligenceLayer(issues) + exports
└── README.md
```

---

## Execution order

```
issues (Issue[])
  → intentAnalyzer   (add intent: "intentional" | "unknown")
  → contextValidator (add userImpact: boolean)
  → issueJudge       (add verdict, reason)
  → importanceRanker (add importanceScore, sort desc)
  → resultOptimizer  (merge same-selector, split critical/warnings/ignored, stats)
  → OptimizedResults
```

---

## Shared issue type

All modules use:

```ts
interface Issue {
  id: string;
  type: string;
  message: string;
  severity: number;   // 0–100
  selector?: string;
  url: string;
  metadata?: Record<string, any>;
}
```

Enriched fields (added by pipeline): `intent`, `userImpact`, `verdict`, `reason`, `importanceScore`.

---

## Example input (raw issues from detectors)

```json
[
  {
    "id": "issue-1",
    "type": "Links",
    "message": "404 - Page not found: Link to /dead returns 404",
    "severity": 70,
    "selector": "a[href=\"/dead\"]",
    "url": "https://example.com"
  },
  {
    "id": "issue-2",
    "type": "Accessibility",
    "message": "Image missing alt text",
    "severity": 50,
    "selector": "img.decorative",
    "url": "https://example.com",
    "metadata": { "elementAttrs": { "ariaHidden": true, "role": "presentation" } }
  },
  {
    "id": "issue-3",
    "type": "HTML Standards",
    "message": "Missing lang attribute on <html>",
    "severity": 30,
    "selector": "html",
    "url": "https://example.com"
  }
]
```

---

## Processed output example

```json
{
  "critical": [
    {
      "id": "issue-1",
      "type": "Links",
      "message": "404 - Page not found: Link to /dead returns 404",
      "severity": 70,
      "selector": "a[href=\"/dead\"]",
      "url": "https://example.com",
      "intent": "unknown",
      "userImpact": true,
      "verdict": "report",
      "reason": "Report: affects user experience (impact=true, severity=70)",
      "importanceScore": 105
    }
  ],
  "warnings": [
    {
      "id": "issue-3",
      "type": "HTML Standards",
      "message": "Missing lang attribute on <html>",
      "severity": 30,
      "selector": "html",
      "url": "https://example.com",
      "intent": "unknown",
      "userImpact": false,
      "verdict": "downgrade",
      "reason": "Downgrade: severity=30, intent=unknown",
      "importanceScore": 15
    }
  ],
  "ignored": [
    {
      "id": "issue-2",
      "type": "Accessibility",
      "message": "Image missing alt text",
      "severity": 50,
      "selector": "img.decorative",
      "url": "https://example.com",
      "metadata": { "elementAttrs": { "ariaHidden": true, "role": "presentation" } },
      "intent": "intentional",
      "userImpact": false,
      "verdict": "ignore",
      "reason": "Ignore: element is intentional (hidden/decorative/test)",
      "importanceScore": 4.5
    }
  ],
  "stats": {
    "total": 3,
    "reported": 2,
    "ignored": 1
  }
}
```

**Reasoning:**

- **issue-1**: Broken link → userImpact true → **report**; high importance → **critical**.
- **issue-2**: elementAttrs show aria-hidden + role=presentation → **intentional** → userImpact false → **ignore**.
- **issue-3**: Low severity (30 < 40) path not taken (we have downgrade); userImpact false (cosmetic) → **downgrade**; low importance → **warnings**.

---

## Integration with existing scanner

Use the adapter and integration helpers so the existing pipeline stays unchanged; the intelligence layer runs after detection.

```ts
import { runIntelligencePipeline, getReportedIssuesForUI } from '@/lib/intelligence';

// After your existing analyze (e.g. analyze-url returns issues + HTML)
const qaIssues: QAIssue[] = result.issues;
const html = await response.text(); // optional, for intent enrichment

const optimized = await runIntelligencePipeline(qaIssues, { html });

// For existing ResultsPanel: flat list of reported issues (critical + warnings)
const issuesForUI = getReportedIssuesForUI(optimized);

// Or use buckets
const { critical, warnings, ignored, stats } = optimized;
```

To wire into the API (e.g. `analyze-url`): after fetching issues from `analyzeWebsite` or the URL analyzer, call `runIntelligencePipeline(issues, { html })`, then pass `getReportedIssuesForUI(optimized)` as the result issues (and optionally attach `optimized.stats` or `optimized.ignored` for transparency).

---

## Module reasoning summary

| Module | Purpose |
|--------|--------|
| **intentAnalyzer** | If element has aria-hidden, role=presentation, data-testid, or hidden → intent = "intentional"; else "unknown". Uses metadata.elementAttrs (enricher can fill from HTML). |
| **contextValidator** | Infers userImpact without a browser: intentional → false; blocking patterns (404, broken link, etc.) → true; cosmetic + non-critical element → false; else true. |
| **issueJudge** | userImpact true → report; intent intentional → ignore; severity < 40 → ignore; else downgrade. Adds verdict + reason. |
| **importanceRanker** | importanceScore = severity × (userImpact ? 1.5 : 0.5) × (intent === "intentional" ? 0.3 : 1). Sort descending. |
| **resultOptimizer** | Merge same-selector issues; split into critical (score ≥ 50), warnings, ignored; attach stats (total, reported, ignored). |

---

## Constraints

- TypeScript only, no external APIs.
- Deterministic, modular, testable.
- Does not change existing detectors or engine logic; runs as a post-processing layer.
