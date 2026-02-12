/**
 * Issue Judge
 *
 * Decides whether an issue should be reported, ignored, or downgraded.
 * Mimics a senior QA triaging results: filter noise, keep real problems.
 *
 * Rules:
 * - userImpact === true → report (affects user)
 * - intent === "intentional" → ignore (by design)
 * - severity < 40 → ignore (low priority)
 * - else → downgrade (show but lower priority)
 *
 * Adds: verdict, reason (human-readable).
 */

import type { EnrichedIssue } from './types';
import type { Verdict } from './types';

const SEVERITY_IGNORE_THRESHOLD = 40;

function buildReason(issue: EnrichedIssue, verdict: Verdict): string {
  if (verdict === 'report') {
    return `Report: affects user experience (impact=${issue.userImpact}, severity=${issue.severity})`;
  }
  if (verdict === 'ignore') {
    const parts: string[] = [];
    if (issue.intent === 'intentional') parts.push('element is intentional (hidden/decorative/test)');
    if (issue.userImpact === false) parts.push('no user impact');
    if ((issue.severity ?? 0) < SEVERITY_IGNORE_THRESHOLD) parts.push(`low severity (${issue.severity} < ${SEVERITY_IGNORE_THRESHOLD})`);
    return `Ignore: ${parts.join('; ')}`;
  }
  // downgrade
  return `Downgrade: severity=${issue.severity}, intent=${issue.intent ?? 'unknown'}`;
}

/**
 * Determine verdict for a single issue.
 */
export function judgeIssue(issue: EnrichedIssue): Verdict {
  if (issue.userImpact === true) return 'report';
  if (issue.intent === 'intentional') return 'ignore';
  if ((issue.severity ?? 0) < SEVERITY_IGNORE_THRESHOLD) return 'ignore';
  return 'downgrade';
}

/**
 * Process issues and attach verdict and reason.
 */
export function runIssueJudge(issues: EnrichedIssue[]): EnrichedIssue[] {
  return issues.map((issue) => {
    const verdict = judgeIssue(issue);
    const reason = buildReason(issue, verdict);
    return { ...issue, verdict, reason };
  });
}
