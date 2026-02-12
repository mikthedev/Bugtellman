/**
 * Impact Classifier Module
 *
 * Classifies each issue by user impact:
 *   - blocking: prevents interaction or navigation
 *   - functional: breaks feature but UI visible
 *   - visual: UI misalignment
 *   - cosmetic: code-only or invisible issues
 *
 * Uses category, title, severity, and selector context.
 */

import type { ValidatedIssue } from './types';
import type { Impact } from './types';

/** Keywords that indicate blocking impact */
const BLOCKING_KEYWORDS = [
  '404',
  'page not found',
  'broken link',
  'failed to load',
  'could not load',
  'cannot load',
  ' prevents ',
  ' blocking ',
  'unreachable',
  'dead link',
];

/** Keywords that indicate functional impact */
const FUNCTIONAL_KEYWORDS = [
  'form',
  'submit',
  'button',
  'input',
  'click',
  'interaction',
  'label',
  'aria',
  'focus',
  'keyboard',
  'navigation',
];

/** Keywords that indicate visual impact */
const VISUAL_KEYWORDS = [
  'layout',
  'viewport',
  'responsive',
  'overflow',
  'alignment',
  'misalign',
  'z-index',
  'width',
  'height',
  'media query',
];

/** Keywords that indicate cosmetic (code-only) impact */
const COSMETIC_KEYWORDS = [
  'deprecated',
  'DOCTYPE',
  'lang attribute',
  'vendor prefix',
  '!important',
  'duplicate id',
  'empty rule',
  'invalid hex',
];

/**
 * Classify impact from issue metadata.
 */
function classifyImpact(issue: ValidatedIssue): Impact {
  const text = `${issue.title} ${issue.description} ${issue.category}`.toLowerCase();

  // Blocking: navigation/interaction prevented
  if (
    issue.category === 'Links' ||
    issue.category === 'Resources' ||
    BLOCKING_KEYWORDS.some((k) => text.includes(k))
  ) {
    if (
      issue.title.toLowerCase().includes('404') ||
      issue.title.toLowerCase().includes('broken') ||
      issue.title.toLowerCase().includes('unreachable')
    ) {
      return 'blocking';
    }
  }

  // Functional: feature broken
  if (
    issue.category === 'Accessibility' ||
    FUNCTIONAL_KEYWORDS.some((k) => text.includes(k))
  ) {
    // Form labels, buttons, inputs = functional
    if (
      issue.selector &&
      /^(button|input|form|a|select|textarea)/i.test(issue.selector)
    ) {
      return 'functional';
    }
    return 'functional';
  }

  // Visual: layout/display
  if (
    issue.category === 'Responsive Design' ||
    issue.category === 'CSS Layout' ||
    VISUAL_KEYWORDS.some((k) => text.includes(k))
  ) {
    return 'visual';
  }

  // Cosmetic: code quality, invisible
  if (
    issue.category === 'HTML Structure' ||
    issue.category === 'HTML Standards' ||
    issue.category === 'CSS Quality' ||
    issue.category === 'CSS Validity' ||
    COSMETIC_KEYWORDS.some((k) => text.includes(k))
  ) {
    return 'cosmetic';
  }

  // Default by severity
  if (issue.severity === 'urgent' || issue.severity === 'high')
    return 'functional';
  if (issue.severity === 'medium') return 'visual';
  return 'cosmetic';
}

/**
 * Main function: add impact classification to each issue.
 *
 * @param issues - Issues (may have confidence, occurrenceRate, etc.)
 * @returns Issues with impact field added
 */
export function addImpact(issues: ValidatedIssue[]): ValidatedIssue[] {
  return issues.map((issue) => ({
    ...issue,
    impact: classifyImpact(issue),
  }));
}
