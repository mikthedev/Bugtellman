/**
 * Auth Check - Login form submission test
 *
 * Submits login forms with invalid credentials and detects if the site
 * incorrectly "accepts" them (e.g. demo backdoor, broken validation).
 * Does not create accounts or perform destructive actions.
 */

import * as cheerio from 'cheerio';
import type { QAIssue } from '../types';
import type { AuthDiscovery } from './types';
import { createAuthCheckIssue } from './checker';

const SUBMIT_TIMEOUT_MS = 10000;

/** Dummy credentials used only to verify the form rejects invalid login */
const DUMMY_EMAIL = 'bugtellman-qa-invalid@example.invalid';
const DUMMY_USERNAME = 'bugtellman_qa_invalid_user';
const DUMMY_PASSWORD = 'WrongPassword123!BugtellmanQA';

/** Phrases that suggest the user is logged in (after submitting invalid creds = bug) */
const SUCCESS_PHRASES = [
  'log out', 'logout', 'sign out', 'signout', 'welcome', 'dashboard',
  'my account', 'account settings', 'signed in', 'you are logged in',
  'profile', 'member area',
];

/** Phrases that suggest the login was rejected (expected for invalid creds) */
const ERROR_PHRASES = [
  'invalid', 'incorrect', 'wrong password', 'wrong email', 'wrong username',
  'error', 'failed', 'try again', 'unable to log', '401', '403',
  'not recognized', 'does not exist', 'no account',
];

function normalizePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, '') || '/';
  } catch {
    return url;
  }
}

function bodySuggestsLoggedIn(bodyLower: string, maxLen = 8000): string {
  const slice = bodyLower.slice(0, maxLen);
  for (const p of SUCCESS_PHRASES) {
    if (slice.includes(p)) return p;
  }
  return '';
}

function bodySuggestsError(bodyLower: string, maxLen = 4000): boolean {
  const slice = bodyLower.slice(0, maxLen);
  for (const p of ERROR_PHRASES) {
    if (slice.includes(p)) return true;
  }
  return false;
}

/**
 * Submit a login form with invalid credentials and analyze the response.
 * Returns an issue if the site appears to have accepted the login (faulty/demo behavior).
 */
export async function runLoginSubmitTest(
  html: string,
  pageUrl: string,
  baseUrl: string,
  formDiscovery: AuthDiscovery
): Promise<QAIssue | null> {
  if (formDiscovery.kind !== 'form' || (formDiscovery.inferredType !== 'login' && formDiscovery.inferredType !== 'signin')) {
    return null;
  }
  if (!formDiscovery.selector) return null;

  const $ = cheerio.load(html);
  const $form = $(formDiscovery.selector).first();
  if ($form.length === 0) return null;

  const action = $form.attr('action') || '';
  const actionUrl = action ? (action.startsWith('http') ? action : new URL(action, baseUrl).href) : pageUrl;
  const method = (($form.attr('method') || 'get').toLowerCase()) as string;

  const params: Record<string, string> = {};
  const passwordNames: string[] = [];
  const usernameLikeNames: string[] = [];

  $form.find('input, select, textarea').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('name');
    if (!name) return;
    const type = ($el.attr('type') || 'text').toLowerCase();
    const tag = $el.prop('tagName')?.toLowerCase();
    if (type === 'submit' || type === 'button') return;

    if (type === 'password') {
      passwordNames.push(name);
      params[name] = DUMMY_PASSWORD;
      return;
    }
    if (
      type === 'email' ||
      /email|user|login|username|account/i.test(name)
    ) {
      usernameLikeNames.push(name);
      params[name] = DUMMY_EMAIL;
      return;
    }
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
    params[name] = String(val ?? '');
  });

  if (passwordNames.length === 0) return null;

  const body = new URLSearchParams(params).toString();
  const isPost = method === 'post';

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

  const pathChanged = finalPath !== loginPath;
  const hasSuccessPhrase = bodySuggestsLoggedIn(bodyLower);
  const hasErrorPhrase = bodySuggestsError(bodyLower);

  if (hasErrorPhrase) {
    return null;
  }
  if (pathChanged && finalPath !== '/' && !loginPath.includes(finalPath)) {
    return createAuthCheckIssue(
      'Security',
      'urgent',
      'Login form accepted invalid credentials',
      `The login form at ${pageUrl} was submitted with invalid credentials (test email/password). The site responded with a redirect to ${finalUrl} and did not show an error. This may indicate broken validation, a demo backdoor, or a security issue.`,
      {
        qaComment: 'I tried logging in with fake credentials. The site let me in instead of showing an error. That could mean anyone can access accounts with wrong passwords, or it’s a demo mode that should be disabled in production.',
        fix: 'Ensure the login endpoint validates credentials and returns 401/403 or an error message for invalid username/password. Remove any demo or test backdoors in production.',
        url: pageUrl,
        pageUrl: finalUrl,
        selector: formDiscovery.selector,
      }
    );
  }
  if (hasSuccessPhrase) {
    return createAuthCheckIssue(
      'Security',
      'urgent',
      'Login form accepted invalid credentials',
      `The login form at ${pageUrl} was submitted with invalid credentials. The response page contains text like "${hasSuccessPhrase}" and no clear error message, suggesting the site may have accepted the login.`,
      {
        qaComment: 'I submitted wrong username and password. The page that came back looks like a logged-in screen (e.g. "Log out", "Welcome") instead of an error. Login should reject invalid credentials.',
        fix: 'Validate credentials on the server and show an error message or 401 for invalid login. Remove demo/backdoor logins in production.',
        url: pageUrl,
        pageUrl: finalUrl,
        selector: formDiscovery.selector,
      }
    );
  }

  return null;
}
