/**
 * State Testing Engine
 *
 * For each form input: empty, invalid, boundary, valid.
 * Submit and log validation failures or crashes.
 */

import { runStateTests } from './runner';

export type { FormInput, StateTestResult, InputState } from './types';
export { getTestValues } from './values';
export { runStateTests };
