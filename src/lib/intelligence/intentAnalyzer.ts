/**
 * Intent Analyzer
 *
 * Detects whether an issue relates to an intentional or harmless pattern.
 * If the element is explicitly hidden, presentational, or test-only,
 * the issue is marked "intentional" so downstream modules can ignore or downgrade.
 *
 * Rules:
 * - aria-hidden="true" → intentional (element excluded from a11y tree)
 * - role="presentation" → intentional (decorative / no semantics)
 * - data-testid present → intentional (test hook, not user-facing)
 * - hidden attribute → intentional (not visible)
 * - Else → unknown
 *
 * Pure: only reads issue.metadata.elementAttrs. Does not touch DOM.
 */

import type { Issue, EnrichedIssue, Intent, ElementAttrs } from './types';

function getElementAttrs(issue: Issue): ElementAttrs | undefined {
  const attrs = issue.metadata?.elementAttrs;
  if (!attrs || typeof attrs !== 'object') return undefined;
  return attrs as ElementAttrs;
}

/**
 * Determine intent from element attributes.
 * Returns "intentional" when the element is explicitly non-user-facing.
 */
export function analyzeIntent(issue: Issue): Intent {
  const attrs = getElementAttrs(issue);
  if (!attrs) return 'unknown';

  if (attrs.ariaHidden === true) return 'intentional';
  if (attrs.role === 'presentation') return 'intentional';
  if (attrs.dataTestid === true) return 'intentional';
  if (attrs.hidden === true) return 'intentional';

  return 'unknown';
}

/**
 * Process a list of issues and attach intent to each.
 * Does not mutate; returns new array with enriched issues.
 */
export function runIntentAnalyzer(issues: Issue[]): EnrichedIssue[] {
  return issues.map((issue) => ({
    ...issue,
    intent: analyzeIntent(issue),
  }));
}
