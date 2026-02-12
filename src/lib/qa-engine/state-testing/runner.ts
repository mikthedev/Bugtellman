/**
 * State Testing Engine - Run form input state tests
 *
 * For each form input: empty, invalid, boundary, valid.
 * Submit and log validation failures or crashes.
 */

import * as cheerio from 'cheerio';
import type { FormInput, StateTestResult } from './types';
import type { QAIssue } from '../types';
import { getTestValues } from './values';

let issueId = 0;
const genId = () => `state-issue-${++issueId}`;

function createIssue(
  category: string,
  severity: QAIssue['severity'],
  title: string,
  description: string,
  extra?: Partial<QAIssue>
): QAIssue {
  return {
    id: genId(),
    category,
    severity,
    title,
    description,
    ...extra,
  };
}

interface FormWithInputs {
  formIndex: number;
  action: string;
  method: string;
  inputs: FormInput[];
}

function extractFormsWithInputs(html: string, baseUrl: string): FormWithInputs[] {
  const $ = cheerio.load(html);
  const forms: FormWithInputs[] = [];
  $('form').each((formIdx, formEl) => {
    const $form = $(formEl);
    const action = $form.attr('action') || baseUrl;
    const method = (($form.attr('method') || 'get').toLowerCase()) as string;
    const actionUrl = action.startsWith('http') ? action : new URL(action, baseUrl).href;
    const inputs: FormInput[] = [];
    $form.find('input, select, textarea').each((i, el) => {
      const $el = $(el);
      const name = $el.attr('name');
      if (!name) return;
      const type = ($el.attr('type') || 'text').toLowerCase();
      const tag = $el.prop('tagName')?.toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'hidden') return;
      const id = $el.attr('id');
      const sel = id ? `#${id}` : `[name="${name}"]`;
      inputs.push({
        name,
        type: tag === 'select' ? 'select' : tag === 'textarea' ? 'textarea' : type,
        selector: sel,
        required: $el.attr('required') != null,
        pattern: $el.attr('pattern') ?? undefined,
        min: parseFloat($el.attr('min') ?? ''),
        max: parseFloat($el.attr('max') ?? ''),
        minLength: parseInt($el.attr('minlength') ?? '', 10),
        maxLength: parseInt($el.attr('maxlength') ?? '', 10),
      });
    });
    if (inputs.length > 0) {
      forms.push({ formIndex: formIdx, action: actionUrl, method, inputs });
    }
  });
  return forms;
}

async function submitForm(
  action: string,
  method: string,
  params: Record<string, string>
): Promise<{ success: boolean; statusCode?: number }> {
  const searchParams = new URLSearchParams(params);
  const body = searchParams.toString();
  const url = method === 'get' ? `${action}?${body}` : action;
  try {
    const res = await fetch(url, {
      method: method === 'get' ? 'GET' : 'POST',
      body: method === 'post' ? body : undefined,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)',
        ...(method === 'post' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    return { success: res.ok, statusCode: res.status };
  } catch {
    return { success: false };
  }
}

function buildFormParams(
  $: cheerio.CheerioAPI,
  formIndex: number,
  inputName: string,
  value: string
): Record<string, string> {
  const params: Record<string, string> = {};
  const $form = $('form').eq(formIndex);
  $form.find('input, select, textarea').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name');
    if (!name) return;
    const type = ($el.attr('type') || 'text').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'hidden') return;
    const tag = $el.prop('tagName')?.toLowerCase();
    params[name] = name === inputName ? value : (tag === 'select'
      ? String($el.find('option:selected').val() ?? $el.find('option').first().val() ?? '')
      : String($el.attr('value') ?? $el.val() ?? ''));
  });
  params[inputName] = value;
  return params;
}

export async function runStateTests(
  html: string,
  baseUrl: string,
  maxInputs = 5,
  maxStatesPerInput = 4
): Promise<StateTestResult[]> {
  const forms = extractFormsWithInputs(html, baseUrl);
  if (forms.length === 0) return [];

  const $ = cheerio.load(html);
  const results: StateTestResult[] = [];
  const states: Array<'empty' | 'invalid' | 'boundary' | 'valid'> = ['empty', 'invalid', 'boundary', 'valid'];
  let totalInputs = 0;

  for (const form of forms) {
    const inputs = form.inputs.slice(0, Math.max(0, maxInputs - totalInputs));
    if (inputs.length === 0) break;

    for (const input of inputs) {
      if (totalInputs >= maxInputs) break;
      totalInputs++;

      const values = getTestValues(input.type, input);
      const statesToRun = states.slice(0, maxStatesPerInput);

      for (const state of statesToRun) {
        const value = values[state];
        const failures: QAIssue[] = [];
        const params = buildFormParams($, form.formIndex, input.name, value);
        const { success, statusCode } = await submitForm(form.action, form.method, params);

        if (state === 'valid' && !success) {
          failures.push(
            createIssue(
              'State Testing',
              'high',
              'Valid input rejected',
              `Form rejected valid value for "${input.name}" (${input.type})`,
              { selector: input.selector }
            )
          );
        }

        if (state === 'invalid' && success && statusCode === 200) {
          failures.push(
            createIssue(
              'State Testing',
              'medium',
              'Invalid input accepted',
              `Form accepted invalid value for "${input.name}" (${input.type})`,
              { selector: input.selector }
            )
          );
        }

        if (state === 'empty' && input.required && success && statusCode === 200) {
          failures.push(
            createIssue(
              'State Testing',
              'medium',
              'Required field accepted empty',
              `Form accepted empty value for required field "${input.name}"`,
              { selector: input.selector }
            )
          );
        }

        results.push({
          inputName: input.name,
          state,
          value: value.length > 50 ? `${value.slice(0, 50)}...` : value,
          submitted: true,
          success,
          statusCode,
          validationFailed: state === 'valid' && !success,
          failures,
        });
      }
    }
  }

  return results;
}
