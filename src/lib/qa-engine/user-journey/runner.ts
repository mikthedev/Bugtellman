/**
 * User Journey Testing - Flow runner
 *
 * Simulates user flows via fetch: follow links, submit forms.
 * Optional multi-step: after a successful nav, fetch that page and test 1–2 inner links.
 */

import type { DetectedFlow, FlowResult, FlowStepResult, SecondLevelCheck } from './types';
import type { QAIssue } from '../types';
import { detectFlows } from './detector';

let issueId = 0;
const genId = () => `flow-issue-${++issueId}`;

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

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000
): Promise<{ res: Response; durationMs: number }> {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)',
        ...options.headers,
      },
    });
    clearTimeout(timeout);
    const durationMs = performance.now() - start;
    return { res, durationMs };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

/** Run a single nav/CTA flow (link click) */
async function runNavFlow(
  flow: DetectedFlow,
  baseUrl: string
): Promise<{ success: boolean; step: FlowStepResult; failures: QAIssue[] }> {
  const failures: QAIssue[] = [];
  const href = flow.href!;
  const start = performance.now();

  try {
    const { res, durationMs } = await fetchWithTimeout(href);
    const step: FlowStepResult = {
      url: href,
      selector: flow.selector,
      action: 'navigate',
      success: res.ok,
      statusCode: res.status,
      durationMs: Math.round(durationMs),
    };

    if (!res.ok) {
      failures.push(
        createIssue(
          'User Journey',
          res.status === 404 ? 'high' : 'medium',
          'Navigation failed',
          `Link "${flow.label}" to ${href} returned HTTP ${res.status}`,
          { url: href, selector: flow.selector }
        )
      );
    }
    return { success: res.ok, step, failures };
  } catch (e) {
    const durationMs = performance.now() - start;
    const step: FlowStepResult = {
      url: href,
      selector: flow.selector,
      action: 'navigate',
      success: false,
      error: e instanceof Error ? e.message : 'Request failed',
      durationMs: Math.round(durationMs),
    };
    failures.push(
      createIssue(
        'User Journey',
        'high',
        'Blocked or failed navigation',
        `Could not reach ${href}: ${e instanceof Error ? e.message : 'Unknown error'}`,
        { url: href, selector: flow.selector }
      )
    );
    return { success: false, step, failures };
  }
}

/** Multi-step: fetch inner page and test up to maxInner links from it */
async function runSecondLevel(
  pageUrl: string,
  baseUrl: string,
  maxInner = 2
): Promise<SecondLevelCheck[]> {
  const checks: SecondLevelCheck[] = [];
  try {
    const { res } = await fetchWithTimeout(pageUrl);
    if (!res.ok) return checks;
    const html = await res.text();
    const innerFlows = detectFlows(html, baseUrl, { includePrimaryNav: true, includeContentLinks: false })
      .filter((f): f is DetectedFlow & { href: string } => f.type === 'nav' && !!f.href)
      .slice(0, maxInner)
      .sort((a, b) => (a.href ?? '').localeCompare(b.href ?? ''));
    for (const flow of innerFlows) {
      const href = flow.href!;
      const start = performance.now();
      const failures: QAIssue[] = [];
      try {
        const { res: innerRes, durationMs } = await fetchWithTimeout(href);
        if (!innerRes.ok) {
          failures.push(
            createIssue('User Journey', innerRes.status === 404 ? 'high' : 'medium', 'Inner link failed', `Link to ${href} returned HTTP ${innerRes.status}`, { url: href, selector: flow.selector })
          );
        }
        checks.push({
          fromUrl: pageUrl,
          testedUrl: href,
          success: innerRes.ok,
          statusCode: innerRes.status,
          durationMs: Math.round(durationMs),
          failures,
        });
      } catch (e) {
        const durationMs = performance.now() - start;
        checks.push({
          fromUrl: pageUrl,
          testedUrl: href,
          success: false,
          durationMs: Math.round(durationMs),
          failures: [
            createIssue('User Journey', 'high', 'Inner link unreachable', `Could not reach ${href}: ${e instanceof Error ? e.message : 'Unknown'}`, { url: href, selector: flow.selector }),
          ],
        });
      }
    }
  } catch {
    // ignore: we already reported the first-level failure
  }
  return checks;
}

