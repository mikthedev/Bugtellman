/**
 * Inconsistency Detector – finds behavioral and logical contradictions
 *
 * Detects mismatches a human QA would notice: button label vs form method,
 * duplicate href with different labels, conflicting states. Pure and deterministic.
 */

import type { BehaviorContext, ExploredFlow, Inconsistency, PageStructure } from './types';

let incId = 0;
function nextId(): string {
  return `inc-${++incId}`;
}

/**
 * Find inconsistencies in structure and explored flows.
 */
export function detectInconsistencies(
  context: BehaviorContext,
  flows: ExploredFlow[]
): Inconsistency[] {
  incId = 0;
  const inconsistencies: Inconsistency[] = [];

  const structure = context.structure;

  if (structure) {
    const hrefToText = new Map<string, string[]>();
    for (const link of structure.links) {
      if (!link.href) continue;
      const list = hrefToText.get(link.href) ?? [];
      list.push(link.text || '(no text)');
      hrefToText.set(link.href, list);
    }
    for (const [href, texts] of hrefToText) {
      const unique = [...new Set(texts)];
      if (unique.length > 1) {
        inconsistencies.push({
          id: nextId(),
          type: 'duplicate_href_different_label',
          description: `Same link target "${href}" has different visible text: ${unique.join(' vs ')}. May confuse users or screen readers.`,
          severity: 'medium',
        });
      }
    }

    for (const form of structure.forms) {
      const submitButtons = structure.buttons.filter(
        (b) => b.type === 'submit' || b.type === 'button'
      );
      if (form.method === 'get' && submitButtons.some((b) => b.text.toLowerCase().includes('submit'))) {
        inconsistencies.push({
          id: nextId(),
          type: 'form_method_vs_label',
          description: `Form uses method GET but has a submit-style button. GET submits via URL params; consider POST for sensitive data.`,
          severity: 'low',
          selectors: [form.selector].filter(Boolean) as string[],
        });
      }
    }
  }

  for (const flow of flows) {
    if (flow.type === 'form' && flow.action && flow.method === 'get') {
      const hasPassword = flow.inputs?.some(
        (i) => i.type.toLowerCase() === 'password'
      );
      if (hasPassword) {
        inconsistencies.push({
          id: nextId(),
          type: 'password_in_get',
          description: 'Form contains password field but uses method GET. Passwords would appear in URL and history.',
          severity: 'high',
          selectors: flow.selector ? [flow.selector] : undefined,
        });
      }
    }
  }

  const linkIssues = context.issues.filter(
    (i) => i.category === 'Links' && (i.title?.includes('404') || i.title?.includes('Broken'))
  );
  if (linkIssues.length > 0) {
    inconsistencies.push({
      id: nextId(),
      type: 'broken_links_present',
      description: `${linkIssues.length} link(s) reported as broken or unreachable. Users may hit dead ends.`,
      severity: 'high',
    });
  }

  return inconsistencies;
}
