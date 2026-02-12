/**
 * Visual Regression Detector
 *
 * DOM-based comparison only (no external APIs).
 * Compare bounding boxes + layout positions across runs.
 * Detect: element moved, missing, dimensions changed, overlapping.
 */

import { extractSnapshotFromHTML, createSnapshot } from './snapshot';
import { compareSnapshots } from './comparator';
import type { DOMSnapshot, VisualDiff } from './types';

export type { DOMSnapshot, ElementBounds, VisualDiff, VisualChangeType, VisualSeverity } from './types';

export { extractSnapshotFromHTML, createSnapshot, compareSnapshots };

/** Run visual regression: compare current HTML with previous snapshot */
export function runVisualRegression(
  html: string,
  url: string,
  previousSnapshot?: DOMSnapshot
): { snapshot: DOMSnapshot; visualDiffs: VisualDiff[] } {
  const { elements } = extractSnapshotFromHTML(html, url);
  const snapshot = createSnapshot(url, elements);

  if (!previousSnapshot) {
    return { snapshot, visualDiffs: [] };
  }

  const visualDiffs = compareSnapshots(previousSnapshot, snapshot);
  return { snapshot, visualDiffs };
}
