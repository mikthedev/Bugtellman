/**
 * Automated QA Testing - Unified entry point
 *
 * Orchestrates:
 * 1. User Journey Testing Engine
 * 2. State Testing Engine
 * 3. Visual Regression Detector
 * 4. Performance Behavior Detector
 * 5. Auth (Login/Register) deep check
 */

import { runUserJourneyTest } from '../user-journey';
import { runStateTests } from '../state-testing';
import { runVisualRegression } from '../visual-regression';
import { runPerformanceDetection } from '../performance';
import { runAuthCheck } from '../auth-check';

export interface AutomatedTestResult {
  userJourney: {
    flows: import('../user-journey').DetectedFlow[];
    results: import('../user-journey').FlowResult[];
  };
  stateTesting: import('../state-testing').StateTestResult[];
  visualRegression: {
    snapshot: import('../visual-regression').DOMSnapshot;
    visualDiffs: import('../visual-regression').VisualDiff[];
  };
  performance: {
    metrics: import('../performance').PerformanceMetric[];
  };
  /** Login/register discovery and deep checks (form structure, security, a11y) */
  authCheck: import('../auth-check').AuthCheckResult;
  /** Passed/total and failure counts for UI summary */
  summary: {
    userJourney: { passed: number; total: number; secondLevelPassed: number; secondLevelTotal: number };
    stateTesting: { passed: number; total: number; withFailures: number };
    visualRegression: { diffCount: number };
    performance: { slowCount: number; total: number; thresholdMs: number };
    authCheck: { found: boolean; issuesCount: number; highOrUrgentCount: number };
  };
}

export interface AutomatedTestOptions {
  maxFlows?: number;
  maxInputs?: number;
  previousSnapshot?: import('../visual-regression').DOMSnapshot;
  maxNavLinks?: number;
  includeContentLinks?: boolean;
  multiStep?: boolean;
  /** Consider nav/request slow above this ms for summary */
  slowThresholdMs?: number;
  /** Full page URL that was fetched (for auth check context); defaults to baseUrl */
  pageUrl?: string;
  /** Whether to fetch discovered auth pages for deep check; default true */
  authCheckFetchPages?: boolean;
}

/** Run all automated QA tests */
export async function runAutomatedTests(
  html: string,
  baseUrl: string,
  options?: AutomatedTestOptions
): Promise<AutomatedTestResult> {
  const opts = options ?? {};
  const pageUrl = opts.pageUrl ?? baseUrl;
  const [userJourney, stateTesting, visualRegression, performance, authCheck] = await Promise.all([
    runUserJourneyTest(html, baseUrl, opts.maxFlows ?? 25, {
      includeContentLinks: opts.includeContentLinks ?? true,
      multiStep: opts.multiStep ?? true,
      maxSecondLevelPerFlow: 2,
    }),
    runStateTests(html, baseUrl, opts.maxInputs ?? 8),
    Promise.resolve(runVisualRegression(html, baseUrl, opts.previousSnapshot)),
    runPerformanceDetection(html, baseUrl, { maxNavLinks: opts.maxNavLinks ?? 8 }),
    runAuthCheck(html, baseUrl, pageUrl, {
      fetchAuthPages: opts.authCheckFetchPages ?? true,
      maxAuthPagesToFetch: 5,
    }),
  ]);

  const ujResults = userJourney.results;
  const ujPassed = ujResults.filter(r => r.success).length;
  let secondLevelPassed = 0;
  let secondLevelTotal = 0;
  for (const r of ujResults) {
    if (r.secondLevel?.length) {
      for (const s of r.secondLevel) {
        secondLevelTotal++;
        if (s.success) secondLevelPassed++;
      }
    }
  }

  const stateTotal = stateTesting.length;
  const statePassed = stateTesting.filter(s => s.failures.length === 0).length;
  const stateWithFailures = stateTesting.filter(s => s.failures.length > 0).length;

  const slowThreshold = opts.slowThresholdMs ?? 3000;
  const perfTotal = performance.metrics.length;
  const slowCount = performance.metrics.filter(m => m.durationMs > slowThreshold).length;

  return {
    userJourney: { flows: userJourney.flows, results: userJourney.results },
    stateTesting,
    visualRegression: {
      snapshot: visualRegression.snapshot,
      visualDiffs: visualRegression.visualDiffs,
    },
    performance: { metrics: performance.metrics },
    authCheck,
    summary: {
      userJourney: {
        passed: ujPassed,
        total: ujResults.length,
        secondLevelPassed,
        secondLevelTotal,
      },
      stateTesting: { passed: statePassed, total: stateTotal, withFailures: stateWithFailures },
      visualRegression: { diffCount: visualRegression.visualDiffs.length },
      performance: { slowCount, total: perfTotal, thresholdMs: slowThreshold },
      authCheck: {
        found: authCheck.found,
        issuesCount: authCheck.summary.issuesCount,
        highOrUrgentCount: authCheck.summary.highOrUrgentCount,
      },
    },
  };
}
