# Issue Validation & Intelligence Layer

Pipeline: **detector → validation engine → scoring engine → decision engine → results panel**

## Folder Structure

```
src/lib/engine/
├── types.ts           # Extended issue types, context interfaces
├── confidence.ts      # Confidence score (0–1)
├── reproducibility.ts # Occurrence rate, stability

├── impact.ts          # Impact classification
├── aggregator.ts      # Merge issues by selector/URL
├── componentAwareness.ts # Severity by element importance
├── flowValidator.ts   # Flow impact (successful flow → downgrade)
├── decision.ts        # Verdict (report/ignore)
├── risk.ts            # Page risk score
├── index.ts           # Pipeline orchestrator
└── README.md
```

## Example Input

```json
{
  "issues": [
    {
      "id": "issue-1",
      "category": "Links",
      "severity": "high",
      "audience": "manual",
      "title": "404 - Page not found",
      "description": "Link returns 404: https://example.com/dead",
      "url": "https://example.com/dead",
      "location": "https://example.com/dead"
    },
    {
      "id": "issue-2",
      "category": "HTML Structure",
      "severity": "medium",
      "audience": "technical",
      "title": "Missing lang attribute on <html>",
      "description": "The html element should have a lang attribute.",
      "selector": "html"
    },
    {
      "id": "issue-3",
      "category": "Accessibility",
      "severity": "low",
      "audience": "manual",
      "title": "Image missing alt text",
      "description": "img element has no alt attribute",
      "selector": "img.hero"
    }
  ]
}
```

## Processed Output Example

```json
{
  "issues": [
    {
      "id": "issue-1",
      "category": "Links",
      "severity": "high",
      "title": "404 - Page not found",
      "description": "Link returns 404: https://example.com/dead",
      "url": "https://example.com/dead",
      "confidence": 0.855,
      "occurrenceRate": 1,
      "stability": "stable",
      "impact": "blocking",
      "flowImpact": false,
      "verdict": "report",
      "reasoning": "Report: Impact: blocking, Confidence: 86%, Stability: stable"
    },
    {
      "id": "issue-2",
      "category": "HTML Structure",
      "severity": "medium",
      "title": "Missing lang attribute on <html>",
      "selector": "html",
      "confidence": 0.608,
      "occurrenceRate": 1,
      "stability": "stable",
      "impact": "cosmetic",
      "flowImpact": false,
      "verdict": "report",
      "reasoning": "Report: Impact: cosmetic, Confidence: 61%, Stability: stable"
    },
    {
      "id": "issue-3",
      "category": "Accessibility",
      "severity": "low",
      "title": "Image missing alt text",
      "selector": "img.hero",
      "confidence": 0.382,
      "occurrenceRate": 1,
      "stability": "stable",
      "impact": "functional",
      "flowImpact": false,
      "verdict": "report",
      "reasoning": "Report: Impact: functional, Confidence: 38%, Stability: stable"
    }
  ],
  "riskScore": 7,
  "riskLevel": "medium"
}
```

## Ignored Issue Example

When `impact === "cosmetic" &&
confidence < 0.6 &&
occurrenceRate < 0.5`, the verdict is `"ignore"`:

```json
{
  "id": "issue-x",
  "category": "CSS Quality",
  "severity": "low",
  "confidence": 0.45,
  "occurrenceRate": 0.33,
  "stability": "flaky",
  "impact": "cosmetic",
  "verdict": "ignore",
  "reasoning": "Ignore: cosmetic impact, low confidence (45%), low reproducibility (33%) — likely false positive"
}
```

Ignored issues are filtered from the display but never deleted from the pipeline.

## Module Summary

| Module | Input | Output |
|--------|-------|--------|
| `reproducibility` | issues, context? | occurrenceRate, stability, severity (downgrade if flaky) |
| `impact` | issues | impact (blocking/functional/visual/cosmetic) |
| `aggregator` | issues | merged issues (fewer, by selector/URL) |
| `componentAwareness` | issues | severity adjusted by element importance |
| `flowValidator` | issues, context? | flowImpact, severity (downgrade if flow succeeded) |
| `confidence` | issues | confidence (0–1) |
| `decision` | issues | verdict, reasoning |
| `risk` | issues | riskScore, riskLevel |
