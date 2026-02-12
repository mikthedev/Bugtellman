/**
 * Structure Builder – derives PageStructure from HTML
 *
 * Optional: run when HTML is available (e.g. from URL scan) to feed the
 * behavior engine with links, forms, and buttons. Pure except for cheerio load.
 */

import type { PageStructure } from './types';

/**
 * Build minimal page structure from HTML string.
 * Used to provide context.structure when running the behavior pipeline after a URL scan.
 */
export async function buildStructureFromHTML(
  html: string,
  baseUrl?: string
): Promise<PageStructure> {
  const { load } = await import('cheerio');
  const $ = load(html);

  const links: PageStructure['links'] = [];
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    const fullHref = baseUrl && !href.startsWith('http') ? new URL(href, baseUrl).href : href;
    links.push({
      href: fullHref,
      text: $el.text().trim().slice(0, 100),
      selector: `a[href="${href.replace(/"/g, '\\"')}"]`,
    });
  });

  const forms: PageStructure['forms'] = [];
  $('form').each((i, el) => {
    const action = $(el).attr('action') || '';
    const actionUrl = baseUrl && action && !action.startsWith('http') ? new URL(action, baseUrl).href : action || baseUrl || '';
    const method = ((el as { attribs?: { method?: string } }).attribs?.method || 'get').toLowerCase();
    const inputs: { name: string; type: string; required?: boolean }[] = [];
    $(el).find('input, select, textarea').each((_, inputEl) => {
      const name = $(inputEl).attr('name');
      if (!name) return;
      const type = ($(inputEl).attr('type') || 'text').toLowerCase();
      if (type === 'submit' || type === 'button') return;
      inputs.push({
        name,
        type: ($(inputEl).prop('tagName') as string)?.toLowerCase() === 'select' ? 'select' : type,
        required: $(inputEl).attr('required') != null,
      });
    });
    forms.push({
      action: actionUrl,
      method,
      selector: `form:nth-of-type(${i + 1})`,
      inputs,
    });
  });

  const buttons: PageStructure['buttons'] = [];
  $('button, input[type="submit"], input[type="button"]').each((_, el) => {
    const $el = $(el);
    const type = ($el.attr('type') || 'button').toLowerCase();
    const tag = $el.prop('tagName')?.toString().toLowerCase() ?? 'button';
    buttons.push({
      text: $el.text().trim().slice(0, 50) || (tag === 'input' ? type : ''),
      type,
      selector: tag,
    });
  });

  return { links, forms, buttons };
}
