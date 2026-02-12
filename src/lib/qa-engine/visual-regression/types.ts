/**
 * Visual Regression Detector - Type definitions
 *
 * DOM-based comparison only (no external APIs).
 */

export type VisualChangeType = 'element_moved' | 'element_missing' | 'dimensions_changed' | 'elements_overlapping';

export type VisualSeverity = 'low' | 'medium' | 'high';

export interface ElementBounds {
  selector: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tagName?: string;
}

export interface DOMSnapshot {
  url: string;
  timestamp: number;
  elements: ElementBounds[];
}

export interface VisualDiff {
  selector: string;
  changeType: VisualChangeType;
  severity: VisualSeverity;
  description: string;
  previous?: ElementBounds;
  current?: ElementBounds;
}
