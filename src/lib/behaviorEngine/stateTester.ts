/**
 * State Tester – derives expected state rules from flows and edge cases
 *
 * Builds a simple state model: e.g. "form with required empty → invalid state",
 * "after submit → success or error". Pure: no runtime; produces rules for validation.
 */

import type { ExploredFlow, EdgeCase, StateRule } from './types';

let ruleId = 0;
function nextId(): string {
  return `state-${++ruleId}`;
}

/**
 * For each form flow, derive state rules from its inputs and edge cases.
 */
export function deriveStateRules(flows: ExploredFlow[], edgeCases: EdgeCase[]): StateRule[] {
  ruleId = 0;
  const rules: StateRule[] = [];

  for (const flow of flows) {
    if (flow.type !== 'form') continue;

    const hasRequired = flow.inputs?.some((i) => i.required);
    const emptyCases = edgeCases.filter(
      (e) => e.flowId === flow.id && e.kind === 'empty'
    );

    if (hasRequired && emptyCases.length > 0) {
      rules.push({
        id: nextId(),
        flowId: flow.id,
        state: 'initial',
        expectedNext: 'invalid',
        condition: 'required field(s) empty',
      });
    }

    rules.push({
      id: nextId(),
      flowId: flow.id,
      state: 'valid_input',
      expectedNext: 'submitted',
      condition: 'all required filled, valid format',
    });

    const invalidCases = edgeCases.filter(
      (e) => e.flowId === flow.id && (e.kind === 'invalid' || e.kind === 'specialChars')
    );
    if (invalidCases.length > 0) {
      rules.push({
        id: nextId(),
        flowId: flow.id,
        state: 'invalid_input',
        expectedNext: 'error_or_blocked',
        condition: 'invalid or unsafe value',
      });
    }
  }

  return rules;
}