/** Run a form submission flow */
async function runFormFlow(
  flow: DetectedFlow,
  html: string,
  baseUrl: string
): Promise<{ success: boolean; step: FlowStepResult; failures: QAIssue[] }> {
  const failures: QAIssue[] = [];
  const action = flow.action || baseUrl;
  const method = (flow.method || 'get').toLowerCase();
  const start = performance.now();

  const { load } = await import('cheerio');
  const $ = load(html);
  const formEl = $(flow.selector).first();
  if (formEl.length === 0) {
    const step: FlowStepResult = {
      url: action,
      selector: flow.selector,
      action: 'submit',
      success: false,
      error: 'Form not found',
    };
    failures.push(
      createIssue('User Journey', 'medium', 'Form not found', `Selector ${flow.selector} did not match`, { selector: flow.selector })
    );
    return { success: false, step, failures };
  }

  const params: Record<string, string> = {};
  formEl.find('input, select, textarea').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name');
    const type = ($el.attr('type') || 'text').toLowerCase();
    const tag = $el.prop('tagName')?.toLowerCase();
    if (!name) return;
    if (type === 'submit' || type === 'button') return;
    if (tag === 'textarea') {
      params[name] = String($el.val() ?? '');
      return;
    }
    if (tag === 'select') {
      const selected = $el.find('option:selected').val();
      params[name] = String(selected ?? '');
      return;
    }
    const val = $el.attr('value') || $el.val() || '';
    params[name] = String(val);
  });

  const searchParams = new URLSearchParams(params);
  const body = searchParams.toString();

  try {
    const url = method === 'get' ? `${action}?${body}` : action;
    const { res, durationMs } = await fetchWithTimeout(url, {
      method: method === 'get' ? 'GET' : 'POST',
      body: method === 'post' ? body : undefined,
      headers: method === 'post' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
    });

    const step: FlowStepResult = {
      url: action,
      selector: flow.selector,
      action: 'submit',
      success: res.ok,
      statusCode: res.status,
      durationMs: Math.round(durationMs),
    };

    if (!res.ok) {
      failures.push(
        createIssue(
          'User Journey',
          'high',
          'Form submission failed',
          `Form "${flow.label}" to ${action} returned HTTP ${res.status}`,
          { url: action, selector: flow.selector }
        )
      );
    }
    return { success: res.ok, step, failures };
  } catch (e) {
    const durationMs = performance.now() - start;
    const step: FlowStepResult = {
      url: action,
      selector: flow.selector,
      action: 'submit',
      success: false,
      error: e instanceof Error ? e.message : 'Request failed',
      durationMs: Math.round(durationMs),
    };
    failures.push(
      createIssue(
        'User Journey',
        'high',
        'Form submission blocked',
        `Could not submit form to ${action}: ${e instanceof Error ? e.message : 'Unknown error'}`,
        { url: action, selector: flow.selector }
      )
    );
    return { success: false, step, failures };
  }
}

/** Run all detected flows */
export async function runFlows(
  html: string,
  baseUrl: string,
  flows: DetectedFlow[],
  maxFlows = 25,
  options?: { multiStep?: boolean; maxSecondLevelPerFlow?: number }
): Promise<FlowResult[]> {
  const results: FlowResult[] = [];
  const toRun = flows.slice(0, maxFlows);
  const formActionsRun = new Set<string>();

  for (const flow of toRun) {
    const path: string[] = [baseUrl];
    const steps: FlowStepResult[] = [];
    const failures: QAIssue[] = [];
    const start = performance.now();

    if (flow.type === 'nav' && flow.href) {
      const { success, step, failures: f } = await runNavFlow(flow, baseUrl);
      steps.push(step);
      failures.push(...f);
      path.push(flow.href);
      const secondLevel =
        options?.multiStep && success
          ? await runSecondLevel(flow.href, baseUrl, options?.maxSecondLevelPerFlow ?? 2)
          : undefined;
      results.push({
        path,
        success,
        failures,
        steps,
        durationMs: Math.round(performance.now() - start),
        secondLevel,
      });
    } else if (flow.type === 'form') {
      const action = flow.action || baseUrl;
      if (formActionsRun.has(action)) continue;
      const { success, step, failures: f } = await runFormFlow(flow, html, baseUrl);
      steps.push(step);
      failures.push(...f);
      path.push(action);
      formActionsRun.add(action);
      results.push({
        path,
        success,
        failures,
        steps,
        durationMs: Math.round(performance.now() - start),
        secondLevel: undefined,
      });
    } else if (flow.type === 'cta') {
      const ctaFlow = flows.find(f => f.type === 'form');
      const action = ctaFlow?.action || baseUrl;
      if (ctaFlow && !formActionsRun.has(action)) {
        const { success, step, failures: f } = await runFormFlow(ctaFlow, html, baseUrl);
        steps.push(step);
        failures.push(...f);
        path.push(action);
        formActionsRun.add(action);
        results.push({
          path,
          success,
          failures,
          steps,
          durationMs: Math.round(performance.now() - start),
          secondLevel: undefined,
        });
      }
    }
  }

  return results;
}
