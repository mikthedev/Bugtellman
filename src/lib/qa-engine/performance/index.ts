/**
 * Performance Behavior Detector
 *
 * Measure real interaction delays:
 * - Navigation delay
 * - Form submission delay
 */

import { measureNavigationDelay, measureFormSubmitDelay } from './detector';
import * as cheerio from 'cheerio';

export type { PerformanceMetric } from './types';

export { measureNavigationDelay, measureFormSubmitDelay };

import type { PerformanceMetric } from './types';

/** Run performance measurements for a page */
export async function runPerformanceDetection(
  html: string,
  baseUrl: string,
  options?: { maxNavLinks?: number; testForms?: boolean }
): Promise<{ metrics: PerformanceMetric[] }> {
  const metrics: PerformanceMetric[] = [];
  const $ = cheerio.load(html);

  const navUrls: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    navUrls.push(fullUrl);
  });

  for (const url of navUrls.slice(0, options?.maxNavLinks ?? 5)) {
    const m = await measureNavigationDelay(url);
    metrics.push(m);
  }

  if (options?.testForms !== false) {
    const form = $('form').first();
    if (form.length) {
      const action = form.attr('action') || baseUrl;
      const method = ((form.attr('method') || 'get').toLowerCase()) as string;
      const actionUrl = action.startsWith('http') ? action : new URL(action, baseUrl).href;
      const params: Record<string, string> = {};
      form.find('input, select, textarea').each((_, el) => {
        const $el = $(el);
        const name = $el.attr('name');
        if (!name) return;
        const type = ($el.attr('type') || 'text').toLowerCase();
        if (['submit', 'button', 'hidden'].includes(type)) return;
        params[name] = String($el.attr('value') ?? $el.val() ?? '');
      });
      const m = await measureFormSubmitDelay(actionUrl, method, params);
      metrics.push(m);
    }
  }

  return { metrics };
}
