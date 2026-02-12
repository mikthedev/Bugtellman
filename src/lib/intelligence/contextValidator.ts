/**
 * Context Validator
 *
 * Checks whether an issue actually affects user experience.
 * In a pure TS environment we cannot run real interactions; we use
 * deterministic heuristics to infer userImpact.
 *
 * Logic:
 * - If intent is "intentional" → element is hidden/decorative → userImpact = false
 * - If issue type indicates a blocking failure (broken link, 404, form error) → userImpact = true
 * - If issue type indicates cosmetic/structural only and no critical element → userImpact = false when safe
 * - Fallback: no interaction possible → assume userImpact = true (report)
 *
 * Pure: no I/O, no DOM; only issue fields and type/category patterns.
 */

import type { EnrichedIssue } from './types';

/** Issue types or categories that imply interaction would fail (user is blocked) */
const BLOCKING_PATTERNS = [
  '404',
  'broken link',
  'dead link',
  'page not found',
  'form submission failed',
  'navigation failed',
  'blocked',
  'unreachable',
  'failed to load',
  'mixed content',
  'blocked or failed',
];

/** Issue types that are typically cosmetic and non-blocking when element is non-interactive */
const COSMETIC_PATTERNS = [
  'missing lang',
  'doctype',
  'deprecated',
  'empty rule',
  'duplicate selector',
  '!important',
  'z-index',
  'media query',
];

function matchesPattern(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

/**
 * Infer whether the issue affects the user.
 * "Simulate interaction" in a pure layer = heuristic from type/message/intent.
 */
export function validateUserImpact(issue: EnrichedIssue): boolean {
  // Intentional elements are not user-facing → no impact
  if (issue.intent === 'intentional') return false;

  // Blocking issues always affect the user
  const typeAndMessage = `${issue.type} ${issue.message}`;
  if (matchesPattern(typeAndMessage, BLOCKING_PATTERNS)) return true;

  // Cosmetic-only and not about a critical element → assume no interaction, low impact
  if (matchesPattern(typeAndMessage, COSMETIC_PATTERNS)) {
    const selector = issue.selector ?? '';
    const criticalTags = ['button', 'a', 'input', 'form', 'label'];
    const isCriticalElement = criticalTags.some((tag) =>
      selector.toLowerCase().includes(tag)
    );
    if (!isCriticalElement) return false;
  }

  // Fallback: we cannot simulate interaction → assume it affects the user
  return true;
}

/**
 * Process issues and attach userImpact.
 */
export function runContextValidator(issues: EnrichedIssue[]): EnrichedIssue[] {
  return issues.map((issue) => ({
    ...issue,
    userImpact: validateUserImpact(issue),
  }));
}
