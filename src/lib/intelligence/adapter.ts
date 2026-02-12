/**
 * Adapter: QAIssue (existing) ↔ Issue (intelligence layer)
 *
 * Converts from detector/engine output to intelligence Issue shape and back.
 * Can enrich metadata.elementAttrs from HTML for intent analysis (optional).
 */

import type { QAIssue, Severity } from '@/lib/qa-engine/types';
import type { Issue, EnrichedIssue, OptimizedResults, ElementAttrs } from './types';

/**
 * Enrich issues with elementAttrs from HTML so intentAnalyzer can mark intentional elements.
 * Uses cheerio to read aria-hidden, role, data-testid, hidden on the element at issue.selector.
 */
export async function enrichIssuesWithElementAttrs(
  issues: Issue[],
  html: string
): Promise<Issue[]> {
  const { load } = await import('cheerio');
  const $ = load(html);

  return issues.map((issue) => {
    if (!issue.selector) return issue;
    try {
      const el = $(issue.selector).first();
      if (el.length === 0) return issue;
      const elementAttrs: ElementAttrs = {
        ariaHidden: el.attr('aria-hidden') === 'true',
        role: el.attr('role') ?? undefined,
        dataTestid: el.attr('data-testid') != null,
        hidden: el.attr('hidden') != null,
      };
      return {
        ...issue,
        metadata: { ...issue.metadata, elementAttrs },
      };
    } catch {
      return issue;
    }
  });
}

const SEVERITY_MAP: Record<Severity, number> = {
  urgent: 90,
  high: 70,
  medium: 50,
  low: 30,
  minor: 10,
};

/**
 * Map severity word to numeric 0–100.
 */
export function severityToNumber(severity: Severity | string): number {
  return SEVERITY_MAP[severity as Severity] ?? 50;
}

/**
 * Convert QAIssue to canonical Issue for the intelligence layer.
 */
export function qaIssueToIssue(qa: QAIssue): Issue {
  const meta = qa as QAIssue & { elementAttrs?: ElementAttrs };
  return {
    id: qa.id,
    type: qa.category,
    message: qa.title + (qa.description ? `: ${qa.description}` : ''),
    severity: severityToNumber(qa.severity),
    selector: qa.selector,
    url: qa.url ?? qa.location ?? qa.pageUrl ?? '',
    metadata: meta.elementAttrs ? { elementAttrs: meta.elementAttrs } : undefined,
  };
}

/**
 * Convert Issue back to QAIssue-like shape for existing UI (e.g. ResultsPanel).
 * Preserves original fields where possible; adds verdict, reason, importanceScore.
 */
export function enrichedIssueToQALike(enriched: EnrichedIssue): QAIssue & { verdict?: string; reasoning?: string; importanceScore?: number } {
  const severityFromNumber = (n: number): Severity => {
    if (n >= 80) return 'urgent';
    if (n >= 60) return 'high';
    if (n >= 40) return 'medium';
    if (n >= 20) return 'low';
    return 'minor';
  };
  return {
    id: enriched.id,
    category: enriched.type,
    severity: severityFromNumber(enriched.severity ?? 50),
    title: enriched.message.split(':')[0] ?? enriched.message,
    description: enriched.message.includes(':') ? enriched.message.split(':').slice(1).join(':').trim() : '',
    selector: enriched.selector,
    url: enriched.url,
    location: enriched.url,
    verdict: enriched.verdict,
    reasoning: enriched.reason,
    importanceScore: enriched.importanceScore,
  } as QAIssue & { verdict?: string; reasoning?: string; importanceScore?: number };
}

/**
 * Flatten optimized results into a single list for display (critical first, then warnings).
 * Converts to QAIssue-like for drop-in with existing ResultsPanel.
 */
export function optimizedToQAIssues(optimized: OptimizedResults): (QAIssue & { verdict?: string; reasoning?: string; importanceScore?: number })[] {
  const list = [...optimized.critical, ...optimized.warnings];
  return list.map(enrichedIssueToQALike);
}
