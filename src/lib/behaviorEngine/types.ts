/**
 * Human-Behavior Testing Layer – shared types
 *
 * Pipeline: scanner → detectors → behavior engine → logic engine → judgment engine → results
 * All modules consume BehaviorContext and produce deterministic, testable outputs.
 */

import type { QAIssue } from '@/lib/qa-engine/types';

/** Minimal page structure derived from scan (links, forms, inputs). Used by explorer and logic. */
export interface PageStructure {
  links: { href: string; text: string; selector?: string }[];
  forms: {
    action: string;
    method: string;
    selector?: string;
    inputs: { name: string; type: string; required?: boolean }[];
  }[];
  buttons: { text: string; type: string; selector?: string }[];
}

/** Input context for the behavior engine: detector output + optional structure. */
export interface BehaviorContext {
  issues: QAIssue[];
  structure?: PageStructure;
  baseUrl?: string;
}

/** A user flow or interaction point discovered by the explorer. */
export interface ExploredFlow {
  id: string;
  type: 'nav' | 'form' | 'interaction';
  label: string;
  selector?: string;
  href?: string;
  action?: string;
  method?: string;
  inputs?: { name: string; type: string; required?: boolean }[];
}

/** An edge case to test (empty, max length, invalid format, etc.). */
export interface EdgeCase {
  id: string;
  flowId: string;
  kind: 'empty' | 'maxLength' | 'invalid' | 'boundary' | 'specialChars';
  targetInput?: string;
  value?: string;
  description: string;
}

/** Expected state or state transition (for state model). */
export interface StateRule {
  id: string;
  flowId: string;
  state: string;
  expectedNext?: string;
  condition?: string;
}

/** An expectation to validate (e.g. "required field empty → submit blocked"). */
export interface Expectation {
  id: string;
  description: string;
  type: 'accessibility' | 'interaction' | 'logic';
  validated: boolean;
  detail?: string;
}

/** A logical or behavioral inconsistency (e.g. label vs action mismatch). */
export interface Inconsistency {
  id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  selectors?: string[];
}

/** Final behavioral/logical finding; can be converted to QAIssue for results. */
export interface BehaviorFinding {
  id: string;
  category: 'Behavioral' | 'Logic' | 'Interaction';
  severity: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  selector?: string;
  url?: string;
  source: 'explorer' | 'edgeCase' | 'state' | 'expectation' | 'inconsistency';
}
