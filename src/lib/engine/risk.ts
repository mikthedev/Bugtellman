/**
 * Risk Score Generator Module
 *
 * Generates overall page risk score:
 *   riskScore = urgent×10 + high×5 + medium×2 + low×1
 *
 * riskLevel: low | medium | high | critical
 *
 * Only counts issues with verdict === "report" (ignored issues don't affect risk).
 */

import type { ValidatedIssue } from './types';
import type { RiskScoreResult, RiskLevel } from './types';

/** Weight per severity for risk calculation: urgent×10 + high×5 + medium×2 + low×1 */
const SEVERITY_WEIGHTS: Record<string, number> = {
  urgent: 10,
  high: 5,
  medium: 2,
  low: 1,
  minor: 0,
};

/** Thresholds for risk level (inclusive) */
const RISK_THRESHOLDS: { max: number; level: RiskLevel }[] = [
  { max: 5, level: 'low' },
  { max: 20, level: 'medium' },
  { max: 50, level: 'high' },
  { max: Infinity, level: 'critical' },
];

/**
 * Main function: compute risk score from reported issues.
 *
 * @param issues - Validated issues with verdict
 * @returns Risk score and level (only counts verdict === "report")
 */
export function computeRisk(issues: ValidatedIssue[]): RiskScoreResult {
  const reported = issues.filter((i) => i.verdict !== 'ignore');

  let riskScore = 0;
  for (const issue of reported) {
    const weight = SEVERITY_WEIGHTS[issue.severity] ?? 0;
    riskScore += weight;
  }

  // Round for readability
  riskScore = Math.round(riskScore * 10) / 10;

  let riskLevel: RiskLevel = 'low';
  for (const { max, level } of RISK_THRESHOLDS) {
    if (riskScore <= max) {
      riskLevel = level;
      break;
    }
  }

  return { riskScore, riskLevel };
}
