/**
 * User Journey Testing - Flow detector
 *
 * Detects:
 * - Primary CTAs (buttons, CTA-like links)
 * - Forms
 * - Primary nav links (first <nav> / <header>)
 * - Same-origin content links (from main/content, for deeper coverage)
 */

import * as cheerio from 'cheerio';
import type { DetectedFlow } from './types';

const CTA_BUTTON_TEXTS = ['login', 'submit', 'buy', 'next', 'continue', 'sign in', 'sign up', 'add to cart', 'checkout', 'register', 'search', 'go', 'apply', 'send'];
const CTA_LINK_PATHS = ['login', 'checkout', 'account', 'cart', 'signin', 'signup', 'register', 'contact', 'about', 'docs', 'support', 'help', 'pricing'];

function buildSelector($: cheerio.CheerioAPI, el: unknown, tag: string): string {
  const $el = $(el as never);
  const id = $el.attr('id');
  if (id && /^[a-zA-Z][\w-]*$/.test(id)) return `#${id}`;
  const cls = $el.attr('class');
  if (cls) {
    const first = cls.split(/\s+/).find((c: string) => /^[a-zA-Z][\w-]*$/.test(c));
    if (first) return `${tag}.${first}`;
  }
    const idx = ($(tag).toArray() as unknown[]).indexOf(el);
  return idx >= 0 ? `${tag}:nth-of-type(${idx + 1})` : tag;
}

function getVisibleText($: cheerio.CheerioAPI, el: unknown): string {
  return $(el as never).text().trim().toLowerCase();
}

/** Detect primary CTA buttons */
function detectCtaButtons($: cheerio.CheerioAPI, baseUrl: string): DetectedFlow[] {
  const flows: DetectedFlow[] = [];
  $('button[type="submit"]').each((_, el) => {
    const $el = $(el);
    const text = getVisibleText($, el);
    const sel = buildSelector($, el, 'button');
    flows.push({
      type: 'cta',
      selector: sel,
      text,
      label: $el.text().trim() || 'Submit',
    });
  });

  $('button:not([type="button"])').each((_, el) => {
    const $el = $(el);
    const text = getVisibleText($, el);
    if (CTA_BUTTON_TEXTS.some(kw => text.includes(kw))) {
      const sel = buildSelector($, el, 'button');
      if (!flows.some(f => f.selector === sel)) {
        flows.push({ type: 'cta', selector: sel, text, label: $el.text().trim() || 'Button' });
      }
    }
  });

  $('[role="button"]').each((_, el) => {
    const $el = $(el);
    const text = getVisibleText($, el);
    if (CTA_BUTTON_TEXTS.some(kw => text.includes(kw))) {
      const sel = buildSelector($, el, '[role="button"]');
      if (!flows.some(f => f.selector === sel)) {
        flows.push({ type: 'cta', selector: sel, text, label: $el.text().trim() || 'Button' });
      }
    }
  });

  return flows;
}

/** Detect CTA-like navigation links (login, checkout, etc.) */
function detectCtaNavLinks($: cheerio.CheerioAPI, baseUrl: string): DetectedFlow[] {
  const flows: DetectedFlow[] = [];
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const fullHref = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    const pathLower = fullHref.toLowerCase();
    if (CTA_LINK_PATHS.some(kw => pathLower.includes(kw))) {
      const id = $el.attr('id');
      const sel = id ? `a#${id}` : `a[href="${href.replace(/"/g, '\\"')}"]`;
      flows.push({
        type: 'nav',
        selector: sel,
        href: fullHref,
        text: getVisibleText($, el),
        label: $el.text().trim() || href,
      });
    }
  });
  return flows;
}

