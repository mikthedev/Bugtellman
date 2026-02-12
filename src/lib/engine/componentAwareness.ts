/**
 * Component Awareness Rules Module
 *
 * Adjusts severity based on element importance:
 *   - critical (button, input, form, link): ×1.5 → bump up
 *   - medium (text, container): ×1 → no change
 *   - low (svg, icon, decorative div): ×0.5 → downgrade
 *
 * Uses selector, category, and title to infer element type.
 */

import type { ValidatedIssue } from './types';
import type { Severity } from '@/lib/qa-engine/types';

const SEVERITY_ORDER: Severity[] = ['minor', 'low', 'medium', 'high', 'urgent'];

/** Critical elements: user interaction points */
const CRITICAL_SELECTORS = ['button', 'input', 'form', 'a', 'link', 'select', 'textarea'];

/** Low importance: decorative */
const LOW_SELECTORS = ['svg', 'icon', 'div', 'span', 'img'];

/** Medium: text, containers */
const MEDIUM_KEYWORDS = ['text', 'container', 'heading', 'h1', 'h2', 'h3', 'p'];

function getElementImportance(issue: ValidatedIssue): 'critical' | 'medium' | 'low' {
  const selector = (issue.selector ?? '').toLowerCase();
  const title = (issue.title ?? '').toLowerCase();
  const category = (issue.category ?? '').toLowerCase();

  // Check selector first
  if (selector) {
    for (const tag of CRITICAL_SELECTORS) {
      if (selector.startsWith(tag) || selector.includes(`.${tag}`) || selector.includes(`#${tag}`)) {
        return 'critical';
      }
    }
    for (const tag of LOW_SELECTORS) {
      if (selector.startsWith('svg') || selector.includes('icon')) return 'low';
      if (selector.startsWith('div') && (selector.includes('decorative') || selector.includes('decoration'))) {
        return 'low';
      }
    }
  }

  // Category hints
  if (category.includes('link') || category.includes('accessibility') && title.includes('button')) {
    return 'critical';
  }
  if (category.includes('form') || title.includes('input') || title.includes('submit')) {
    return 'critical';
  }

  for (const kw of MEDIUM_KEYWORDS) {
    if (title.includes(kw) || selector.includes(kw)) return 'medium';
  }

  // Page-level / structural issues: medium
  if (!selector && !issue.url) return 'medium';

  return 'low';
}

function bumpSeverity(severity: Severity): Severity {
  const idx = SEVERITY_ORDER.indexOf(severity);
  if (idx < 0 || idx >= SEVERITY_ORDER.length - 1) return severity;
  return SEVERITY_ORDER[idx + 1]!;
}

function downgradeSeverity(severity: Severity): Severity {
  const idx = SEVERITY_ORDER.indexOf(severity);
  if (idx <= 0) return severity;
  return SEVERITY_ORDER[idx - 1]!;
}

/**
 * Main function: apply component awareness multiplier to severity.
 *
 * @param issues - Validated issues
 * @returns Issues with severity adjusted by element importance
 */
export function applyComponentAwareness(issues: ValidatedIssue[]): ValidatedIssue[] {
  return issues.map((issue) => {
    const importance = getElementImportance(issue);

    if (importance === 'critical') {
      return { ...issue, severity: bumpSeverity(issue.severity) };
    }
    if (importance === 'low') {
      return { ...issue, severity: downgradeSeverity(issue.severity) };
    }
    return issue;
  });
}
