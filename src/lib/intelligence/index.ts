/**
 * Decision Intelligence Layer
 *
 * Pipeline: detectors → intelligence engine → prioritizer → results
 *
 * Execution order:
 *   issues → intentAnalyzer → contextValidator → issueJudge → importanceRanker → resultOptimizer
 *
 * Reduces false positives, ranks like a human QA, filters harmless warnings.
 */

import type { Issue, EnrichedIssue, OptimizedResults } from './types';
import { runIntentAnalyzer } from './intentAnalyzer';
import { runContextValidator } from './contextValidator';
import { runIssueJudge } from './issueJudge';
import { runImportanceRanker } from './importanceRanker';
import { runResultOptimizer } from './resultOptimizer';

export type { Issue, EnrichedIssue, OptimizedResults, Verdict, Intent, ElementAttrs } from './types';
export { runIntentAnalyzer } from './intentAnalyzer';
export { runContextValidator } from './contextValidator';
export { runIssueJudge } from './issueJudge';
export { runImportanceRanker } from './importanceRanker';
export { runResultOptimizer } from './resultOptimizer';
export { qaIssueToIssue, enrichedIssueToQALike, optimizedToQAIssues, enrichIssuesWithElementAttrs } from './adapter';
export { runIntelligencePipeline, getReportedIssuesForUI } from './integration';
export type { IntelligencePipelineOptions } from './integration';

/**
 * Run the full intelligence pipeline.
 *
 * @param issues - Raw issues (canonical Issue shape)
 * @returns Optimized results: critical, warnings, ignored, stats
 */
export function runIntelligenceLayer(issues: Issue[]): OptimizedResults {
  if (issues.length === 0) {
    return {
      critical: [],
      warnings: [],
      ignored: [],
      stats: { total: 0, reported: 0, ignored: 0 },
    };
  }

  let pipeline: EnrichedIssue[] = runIntentAnalyzer(issues);
  pipeline = runContextValidator(pipeline);
  pipeline = runIssueJudge(pipeline);
  pipeline = runImportanceRanker(pipeline);
  return runResultOptimizer(pipeline);
}
