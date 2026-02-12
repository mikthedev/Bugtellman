/**
 * Issue Validation & Intelligence Layer
 *
 * Pipeline: detector → validation engine → scoring engine → decision engine → results panel
 *
 * Modules (in order):
 * 1. reproducibility - occurrence rate, stability
 * 2. impact - blocking/functional/visual/cosmetic
 * 3. aggregator - merge issues by selector/URL
 * 4. componentAwareness - severity by element importance
 * 5. flowValidator - flow impact
 * 6. confidence - confidence score
 * 7. decision - verdict (report/ignore)
 * 8. risk - page risk score
 */

import type { QAIssue } from '@/lib/qa-engine/types';
import type { AnalysisResult } from '@/lib/qa-engine/types';
import type { ValidatedIssue } from './types';
import type { ReproducibilityContext } from './types';
import type { FlowContext } from './types';
import type { RiskScoreResult } from './types';

import { addReproducibility } from './reproducibility';
import { addImpact } from './impact';
import { aggregateIssues } from './aggregator';
import { applyComponentAwareness } from './componentAwareness';
import { addFlowImpact } from './flowValidator';
import { addConfidence } from './confidence';
import { addDecision } from './decision';
import { computeRisk } from './risk';

export type { ValidatedIssue, RiskScoreResult, ReproducibilityContext, FlowContext } from './types';

export { addReproducibility } from './reproducibility';
export { addImpact } from './impact';
export { aggregateIssues } from './aggregator';
export { applyComponentAwareness } from './componentAwareness';
export { addFlowImpact } from './flowValidator';
export { addConfidence } from './confidence';
export { addDecision } from './decision';
export { computeRisk } from './risk';

export interface ValidationPipelineOptions {
  reproducibilityContext?: ReproducibilityContext;
  flowContext?: FlowContext;
}

export interface ValidatedAnalysisResult extends AnalysisResult {
  issues: ValidatedIssue[];
  riskScore?: number;
  riskLevel?: string;
}

/**
 * Run the full validation pipeline on raw detector issues.
 *
 * @param issues - Raw QAIssue[] from detectors
 * @param options - Optional context for reproducibility and flow
 * @returns Validated issues + risk score
 */
export function runValidationPipeline(
  issues: QAIssue[],
  options?: ValidationPipelineOptions
): { issues: ValidatedIssue[]; risk: RiskScoreResult } {
  let validated: ValidatedIssue[] = issues.map((i) => ({ ...i }));

  // 1. Reproducibility (needs to run early for confidence)
  validated = addReproducibility(validated, options?.reproducibilityContext);

  // 2. Impact classification
  validated = addImpact(validated);

  // 3. Aggregation (merge duplicate selectors/URLs)
  validated = aggregateIssues(validated);

  // 4. Component awareness (severity by element importance)
  validated = applyComponentAwareness(validated);

  // 5. Flow validator
  validated = addFlowImpact(validated, options?.flowContext);

  // 6. Confidence score
  validated = addConfidence(validated);

  // 7. Decision engine
  validated = addDecision(validated);

  // 8. Risk score (computed from reported issues only)
  const risk = computeRisk(validated);

  return { issues: validated, risk };
}

/**
 * Merge validation output into AnalysisResult.
 * Filters out ignored issues for display (optional - we never delete, but can filter).
 */
export function mergeValidationIntoResult(
  result: AnalysisResult,
  validated: ValidatedIssue[],
  risk: RiskScoreResult,
  filterIgnored: boolean = true
): ValidatedAnalysisResult {
  const issuesToShow = filterIgnored
    ? validated.filter((i) => i.verdict !== 'ignore')
    : validated;

  const summary = {
    total: issuesToShow.length,
    urgent: issuesToShow.filter((i) => i.severity === 'urgent').length,
    high: issuesToShow.filter((i) => i.severity === 'high').length,
    medium: issuesToShow.filter((i) => i.severity === 'medium').length,
    low: issuesToShow.filter((i) => i.severity === 'low').length,
    minor: issuesToShow.filter((i) => i.severity === 'minor').length,
  };

  return {
    ...result,
    issues: issuesToShow,
    summary,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
  };
}
