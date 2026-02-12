import * as cheerio from 'cheerio';
import type { QAIssue } from './types';

let issueId = 0;
const genId = () => `issue-${++issueId}`;

/** Escape value for CSS attribute selector [attr="value"] */
function escapeCssAttr(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildImgSelector($: cheerio.CheerioAPI, el: unknown, src: string): string | undefined {
  const $el = $(el as never);
  const id = $el.attr('id');
  if (id && /^[a-zA-Z][\w-]*$/.test(id)) return `#${id}`;
  const cls = $el.attr('class');
  if (cls) {
    const firstClass = cls.split(/\s+/).find((c: string) => /^[a-zA-Z][\w-]*$/.test(c));
    if (firstClass) {
      const imgsWithClass = $(`img.${firstClass}`);
      if (imgsWithClass.length === 1) return `img.${firstClass}`;
    }
  }
  if (src && src.trim().length > 0 && src.length < 200) return `img[src="${escapeCssAttr(src)}"]`;
  if (!src || !src.trim()) return `img:not([src]), img[src=""]`;
  const imgs = $('img');
  const idx = imgs.toArray().indexOf(el as never);
  if (idx >= 0 && imgs.length > 1) return `img:nth-of-type(${idx + 1})`;
  return 'img';
}

function buildLinkSelector($: cheerio.CheerioAPI, el: unknown, href: string): string | undefined {
  const $el = $(el as never);
  const id = $el.attr('id');
  if (id && /^[a-zA-Z][\w-]*$/.test(id)) return `#${id}`;
  const escaped = escapeCssAttr(href);
  if (href === '#') return `a[href="#"]`;
  return `a[href="${escaped}"]`;
}

function buildButtonSelector($: cheerio.CheerioAPI, el: unknown): string | undefined {
  const $el = $(el as never);
  const id = $el.attr('id');
  if (id && /^[a-zA-Z][\w-]*$/.test(id)) return `#${id}`;
  const tag = $el.prop('tagName')?.toLowerCase();
  const selector = tag === 'button' ? 'button' : '[role="button"]';
  const idx = $(selector).toArray().indexOf(el as never);
  if (idx >= 0) return `${selector}:nth-of-type(${idx + 1})`;
  return tag === 'button' ? 'button' : '[role="button"]';
}

export function analyzeHTML(html: string, baseUrl?: string, pageUrl?: string): QAIssue[] {
  const issues: QAIssue[] = [];
  const $ = cheerio.load(html);

  // Missing doctype
  const htmlContent = $.html();
  if (!/<!DOCTYPE\s+html/i.test(htmlContent)) {
    issues.push({
      id: genId(),
      category: 'HTML Structure',
      severity: 'medium',
      audience: 'technical',
      title: 'Missing DOCTYPE declaration',
      description: 'HTML document lacks a proper DOCTYPE. This can cause inconsistent rendering across browsers.',
      qaComment: 'When I reviewed the page, I noticed there’s no DOCTYPE at the top. This can cause quirks mode in older browsers and affect layout consistency across different devices.',
      whyFlagged: 'The parser found that the document starts without a DOCTYPE declaration. Without it, browsers assume quirks mode, which can cause inconsistent box models, height calculations, and layout behavior across different browsers.',
      fix: 'Add <!DOCTYPE html> as the very first line of your HTML file, before the <html> tag. This tells browsers to render in standards mode.',
      suggestedCode: '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8">\n    <title>Your Page</title>\n  </head>\n  <body>\n    <!-- your content -->\n  </body>\n</html>',
    });
  }

  // Missing lang attribute
  const htmlElement = $('html');
  if (!htmlElement.attr('lang')) {
    issues.push({
      id: genId(),
      category: 'Accessibility',
      severity: 'medium',
      audience: 'technical',
      title: 'Missing lang attribute on <html>',
      description: 'The html element should have a lang attribute for screen readers and translation tools.',
      selector: 'html',
      qaComment: 'I ran this through accessibility checks and the <html> tag is missing the lang attribute. Screen readers rely on this to know the page language, and it also helps with translation tools and SEO.',
      whyFlagged: 'The parser detected an <html> element without a lang attribute. The HTML5 spec requires this for document language declaration. Screen readers, translation tools, and browsers use it for pronunciation and language-specific behavior.',
      fix: 'Add lang="en" (or your page language, e.g. lang="es" for Spanish) to the opening <html> tag.',
      suggestedCode: '<html lang="en">',
    });
  }

  // Missing meta viewport (page-level issue — screenshot = mobile view)
  const viewportMeta = $('meta[name="viewport"], meta[name="Viewport"]');
  const hasViewport = viewportMeta.length > 0 || /<meta[^>]+name=["']viewport["'][^>]*>/i.test($.html());
  if (!hasViewport) {
    const isSpa = $('body').find('#root, #app, #__next, [data-reactroot], [data-v-app]').length > 0;
    issues.push({
      id: genId(),
      category: 'Responsive Design',
      severity: isSpa ? 'low' : 'medium',
      audience: 'manual',
      pageUrl,
      screenshotSelector: 'body',
      screenshotDevice: 'iPhone 12',
      title: isSpa ? 'Viewport meta not found in initial HTML' : 'Missing viewport meta tag',
      description: isSpa
        ? 'No viewport meta in initial HTML. If your framework injects it at runtime, this may be fine.'
        : 'Without a viewport meta tag, mobile devices will render the page at desktop width.',
      qaComment: isSpa
        ? "I didn't see a viewport meta in the raw HTML. If you use React, Vue, or similar, your framework may add it — verify on a real device."
        : "I tested on mobile and the page was zoomed out like a desktop site — it’s because the viewport meta tag is missing. Users on phones will have to pinch-to-zoom to read anything, which is bad UX.",
      whyFlagged: isSpa
        ? 'The parser found no <meta name="viewport"> in the initial HTML. SPAs often inject it; verify in the browser.'
        : 'The parser found no <meta name="viewport"> in the document. Without it, mobile browsers assume a ~980px wide viewport and scale the page down.',
      fix: isSpa
        ? 'If your framework does not add viewport, add <meta name="viewport" content="width=device-width, initial-scale=1"> in your index.html or root template.'
        : 'Add the viewport meta tag inside your <head>: <meta name="viewport" content="width=device-width, initial-scale=1">',
      suggestedCode: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    });
  }

  // Images - missing alt, empty src
  $('img').each((_, el) => {
    const $el = $(el);
    const alt = $el.attr('alt');
    const src = $el.attr('src') || '';
    if (!src || src.trim() === '') {
      const sel = buildImgSelector($, el, src);
      issues.push({
        id: genId(),
        category: 'HTML Validity',
        severity: 'high',
        audience: 'manual',
        pageUrl,
        screenshotSelector: sel,
        title: 'Image with empty or missing src',
        description: 'Images must have a valid src attribute.',
        qaComment: 'I found an <img> tag with no src or an empty src. The image won’t load at all — it’s either a bug or leftover placeholder code.',
        fix: 'Add a valid image path or URL to the src attribute. If the image is intentional, ensure the path is correct. If it’s a placeholder, remove the tag or use a real image.',
        location: src,
      });
    }
    if (alt === undefined || alt === null) {
      const sel = buildImgSelector($, el, src);
      issues.push({
        id: genId(),
        category: 'Accessibility',
        severity: 'medium',
        audience: 'manual',
        pageUrl,
        screenshotSelector: sel,
        title: 'Image missing alt text',
        description: 'Images should have alt text for screen readers and when images fail to load.',
        location: src,
        snippet: $el.prop('outerHTML')?.slice(0, 100) + '...',
        qaComment: 'I spotted an image without alt text. Users with screen readers won’t know what it shows, and if the image fails to load, nobody sees a fallback description.',
        whyFlagged: 'The parser found an <img> element with no alt attribute. WCAG 2.1 requires alt text for all non-decorative images. Without it, assistive technologies cannot convey the image content, and broken images show no fallback.',
        fix: 'Add an alt attribute with a concise description of the image. For decorative images (spacers, icons that duplicate nearby text), use alt="" explicitly.',
        suggestedCode: `<img src="${src.slice(0, 50)}${src.length > 50 ? '...' : ''}" alt="Description of what the image shows">`,
      });
    } else if (alt === '' && !/^\s*$/.test(src)) {
      issues.push({
        id: genId(),
        category: 'Accessibility',
        severity: 'low',
        audience: 'technical',
        title: 'Image with empty alt - verify if decorative',
        description: 'Image has empty alt. Ensure it is decorative; otherwise add descriptive text.',
        location: src,
        qaComment: 'This image has alt="". That’s fine for decorative images, but if it conveys meaning (e.g. a chart, diagram, or important photo), it should have descriptive alt text.',
        fix: 'If the image is decorative, keep alt="". If it’s meaningful, add alt="Description of what the image shows."',
      });
    }
  });

  // Links - check for empty href, #, etc
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    
    if (href === '#' || href === 'javascript:void(0)' || href === 'javascript:;') {
      const sel = buildLinkSelector($, el, href);
      issues.push({
        id: genId(),
        category: 'Links',
        severity: 'low',
        audience: 'manual',
        pageUrl,
        screenshotSelector: sel,
        title: 'Placeholder or empty link',
        description: `Link uses "${href}" - may be placeholder or non-functional.`,
        snippet: $el.prop('outerHTML')?.slice(0, 120) + '...',
        qaComment: 'I clicked this link and it goes nowhere — it uses a placeholder href like "#" or "javascript:void(0)". If it’s meant to be a button, it should be a <button> instead.',
        fix: 'For navigation: replace with the real URL. For buttons/actions: use <button> or <button type="button"> so it’s semantically correct and keyboard accessible.',
      });
    }
    
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      if (href.startsWith('http://') && baseUrl?.startsWith('https://')) {
        const sel = buildLinkSelector($, el, href);
        issues.push({
          id: genId(),
          category: 'Security',
          severity: 'high',
          audience: 'manual',
          pageUrl,
          screenshotSelector: sel,
          title: 'Mixed content - HTTP link on HTTPS page',
          description: 'Links to HTTP resources from HTTPS page can cause security warnings.',
          location: href,
          qaComment: 'The page is served over HTTPS but this link points to HTTP. Browsers may block it or show warnings. Users might lose trust or the feature may not work.',
          fix: 'Change the URL to use HTTPS: https://... instead of http://... Most sites support HTTPS now.',
        });
      }
    }
  });

  // Form inputs without labels
  $('input:not([type="hidden"]), textarea, select').each((_, el) => {
    const $el = $(el);
    const id = $el.attr('id');
    const name = $el.attr('name');
    const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : $el.closest('label').length > 0;
    if (!hasLabel && name) {
      issues.push({
        id: genId(),
        category: 'Accessibility',
        severity: 'medium',
        audience: 'technical',
        title: 'Form control without associated label',
        description: 'Form inputs should have associated labels for accessibility.',
        location: name,
        snippet: $el.prop('outerHTML')?.slice(0, 100) + '...',
        qaComment: 'When I tested with a screen reader, this form field didn’t announce its purpose. It’s missing a label. Users might not know what to type in.',
        whyFlagged: 'The parser found a form control (input, textarea, or select) that has no associated <label> via for/id or wrapping. WCAG 2.1 requires form controls to have programmatically associated labels so screen readers can announce the purpose.',
        fix: 'Add a <label for="id-of-input">Label text</label> and give the input a matching id, or wrap the input inside the label.',
        suggestedCode: '<label for="email">Email address</label>\n<input type="email" id="email" name="email" />',
      });
    }
  });

  // Deprecated elements
  const deprecated = ['center', 'font', 'marquee', 'frameset', 'frame', 'noframes', 'acronym', 'big', 'tt', 'strike'];
  deprecated.forEach(tag => {
    $(tag).each((_, el) => {
      issues.push({
        id: genId(),
        category: 'HTML Standards',
        severity: 'low',
        audience: 'technical',
        title: `Deprecated HTML element: <${tag}>`,
        description: `The <${tag}> element is deprecated in HTML5. Use CSS or modern alternatives.`,
        snippet: $(el).prop('outerHTML')?.slice(0, 80) + '...',
        qaComment: `I found a <${tag}> tag — it’s deprecated and browsers may drop support in the future. It can also cause layout quirks.`,
        fix: `Replace <${tag}> with modern alternatives: use CSS for <center>, <font>; use <strong> for <b>; use <em> for <i>. For <marquee>, consider CSS animations.`,
      });
    });
  });

  // Headings hierarchy
  const headings: number[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = parseInt($(el).prop('tagName')?.charAt(1) || '0');
    headings.push(level);
  });
  for (let i = 1; i < headings.length; i++) {
    if (headings[i]! > headings[i - 1]! + 1) {
      issues.push({
        id: genId(),
        category: 'Accessibility',
        severity: 'low',
        audience: 'technical',
        title: 'Skipped heading level',
        description: 'Headings should be in order (e.g., h2 after h1, not h4 after h1).',
        qaComment: 'The heading order jumps (e.g. h1 then h4). Screen reader users use headings to navigate — they expect a logical order like h1 → h2 → h3.',
        fix: 'Don’t skip levels. Use h2 after h1, h3 after h2, etc. If you need a smaller visual heading, use CSS (font-size) instead of skipping to h5.',
      });
      break;
    }
  }

  // Empty buttons
  $('button, [role="button"]').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const ariaLabel = $el.attr('aria-label');
    if (!text && !ariaLabel && !$el.find('img[alt]').length) {
      const sel = buildButtonSelector($, el);
      issues.push({
        id: genId(),
        category: 'Accessibility',
        severity: 'medium',
        audience: 'manual',
        pageUrl,
        screenshotSelector: sel,
        title: 'Button without accessible text',
        description: 'Buttons need visible text or aria-label for screen readers.',
        snippet: $el.prop('outerHTML')?.slice(0, 100) + '...',
        qaComment: 'This button has no visible text or aria-label, so screen readers can’t tell users what it does. I’ve seen similar issues with icon-only buttons.',
        whyFlagged: 'The parser found a button or [role="button"] element with no text content, no aria-label, and no img with alt. Icon-only buttons must provide an accessible name for screen readers.',
        fix: 'Add aria-label or screen-reader-only text. For icon buttons, aria-label is the simplest fix.',
        suggestedCode: '<button aria-label="Close menu">×</button>\n\n<!-- Or with screen-reader-only text -->\n<button><span class="sr-only">Close menu</span>×</button>',
      });
    }
  });

  // Duplicate IDs
  const ids: Record<string, number> = {};
  $('[id]').each((_, el) => {
    const id = $(el).attr('id')!;
    ids[id] = (ids[id] || 0) + 1;
  });
  Object.entries(ids).forEach(([id, count]) => {
    if (count > 1) {
      issues.push({
        id: genId(),
        category: 'HTML Validity',
        severity: 'high',
        audience: 'technical',
        title: 'Duplicate ID attribute',
        description: `ID "${id}" is used ${count} times. IDs must be unique.`,
        qaComment: `I found the same id="${id}" on ${count} elements. IDs must be unique — things like label[for], links, and focus management can break when they’re duplicated.`,
        whyFlagged: `The parser traversed all elements with id attributes and found "${id}" repeated ${count} times. The HTML spec requires ids to be unique. Duplicate ids break document.getElementById(), label[for] associations, anchor links (#id), and ARIA references.`,
        fix: 'Give each element a unique id. If you need to target multiple elements with the same styling or behavior, use a class instead.',
        suggestedCode: `<!-- Instead of: id="card" on multiple items -->
<div class="card">...</div>
<div class="card">...</div>

<!-- Or use unique ids: -->
<div id="card-1" class="card">...</div>
<div id="card-2" class="card">...</div>`,
      });
    }
  });

  // Tables without captions/th
  $('table').each((_, el) => {
    const $table = $(el);
    if (!$table.find('th').length && $table.find('td').length) {
      issues.push({
        id: genId(),
        category: 'Accessibility',
        severity: 'medium',
        audience: 'technical',
        title: 'Data table missing header cells',
        description: 'Tables with data should have <th> elements for column/row headers.',
        qaComment: 'This table has data but no headers. Screen readers can’t tell users what each column means. I couldn’t navigate it properly with a screen reader.',
        fix: 'Add a <thead> with <th> cells for each column. Example: <thead><tr><th>Name</th><th>Email</th></tr></thead><tbody>...</tbody>',
      });
    }
  });

  return issues;
}

export function extractLinks(html: string, baseUrl?: string): { href: string; text: string }[] {
  const $ = cheerio.load(html);
  const links: { href: string; text: string }[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
      let fullUrl = href;
      if (baseUrl && !href.startsWith('http')) {
        try {
          fullUrl = new URL(href, baseUrl).href;
        } catch {
          fullUrl = href;
        }
      }
      links.push({ href: fullUrl, text: $(el).text().trim() });
    }
  });
  return links;
}

export function extractCSSUrls(html: string, baseUrl?: string): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        urls.push(baseUrl ? new URL(href, baseUrl).href : href);
      } catch {
        urls.push(href);
      }
    }
  });
  const styleContent = $('style').html() || '';
  const urlMatches = styleContent.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
  if (urlMatches) {
    urlMatches.forEach(m => {
      const match = m.match(/url\(['"]?([^'")\s]+)['"]?\)/);
      if (match) urls.push(match[1]!);
    });
  }
  return urls;
}
