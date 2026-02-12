/**
 * Auth Check (Login/Register) - Type definitions
 *
 * Used to discover and deeply validate authentication flows on a website.
 */

import type { QAIssue } from '../types';

/** Auth-related page or form discovered on the site */
export interface AuthDiscovery {
  kind: 'link' | 'form';
  /** Page URL (for link: destination; for form: page where form lives) */
  pageUrl: string;
  /** Human label (e.g. "Login", "Sign up") */
  label: string;
  /** For forms: form action URL */
  actionUrl?: string;
  /** For forms: HTTP method */
  method?: string;
  /** CSS selector for the form or link */
  selector?: string;
  /** Inferred auth type from URL/text */
  inferredType: 'login' | 'register' | 'signin' | 'signup' | 'auth';
}

/** Context for deep-checking a single page (HTML + URL) */
export interface AuthPageContext {
  html: string;
  pageUrl: string;
  baseUrl: string;
  discoveries: AuthDiscovery[];
}

/** Result of running the full auth check (discovery + deep checks) */
export interface AuthCheckResult {
  /** Whether any login/register flows were found */
  found: boolean;
  /** Discovered auth links and forms */
  discoveries: AuthDiscovery[];
  /** Issues from deep checks (form structure, security, a11y) */
  issues: QAIssue[];
  /** Summary for UI */
  summary: {
    loginFound: boolean;
    registerFound: boolean;
    issuesCount: number;
    highOrUrgentCount: number;
  };
}
