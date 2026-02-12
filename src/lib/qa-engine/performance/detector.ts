/**
 * Performance Behavior Detector
 *
 * Measure real interaction delays via fetch:
 * - Link navigation delay
 * - Form submission delay
 *
 * Uses performance.now() around fetch calls.
 */

import type { PerformanceMetric } from './types';

const USER_AGENT = 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)';

/** Measure navigation delay (fetch a URL) */
export async function measureNavigationDelay(url: string): Promise<PerformanceMetric> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    const durationMs = performance.now() - start;
    return {
      name: 'navigation',
      type: 'navigation',
      durationMs: Math.round(durationMs),
      url,
      success: res.ok,
    };
  } catch {
    const durationMs = performance.now() - start;
    return {
      name: 'navigation',
      type: 'navigation',
      durationMs: Math.round(durationMs),
      url,
      success: false,
    };
  }
}

/** Measure form submission delay */
export async function measureFormSubmitDelay(
  actionUrl: string,
  method: string,
  params: Record<string, string>
): Promise<PerformanceMetric> {
  const start = performance.now();
  const body = new URLSearchParams(params).toString();
  const url = method === 'get' ? `${actionUrl}?${body}` : actionUrl;
  try {
    const res = await fetch(url, {
      method: method === 'get' ? 'GET' : 'POST',
      body: method === 'post' ? body : undefined,
      headers: {
        'User-Agent': USER_AGENT,
        ...(method === 'post' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    const durationMs = performance.now() - start;
    return {
      name: 'form_submit',
      type: 'form_submit',
      durationMs: Math.round(durationMs),
      url: actionUrl,
      success: res.ok,
    };
  } catch {
    const durationMs = performance.now() - start;
    return {
      name: 'form_submit',
      type: 'form_submit',
      durationMs: Math.round(durationMs),
      url: actionUrl,
      success: false,
    };
  }
}
