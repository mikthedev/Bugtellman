/**
 * Auth Check - Discovery
 *
 * Finds login/register/signin/signup links and forms in HTML.
 */

import * as cheerio from 'cheerio';
import type { AuthDiscovery } from './types';

const AUTH_PATH_KEYWORDS = [
  'login', 'log-in', 'signin', 'sign-in', 'auth', 'session',
  'register', 'signup', 'sign-up', 'join', 'create-account', 'createaccount', 'get-started',
];
const AUTH_LINK_TEXT = [
  'login', 'log in', 'sign in', 'signin', 'sign up', 'signup', 'register',
  'create account', 'create an account', 'create your account', 'get started', 'get started free',
  'join', 'log out', 'logout', 'sign out', 'signout', 'start free', 'free trial',
];

function pathLooksAuth(href: string): boolean {
  const path = href.replace(/^https?:\/\/[^/]+/, '').toLowerCase();
  return AUTH_PATH_KEYWORDS.some(kw => path.includes(kw));
}

function textLooksAuth(text: string): boolean {
  const t = text.trim().toLowerCase();
  return AUTH_LINK_TEXT.some(kw => t.includes(kw) || t === kw);
}

function inferAuthType(url: string, text: string): AuthDiscovery['inferredType'] {
  const u = (url + ' ' + text).toLowerCase();
  if (
    u.includes('register') || u.includes('signup') || u.includes('sign-up') ||
    u.includes('join') || u.includes('create-account') || u.includes('createaccount') ||
    u.includes('create an account') || u.includes('create your account') ||
    u.includes('get started') || u.includes('start free') || u.includes('free trial')
  ) return 'register';
  if (u.includes('signin') || u.includes('sign-in')) return 'signin';
  if (u.includes('signup')) return 'signup';
  if (u.includes('login') || u.includes('log-in')) return 'login';
  return 'auth';
}

/** Discover auth-related links (same page or same origin) */
function discoverAuthLinks($: cheerio.CheerioAPI, baseUrl: string): AuthDiscovery[] {
  const out: AuthDiscovery[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
    const origin = new URL(baseUrl).origin;
    if (new URL(fullUrl).origin !== origin) return;

    const pathMatch = pathLooksAuth(fullUrl);
    const text = $el.text().trim().toLowerCase();
    const textMatch = textLooksAuth($el.text());

    if (!pathMatch && !textMatch) return;
    if (seen.has(fullUrl)) return;
    seen.add(fullUrl);

    const label = $el.text().trim() || fullUrl.replace(/^https?:\/\/[^/]+/, '') || 'Auth';
    const id = $el.attr('id');
    const selector = id ? `a#${id}` : `a[href="${href.replace(/"/g, '\\"')}"]`;

    out.push({
      kind: 'link',
      pageUrl: fullUrl,
      label,
      selector,
      inferredType: inferAuthType(fullUrl, $el.text()),
    });
  });

  return out;
}

/** Discover forms that look like auth (have password input or are in auth-like container) */
function discoverAuthForms($: cheerio.CheerioAPI, pageUrl: string, baseUrl: string): AuthDiscovery[] {
  const out: AuthDiscovery[] = [];
  const origin = new URL(baseUrl).origin;

  $('form').each((i, formEl) => {
    const $form = $(formEl);
    const hasPassword = $form.find('input[type="password"]').length > 0;
    const action = $form.attr('action') || '';
    const actionUrl = action ? (action.startsWith('http') ? action : new URL(action, baseUrl).href) : pageUrl;
    const formId = $form.attr('id');
    const formName = $form.attr('name');
    const formClass = ($form.attr('class') || '').toLowerCase();
    const parentId = $form.parent().attr('id') || '';
    const parentClass = ($form.parent().attr('class') || '').toLowerCase();

    const authLikeContainer =
      /login|signin|signup|register|auth|session|account|create-account|createaccount|get-started/i.test(parentId + ' ' + parentClass + ' ' + formClass) ||
      /login|signin|signup|register|auth|session|account|create-account|createaccount/i.test(String(formId) + ' ' + formName);

    if (!hasPassword && !authLikeContainer) return;

    const selector = formId ? `form#${formId}` : `form:nth-of-type(${i + 1})`;
    const method = (($form.attr('method') || 'get').toLowerCase()) as string;
    const label = formName || formId || `Form ${i + 1}`;

    let inferredType: AuthDiscovery['inferredType'] = 'auth';
    if (hasPassword) {
      const hasEmail = $form.find('input[type="email"], input[name*="email"], input[name*="user"], input[name*="login"]').length > 0;
      const hasUsername = $form.find('input[name*="user"], input[name*="login"], input[name*="name"]').length > 0;
      const hasConfirm = $form.find('input[name*="confirm"], input[name*="password2"]').length > 0;
      if (hasConfirm || /register|signup|sign-up|join|create-account|createaccount|get started/i.test(actionUrl + formClass + parentClass)) inferredType = 'register';
      else inferredType = 'login';
    } else if (authLikeContainer) {
      if (/register|signup|sign-up|join|create-account|createaccount|get started/i.test(actionUrl + formClass + parentClass)) inferredType = 'register';
      else inferredType = 'login';
    }

    out.push({
      kind: 'form',
      pageUrl,
      label,
      actionUrl: actionUrl.startsWith(origin) ? actionUrl : undefined,
      method,
      selector,
      inferredType,
    });
  });

  return out;
}

/**
 * Discover all auth-related links and forms on a single page.
 */
export function discoverAuthOnPage(html: string, pageUrl: string, baseUrl: string): AuthDiscovery[] {
  const $ = cheerio.load(html);
  const linkDiscoveries = discoverAuthLinks($, baseUrl);
  const formDiscoveries = discoverAuthForms($, pageUrl, baseUrl);

  const seen = new Set<string>();
  const result: AuthDiscovery[] = [];
  const add = (d: AuthDiscovery) => {
    const key = `${d.kind}:${d.pageUrl}:${d.selector ?? ''}:${d.actionUrl ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(d);
    }
  };
  linkDiscoveries.forEach(add);
  formDiscoveries.forEach(add);
  return result;
}
