/**
 * Importance Ranker
 *
 * Ranks issues by real importance, not raw severity.
 * Formula:
 *   importanceScore = severity × (userImpact ? 1.5 : 0.5) × (intent === "intentional" ? 0.3 : 1)
 *
 * Then sort descending so critical items appear first.
 * Pure: deterministic, no I/O.
 */

import type { EnrichedIssue } from './types';

/**
 * Compute importance score for a single issue.
 * Higher = more important to fix first.
 */
export function computeImportance(issue: EnrichedIssue): number {
  const severity = issue.severity ?? 0;
  const userImpactFactor = issue.userImpact === true ? 1.5 : 0.5;
  const intentFactor = issue.intent === 'intentional' ? 0.3 : 1;
  return severity * userImpactFactor * intentFactor;
}

/**
 * Attach importanceScore to each issue and sort by it descending.
 */
export function runImportanceRanker(issues: EnrichedIssue[]): EnrichedIssue[] {
  const withScore = issues.map((issue) => ({
    ...issue,
    importanceScore: computeImportance(issue),
  }));
  return [...withScore].sort((a, b) => (b.importanceScore ?? 0) - (a.importanceScore ?? 0));
}
