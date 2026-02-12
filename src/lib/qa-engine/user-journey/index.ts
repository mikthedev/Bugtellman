/**
 * User Journey Testing Engine
 *
 * Detects primary CTAs, nav links, forms, primary nav, and optional content links.
 * Runs flows with optional multi-step (test inner links from reached pages).
 */

import { detectFlows } from './detector';
import { runFlows } from './runner';

export type { DetectedFlow, FlowResult, FlowStepResult, SecondLevelCheck } from './types';

export { detectFlows, runFlows };

export interface UserJourneyOptions {
  maxFlows?: number;
  includeContentLinks?: boolean;
  maxContentLinks?: number;
  multiStep?: boolean;
  maxSecondLevelPerFlow?: number;
}

/** Run full user journey test: detect + run */
export async function runUserJourneyTest(
  html: string,
  baseUrl: string,
  maxFlows = 25,
  options?: UserJourneyOptions
) {
  const opts = options ?? {};
  const flows = detectFlows(html, baseUrl, {
    includePrimaryNav: true,
    includeContentLinks: opts.includeContentLinks ?? true,
    maxContentLinks: opts.maxContentLinks ?? 15,
  });
  const results = await runFlows(html, baseUrl, flows, maxFlows, {
    multiStep: opts.multiStep ?? true,
    maxSecondLevelPerFlow: opts.maxSecondLevelPerFlow ?? 2,
  });
  return { flows, results };
}