/** Detect links inside first <nav> or <header> (primary navigation) */
function detectPrimaryNavLinks($: cheerio.CheerioAPI, baseUrl: string, origin: string, max = 15): DetectedFlow[] {
  const flows: DetectedFlow[] = [];
  const $nav = $('nav').first().add($('header').first());
  $nav.find('a[href]').each((_, el) => {
    if (flows.length >= max) return false;
    const $el = $(el);
    const href = $el.attr('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const fullHref = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    if (!fullHref.startsWith(origin)) return;
    const id = $el.attr('id');
    const sel = id ? `a#${id}` : `a[href="${href.replace(/"/g, '\\"')}"]`;
    flows.push({
      type: 'nav',
      selector: sel,
      href: fullHref,
      text: getVisibleText($, el),
      label: $el.text().trim() || href,
    });
  });
  return flows;
}

/** Detect same-origin links from main content (for deeper coverage) */
function detectSameOriginLinks($: cheerio.CheerioAPI, baseUrl: string, origin: string, max = 20): DetectedFlow[] {
  const flows: DetectedFlow[] = [];
  const seen = new Set<string>();
  const $content = $('main a[href], article a[href], [role="main"] a[href], .content a[href]').length
    ? $('main a[href], article a[href], [role="main"] a[href], .content a[href]')
    : $('body a[href]');
  $content.each((_, el) => {
    if (flows.length >= max) return false;
    const $el = $(el);
    const href = $el.attr('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const fullHref = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    if (!fullHref.startsWith(origin) || seen.has(fullHref)) return;
    seen.add(fullHref);
    const id = $el.attr('id');
    const sel = id ? `a#${id}` : `a[href="${href.replace(/"/g, '\\"')}"]`;
    flows.push({
      type: 'nav',
      selector: sel,
      href: fullHref,
      text: getVisibleText($, el),
      label: $el.text().trim() || href,
    });
  });
  return flows;
}

/** Detect forms */
function detectForms($: cheerio.CheerioAPI, baseUrl: string): DetectedFlow[] {
  const flows: DetectedFlow[] = [];
  $('form').each((i, el) => {
    const $el = $(el);
    const action = $el.attr('action') || '';
    const method = (($el.attr('method') || 'get').toLowerCase()) as string;
    const actionUrl = action ? (action.startsWith('http') ? action : new URL(action, baseUrl).href) : baseUrl;
    const sel = $el.attr('id') ? `form#${$el.attr('id')}` : `form:nth-of-type(${i + 1})`;
    flows.push({
      type: 'form',
      selector: sel,
      action: actionUrl,
      method,
      label: $el.attr('name') || `Form ${i + 1}`,
    });
  });
  return flows;
}

/** Main: detect all flows from HTML (CTAs first, then primary nav, forms, then content links) */
export function detectFlows(
  html: string,
  baseUrl: string,
  options?: { includePrimaryNav?: boolean; includeContentLinks?: boolean; maxContentLinks?: number }
): DetectedFlow[] {
  const $ = cheerio.load(html);
  const origin = new URL(baseUrl).origin;
  const flows: DetectedFlow[] = [];
  const seen = new Set<string>();

  const add = (f: DetectedFlow) => {
    const key = `${f.type}:${f.selector}:${f.href || f.action || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      flows.push(f);
    }
  };

  for (const f of detectCtaButtons($, baseUrl)) add(f);
  for (const f of detectCtaNavLinks($, baseUrl)) add(f);
  for (const f of detectForms($, baseUrl)) add(f);
  if (options?.includePrimaryNav !== false) {
    for (const f of detectPrimaryNavLinks($, baseUrl, origin)) add(f);
  }
  if (options?.includeContentLinks) {
    for (const f of detectSameOriginLinks($, baseUrl, origin, options?.maxContentLinks ?? 20)) add(f);
  }

  // Stable order so the same HTML always yields the same flows (consistent User Journey results)
  return flows.slice().sort((a, b) => {
    const key = (f: DetectedFlow) => `${f.type}:${f.selector}:${f.href ?? ''}:${f.action ?? ''}`;
    return key(a).localeCompare(key(b));
  });
}
