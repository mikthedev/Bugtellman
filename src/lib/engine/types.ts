/**
 * Engine types for the Issue Validation & Intelligence Layer.
 * Extends QAIssue with validation, scoring, and decision metadata.
 * All new fields are optional for backward compatibility.
 */

import type { QAIssue, Severity } from '@/lib/qa-engine/types';

/** Re-export base types */
export type { QAIssue, Severity };

/** Impact classification: how the issue affects user experience */
export type Impact = 'blocking' | 'functional' | 'visual' | 'cosmetic';

/** Reproducibility stability classification */
export type Stability = 'stable' | 'flaky' | 'random';

/** Final verdict from decision engine */
export type Verdict = 'report' | 'ignore';

/** Risk level for page overall */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Extended issue with validation engine metadata.
 * Extends QAIssue - never deletes issues, only adds/downgrades.
 */
export interface ValidatedIssue extends QAIssue {
  /** Confidence score 0-1: reproducibilityScore × signalStrength × detectorReliability */
  confidence?: number;

  /** Occurrence rate from reproducibility engine (0-1) */
  occurrenceRate?: number;

  /** Stability classification */
  stability?: Stability;

  /** Impact classification */
  impact?: Impact;

  /** Whether user flow completed successfully (downgrades related issues) */
  flowImpact?: boolean;

  /** Final verdict: report or ignore */
  verdict?: Verdict;

  /** Human-readable reasoning for the verdict */
  reasoning?: string;

  /** For aggregated issues: IDs of merged issues */
  mergedIssueIds?: string[];

  /** Request URL for aggregation (links, fetches) */
  requestUrl?: string;
}

/** Reproducibility result for a single issue */
export interface ReproducibilityResult {
  occurrenceRate: number;
  stability: Stability;
}

/** Risk score result for the page */
export interface RiskScoreResult {
  riskScore: number;
  riskLevel: RiskLevel;
}

/** Context passed to reproducibility engine for re-checking */
export interface ReproducibilityContext {
  /** How many times each issue was detected (out of runs) */
  occurrenceCounts?: Map<string, number>;
  /** Total number of detection runs (default 3) */
  runs?: number;
}

/** Context for flow validation (simulated user flow) */
export interface FlowContext {
  /** Whether main user flow completed successfully */
  flowCompleted?: boolean;
  /** Selectors/URLs that were successfully interacted with */
  successfulInteractions?: Set<string>;
}
