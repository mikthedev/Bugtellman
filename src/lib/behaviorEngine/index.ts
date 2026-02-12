/**
 * Human-Behavior Testing Layer
 *
 * Pipeline: scanner → detectors → behavior engine → logic engine → judgment engine → results
 *
 * Behavior engine: explorer, edgeCaseTester, stateTester
 * Logic engine: expectationValidator, inconsistencyDetector
 * Judgment engine: judge → BehaviorFinding[]
 */

import type {
  BehaviorContext,
  BehaviorFinding,
  ExploredFlow,
  EdgeCase,
  StateRule,
  Expectation,
  Inconsistency,
  PageStructure,
} from './types';
import { explore } from './explorer';
import { generateEdgeCases } from './edgeCaseTester';
import { deriveStateRules } from './stateTester';
import { validateExpectations } from './expectationValidator';
import { detectInconsistencies } from './inconsistencyDetector';
import { judge } from './judgmentEngine';

export type {
  BehaviorContext,
  BehaviorFinding,
  ExploredFlow,
  EdgeCase,
  StateRule,
  Expectation,
  Inconsistency,
  PageStructure,
};
export { explore } from './explorer';
export { generateEdgeCases } from './edgeCaseTester';
export { deriveStateRules } from './stateTester';
export { validateExpectations } from './expectationValidator';
export { detectInconsistencies } from './inconsistencyDetector';
export { judge } from './judgmentEngine';
export { buildStructureFromHTML } from './structureBuilder';
export { behaviorFindingToQAIssue, behaviorFindingsToQAIssues } from './adapter';

/** Result of the full behavior pipeline (for callers that need intermediate data). */
export interface BehaviorPipelineResult {
  flows: ExploredFlow[];
  edgeCases: EdgeCase[];
  stateRules: StateRule[];
  expectations: Expectation[];
  inconsistencies: Inconsistency[];
  findings: BehaviorFinding[];
}

/**
 * Run the full pipeline: behavior engine → logic engine → judgment engine.
 *
 * @param context - Detector issues + optional page structure
 * @returns Findings (and intermediate results if needed)
 */
export function runBehaviorPipeline(context: BehaviorContext): BehaviorPipelineResult {
  const flows = explore(context);
  const edgeCases = generateEdgeCases(flows);
  const stateRules = deriveStateRules(flows, edgeCases);
  const expectations = validateExpectations(context, flows, stateRules, edgeCases);
  const inconsistencies = detectInconsistencies(context, flows);
  const findings = judge(flows, edgeCases, stateRules, expectations, inconsistencies);

  return {
    flows,
    edgeCases,
    stateRules,
    expectations,
    inconsistencies,
    findings,
  };
}
