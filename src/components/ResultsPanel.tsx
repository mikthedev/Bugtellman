'use client';

import { useState, useEffect, useMemo } from 'react';
import type { AnalysisResult, QAIssue, Severity } from '@/lib/qa-engine';

interface ResultsPanelProps {
  result: (AnalysisResult & { riskScore?: number; riskLevel?: string }) | null;
}

/** Group key: same title + category + severity = same issue type (different locations/pages) */
function issueGroupKey(issue: QAIssue): string {
  const desc = (issue.description || '').slice(0, 80).trim();
  return `${issue.title}|${issue.category}|${issue.severity}|${desc}`;
}

export interface GroupedIssue {
  representative: QAIssue;
  count: number;
  occurrences: QAIssue[];
}

function groupSimilarIssues(issues: QAIssue[]): GroupedIssue[] {
  const byKey = new Map<string, QAIssue[]>();
  for (const issue of issues) {
    const key = issueGroupKey(issue);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(issue);
  }
  return Array.from(byKey.entries()).map(([, occs]) => ({
    representative: occs[0]!,
    count: occs.length,
    occurrences: occs,
  }));
}

type SeverityFilter = Severity | 'all';
type ViewSection = 'manual' | 'technical';

const ISSUE_COUNT_FOR_SCREWED = 10;

const SEVERITY_HINT: Record<Severity, string> = {
  urgent: 'Needs immediate attention',
  high: 'Should fix soon',
  medium: 'A little buggy, but not the end of the world 🐛',
  low: 'Just a tiny critter crawling around 🪲',
  minor: 'More of a feature request than a bug 🦋',
};

