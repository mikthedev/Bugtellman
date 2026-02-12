/**
 * Multi-Signal Aggregator Module
 *
 * Merges issues affecting the same selector or endpoint.
 * Example: console error + failed request + click failure → single combined issue
 *
 * Groups by selector OR request URL. Merged issues become one "parent" issue
 * with mergedIssueIds referencing the original issues.
 */

import type { ValidatedIssue } from './types';

/**
 * Get aggregation key for an issue.
 * Group by selector (normalized) or url/location for link/request issues.
 */
function getAggregationKey(issue: ValidatedIssue): string | null {
  // Prefer selector for DOM issues
  if (issue.selector && issue.selector.trim()) {
    return `selector:${issue.selector.trim().toLowerCase()}`;
  }

  // For link/404 issues: group by URL
  const url = issue.url || issue.location || issue.pageUrl;
  if (url && (url.startsWith('http') || url.includes('/'))) {
    try {
      const parsed = new URL(url, 'https://example.com');
      return `url:${parsed.href}`;
    } catch {
      return `url:${url}`;
    }
  }

  // Fallback: location (file path)
  if (issue.location) {
    return `location:${issue.location}`;
  }

  return null;
}

/**
 * Merge a group of issues into one representative issue.
 * Uses highest severity, concatenates descriptions, preserves first issue's structure.
 */
function mergeIssues(issues: ValidatedIssue[]): ValidatedIssue {
  if (issues.length === 1) return issues[0]!;

  const severityOrder = ['urgent', 'high', 'medium', 'low', 'minor'] as const;
  const sorted = [...issues].sort(
    (a, b) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );
  const primary = sorted[0]!;

  const titles = [...new Set(issues.map((i) => i.title))];
  const combinedTitle =
    titles.length === 1 ? titles[0]! : `Multiple issues: ${titles.join(', ')}`;

  const descriptions = [...new Set(issues.map((i) => i.description))];
  const combinedDescription =
    descriptions.length === 1
      ? descriptions[0]!
      : descriptions.join('; ');

  return {
    ...primary,
    id: primary.id,
    title: combinedTitle,
    description: combinedDescription,
    mergedIssueIds: issues.map((i) => i.id),
    // Preserve highest severity
    severity: primary.severity,
  };
}

/**
 * Main function: merge issues that share selector or URL.
 *
 * @param issues - Array of validated issues
 * @returns Fewer issues (merged), each with mergedIssueIds if it contains merged issues
 */
export function aggregateIssues(issues: ValidatedIssue[]): ValidatedIssue[] {
  const groups = new Map<string, ValidatedIssue[]>();

  for (const issue of issues) {
    const key = getAggregationKey(issue);
    if (key) {
      const existing = groups.get(key) ?? [];
      existing.push(issue);
      groups.set(key, existing);
    } else {
      // No key: keep as singleton
      groups.set(`single:${issue.id}`, [issue]);
    }
  }

  return Array.from(groups.values()).map((group) => mergeIssues(group));
}
