/**
 * Judgment Engine – turns behavior/logic outputs into reportable findings
 *
 * Final step: consolidate expectations, inconsistencies, and state rules into
 * a single list of behavioral, logical, and interaction findings with severity.
 * Pure and deterministic.
 */

import type {
  ExploredFlow,
  EdgeCase,
  StateRule,
  Expectation,
  Inconsistency,
  BehaviorFinding,
} from './types';

let findingId = 0;
function nextId(): string {
  return `behavior-${++findingId}`;
}

function severityFromInconsistency(inc: Inconsistency): BehaviorFinding['severity'] {
  if (inc.severity === 'high') return 'high';
  if (inc.severity === 'medium') return 'medium';
  return 'low';
}

/**
 * Convert inconsistencies into findings.
 */
function findingsFromInconsistencies(inconsistencies: Inconsistency[]): BehaviorFinding[] {
  return inconsistencies.map((inc) => ({
    id: nextId(),
    category: 'Logic' as const,
    severity: severityFromInconsistency(inc),
    title: inc.type.replace(/_/g, ' '),
    description: inc.description,
    selector: inc.selectors?.[0],
    source: 'inconsistency' as const,
  }));
}

/**
 * Convert unvalidated expectations into findings (potential behavioral bugs).
 */
function findingsFromExpectations(expectations: Expectation[]): BehaviorFinding[] {
  const findings: BehaviorFinding[] = [];
  for (const exp of expectations) {
    if (!exp.validated && exp.type === 'logic') {
      findings.push({
        id: nextId(),
        category: 'Behavioral',
        severity: 'medium',
        title: 'Unverified validation rule',
        description: exp.description,
        source: 'expectation',
      });
    }
    if (!exp.validated && exp.type === 'interaction') {
      findings.push({
        id: nextId(),
        category: 'Interaction',
        severity: 'low',
        title: 'Interaction to verify',
        description: exp.description,
        source: 'expectation',
      });
    }
  }
  return findings;
}

/**
 * Produce findings from state rules that imply risk (e.g. invalid state handling).
 */
function findingsFromStateRules(stateRules: StateRule[]): BehaviorFinding[] {
  const findings: BehaviorFinding[] = [];
  for (const rule of stateRules) {
    if (rule.expectedNext === 'error_or_blocked' || rule.expectedNext === 'invalid') {
      findings.push({
        id: nextId(),
        category: 'Behavioral',
        severity: 'medium',
        title: 'State transition to verify',
        description: `When ${rule.condition}, expect ${rule.expectedNext}. Manually test or automate.`,
        source: 'state',
      });
    }
  }
  return findings;
}

/**
 * Run the judgment engine: merge all behavior/logic outputs into a single finding list.
 */
export function judge(
  flows: ExploredFlow[],
  edgeCases: EdgeCase[],
  stateRules: StateRule[],
  expectations: Expectation[],
  inconsistencies: Inconsistency[]
): BehaviorFinding[] {
  findingId = 0;
  const fromInconsistencies = findingsFromInconsistencies(inconsistencies);
  const fromExpectations = findingsFromExpectations(expectations);
  const fromState = findingsFromStateRules(stateRules);

  const combined = [...fromInconsistencies, ...fromExpectations, ...fromState];

  const severityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return combined.sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );
}
