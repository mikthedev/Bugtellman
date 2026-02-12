/**
 * Auth Check (Login/Register) - Main entry
 *
 * Discovers login/register/signin/signup on the site and runs deep checks
 * (form structure, security, accessibility, consistency).
 */

import type { AuthCheckResult, AuthDiscovery } from './types';
import type { QAIssue } from '../types';
import { discoverAuthOnPage } from './discover';
import { runDeepCheck, resetAuthCheckIds } from './checker';
import { runLoginSubmitTest } from './loginSubmitTest';
import { runInputValidationTests } from './inputValidationTest';

const AUTH_PAGE_FETCH_TIMEOUT_MS = 8000;

export type { AuthCheckResult, AuthDiscovery } from './types';

export interface AuthCheckOptions {
  /** If true, fetch discovered auth pages and run deep checks on them too */
  fetchAuthPages?: boolean;
  /** Max auth pages to fetch (when fetchAuthPages is true) */
  maxAuthPagesToFetch?: number;
  /** If true, submit login forms with invalid credentials and flag if site accepts them */
  testLoginWithInvalidCredentials?: boolean;
  /** If true, submit auth forms with invalid per-field input (email format, phone letters, empty, etc.) and flag when accepted */
  testInputValidation?: boolean;
}

/**
 * Run full auth check: discover auth links/forms on the given HTML (and optionally
 * on linked auth pages), then run deep checks. Returns discoveries and issues.
 */
export async function runAuthCheck(
  html: string,
  baseUrl: string,
  pageUrl: string,
  options?: AuthCheckOptions
): Promise<AuthCheckResult> {
  resetAuthCheckIds();
  const opts = options ?? {};
  const discoveries = discoverAuthOnPage(html, pageUrl, baseUrl);

  const allIssues: QAIssue[] = [];
  const pagesToCheck: { html: string; pageUrl: string; discoveries: AuthDiscovery[] }[] = [
    { html, pageUrl, discoveries },
  ];

  if (opts.fetchAuthPages !== false && discoveries.length > 0) {
    const linkDiscoveries = discoveries.filter((d): d is AuthDiscovery & { pageUrl: string } => d.kind === 'link' && !!d.pageUrl);
    const urlsToFetch = [...new Set(linkDiscoveries.map(d => d.pageUrl))].slice(0, opts.maxAuthPagesToFetch ?? 5);

    for (const url of urlsToFetch) {
      if (url === pageUrl) continue;
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)' },
          signal: AbortSignal.timeout(AUTH_PAGE_FETCH_TIMEOUT_MS),
        });
        if (!res.ok) continue;
        const subHtml = await res.text();
        const subDiscoveries = discoverAuthOnPage(subHtml, url, baseUrl);
        if (subDiscoveries.length > 0) {
          pagesToCheck.push({ html: subHtml, pageUrl: url, discoveries: subDiscoveries });
        }
      } catch {
        // Skip unreachable auth pages
      }
    }
  }

  for (const { html: pageHtml, pageUrl: pUrl, discoveries: disc } of pagesToCheck) {
    const ctx = { html: pageHtml, pageUrl: pUrl, baseUrl, discoveries: disc };
    const issues = runDeepCheck(ctx);
    allIssues.push(...issues);

    if (opts.testLoginWithInvalidCredentials !== false) {
      const loginForms = disc.filter(
        d => d.kind === 'form' && (d.inferredType === 'login' || d.inferredType === 'signin')
      );
      for (const formDiscovery of loginForms.slice(0, 3)) {
        const submitIssue = await runLoginSubmitTest(pageHtml, pUrl, baseUrl, formDiscovery);
        if (submitIssue) allIssues.push(submitIssue);
      }
    }

    if (opts.testInputValidation !== false) {
      const authForms = disc.filter(d => d.kind === 'form').slice(0, 2);
      for (const formDiscovery of authForms) {
        const validationIssues = await runInputValidationTests(pageHtml, pUrl, baseUrl, formDiscovery);
        allIssues.push(...validationIssues);
      }
    }
  }

  const loginFound = discoveries.some(d => d.inferredType === 'login' || d.inferredType === 'signin');
  const registerFound = discoveries.some(d => d.inferredType === 'register' || d.inferredType === 'signup');
  const highOrUrgent = allIssues.filter(i => i.severity === 'high' || i.severity === 'urgent').length;

  return {
    found: discoveries.length > 0,
    discoveries,
    issues: allIssues,
    summary: {
      loginFound,
      registerFound,
      issuesCount: allIssues.length,
      highOrUrgentCount: highOrUrgent,
    },
  };
}
