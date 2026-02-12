/**
 * Visual Regression - DOM comparison
 *
 * Compare current snapshot with previous.
 * Detect: element moved, missing, dimensions changed, overlapping.
 * No external APIs - local comparison only.
 */

import type { DOMSnapshot, ElementBounds, VisualDiff } from './types';

const MOVE_THRESHOLD = 10;
const DIMENSION_THRESHOLD = 0.05;

function rectsOverlap(a: ElementBounds, b: ElementBounds): boolean {
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
}

/** Compare two snapshots and return visual diffs */
export function compareSnapshots(
  previous: DOMSnapshot,
  current: DOMSnapshot
): VisualDiff[] {
  const diffs: VisualDiff[] = [];
  const prevMap = new Map(previous.elements.map(e => [e.selector, e]));
  const currMap = new Map(current.elements.map(e => [e.selector, e]));

  for (const [selector, prev] of prevMap) {
    const curr = currMap.get(selector);
    if (!curr) {
      diffs.push({
        selector,
        changeType: 'element_missing',
        severity: 'high',
        description: `Element "${selector}" is no longer present in the DOM`,
        previous: prev,
      });
      continue;
    }

    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      diffs.push({
        selector,
        changeType: 'element_moved',
        severity: 'low',
        description: `Element "${selector}" moved from (${prev.x},${prev.y}) to (${curr.x},${curr.y})`,
        previous: prev,
        current: curr,
      });
    }

    const widthDiff = Math.abs(curr.width - prev.width) / (prev.width || 1);
    const heightDiff = Math.abs(curr.height - prev.height) / (prev.height || 1);
    if (widthDiff > DIMENSION_THRESHOLD || heightDiff > DIMENSION_THRESHOLD) {
      diffs.push({
        selector,
        changeType: 'dimensions_changed',
        severity: 'medium',
        description: `Element "${selector}" dimensions changed from ${prev.width}x${prev.height} to ${curr.width}x${curr.height}`,
        previous: prev,
        current: curr,
      });
    }
  }

  const currEls = Array.from(currMap.values());
  for (let i = 0; i < currEls.length; i++) {
    for (let j = i + 1; j < currEls.length; j++) {
      if (rectsOverlap(currEls[i]!, currEls[j]!)) {
        const sel = `${currEls[i]!.selector} vs ${currEls[j]!.selector}`;
        diffs.push({
          selector: sel,
          changeType: 'elements_overlapping',
          severity: 'medium',
          description: `Elements "${currEls[i]!.selector}" and "${currEls[j]!.selector}" overlap`,
          current: currEls[i],
        });
      }
    }
  }

  return diffs;
}
