/**
 * Flow Validator Module
 *
 * Simulates real user flow: click main buttons, follow nav links, submit forms.
 * If flow completes successfully → downgrade all related issues (flowImpact: true).
 *
 * This module receives flow context from the caller. The actual flow simulation
 * (navigation, clicks) is done by the caller (e.g. analyze-url route) which has
 * access to fetch/navigation. We apply flowImpact based on that context.
 */

import type { ValidatedIssue } from './types';
import type { FlowContext } from './types';
import type { Severity } from '@/lib/qa-engine/types';

const SEVERITY_ORDER: Severity[] = ['urgent', 'high', 'medium', 'low', 'minor'];

/**
 * Downgrade severity by one level.
 */
function downgradeSeverity(severity: Severity): Severity {
  const idx = SEVERITY_ORDER.indexOf(severity);
  if (idx < 0 || idx >= SEVERITY_ORDER.length - 1) return severity;
  return SEVERITY_ORDER[idx + 1]!;
}

/**
 * Check if an issue is "related" to a successful flow interaction.
 * An issue is related if:
 * - Its selector/url matches a successful interaction
 * - It's on a page that was successfully navigated to
 * - It's a form/button/link that was successfully used
 */
function isRelatedToSuccessfulFlow(
  issue: ValidatedIssue,
  context: FlowContext
): boolean {
  if (!context.flowCompleted && !context.successfulInteractions?.size) {
    return false;
  }

  // If flow completed globally, all issues on the main flow path are "related"
  if (context.flowCompleted) {
    const selectors = [
      issue.selector,
      issue.screenshotSelector,
      issue.url,
      issue.location,
      issue.pageUrl,
    ].filter(Boolean) as string[];

    for (const s of selectors) {
      if (context.successfulInteractions?.has(s)) return true;
      // Partial match: e.g. "button" in "button.submit-btn"
      for (const success of context.successfulInteractions ?? []) {
        if (s.includes(success) || success.includes(s)) return true;
      }
    }

    // Conservative: if we have no selector/url, don't assume related
    if (selectors.length === 0) return false;

    // For link issues: if we successfully followed links, 404s we didn't hit might be less critical
    // We only downgrade if the issue's URL was in the successful path
    return false;
  }

  return false;
}

/**
 * Main function: add flowImpact and optionally downgrade issues
 * when user flow completed successfully.
 *
 * @param issues - Validated issues
 * @param context - Flow context (flowCompleted, successfulInteractions)
 * @returns Issues with flowImpact set; severity downgraded for related issues when flow succeeded
 */
export function addFlowImpact(
  issues: ValidatedIssue[],
  context?: FlowContext
): ValidatedIssue[] {
  if (!context?.flowCompleted && !context?.successfulInteractions?.size) {
    return issues.map((issue) => ({
      ...issue,
      flowImpact: false,
    }));
  }

  return issues.map((issue) => {
    const related = isRelatedToSuccessfulFlow(issue, context);

    if (related && context.flowCompleted) {
      return {
        ...issue,
        flowImpact: true,
        severity: downgradeSeverity(issue.severity),
      };
    }

    return {
      ...issue,
      flowImpact: false,
    };
  });
}
