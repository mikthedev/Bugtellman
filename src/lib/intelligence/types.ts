/**
 * Decision Intelligence Layer – shared types
 *
 * All modules consume and produce issues using this canonical shape.
 * Enriched fields (intent, userImpact, verdict, reason, importanceScore)
 * are added by the pipeline and remain optional for intermediate steps.
 */

/** Canonical issue shape for the intelligence pipeline */
export interface Issue {
  id: string;
  type: string;
  message: string;
  /** Numeric severity 0–100 (higher = more severe) */
  severity: number;
  selector?: string;
  url: string;
  metadata?: Record<string, unknown>;
}

/**
 * Optional element attributes used by intentAnalyzer.
 * Populated by pipeline/enricher from HTML when available (e.g. aria-hidden, role, data-testid, hidden).
 */
export interface ElementAttrs {
  ariaHidden?: boolean;
  role?: string;
  dataTestid?: boolean;
  hidden?: boolean;
}

/** Intent classification from intentAnalyzer */
export type Intent = 'intentional' | 'unknown';

/** Verdict from issueJudge */
export type Verdict = 'report' | 'ignore' | 'downgrade';

/** Issue with all intelligence fields attached (after full pipeline) */
export interface EnrichedIssue extends Issue {
  intent?: Intent;
  userImpact?: boolean;
  verdict?: Verdict;
  reason?: string;
  importanceScore?: number;
}

/** Final output from resultOptimizer */
export interface OptimizedResults {
  critical: EnrichedIssue[];
  warnings: EnrichedIssue[];
  ignored: EnrichedIssue[];
  stats: {
    total: number;
    reported: number;
    ignored: number;
  };
}