const SEVERITY: Record<Severity, { label: string; dot: string; bg: string; border: string; pill: string }> = {
  urgent: { label: 'Urgent', dot: 'bg-rose-400', bg: 'bg-rose-500/10', border: 'border-l-rose-400', pill: 'bg-rose-500/20 text-rose-300 border-rose-400/40' },
  high: { label: 'High', dot: 'bg-amber-400', bg: 'bg-amber-500/10', border: 'border-l-amber-400', pill: 'bg-amber-500/20 text-amber-300 border-amber-400/40' },
  medium: { label: 'Medium', dot: 'bg-sky-400', bg: 'bg-sky-500/10', border: 'border-l-sky-400', pill: 'bg-sky-500/20 text-sky-300 border-sky-400/40' },
  low: { label: 'Low', dot: 'bg-slate-400', bg: 'bg-slate-500/10', border: 'border-l-slate-400', pill: 'bg-slate-500/20 text-slate-300 border-slate-400/40' },
  minor: { label: 'Minor', dot: 'bg-zinc-400', bg: 'bg-zinc-500/10', border: 'border-l-zinc-400', pill: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40' },
};

/** Section label unique to the bug type - bug-themed for lower severity */
function getFindingLabel(issue: QAIssue): string {
  const { category, title, severity } = issue;
  const isLowSeverity = severity === 'low' || severity === 'minor' || severity === 'medium';
  
  if (title.includes('404') || title.includes('Broken link')) {
    return isLowSeverity ? 'Found a dead link (RIP 🪦)' : 'Broken link found';
  }
  if (title.includes('Page not found')) {
    return isLowSeverity ? 'This page went to bug heaven 🦋' : 'Dead link';
  }
  if (category === 'Links') {
    return isLowSeverity ? 'Link bug spotted 🐞' : 'Link issue';
  }
  if (title.includes('alt') || title.includes('Image')) {
    return isLowSeverity ? 'Accessibility bug buzzing around 🐝' : 'Accessibility note';
  }
  if (category === 'Accessibility') {
    return isLowSeverity ? 'A11y bug alert 🪲' : 'Accessibility issue';
  }
  if (category === 'Security' || title.includes('Mixed content')) {
    return 'Security concern'; // Keep serious
  }
  if (category === 'Responsive' || title.includes('viewport')) {
    return isLowSeverity ? 'Responsive bug crawling on mobile 📱🐛' : 'Responsive design issue';
  }
  if (category === 'HTML Validity' || category === 'HTML Structure') {
    return isLowSeverity ? 'HTML bug infestation 🪳' : 'HTML issue';
  }
  if (category === 'HTML Standards') {
    return isLowSeverity ? 'Deprecated HTML (ancient bug fossil 🦗)' : 'Deprecated HTML';
  }
  if (category === 'CSS Quality' || category === 'CSS Validity' || category === 'CSS Layout') {
    return isLowSeverity ? 'CSS bug hiding in the stylesheet 🕷️' : 'CSS issue';
  }
  if (category === 'Responsive Design') {
    return isLowSeverity ? 'Layout bug on the loose 🐜' : 'Responsive layout';
  }
  if (category === 'Browser Compatibility') {
    return isLowSeverity ? 'Browser bug party 🎉🐛' : 'Browser compatibility';
  }
  if (category === 'Resources') {
    return isLowSeverity ? 'Resource bug munching on files 🦟' : 'Resource loading';
  }
  if (category === 'Logic' && (title.toLowerCase().includes('login') || title.toLowerCase().includes('register'))) {
    return 'Auth / account flow'; // Keep serious
  }
  if (title.includes('Login') || title.includes('Register') || title.includes('password') || title.includes('auth form')) {
    return 'Login/Register check'; // Keep serious
  }
  return isLowSeverity ? 'Bug report from the field 🐛' : 'What I found';
}

function getStepsToReproduce(issue: QAIssue): string[] {
  const steps: string[] = [];
  const pageUrl = issue.url || issue.location;
  if (pageUrl && (pageUrl.startsWith('http') || pageUrl.includes('/')) && !isEmailProtectionUrl(pageUrl)) {
    steps.push(`Open the page: ${pageUrl}`);
  }
  if (issue.selector) {
    const short = issue.selector.length > 60 ? issue.selector.slice(0, 57) + '…' : issue.selector;
    steps.push(`Find the element: ${short}`);
  } else if (issue.category === 'Links') {
    steps.push('Locate the link or button that should navigate or submit');
  }
  const whatHappens = issue.title || issue.description?.slice(0, 120);
  if (whatHappens) {
    steps.push(`What's wrong: ${whatHappens}${(issue.description?.length ?? 0) > 120 ? '…' : ''}`);
  }
  return steps.length > 0 ? steps : ['Open the page and follow the flow where the issue appears.'];
}

function getScreenshotHint(issue: QAIssue): string | null {
  if (issue.selector) return issue.selector.length > 45 ? issue.selector.slice(0, 42) + '…' : issue.selector;
  if (issue.category === 'Links') return 'Link / button that goes nowhere';
  if (issue.title) return issue.title.length > 40 ? issue.title.slice(0, 37) + '…' : issue.title;
  return null;
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg bg-black/30 overflow-hidden border border-white/5">
      {label && (
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 border-b border-white/5">
          {label}
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm scrollbar-thin">
        <code className="font-mono text-zinc-300 whitespace-pre leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

const isEmailProtectionUrl = (s: string | undefined) => !!s && /email-protection/i.test(s);

/* ----- Manual issue card: clean report block ----- */
function ManualIssueCard({ grouped, pageScreenshot, analyzedUrl }: { grouped: GroupedIssue; pageScreenshot?: string; analyzedUrl?: string }) {
  const issue = grouped.representative;
  const s = SEVERITY[issue.severity as Severity] ?? SEVERITY.medium;
  // Try to get screenshot from representative first, then any occurrence, then fallback to page screenshot
  const screenshotUrl = issue.screenshotUrl || 
    (grouped.occurrences.find(o => o.screenshotUrl)?.screenshotUrl) || 
    pageScreenshot;
  let linkHref = issue.url || issue.location || analyzedUrl;
  if (linkHref && isEmailProtectionUrl(linkHref)) linkHref = undefined;
  const showLink = linkHref && (linkHref.startsWith('http') || linkHref.includes('/'));
  const multi = grouped.count > 1;
  const locations = multi ? (grouped.occurrences.map(o => o.url || o.location).filter((x): x is string => !!x && !isEmailProtectionUrl(x)) as string[]) : [];
  const steps = getStepsToReproduce(issue);
  const screenshotHint = getScreenshotHint(issue);
  const selector = issue.selector || issue.screenshotSelector;
  const allSelectors = multi ? grouped.occurrences.map(o => o.selector || o.screenshotSelector).filter((x): x is string => !!x) : (selector ? [selector] : []);

  return (
    <article className={`rounded-2xl border ${s.border} border-l-4 bg-zinc-900/50 overflow-hidden transition-colors hover:bg-zinc-900/70`}>
      <div className="flex flex-col lg:flex-row">
        {/* Content column */}
        <div className="flex-1 min-w-0 p-5 lg:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.pill}`}>
              {s.label}
            </span>
            {multi && (
              <span className="text-xs text-zinc-500">{grouped.count} occurrences</span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-zinc-100 leading-tight">{issue.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{SEVERITY_HINT[issue.severity as Severity] ?? SEVERITY_HINT.medium}</p>

          <div className="mt-4 space-y-4">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400/90 mb-2">Steps to reproduce</p>
              <ol className="list-decimal list-inside space-y-1.5 text-sm text-zinc-300">
                {steps.map((step, i) => (
                  <li key={i} className="pl-0.5">{step}</li>
                ))}
              </ol>
            </div>

            {/* Element selector - where Bugtellman found it */}
            {allSelectors.length > 0 && (
              <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Found at</p>
                {multi ? (
                  <div className="space-y-2">
                    {allSelectors.map((sel, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-xs text-zinc-500 mt-0.5">#{idx + 1}</span>
                        <code className="flex-1 rounded bg-black/40 px-2.5 py-1.5 text-xs font-mono text-[#CAF76F] break-all border border-zinc-700/50">
                          {sel}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(sel);
                          }}
                          className="shrink-0 rounded px-2 py-1 text-xs text-zinc-500 hover:text-[#CAF76F] transition-colors"
                          title="Copy selector"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-zinc-500 mt-2">💡 Paste these selectors in DevTools Console to find the elements: <code className="text-[#CAF76F]">document.querySelector('selector')</code></p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <code className="flex-1 rounded bg-black/40 px-2.5 py-1.5 text-xs font-mono text-[#CAF76F] break-all border border-zinc-700/50">
                      {selector}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selector!);
                      }}
                      className="shrink-0 rounded px-2 py-1 text-xs text-zinc-500 hover:text-[#CAF76F] transition-colors"
                      title="Copy selector"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {(issue.qaComment || issue.description) && (
              <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">{getFindingLabel(issue)}</p>
                <p className="text-sm leading-relaxed text-zinc-300 break-words">
                  {issue.qaComment ? `"${issue.qaComment}"` : issue.description}
                </p>
              </div>
            )}

            {multi && locations.length > 0 && (
              <details className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 overflow-hidden">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-400 hover:text-zinc-200">
                  {locations.length} locations
                </summary>
                <ul className="max-h-32 list-none space-y-0.5 overflow-y-auto border-t border-zinc-700/50 px-4 py-3">
                  {[...new Set(locations)].slice(0, 15).map((loc, i) => (
                    <li key={i}>
                      <a href={loc.startsWith('http') ? loc : undefined} target={loc.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="block truncate font-mono text-sm text-zinc-400 hover:text-[#CAF76F]" title={loc}>{loc}</a>
                    </li>
                  ))}
                  {locations.length > 15 && <li className="text-sm text-zinc-500">… and {locations.length - 15} more</li>}
                </ul>
              </details>
            )}

            {issue.fix && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">How to fix</p>
                <p className="text-sm leading-relaxed text-zinc-300 break-words">{issue.fix}</p>
              </div>
            )}

            {showLink && (
              <a
                href={linkHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-lg py-2 font-mono text-sm text-zinc-400 hover:text-[#CAF76F] transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="min-w-0 truncate" title={linkHref}>{linkHref}</span>
              </a>
            )}
            {issue.location && !showLink && !multi && (
              <p className="truncate font-mono text-sm text-zinc-500" title={issue.location}>{issue.location}</p>
            )}
          </div>
        </div>

        {/* Screenshot column */}
        {screenshotUrl && (
          <div className="lg:w-[320px] lg:min-w-[320px] border-t lg:border-t-0 lg:border-l border-zinc-700/50 flex flex-col">
            <a href={linkHref} target="_blank" rel="noopener noreferrer" className="relative flex min-h-[200px] lg:min-h-0 lg:flex-1 items-center justify-center overflow-hidden bg-zinc-950/80 p-4">
              <img
                src={screenshotUrl}
                alt="Where the issue appears"
                className="h-full w-full rounded-lg object-contain object-top"
              />
              {screenshotHint && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-zinc-900/95 px-3 py-2 shadow-xl">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400" aria-hidden>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.828 11H2m4.828 0L2 7" /></svg>
                  </span>
                  <span className="truncate text-xs font-semibold text-zinc-200">Issue: {screenshotHint}</span>
                </div>
              )}
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

/* ----- Technical issue card: code-first report block ----- */
function TechnicalIssueCard({ grouped }: { grouped: GroupedIssue }) {
  const issue = grouped.representative;
  const s = SEVERITY[issue.severity as Severity] ?? SEVERITY.medium;
  const multi = grouped.count > 1;
  const locations = multi ? grouped.occurrences.map(o => o.location || o.url).filter((x): x is string => !!x && !isEmailProtectionUrl(x)) as string[] : [];
  const showLocationLink = issue.location && !multi && !isEmailProtectionUrl(issue.location) && issue.location.startsWith('http');
  const hasLocationCode = issue.location && !multi && !isEmailProtectionUrl(issue.location) && !issue.location.startsWith('http');
  const hasCodeColumn = hasLocationCode || issue.suggestedCode || issue.snippet;
  const selector = issue.selector || issue.screenshotSelector;
  const allSelectors = multi ? grouped.occurrences.map(o => o.selector || o.screenshotSelector).filter((x): x is string => !!x) : (selector ? [selector] : []);

  return (
    <article className={`rounded-2xl border ${s.border} border-l-4 bg-zinc-900/50 overflow-hidden transition-colors hover:bg-zinc-900/70`}>
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 p-5 lg:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.pill}`}>
              {s.label}
            </span>
            {multi && (
              <span className="text-xs text-zinc-500">{grouped.count} occurrences</span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-zinc-100 leading-tight">{issue.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{SEVERITY_HINT[issue.severity as Severity] ?? SEVERITY_HINT.medium}</p>

          <div className="mt-4 space-y-4">
            {/* Element selector - where Bugtellman found it */}
            {allSelectors.length > 0 && (
              <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Found at</p>
                {multi ? (
                  <div className="space-y-2">
                    {allSelectors.map((sel, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-xs text-zinc-500 mt-0.5">#{idx + 1}</span>
                        <code className="flex-1 rounded bg-black/40 px-2.5 py-1.5 text-xs font-mono text-[#CAF76F] break-all border border-zinc-700/50">
                          {sel}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(sel);
                          }}
                          className="shrink-0 rounded px-2 py-1 text-xs text-zinc-500 hover:text-[#CAF76F] transition-colors"
                          title="Copy selector"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-zinc-500 mt-2">💡 Paste these selectors in DevTools Console to find the elements: <code className="text-[#CAF76F]">document.querySelector('selector')</code></p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <code className="flex-1 rounded bg-black/40 px-2.5 py-1.5 text-xs font-mono text-[#CAF76F] break-all border border-zinc-700/50">
                      {selector}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selector!);
                      }}
                      className="shrink-0 rounded px-2 py-1 text-xs text-zinc-500 hover:text-[#CAF76F] transition-colors"
                      title="Copy selector"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {issue.qaComment && (
              <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">{getFindingLabel(issue)}</p>
                <p className="text-sm leading-relaxed text-zinc-300 break-words">&ldquo;{issue.qaComment}&rdquo;</p>
              </div>
            )}
            {!issue.qaComment && issue.description && (
              <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Details</p>
                <p className="text-sm leading-relaxed text-zinc-300 break-words">{issue.description}</p>
              </div>
            )}
            {issue.whyFlagged && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">Why we flagged this</p>
                <p className="text-sm leading-relaxed text-zinc-300 break-words">{issue.whyFlagged}</p>
              </div>
            )}
            {multi && locations.length > 0 && (
              <details className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 overflow-hidden">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-400 hover:text-zinc-200">
                  {locations.length} locations
                </summary>
                <ul className="max-h-32 list-none space-y-0.5 overflow-y-auto border-t border-zinc-700/50 px-4 py-3">
                  {[...new Set(locations)].slice(0, 15).map((loc, i) => (
                    <li key={i}>
                      {loc.startsWith('http') ? (
                        <a href={loc} target="_blank" rel="noopener noreferrer" className="block truncate font-mono text-sm text-zinc-400 hover:text-[#CAF76F]" title={loc}>{loc}</a>
                      ) : (
                        <pre className="truncate font-mono text-sm text-zinc-400"><code>{loc}</code></pre>
                      )}
                    </li>
                  ))}
                  {locations.length > 15 && <li className="text-sm text-zinc-500">… and {locations.length - 15} more</li>}
                </ul>
              </details>
            )}
            {issue.fix && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1.5">How to fix</p>
                <p className="text-sm leading-relaxed text-zinc-300 break-words">{issue.fix}</p>
              </div>
            )}
            {showLocationLink && (
              <a
                href={issue.location!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-2 rounded-lg py-2 font-mono text-sm text-zinc-400 hover:text-[#CAF76F] transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="min-w-0 truncate" title={issue.location}>{issue.location}</span>
              </a>
            )}
            {issue.location && !multi && !isEmailProtectionUrl(issue.location) && !issue.location.startsWith('http') && (
              <p className="truncate font-mono text-sm text-zinc-500" title={issue.location}>{issue.location}</p>
            )}
          </div>
        </div>

        {hasCodeColumn && (
          <div className="lg:w-[380px] lg:min-w-[380px] border-t lg:border-t-0 lg:border-l border-zinc-700/50 bg-zinc-950/50 p-4 space-y-3">
            {hasLocationCode && (
              <details className="rounded-lg overflow-hidden" open={false}>
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">Location</summary>
                <CodeBlock code={issue.location!} />
              </details>
            )}
            {issue.suggestedCode && (
              <details className="rounded-lg overflow-hidden" open>
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-500/90 hover:text-emerald-400">Suggested code</summary>
                <CodeBlock code={issue.suggestedCode} />
              </details>
            )}
            {issue.snippet && (
              <details className="rounded-lg overflow-hidden" open={!issue.suggestedCode}>
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-300">Current code</summary>
                <CodeBlock code={issue.snippet} />
              </details>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function GentleReminder({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex items-center gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
      <div>
        <p className="font-semibold text-zinc-200">🐛 You've got quite a bug infestation!</p>
        <p className="mt-0.5 text-sm text-zinc-500">Work through them one critter at a time. Use the severity filter to focus your bug hunt.</p>
      </div>
    </div>
  );
}

function downloadIssuesSheet(result: AnalysisResult & { riskScore?: number; riskLevel?: string }) {
  const headers = ['#', 'Title', 'Category', 'Severity', 'Audience', 'Description', 'QA comment', 'Why flagged', 'Fix', 'Location', 'URL', 'Line', 'Selector', 'Suggested code', 'Snippet'];
  const issues = result.issues ?? [];
  const rows = issues.map((issue, idx) => ({
    '#': idx + 1,
    Title: issue.title,
    Category: issue.category,
    Severity: issue.severity,
    Audience: issue.audience ?? 'technical',
    Description: (issue.description || '').replace(/\r?\n/g, ' '),
    'QA comment': (issue.qaComment || '').replace(/\r?\n/g, ' '),
    'Why flagged': (issue.whyFlagged || '').replace(/\r?\n/g, ' '),
    Fix: (issue.fix || '').replace(/\r?\n/g, ' '),
    Location: isEmailProtectionUrl(issue.location) ? '' : (issue.location || ''),
    URL: isEmailProtectionUrl(issue.url) ? '' : (issue.url || ''),
    Line: issue.line ?? '',
    Selector: issue.selector || '',
    'Suggested code': (issue.suggestedCode || '').replace(/\r?\n/g, ' '),
    Snippet: (issue.snippet || '').replace(/\r?\n/g, ' '),
  }));
  const csvContent = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = String((r as Record<string, string | number>)[h] ?? '');
      const escaped = /[,"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      return escaped;
    }).join(',')),
  ].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bugtellman-issues-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const DEFAULT_SUMMARY = { total: 0, urgent: 0, high: 0, medium: 0, low: 0, minor: 0 } as const;
const DEFAULT_STATS = { totalPages: 0, totalLinks: 0, brokenLinks: 0, totalImages: 0, imagesWithoutAlt: 0 } as const;

export function ResultsPanel({ result }: ResultsPanelProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [viewSection, setViewSection] = useState<ViewSection>('manual');
  if (!result) return null;

  const issues = result.issues ?? [];
  const summary = result.summary ?? DEFAULT_SUMMARY;
  const stats = result.stats ?? DEFAULT_STATS;
  const pageScreenshot = result.pageScreenshot;
  const showScrewed = issues.length >= ISSUE_COUNT_FOR_SCREWED;
  const technical = issues.filter(i => (i.audience ?? 'technical') === 'technical');
  const manual = issues.filter(i => i.audience === 'manual');

  const { groupedTechnical, groupedManual } = useMemo(() => {
    const tech = issues.filter(i => (i.audience ?? 'technical') === 'technical');
    const man = issues.filter(i => i.audience === 'manual');
    return { groupedTechnical: groupSimilarIssues(tech), groupedManual: groupSimilarIssues(man) };
  }, [issues]);

  const filteredGroupedTechnical = filter === 'all' ? groupedTechnical : groupedTechnical.filter(g => g.representative.severity === filter);
  const filteredGroupedManual = filter === 'all' ? groupedManual : groupedManual.filter(g => g.representative.severity === filter);

  return (
    <div className="space-y-6">
      {showScrewed && <GentleReminder show={showScrewed} />}

      {/* Summary strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-700/50 bg-zinc-900/40 px-5 py-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div>
            <span className="text-2xl font-bold text-zinc-100">{summary.total}</span>
            <span className="ml-2 text-zinc-500">issues</span>
          </div>
          <div className="text-sm text-zinc-500">
            {stats.totalPages} {stats.totalPages === 1 ? 'page' : 'pages'}
            {stats.brokenLinks > 0 && <> · <span className="text-amber-400">{stats.brokenLinks} broken links</span></>}
            {stats.imagesWithoutAlt > 0 && <> · <span className="text-sky-400">{stats.imagesWithoutAlt} without alt</span></>}
          </div>
          {result.riskScore != null && result.riskLevel && (
            <span className="rounded-full border border-zinc-600 bg-zinc-800/80 px-3 py-1 text-xs font-semibold text-zinc-300">
              Risk {result.riskScore}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => downloadIssuesSheet(result)}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-zinc-600/80 bg-zinc-800/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-[#CAF76F]/40 hover:bg-zinc-800 hover:text-[#CAF76F]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download CSV
        </button>
      </div>

      {/* Tabs + severity */}
      <div className="flex flex-col gap-4">
        <div className="relative flex rounded-2xl border border-zinc-700/50 bg-zinc-900/40 p-1.5 backdrop-blur-sm">
          <div
            className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl bg-[#CAF76F] transition-all duration-300 ease-out"
            style={{ left: viewSection === 'manual' ? '6px' : 'calc(50% + 3px)' }}
          />
          <button
            onClick={() => setViewSection('manual')}
            className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
              viewSection === 'manual' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Peek-a-Bug
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${viewSection === 'manual' ? 'bg-zinc-900/20 text-zinc-800' : 'bg-zinc-700/50 text-zinc-400'}`}>
              {filteredGroupedManual.length}
            </span>
          </button>
          <button
            onClick={() => setViewSection('technical')}
            className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors ${
              viewSection === 'technical' ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Code Crimes
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${viewSection === 'technical' ? 'bg-zinc-900/20 text-zinc-800' : 'bg-zinc-700/50 text-zinc-400'}`}>
              {filteredGroupedTechnical.length}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mr-1">Severity</span>
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-[#CAF76F] text-zinc-900' : 'bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700/60 hover:text-zinc-300 border border-zinc-700/50'
            }`}
          >
            All
          </button>
          {(['urgent', 'high', 'medium', 'low', 'minor'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setFilter(filter === sev ? 'all' : sev)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors border ${
                filter === sev ? `${SEVERITY[sev].pill} border-current` : 'border-zinc-700/50 bg-zinc-800/60 text-zinc-500 hover:bg-zinc-700/60 hover:text-zinc-300'
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY[sev].dot}`} />
              {SEVERITY[sev].label}
              <span className="opacity-80">({summary[sev]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {viewSection === 'manual' && (
        <section className="space-y-5">
          {pageScreenshot && result.analyzedUrl && (
            <details className="group rounded-2xl border border-zinc-700/50 bg-zinc-900/40 overflow-hidden">
              <summary className="flex cursor-pointer items-center gap-2 px-5 py-3.5 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-300">
                <svg className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Page preview
              </summary>
              <a href={result.analyzedUrl} target="_blank" rel="noopener noreferrer" className="block border-t border-zinc-700/50 p-4">
                <img src={pageScreenshot} alt="Analyzed page" className="max-h-52 w-full rounded-xl object-cover object-top opacity-90 transition-opacity group-open:opacity-100" />
              </a>
            </details>
          )}
          {filteredGroupedManual.length === 0 ? (
            <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/30 py-16 text-center">
              <p className="text-base font-medium text-zinc-400">No bugs found in this category 🎉</p>
              <p className="mt-2 text-sm text-zinc-500">Try &quot;All&quot; or a different severity to catch more critters.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredGroupedManual.map((grouped, i) => (
                <ManualIssueCard key={grouped.representative.id || `m-${i}`} grouped={grouped} pageScreenshot={pageScreenshot} analyzedUrl={result.analyzedUrl} />
              ))}
            </div>
          )}
        </section>
      )}

      {viewSection === 'technical' && (
        <section className="space-y-5">
          {filteredGroupedTechnical.length === 0 ? (
            <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/30 py-16 text-center">
              <p className="text-base font-medium text-zinc-400">No code crimes detected! 🐛✨</p>
              <p className="mt-2 text-sm text-zinc-500">Try &quot;All&quot; or a different severity to hunt for more bugs.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredGroupedTechnical.map((grouped, i) => (
                <TechnicalIssueCard key={grouped.representative.id || `t-${i}`} grouped={grouped} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
