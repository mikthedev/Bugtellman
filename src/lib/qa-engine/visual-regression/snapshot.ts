/**
 * Visual Regression - DOM snapshot from HTML
 *
 * Extracts element bounds from HTML (cheerio). For real layout, we'd need
 * a browser. We use heuristics: approximate positions from DOM order.
 * For accurate bounds, caller can pass bounds from Puppeteer.
 */

import * as cheerio from 'cheerio';
import type { ElementBounds } from './types';

/** Selectors for elements we care about */
const LAYOUT_SELECTORS = [
  'header', 'nav', 'main', 'footer', 'aside', 'section', 'article',
  'button', 'form', 'input', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  '[role="button"]', '[role="navigation"]', '[role="main"]', '[id]', '[class]',
];

function buildSelector($: cheerio.CheerioAPI, el: unknown): string {
  const $el = $(el as never);
  const id = $el.attr('id');
  if (id && /^[a-zA-Z][\w-]*$/.test(id)) return `#${id}`;
  const tag = $el.prop('tagName')?.toLowerCase() || 'div';
  const cls = $el.attr('class');
  if (cls) {
    const first = cls.split(/\s+/).find((c: string) => /^[a-zA-Z][\w-]*$/.test(c));
    if (first) return `${tag}.${first}`;
  }
  const idx = ($(tag).toArray() as unknown[]).indexOf(el);
  return idx >= 0 ? `${tag}:nth-of-type(${idx + 1})` : tag;
}

/**
 * Extract element bounds from HTML.
 * Uses DOM order as proxy for layout (no real layout engine).
 * For production: use Puppeteer page.evaluate to get getBoundingClientRect().
 */
export function extractSnapshotFromHTML(html: string, url: string): { elements: ElementBounds[] } {
  const $ = cheerio.load(html);
  const elements: ElementBounds[] = [];
  const seen = new Set<string>();

  $('body *').each((i, el) => {
    const $el = $(el);
    const tag = $el.prop('tagName')?.toLowerCase();
    if (!tag) return;
    const selector = buildSelector($, el);
    if (seen.has(selector)) return;
    seen.add(selector);

    const id = $el.attr('id');
    const hasImportantRole = ['button', 'form', 'input', 'a', 'header', 'nav', 'main', 'footer'].includes(tag) ||
      id != null;

    if (!hasImportantRole && i > 50) return;

    const lineHeight = 20;
    const blockWidth = 800;
    const row = Math.floor(i / 10);
    const col = i % 10;
    const w = tag === 'img' ? 200 : Math.min(blockWidth - col * 80, 400);
    const h = tag === 'img' ? 150 : lineHeight * (tag.startsWith('h') ? 2 : 1);

    elements.push({
      selector,
      x: col * 80,
      y: row * 60,
      width: w,
      height: h,
      tagName: tag,
    });
  });

  return {
    elements: elements.slice(0, 100),
  };
}

export function createSnapshot(url: string, elements: ElementBounds[]): { url: string; timestamp: number; elements: ElementBounds[] } {
  return {
    url,
    timestamp: Date.now(),
    elements,
  };
}
