/**
 * State Testing Engine - Type definitions
 */

import type { QAIssue } from '../types';

export type InputState = 'empty' | 'invalid' | 'boundary' | 'valid';

export interface FormInput {
  name: string;
  type: string;
  selector: string;
  required?: boolean;
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
}

export interface StateTestResult {
  inputName: string;
  state: InputState;
  value: string;
  submitted: boolean;
  success: boolean;
  statusCode?: number;
  validationFailed?: boolean;
  error?: string;
  failures: QAIssue[];
}
