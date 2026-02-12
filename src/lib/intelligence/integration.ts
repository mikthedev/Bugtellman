/**
 * Integration: plug intelligence layer into existing Bugtellman pipeline
 *
 * Usage:
 *   1. Run detectors as usual (analyze-url, analyze-files) → get issues
 *   2. Optionally fetch HTML for the analyzed URL (for element attrs)
 *   3. runIntelligencePipeline(issues, { html }) → optimized results
 *   4. Use optimizedToQAIssues(optimized) for ResultsPanel, or use optimized.critical/warnings directly
 *
 * Does not replace or break existing engine; runs as an additional layer.
 */

import type { QAIssue } from '@/lib/qa-engine/types';
import type { OptimizedResults } from './types';
import { qaIssueToIssue, enrichIssuesWithElementAttrs, optimizedToQAIssues } from './adapter';
import { runIntentAnalyzer } from './intentAnalyzer';
import { runContextValidator } from './contextValidator';
import { runIssueJudge } from './issueJudge';
import { runImportanceRanker } from './importanceRanker';
import { runResultOptimizer } from './resultOptimizer';

export interface IntelligencePipelineOptions {
  /** Optional HTML of the analyzed page; used to enrich elementAttrs for intent (aria-hidden, role, etc.) */
  html?: string;
}

/**
 * Run the full intelligence pipeline on raw QAIssue[] from detectors.
 *
 * 1. Convert QAIssue → Issue
 * 2. Optionally enrich with elementAttrs from HTML
 * 3. Run intentAnalyzer → contextValidator → issueJudge → importanceRanker → resultOptimizer
 * 4. Return OptimizedResults (critical, warnings, ignored, stats)
 */
export async function runIntelligencePipeline(
  qaIssues: QAIssue[],
  options?: IntelligencePipelineOptions
): Promise<OptimizedResults> {
  let issues = qaIssues.map(qaIssueToIssue);

  if (options?.html) {
    issues = await enrichIssuesWithElementAttrs(issues, options.html);
  }

  const pipeline = runResultOptimizer(
    runImportanceRanker(
      runIssueJudge(
        runContextValidator(runIntentAnalyzer(issues))
      )
    )
  );
  return pipeline;
}

/**
 * Get a flat list of QAIssue-like issues for the existing ResultsPanel,
 * with verdict and reasoning attached. Only reported issues (critical + warnings).
 */
export function getReportedIssuesForUI(optimized: OptimizedResults): (QAIssue & { verdict?: string; reasoning?: string; importanceScore?: number })[] {
  return optimizedToQAIssues(optimized);
}
