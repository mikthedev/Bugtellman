import type { QAIssue } from './types';

let issueId = 1000;
const genId = () => `issue-${++issueId}`;

export function analyzeCSS(css: string, filename?: string): QAIssue[] {
  const issues: QAIssue[] = [];

  // Parse CSS roughly - look for common issues
  const lines = css.split('\n');

  // Vendor prefix completeness
  const propChecks: Record<string, string[]> = {
    'user-select': ['-webkit-user-select', '-moz-user-select', '-ms-user-select'],
    'display': ['-webkit-box', '-ms-flexbox'],
    'flex': ['-webkit-box', '-ms-flexbox'],
  };

  // Check for !important overuse
  const importantCount = (css.match(/!important/g) || []).length;
  if (importantCount > 10) {
    issues.push({
      id: genId(),
      category: 'CSS Quality',
      severity: 'low',
      audience: 'technical',
      title: 'Excessive use of !important',
      description: `Found ${importantCount} uses of !important. Overuse can make CSS hard to maintain.`,
      location: filename,
      qaComment: `I counted ${importantCount} !important declarations. This usually means specificity wars — styles override each other in confusing ways. Future changes will be harder to maintain.`,
      whyFlagged: `The CSS parser found ${importantCount} instances of !important. High counts typically indicate specificity conflicts where developers kept adding !important to override previous rules. This makes the cascade unpredictable and maintenance difficult.`,
      fix: 'Refactor with clearer selectors. Use BEM or a naming convention. Reserve !important only for utility overrides (e.g. .hidden { display: none !important; }).',
      suggestedCode: `/* Instead of specificity wars: */
.button { color: red !important; }
.header .button { color: blue !important; }

/* Use clear specificity or utilities: */
.btn-primary { color: blue; }
.btn--urgent { color: red; }`,
    });
  }

  // Empty rules
  const emptyRuleRegex = /[^{}]+\{\s*\}/g;
  let match;
  while ((match = emptyRuleRegex.exec(css)) !== null) {
    issues.push({
      id: genId(),
      category: 'CSS Quality',
      severity: 'minor',
      audience: 'technical',
      title: 'Empty CSS rule',
      description: 'CSS rule has no declarations.',
      snippet: match[0].slice(0, 80) + '...',
      location: filename,
      qaComment: 'I found a CSS rule with no properties inside. It does nothing and adds unnecessary file size.',
      whyFlagged: 'The parser matched rules with empty declaration blocks (selectors followed by {} with nothing inside). These add bytes to the file and serve no purpose.',
      fix: 'Delete the empty rule, or add the intended CSS properties. Run a minifier to strip these in production.',
      suggestedCode: `/* Remove this: */
.some-selector { }

/* Or add properties: */
.some-selector { margin: 0; padding: 0; }`,
    });
  }

  // Z-index values (potential stacking issues)
  const zIndexMatches = css.match(/z-index:\s*(-?\d+)/g);
  if (zIndexMatches) {
    const values = zIndexMatches.map(m => parseInt(m.replace('z-index:', '').trim()));
    const maxZ = Math.max(...values);
    if (maxZ > 9999) {
      issues.push({
        id: genId(),
        category: 'CSS Layout',
        severity: 'low',
        audience: 'technical',
        title: 'Very high z-index value',
        description: `Z-index of ${maxZ} may indicate stacking context issues.`,
        location: filename,
        qaComment: `Z-index of ${maxZ} is unusually high. Usually this means layers were stacked on top of each other instead of using proper stacking contexts. Modals and dropdowns can get buried.`,
        whyFlagged: `The parser found z-index values up to ${maxZ}. Values above 9999 often indicate stacking-context wars where developers kept raising z-index to win. This makes layering unpredictable.`,
        fix: 'Use a small scale (e.g. 1–10 for content, 100 for modals, 1000 for tooltips). Create stacking contexts with isolation: isolate where needed.',
        suggestedCode: `/* Semantic z-index scale */
.modal { z-index: 100; }
.tooltip { z-index: 1000; }
/* For nested stacking: */
.modal { isolation: isolate; z-index: 100; }`,
      });
    }
  }

  // @media without proper structure
  const mediaCount = (css.match(/@media/g) || []).length;
  if (mediaCount === 0 && css.length > 1500) {
    issues.push({
      id: genId(),
      category: 'Responsive Design',
      severity: 'medium',
      audience: 'manual',
      title: 'No media queries in this CSS file',
      description: 'This file has no @media rules. If it is the main or only stylesheet, layout may not adapt to small screens — verify on a real device or in DevTools device mode.',
      location: filename,
      qaComment: 'This stylesheet has no responsive breakpoints. I didn’t render the page on phone dimensions — other stylesheets or inline styles might still provide mobile layout. Verify on a real device to confirm whether the phone layout is actually wrong.',
      whyFlagged: 'The parser found no @media rules in this CSS file (over 1500 chars). If other stylesheets also have no breakpoints, the layout may not adapt. Actual viewport dimensions were not measured.',
      fix: 'Add breakpoints for common widths. Use flex-wrap, max-width, and relative units (%, rem) to make layouts fluid.',
      suggestedCode: `/* Mobile-first breakpoints */
@media (max-width: 768px) {
  .container { padding: 1rem; }
  .grid { flex-direction: column; }
}
@media (min-width: 1024px) {
  .container { max-width: 1200px; } }`,
    });
  }

  // Fixed widths that might cause overflow
  const fixedWidthRegex = /width:\s*(\d+)px/g;
  let widthMatch;
  while ((widthMatch = fixedWidthRegex.exec(css)) !== null) {
    const width = parseInt(widthMatch[1]!);
    if (width > 1200) {
      issues.push({
        id: genId(),
        category: 'Responsive Design',
        severity: 'low',
        audience: 'manual',
        title: 'Fixed width may cause horizontal scroll on narrow viewports',
        description: `Fixed width of ${width}px may overflow on viewports narrower than this — verify on a real device or in DevTools device mode.`,
        location: filename,
        qaComment: `This file sets a fixed width of ${width}px. On narrow viewports (e.g. phones) that can cause horizontal scroll if the element isn't overridden elsewhere. I didn't measure actual phone dimensions — verify on a device to confirm.`,
        fix: 'Use max-width instead of width, or width: 100% with max-width. Prefer rem or % for fluid layouts.',
      });
    }
  }

  // Invalid hex colors
  const invalidHex = css.match(/#[0-9a-fA-F]{1,2}(?![0-9a-fA-F])/g);
  if (invalidHex) {
    invalidHex.forEach(hex => {
      issues.push({
        id: genId(),
        category: 'CSS Validity',
        severity: 'medium',
        audience: 'technical',
        title: 'Invalid hex color',
        description: `"${hex}" is not a valid hex color (need 3 or 6 digits).`,
        location: filename,
        qaComment: `The color "${hex}" is invalid — hex needs 3 or 6 digits. Some browsers might ignore it or render unexpectedly.`,
        fix: 'Use #RGB (e.g. #f00) or #RRGGBB (e.g. #ff0000). Or use rgb() / hsl() if you prefer.',
      });
    });
  }

  // Browser compatibility - webkit
  const webkitProps = ['-webkit-backface-visibility', '-webkit-transform', '-webkit-transition'];
  const hasTransform = /transform:|rotate|scale|translate/.test(css);
  if (hasTransform && !webkitProps.some(p => css.includes(p)) && css.includes('transform')) {
    issues.push({
      id: genId(),
      category: 'Browser Compatibility',
      severity: 'low',
      audience: 'technical',
      title: 'Consider adding -webkit- prefix for transforms',
      description: 'Older WebKit browsers may need -webkit-transform for transforms.',
      location: filename,
      qaComment: 'Transforms are used but without -webkit- prefix. Older Safari and some mobile browsers might not render animations correctly.',
      fix: 'Add -webkit-transform alongside transform: property; -webkit-transform: property; transform: property;',
    });
  }

  // !important in keyframes (bad practice)
  if (/@keyframes[\s\S]*!important/.test(css)) {
    issues.push({
      id: genId(),
      category: 'CSS Quality',
      severity: 'low',
      audience: 'technical',
      title: '!important in @keyframes',
      description: '!important in keyframes is invalid and ignored by browsers.',
      location: filename,
      qaComment: '!important inside @keyframes doesn’t work — browsers ignore it. The animation might not behave as expected.',
      fix: 'Remove !important from all keyframe declarations. Adjust keyframe values or animation timing instead.',
    });
  }

  // Duplicate selectors (simplified check)
  const selectorRegex = /([^{]+)\{/g;
  const selectors: string[] = [];
  let selMatch;
  while ((selMatch = selectorRegex.exec(css)) !== null) {
    selectors.push(selMatch[1].trim());
  }
  const selectorCounts: Record<string, number> = {};
  selectors.forEach(s => { selectorCounts[s] = (selectorCounts[s] || 0) + 1; });
  const duplicates = Object.entries(selectorCounts).filter(([, c]) => c > 3);
  if (duplicates.length > 0) {
    issues.push({
      id: genId(),
      category: 'CSS Quality',
      severity: 'minor',
      audience: 'technical',
      title: 'Repeated selector declarations',
      description: `Some selectors appear many times. Consider consolidating.`,
      location: filename,
      qaComment: 'The same selectors are repeated multiple times. This bloats the CSS and makes it harder to change styles in one place.',
      whyFlagged: 'The parser found the same selector repeated many times across the file. Multiple blocks for the same selector increase file size and make maintenance harder when you need to change one rule.',
      fix: 'Merge duplicate selector blocks into a single block with all declarations.',
      suggestedCode: `/* Instead of: */
.btn { color: red; }
.btn { padding: 8px; }
.btn { border-radius: 4px; }

/* Use: */
.btn {
  color: red;
  padding: 8px;
  border-radius: 4px;
}`,
    });
  }

  return issues;
}
