/**
 * Expectation Validator – produces and validates expectations from structure
 *
 * Derives expectations a human tester would have: e.g. "required field empty →
 * submit should be blocked", "link with href → navigates". Without runtime,
 * validated is set from structure consistency (e.g. form has action → expectation
 * "form submits somewhere" exists). Pure and deterministic.
 */

import type {
  BehaviorContext,
  ExploredFlow,
  StateRule,
  EdgeCase,
  Expectation,
} from './types';

let expectId = 0;
function nextId(): string {
  return `expect-${++expectId}`;
}

/**
 * Build expectations from flows, state rules, and edge cases.
 * validated: true when the expectation is structurally supported (e.g. form has action);
 * false when we cannot verify without runtime.
 */
export function validateExpectations(
  context: BehaviorContext,
  flows: ExploredFlow[],
  stateRules: StateRule[],
  edgeCases: EdgeCase[]
): Expectation[] {
  expectId = 0;
  const expectations: Expectation[] = [];

  for (const flow of flows) {
    if (flow.type === 'nav' && flow.href) {
      expectations.push({
        id: nextId(),
        description: `Link "${flow.label}" should navigate to ${flow.href}`,
        type: 'interaction',
        validated: !!flow.href,
        detail: 'Verify link is reachable and same-origin or CORS allows',
      });
    }

    if (flow.type === 'form') {
      const hasAction = !!flow.action;
      expectations.push({
        id: nextId(),
        description: `Form "${flow.label}" should submit to ${flow.action || 'current URL'}`,
        type: 'interaction',
        validated: hasAction,
        detail: flow.method === 'post' ? 'POST request' : 'GET with params',
      });

      const requiredInputs = flow.inputs?.filter((i) => i.required) ?? [];
      if (requiredInputs.length > 0) {
        expectations.push({
          id: nextId(),
          description: `Required fields (${requiredInputs.map((i) => i.name).join(', ')}) should block submit when empty`,
          type: 'logic',
          validated: false,
          detail: 'Requires runtime validation test',
        });
      }
    }

    const rulesForFlow = stateRules.filter((r) => r.flowId === flow.id);
    for (const rule of rulesForFlow) {
      if (rule.expectedNext === 'error_or_blocked' || rule.expectedNext === 'invalid') {
        expectations.push({
          id: nextId(),
          description: `When ${rule.condition}, expect ${rule.expectedNext}`,
          type: 'logic',
          validated: false,
          detail: rule.id,
        });
      }
    }
  }

  const a11yIssues = context.issues.filter(
    (i) => i.category === 'Accessibility' || i.category === 'HTML Structure'
  );
  if (a11yIssues.length > 0) {
    expectations.push({
      id: nextId(),
      description: `Page should meet accessibility expectations (${a11yIssues.length} potential issue(s) from scan)`,
      type: 'accessibility',
      validated: a11yIssues.length === 0,
      detail: `${a11yIssues.length} items to verify`,
    });
  }

  return expectations;
}
