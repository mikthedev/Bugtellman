/**
 * Auth Check - Input validation testing
 *
 * Submits login/register forms with invalid input per field type (e.g. numbers
 * in email, letters in phone, empty required, too-short password) and detects
 * when the form or server accepts them instead of showing validation errors.
 */

import * as cheerio from 'cheerio';
import type { QAIssue } from '../types';
import type { AuthDiscovery } from './types';
import { createAuthCheckIssue } from './checker';

const SUBMIT_TIMEOUT_MS = 10000;
const MAX_VALIDATION_TESTS_PER_FORM = 6;

/** Sensible default values for "other" fields when testing one field's validation */
const VALID_DUMMY = {
  email: 'test@example.com',
  username: 'validuser',
  phone: '5551234567',
  password: 'ValidPassword123!',
  text: 'Valid input',
};

/** Input classification from type/name */
type FieldKind = 'email' | 'phone' | 'password' | 'username' | 'text';

function classifyInput($el: cheerio.Cheerio<cheerio.AnyNode>): FieldKind {
  const type = ($el.attr('type') || 'text').toLowerCase();
  const name = ($el.attr('name') || '').toLowerCase();
  if (type === 'email') return 'email';
  if (type === 'tel' || /phone|tel|mobile|cell/i.test(name)) return 'phone';
  if (type === 'password') return 'password';
  if ((/username|login/i.test(name) || name === 'user') && type === 'text') return 'username';
  if (/email|account/i.test(name) && type !== 'password') return 'email';
  return 'text';
}

export interface ValidationTestCase {
  /** Field name (input name attribute) */
  fieldName: string;
  /** Human-readable field label for reports */
  fieldLabel: string;
  /** Invalid value we're sending */
  invalidValue: string;
  /** Short description for the issue */
  description: string;
  /** Field kind */
  kind: FieldKind;
}

/** Phrases that indicate the server/form showed a validation error (good) */
const VALIDATION_ERROR_PHRASES = [
  'invalid', 'error', 'required', 'enter a valid', 'valid email', 'valid phone',
  'must be', 'at least', 'characters', 'incorrect format', 'wrong format',
  'please enter', 'field is required', 'is required', 'cannot be empty',
  'wrong password', 'incorrect', 'try again', '401', '403', 'failed',
  'not valid', 'invalid email', 'invalid phone', 'numbers only', 'letters',
];

/** Phrases that indicate success (bad when we sent invalid input) */
const SUCCESS_PHRASES = [
  'log out', 'logout', 'sign out', 'signout', 'welcome', 'dashboard',
  'my account', 'signed in', 'you are logged in', 'profile', 'member area',
  'success', 'thank you', 'registered', 'account created', 'check your email',
];

function responseShowsValidationError(bodyLower: string, maxLen = 6000): boolean {
  const slice = bodyLower.slice(0, maxLen);
  return VALIDATION_ERROR_PHRASES.some(p => slice.includes(p));
}

function responseShowsSuccess(bodyLower: string, maxLen = 8000): string {
  const slice = bodyLower.slice(0, maxLen);
  for (const p of SUCCESS_PHRASES) {
    if (slice.includes(p)) return p;
  }
  return '';
}

function normalizePath(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return url;
  }
}

/**
 * Build test cases for this form: one invalid value per relevant field type.
 */
