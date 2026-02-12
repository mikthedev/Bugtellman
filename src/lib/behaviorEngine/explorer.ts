/**
 * Explorer – discovers user flows and interaction points
 *
 * Simulates "what would a real user do?" by enumerating navigation, forms,
 * and interactive elements from the page structure. Pure and deterministic.
 */

import type { QAIssue } from '@/lib/qa-engine/types';
import type { BehaviorContext, ExploredFlow, PageStructure } from './types';

let flowId = 0;
function nextId(): string {
  return `flow-${++flowId}`;
}

function exploreFromStructure(structure: PageStructure): ExploredFlow[] {
  const flows: ExploredFlow[] = [];

  for (const link of structure.links) {
    if (link.href && !link.href.startsWith('#') && !link.href.startsWith('mailto:')) {
      flows.push({
        id: nextId(),
        type: 'nav',
        label: link.text || link.href,
        href: link.href,
        selector: link.selector,
      });
    }
  }

  for (let i = 0; i < structure.forms.length; i++) {
    const form = structure.forms[i]!;
    flows.push({
      id: nextId(),
      type: 'form',
      label: form.action || `Form ${i + 1}`,
      action: form.action,
      method: form.method || 'get',
      inputs: form.inputs,
      selector: form.selector,
    });
  }

  for (const btn of structure.buttons) {
    flows.push({
      id: nextId(),
      type: 'interaction',
      label: btn.text || 'Button',
      selector: btn.selector,
    });
  }

  return flows;
}

/** Derive minimal flows from detector issues when structure is missing (e.g. link issues). */
function exploreFromIssues(issues: QAIssue[]): ExploredFlow[] {
  const flows: ExploredFlow[] = [];
  const seen = new Set<string>();
  for (const issue of issues) {
    if (issue.url && issue.category === 'Links' && !seen.has(issue.url)) {
      seen.add(issue.url);
      flows.push({
        id: nextId(),
        type: 'nav',
        label: issue.title || issue.url,
        href: issue.url,
        selector: issue.selector,
      });
    }
  }
  return flows;
}

/**
 * Explore all user-facing flows from context.
 * Uses structure when available; otherwise falls back to issues.
 */
export function explore(context: BehaviorContext): ExploredFlow[] {
  flowId = 0;
  if (context.structure && (context.structure.links.length > 0 || context.structure.forms.length > 0)) {
    return exploreFromStructure(context.structure);
  }
  return exploreFromIssues(context.issues);
}
