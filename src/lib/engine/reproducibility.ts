/**
 * Reproducibility Engine
 *
 * Re-checks each detected issue to determine stability.
 * Rules:
 *   - occurrenceRate >= 0.5: stable
 *   - occurrenceRate < 0.5: downgrade severity
 *   - occurrenceRate < 0.3: mark as flaky
 *
 * Accepts pre-computed occurrence counts from caller (e.g. from 3 detection runs).
 * If not provided, assumes all issues are stable (occurrenceRate = 1).
 */

import type { ValidatedIssue } from './types';
import type { ReproducibilityContext } from './types';
import type { Severity } from '@/lib/qa-engine/types';

const SEVERITY_DOWNGRADE: Record<Severity, Severity> = {
  urgent: 'high',
  high: 'medium',
  medium: 'low',
  low: 'minor',
  minor: 'minor',
};

/**
 * Downgrade severity by one level (never below minor).
 */
function downgradeSeverity(severity: Severity): Severity {
  return SEVERITY_DOWNGRADE[severity] ?? severity;
}

/**
 * Main function: add occurrenceRate and stability to each issue.
 * Optionally downgrades severity for flaky issues.
 *
 * @param issues - Raw issues from detectors
 * @param context - Optional occurrence counts (issueId -> count) and runs count
 * @returns Issues with occurrenceRate, stability, and possibly downgraded severity
 */
export function addReproducibility(
  issues: ValidatedIssue[],
  context?: ReproducibilityContext
): ValidatedIssue[] {
  const runs = context?.runs ?? 3;
  const occurrenceCounts = context?.occurrenceCounts;

  return issues.map((issue) => {
    let occurrenceRate: number;
    let stability: 'stable' | 'flaky' | 'random';

    if (occurrenceCounts?.has(issue.id)) {
      const count = occurrenceCounts.get(issue.id)!;
      occurrenceRate = count / runs;
      stability =
        occurrenceRate >= 0.5
          ? 'stable'
          : occurrenceRate >= 0.3
            ? 'flaky'
            : 'random';
    } else {
      // No recheck data: assume stable (e.g. static analysis is deterministic)
      occurrenceRate = 1.0;
      stability = 'stable';
    }

    let severity = issue.severity;

    // Downgrade severity for flaky/random issues
    if (occurrenceRate < 0.5) {
      severity = downgradeSeverity(severity);
    }

    return {
      ...issue,
      occurrenceRate: Math.round(occurrenceRate * 1000) / 1000,
      stability,
      severity,
    };
  });
}