export function getValidationTestCases(
  $: cheerio.CheerioAPI,
  formSelector: string
): ValidationTestCase[] {
  const cases: ValidationTestCase[] = [];
  const seen = new Set<string>();

  const $form = $(formSelector).first();
  if ($form.length === 0) return [];

  $form.find('input, textarea').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name');
    if (!name) return;
    const type = ($el.attr('type') || 'text').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'hidden') return;

    const kind = classifyInput($el);
    const id = $el.attr('id');
    const label = id ? $(`label[for="${id}"]`).first().text().trim() : '';
    const fieldLabel = label || name || kind;

    const key = `${name}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);

    if (kind === 'email') {
      cases.push({
        fieldName: name,
        fieldLabel,
        invalidValue: '123',
        description: 'numbers only (no @, invalid email format)',
        kind: 'email',
      });
    } else if (kind === 'phone') {
      cases.push({
        fieldName: name,
        fieldLabel,
        invalidValue: 'abc',
        description: 'letters instead of numbers',
        kind: 'phone',
      });
    } else if (kind === 'password') {
      cases.push({
        fieldName: name,
        fieldLabel,
        invalidValue: '1',
        description: 'single character (too short)',
        kind: 'password',
      });
    } else if (kind === 'username' || kind === 'text') {
      cases.push({
        fieldName: name,
        fieldLabel,
        invalidValue: '',
        description: 'empty value',
        kind: kind,
      });
    }
  });

  return cases.slice(0, MAX_VALIDATION_TESTS_PER_FORM);
}

/**
 * Build form params with sensible values; then override one field with invalid value.
 */
function buildParams(
  $: cheerio.CheerioAPI,
  formSelector: string,
  override: { name: string; value: string }
): Record<string, string> {
  const params: Record<string, string> = {};

  $(`${formSelector} input, ${formSelector} textarea, ${formSelector} select`).each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name');
    if (!name) return;
    const type = ($el.attr('type') || 'text').toLowerCase();
    const tag = $el.prop('tagName')?.toLowerCase();
    if (type === 'submit' || type === 'button') return;

    if (name === override.name) {
      params[name] = override.value;
      return;
    }

    if (type === 'password') {
      params[name] = VALID_DUMMY.password;
      return;
    }
    const kind = classifyInput($el);
    if (kind === 'email' || kind === 'username') params[name] = VALID_DUMMY.email;
    else if (kind === 'phone') params[name] = VALID_DUMMY.phone;
    else if (tag === 'textarea') params[name] = String($el.val() ?? VALID_DUMMY.text);
    else if (tag === 'select') {
      const selected = $el.find('option:selected').val();
      params[name] = String(selected ?? '');
    } else {
      const val = $el.attr('value') || $el.val() || '';
      params[name] = String(val || VALID_DUMMY.text);
    }
  });

  return params;
}

/**
 * Run a single validation test: submit form with invalid value in one field,
 * check response. Returns an issue if the form/site accepted the invalid input.
 */
export async function runOneValidationTest(
  html: string,
  pageUrl: string,
  baseUrl: string,
  formDiscovery: AuthDiscovery,
  testCase: ValidationTestCase
): Promise<QAIssue | null> {
  if (formDiscovery.kind !== 'form' || !formDiscovery.selector) return null;

  const $ = cheerio.load(html);
  const $form = $(formDiscovery.selector).first();
  if ($form.length === 0) return null;

  const action = $form.attr('action') || '';
  const actionUrl = action ? (action.startsWith('http') ? action : new URL(action, baseUrl).href) : pageUrl;
  const method = (($form.attr('method') || 'get').toLowerCase()) as string;
  const isPost = method === 'post';

  const params = buildParams($, formDiscovery.selector, {
    name: testCase.fieldName,
    value: testCase.invalidValue,
  });
  const body = new URLSearchParams(params).toString();

  let res: Response;
  let finalUrl: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    res = await fetch(isPost ? actionUrl : `${actionUrl}?${body}`, {
      method: isPost ? 'POST' : 'GET',
      body: isPost ? body : undefined,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)',
        ...(isPost ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
    });
    clearTimeout(timeout);
    finalUrl = res.url;
  } catch {
    return null;
  }

  const responseText = await res.text();
  const bodyLower = responseText.toLowerCase();
  const loginPath = normalizePath(pageUrl);
  const finalPath = normalizePath(finalUrl);
  const pathChanged = finalPath !== loginPath && finalPath !== '/' && !loginPath.includes(finalPath);
  const hasValidationError = responseShowsValidationError(bodyLower);
  const successPhrase = responseShowsSuccess(bodyLower);

  if (hasValidationError) return null;

  if (pathChanged || successPhrase) {
    return createAuthCheckIssue(
      'HTML Structure',
      'high',
      `Auth form accepted invalid input in "${testCase.fieldLabel}"`,
      `The ${formDiscovery.inferredType} form was submitted with ${testCase.description} in field "${testCase.fieldName}". The site did not show a validation error and ${pathChanged ? 'redirected away' : `responded with text like "${successPhrase}"`}. Fields should validate format (e.g. email, phone) and reject invalid or empty values.`,
      {
        qaComment: `I entered invalid data in the ${testCase.fieldLabel} field (${testCase.description}). The form accepted it instead of showing an error. Users could submit bad data or hit unexpected behavior.`,
        fix: `Add client- and/or server-side validation for "${testCase.fieldName}": reject invalid formats (e.g. email must contain @, phone only digits) and show a clear error message.`,
        url: pageUrl,
        pageUrl: finalUrl,
        selector: formDiscovery.selector,
      }
    );
  }

  return null;
}

/**
 * Run all validation test cases for one form; returns list of issues.
 */
export async function runInputValidationTests(
  html: string,
  pageUrl: string,
  baseUrl: string,
  formDiscovery: AuthDiscovery
): Promise<QAIssue[]> {
  if (formDiscovery.kind !== 'form' || !formDiscovery.selector) return [];

  const $ = cheerio.load(html);
  const cases = getValidationTestCases($, formDiscovery.selector);
  const issues: QAIssue[] = [];

  for (const testCase of cases) {
    const issue = await runOneValidationTest(html, pageUrl, baseUrl, formDiscovery, testCase);
    if (issue) issues.push(issue);
  }

  return issues;
}
