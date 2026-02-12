/**
 * Auth Check - Deep checker
 *
 * Runs complex validation on login/register forms:
 * - Form structure (method, action, required fields, labels)
 * - Security (HTTPS, no password in GET, CSRF hints, autocomplete)
 * - Accessibility (labels, error regions, focus)
 * - Consistency (forgot password, login vs register parity)
 */

import * as cheerio from 'cheerio';
import type { QAIssue } from '../types';
import type { AuthDiscovery, AuthPageContext } from './types';

let issueCounter = 0;
function nextId(): string {
  return `auth-check-${++issueCounter}`;
}

/** Reset ID counter so each run gets stable IDs (call from runAuthCheck entry). */
export function resetAuthCheckIds(): void {
  issueCounter = 0;
}

function createIssue(
  category: string,
  severity: QAIssue['severity'],
  title: string,
  description: string,
  opts?: Partial<QAIssue>
): QAIssue {
  return {
    id: nextId(),
    category,
    severity,
    title,
    description,
    audience: 'technical',
    ...opts,
  };
}

/** Create a single issue (e.g. from login submit test) using shared ID counter. */
export function createAuthCheckIssue(
  category: string,
  severity: QAIssue['severity'],
  title: string,
  description: string,
  opts?: Partial<QAIssue>
): QAIssue {
  return createIssue(category, severity, title, description, opts);
}

