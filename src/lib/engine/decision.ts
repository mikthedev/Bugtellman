/**
 * Decision Engine Module
 *
 * Final verdict logic:
 *   if (impact === "cosmetic" && confidence < 0.6 && occurrenceRate < 0.5)
 *     → verdict = "ignore"
 *   else
 *     → verdict = "report"
 *
 * Returns verdict and reasoning. Never deletes issues — only flags as ignore.
 */

import type { ValidatedIssue } from './types';
import type { Verdict } from './types';

/**
 * Build human-readable reasoning for the verdict.
 */
function buildReasoning(
  issue: ValidatedIssue,
  verdict: Verdict
): string {
  if (verdict === 'report') {
    const parts: string[] = [];
    if (issue.impact) parts.push(`Impact: ${issue.impact}`);
    if (issue.confidence != null)
      parts.push(`Confidence: ${(issue.confidence * 100).toFixed(0)}%`);
    if (issue.stability) parts.push(`Stability: ${issue.stability}`);
    return `Report: ${parts.join(', ')}`;
  }

  // verdict === "ignore"
  const reasons: string[] = [];
  if (issue.impact === 'cosmetic') reasons.push('cosmetic impact');
  if (issue.confidence != null && issue.confidence < 0.6)
    reasons.push(`low confidence (${(issue.confidence * 100).toFixed(0)}%)`);
  if (issue.occurrenceRate != null && issue.occurrenceRate < 0.5)
    reasons.push(`low reproducibility (${(issue.occurrenceRate * 100).toFixed(0)}%)`);

  return `Ignore: ${reasons.join(', ')} — likely false positive`;
}

/**
 * Main function: add verdict and reasoning to each issue.
 *
 * @param issues - Fully validated issues (with confidence, impact, occurrenceRate)
 * @returns Issues with verdict and reasoning added
 */
export function addDecision(issues: ValidatedIssue[]): ValidatedIssue[] {
  return issues.map((issue) => {
    const impact = issue.impact ?? 'cosmetic';
    const confidence = issue.confidence ?? 1;
    const occurrenceRate = issue.occurrenceRate ?? 1;

    const shouldIgnore =
      impact === 'cosmetic' && confidence < 0.6 && occurrenceRate < 0.5;

    const verdict: Verdict = shouldIgnore ? 'ignore' : 'report';
    const reasoning = buildReasoning(issue, verdict);

    return {
      ...issue,
      verdict,
      reasoning,
    };
  });
}
