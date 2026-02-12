/**
 * Confidence Score Module
 *
 * Calculates confidence for each issue:
 *   confidence = reproducibilityScore × signalStrength × detectorReliability
 *
 * All factors are 0-1. Higher confidence = more trust in the detection.
 * Senior QA engineers prefer high-confidence findings.
 */

import type { ValidatedIssue } from './types';

/** Maps category to detector reliability (0-1). Higher = more reliable detector. */
const DETECTOR_RELIABILITY: Record<string, number> = {
  Links: 0.95, // 404 checks are deterministic when network is stable
  Accessibility: 0.85, // HTML parsing is reliable
  'HTML Structure': 0.9,
  'HTML Standards': 0.9,
  'HTML Validity': 0.9,
  'Responsive Design': 0.55, // Viewport/media queries can be false positives (SPA-injected, per-file checks)
  Security: 0.9, // Mixed content detection is precise
  'CSS Quality': 0.75,
  'CSS Validity': 0.9,
  'CSS Layout': 0.8,
  'Browser Compatibility': 0.7,
  Resources: 0.85, // Failed fetch detection
};

/** Maps severity to signal strength. Urgent/high = stronger signal. */
const SEVERITY_SIGNAL: Record<string, number> = {
  urgent: 1.0,
  high: 0.9,
  medium: 0.75,
  low: 0.6,
  minor: 0.5,
};

/** Default detector reliability when category unknown */
const DEFAULT_RELIABILITY = 0.7;

/**
 * Compute signal strength from issue characteristics.
 * Stronger signals: has selector, has url, has code snippet, etc.
 */
function getSignalStrength(issue: ValidatedIssue): number {
  let strength = SEVERITY_SIGNAL[issue.severity] ?? 0.6;

  // Booster: concrete location evidence
  if (issue.selector) strength = Math.min(1, strength + 0.1);
  if (issue.url || issue.location) strength = Math.min(1, strength + 0.05);
  if (issue.snippet || issue.suggestedCode) strength = Math.min(1, strength + 0.05);
  if (issue.line != null) strength = Math.min(1, strength + 0.05);

  return strength;
}

/**
 * Get reproducibility score. Uses occurrenceRate if available, else 1.0 (assume stable).
 */
function getReproducibilityScore(issue: ValidatedIssue): number {
  if (issue.occurrenceRate != null) return issue.occurrenceRate;
  return 1.0;
}

/**
 * Main function: add confidence score to each issue.
 *
 * @param issues - Array of issues (may already have occurrenceRate from reproducibility)
 * @returns Issues with confidence field added (0-1)
 */
export function addConfidence(issues: ValidatedIssue[]): ValidatedIssue[] {
  return issues.map((issue) => {
    const reproducibilityScore = getReproducibilityScore(issue);
    const signalStrength = getSignalStrength(issue);
    const detectorReliability =
      DETECTOR_RELIABILITY[issue.category] ?? DEFAULT_RELIABILITY;

    const confidence = Math.min(
      1,
      Math.max(0, reproducibilityScore * signalStrength * detectorReliability)
    );

    return {
      ...issue,
      confidence: Math.round(confidence * 1000) / 1000,
    };
  });
}