/** Deep-check a single page's HTML for auth forms and related elements */
export function runDeepCheck(ctx: AuthPageContext): QAIssue[] {
  const issues: QAIssue[] = [];
  const $ = cheerio.load(ctx.html);
  const pageUrl = ctx.pageUrl;
  const baseUrl = ctx.baseUrl;

  for (const discovery of ctx.discoveries) {
    if (discovery.kind === 'form' && discovery.selector) {
      const $form = $(discovery.selector).first();
      if ($form.length === 0) continue;

      const action = $form.attr('action') || '';
      const actionUrl = action ? (action.startsWith('http') ? action : new URL(action, baseUrl).href) : pageUrl;
      const method = (($form.attr('method') || 'get').toLowerCase()) as string;

      // --- Security ---
      if (actionUrl && actionUrl.toLowerCase().startsWith('http://')) {
        issues.push(
          createIssue(
            'Security',
            'high',
            'Login/register form submitted over HTTP',
            `Form "${discovery.label}" action is ${actionUrl}. Credentials should never be sent over non-HTTPS.`,
            {
              qaComment: 'I noticed this auth form posts to a non-secure URL. Users’ passwords could be intercepted.',
              fix: 'Use HTTPS for the form action and ensure the whole site is served over HTTPS.',
              url: pageUrl,
              selector: discovery.selector,
            }
          )
        );
      }

      if (method !== 'post' && method !== 'get') {
        issues.push(
          createIssue(
            'Security',
            'medium',
            'Unusual form method for auth',
            `Form "${discovery.label}" uses method="${method}". Auth forms typically use POST.`,
            { url: pageUrl, selector: discovery.selector }
          )
        );
      }

      if (method === 'get') {
        const hasPassword = $form.find('input[type="password"]').length > 0;
        if (hasPassword) {
          issues.push(
            createIssue(
              'Security',
              'urgent',
              'Password sent via GET',
              `Form "${discovery.label}" uses method="get" but contains a password field. Passwords must never be sent in the URL.`,
              {
                qaComment: 'This form would send the password in the URL (GET). That’s a serious security flaw.',
                fix: 'Change the form method to POST so credentials are sent in the request body, not the URL.',
                url: pageUrl,
                selector: discovery.selector,
              }
            )
          );
        }
      }

      // CSRF: look for token-like hidden inputs
      const hiddenInputs = $form.find('input[type="hidden"]');
      const hasCsrfLike = Array.from(hiddenInputs).some(el => {
        const name = $(el).attr('name')?.toLowerCase() ?? '';
        return /csrf|token|authenticity|_token|nonce/.test(name);
      });
      if (!hasCsrfLike && method === 'post') {
        issues.push(
          createIssue(
            'Security',
            'low',
            'No CSRF token detected in auth form',
            `Form "${discovery.label}" uses POST but no CSRF/token-like hidden field was found. May be added by JS or framework.`,
            {
              fix: 'Ensure the form is protected against CSRF (e.g. hidden token or SameSite cookies).',
              url: pageUrl,
              selector: discovery.selector,
            }
          )
        );
      }

      // --- Form structure ---
      const passwordInputs = $form.find('input[type="password"]');
      if (passwordInputs.length === 0 && discovery.inferredType !== 'auth') {
        issues.push(
          createIssue(
            'HTML Structure',
            'medium',
            'Auth-like form has no password field',
            `Form "${discovery.label}" looks like login/register but has no password input.`,
            { url: pageUrl, selector: discovery.selector }
          )
        );
      }

      $form.find('input[type="password"]').each((_, inputEl) => {
        const $input = $(inputEl);
        const name = $input.attr('name');
        const id = $input.attr('id');
        const autocomplete = ($input.attr('autocomplete') ?? '').toLowerCase();
        const hasLabel = id && $(`label[for="${id}"]`).length > 0;
        const hasAriaLabel = !!$input.attr('aria-label') || !!$input.attr('aria-labelledby');

        if (!name) {
          issues.push(
            createIssue(
              'HTML Structure',
              'high',
              'Password input missing name attribute',
              'A password field has no name; it may not be submitted correctly.',
              { url: pageUrl, selector: discovery.selector }
            )
          );
        }
        if (!hasLabel && !hasAriaLabel) {
          issues.push(
            createIssue(
              'Accessibility',
              'medium',
              'Password field has no accessible label',
              'Password input should have a <label for="..."> or aria-label for screen readers.',
              {
                fix: 'Add <label for="id"> or aria-label on the password input.',
                url: pageUrl,
                selector: discovery.selector,
              }
            )
          );
        }
        if (autocomplete === 'off' && discovery.inferredType === 'login') {
          issues.push(
            createIssue(
              'Accessibility',
              'low',
              'Login password field has autocomplete=off',
              'autocomplete=off on login password fields can hurt password managers and users.',
              {
                fix: 'Use autocomplete="current-password" for login, "new-password" for register.',
                url: pageUrl,
                selector: discovery.selector,
              }
            )
          );
        }
      });

      $form.find('input[type="email"], input[name*="email"], input[name*="user"]').each((_, inputEl) => {
        const $input = $(inputEl);
        const id = $input.attr('id');
        const hasLabel = id && $(`label[for="${id}"]`).length > 0;
        const hasAriaLabel = !!$input.attr('aria-label') || !!$input.attr('aria-labelledby');
        if (!hasLabel && !hasAriaLabel) {
          issues.push(
            createIssue(
              'Accessibility',
              'medium',
              'Email/username field has no accessible label',
              'Auth identifier field should have a visible label or aria-label.',
              { url: pageUrl, selector: discovery.selector }
            )
          );
        }
      });

      // Forgot password link (login forms)
      if (discovery.inferredType === 'login' || discovery.inferredType === 'signin') {
        const $scope = $form.add($form.parent());
        const hasForgotLink = $scope.find('a[href]').filter((_, el) => {
          const t = $(el).text().toLowerCase();
          const h = $(el).attr('href')?.toLowerCase() ?? '';
          return /forgot|reset|password.*reset|recover/.test(t + ' ' + h);
        }).length > 0;
        if (!hasForgotLink) {
          issues.push(
            createIssue(
              'Accessibility',
              'low',
              'No "forgot password" link near login form',
              'Login forms typically offer a way to reset forgotten passwords.',
              {
                fix: 'Add a "Forgot password?" link that points to your password reset flow.',
                url: pageUrl,
                selector: discovery.selector,
              }
            )
          );
        }
      }
    }

    if (discovery.kind === 'link') {
      // Link reachability is covered by user journey; here we only note if it looks broken
      // (optional: we could skip or add a low-severity "auth link found" info)
    }
  }

  // Cross-page consistency: if we have both login and register discoveries, ensure parity
  const hasLogin = ctx.discoveries.some(d => d.inferredType === 'login' || d.inferredType === 'signin');
  const hasRegister = ctx.discoveries.some(d => d.inferredType === 'register' || d.inferredType === 'signup');
  if (hasLogin && !hasRegister) {
    issues.push(
      createIssue(
        'Logic',
        'low',
        'Login found but no register/sign-up link',
        'The page has login flow but no obvious registration link. Users may not know how to create an account.',
        {
          fix: 'If the site supports registration, add a clear "Sign up" or "Create account" link near the login.',
          url: pageUrl,
        }
      )
    );
  }

  return issues;
}
