/**
 * User Journey Testing Engine - Type definitions
 */

import type { QAIssue } from '../types';

/** CTA or interactive element detected */
export interface DetectedFlow {
  type: 'cta' | 'nav' | 'form';
  selector: string;
  text?: string;
  href?: string;
  action?: string;
  method?: string;
  label?: string;
}

/** Result of running a single flow step */
export interface FlowStepResult {
  url: string;
  selector: string;
  action: 'click' | 'submit' | 'navigate';
  success: boolean;
  statusCode?: number;
  error?: string;
  durationMs?: number;
}

/** Second-level check: we followed a link and tested inner page */
export interface SecondLevelCheck {
  fromUrl: string;
  testedUrl: string;
  success: boolean;
  statusCode?: number;
  durationMs?: number;
  failures: QAIssue[];
}

/** Completed flow with path and failures */
export interface FlowResult {
  path: string[];
  success: boolean;
  failures: QAIssue[];
  steps: FlowStepResult[];
  durationMs?: number;
  /** When multi-step: results of following 1–2 links from the reached page */
  secondLevel?: SecondLevelCheck[];
}
