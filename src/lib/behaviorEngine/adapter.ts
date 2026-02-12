/**
 * Adapter – BehaviorFinding to QAIssue for merging with detector results
 */

import type { Severity } from '@/lib/qa-engine/types';
import type { QAIssue } from '@/lib/qa-engine/types';
import type { BehaviorFinding } from './types';

/**
 * Convert a behavior finding to QAIssue so it can be merged into the main results list.
 */
export function behaviorFindingToQAIssue(finding: BehaviorFinding): QAIssue {
  return {
    id: finding.id,
    category: finding.category,
    severity: finding.severity as Severity,
    audience: 'technical',
    title: finding.title,
    description: finding.description,
    qaComment: `Behavior check: ${finding.description}`,
    selector: finding.selector,
    url: finding.url,
  };
}

/**
 * Convert all behavior findings to QAIssue[] for appending to analysis result issues.
 */
export function behaviorFindingsToQAIssues(findings: BehaviorFinding[]): QAIssue[] {
  return findings.map(behaviorFindingToQAIssue);
}
