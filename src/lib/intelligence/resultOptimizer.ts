/**
 * Result Optimizer
 *
 * Cleans final output before UI: remove ignored from primary list,
 * group duplicates, merge same-selector issues, attach summary stats.
 *
 * Returns: { critical, warnings, ignored, stats }
 * - critical: report verdict, high importance (e.g. score >= 50)
 * - warnings: report or downgrade, lower importance
 * - ignored: ignore verdict (kept for transparency)
 */

import type { EnrichedIssue, OptimizedResults } from './types';

const CRITICAL_IMPORTANCE_THRESHOLD = 50;

/**
 * Normalize selector for grouping (lowercase, trim).
 */
function normalizeSelector(selector?: string): string {
  if (!selector) return '';
  return selector.trim().toLowerCase();
}

/**
 * Merge a list of issues that share the same selector into one representative issue.
 * Keeps highest severity, concatenates messages, merges metadata.
 */
function mergeSameSelector(issues: EnrichedIssue[]): EnrichedIssue {
  const first = issues[0]!;
  if (issues.length === 1) return first;

  const mergedIds = issues.map((i) => i.id);
  const messages = [...new Set(issues.map((i) => i.message))];
  const maxSeverity = Math.max(...issues.map((i) => i.severity ?? 0));
  const maxImportance = Math.max(...issues.map((i) => i.importanceScore ?? 0));
  const hasReport = issues.some((i) => i.verdict === 'report');
  const verdict = hasReport ? 'report' : first.verdict;
  const userImpact = issues.some((i) => i.userImpact === true);

  return {
    ...first,
    id: `merged-${first.id}`,
    message: messages.length > 1 ? `${messages.length} issues: ${messages.slice(0, 2).join('; ')}${messages.length > 2 ? '…' : ''}` : first.message,
    severity: maxSeverity,
    importanceScore: maxImportance,
    userImpact,
    verdict,
    metadata: {
      ...first.metadata,
      mergedIds,
      mergedCount: issues.length,
    },
  };
}

/**
 * Group issues by selector and merge each group.
 */
function groupAndMergeDuplicates(issues: EnrichedIssue[]): EnrichedIssue[] {
  const bySelector = new Map<string, EnrichedIssue[]>();
  for (const issue of issues) {
    const key = normalizeSelector(issue.selector) || issue.id;
    const list = bySelector.get(key) ?? [];
    list.push(issue);
    bySelector.set(key, list);
  }
  return [...bySelector.values()].map(mergeSameSelector);
}

/**
 * Split into critical, warnings, ignored and add stats.
 */
export function runResultOptimizer(issues: EnrichedIssue[]): OptimizedResults {
  const merged = groupAndMergeDuplicates(issues);

  const ignored = merged.filter((i) => i.verdict === 'ignore');
  const reported = merged.filter((i) => i.verdict === 'report' || i.verdict === 'downgrade');

  const critical = reported.filter((i) => (i.importanceScore ?? 0) >= CRITICAL_IMPORTANCE_THRESHOLD);
  const warnings = reported.filter((i) => (i.importanceScore ?? 0) < CRITICAL_IMPORTANCE_THRESHOLD);

  return {
    critical,
    warnings,
    ignored,
    stats: {
      total: merged.length,
      reported: reported.length,
      ignored: ignored.length,
    },
  };
}
