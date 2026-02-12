/**
 * Edge Case Tester – generates edge cases for forms and inputs
 *
 * Produces test cases a human QA would try: empty, max length, invalid format,
 * boundary values, special characters. Pure and deterministic.
 */

import type { ExploredFlow, EdgeCase } from './types';

let caseId = 0;
function nextId(): string {
  return `edge-${++caseId}`;
}

function edgeCasesForInput(
  flowId: string,
  inputName: string,
  inputType: string,
  required?: boolean
): EdgeCase[] {
  const cases: EdgeCase[] = [];
  const type = inputType.toLowerCase();

  cases.push({
    id: nextId(),
    flowId,
    kind: 'empty',
    targetInput: inputName,
    value: '',
    description: `Empty value for ${inputName}${required ? ' (required)' : ''}`,
  });

  if (type === 'email' || type === 'text' || type === 'search') {
    cases.push({
      id: nextId(),
      flowId,
      kind: 'invalid',
      targetInput: inputName,
      value: 'not-an-email',
      description: `Invalid format for ${inputName}`,
    });
  }

  if (type === 'number' || type === 'range') {
    cases.push({
      id: nextId(),
      flowId,
      kind: 'boundary',
      targetInput: inputName,
      value: '0',
      description: `Boundary value for ${inputName}`,
    });
  }

  cases.push({
    id: nextId(),
    flowId,
    kind: 'specialChars',
    targetInput: inputName,
    value: '<script>alert(1)</script>',
    description: `Special characters in ${inputName}`,
  });

  return cases;
}

/**
 * Generate edge cases for all form flows and their inputs.
 */
export function generateEdgeCases(flows: ExploredFlow[]): EdgeCase[] {
  caseId = 0;
  const result: EdgeCase[] = [];

  for (const flow of flows) {
    if (flow.type !== 'form' || !flow.inputs?.length) continue;
    for (const input of flow.inputs) {
      result.push(
        ...edgeCasesForInput(flow.id, input.name, input.type, input.required)
      );
    }
  }

  return result;
}
