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

const FUNNY_FLAVOR: Record<string, string[]> = {
  urgent: ['🚨 Yikes, this one hurts.', '💀 RIP your production.', '🔥 Someone call 911.'],
  high: ['😬 Oof, that\'s not great.', '📉 Your QA score just wept.', '😅 Might wanna fix this before the client sees it.'],
  medium: ['🤷 Not the end of the world, but...', '👀 Your future self will thank you.', '💡 Free tech debt, anyone?'],
  low: ['🫠 Minor, but still a side-eye.', '😴 Low priority, high judgment.', '✨ It\'s the little things.'],
  minor: ['🥱 Barely worth mentioning. Almost.', '📝 Future you might care.', '🌱 Tiny gremlin in the code.'],
};

function getFunnyFlavor(severity: Severity): string {
  const arr = FUNNY_FLAVOR[severity] || FUNNY_FLAVOR.medium;
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const SEVERITY: Record<Severity, { label: string; dot: string }> = {
  urgent: { label: 'Urgent', dot: 'bg-red-500' },
  high: { label: 'High', dot: 'bg-orange-500' },
  medium: { label: 'Medium', dot: 'bg-amber-500' },
  low: { label: 'Low', dot: 'bg-blue-500' },
  minor: { label: 'Minor', dot: 'bg-emerald-500' },
};

/** Section label unique to the bug type (instead of generic "What I found") */
function getFindingLabel(issue: QAIssue): string {
  const { category, title } = issue;
  if (title.includes('404') || title.includes('Broken link')) return 'Broken link found';
  if (title.includes('Page not found')) return 'Dead link';
  if (category === 'Links') return 'Link issue';
  if (title.includes('alt') || title.includes('Image')) return 'Accessibility note';
  if (category === 'Accessibility') return 'Accessibility issue';
  if (category === 'Security' || title.includes('Mixed content')) return 'Security concern';
  if (category === 'Responsive' || title.includes('viewport')) return 'Responsive design issue';
  if (category === 'HTML Validity' || category === 'HTML Structure') return 'HTML issue';
  if (category === 'HTML Standards') return 'Deprecated HTML';
  if (category === 'CSS Quality' || category === 'CSS Validity' || category === 'CSS Layout') return 'CSS issue';
  if (category === 'Responsive Design') return 'Responsive layout';
  if (category === 'Browser Compatibility') return 'Browser compatibility';
  if (category === 'Resources') return 'Resource loading';
  return 'What I found';
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg border border-zinc-600/60 bg-zinc-950 overflow-hidden">
      {label && (
        <div className="px-3 py-2 border-b border-zinc-700/60 text-xs font-medium text-zinc-400 bg-zinc-900/50">
          {label}
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm scrollbar-thin">
        <code className="font-mono text-zinc-300 whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

function ManualIssueCard({ grouped, pageScreenshot, analyzedUrl }: { grouped: GroupedIssue; pageScreenshot?: string; analyzedUrl?: string }) {
  const issue = grouped.representative;
  const s = SEVERITY[issue.severity];
  const screenshotUrl = issue.screenshotUrl || pageScreenshot;
  const linkHref = issue.url || issue.location || analyzedUrl;
  const showLink = linkHref && (linkHref.startsWith('http') || linkHref.includes('/'));
  const multi = grouped.count > 1;
  const locations = multi ? grouped.occurrences.map(o => o.url || o.location).filter(Boolean) as string[] : [];

  return (
    <article className="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-6 transition-all hover:border-zinc-600/80 hover:bg-zinc-800/50">
      {/* Header: severity + title + X occurrences + tiny screenshot thumbnail */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
            <h4 className="text-base font-semibold text-zinc-100">{issue.title}</h4>
            {multi && (
              <span className="rounded-full bg-zinc-600/50 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                {grouped.count} {grouped.count === 1 ? 'occurrence' : 'occurrences'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">{getFunnyFlavor(issue.severity)}</p>
        </div>
        {screenshotUrl && (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 overflow-hidden rounded-lg border border-zinc-600/60 ring-1 ring-zinc-600/40 transition-opacity hover:opacity-90"
          >
            <img
              src={screenshotUrl}
              alt="Preview"
              className="h-16 w-24 object-cover object-top"
            />
          </a>
        )}
      </div>

      {/* Body: text-first, full width */}
      <div className="mt-5 space-y-4">
        {issue.qaComment && (
          <div className="rounded-lg border-l-4 border-[#CAF76F]/60 bg-zinc-900/50 py-3 pl-4 pr-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#CAF76F]/90">{getFindingLabel(issue)}</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-zinc-300" style={{ wordBreak: 'break-word' }}>
              &ldquo;{issue.qaComment}&rdquo;
            </p>
          </div>
        )}
        {!issue.qaComment && (
          <p className="break-words text-sm leading-relaxed text-zinc-400" style={{ wordBreak: 'break-word' }}>
            {issue.description}
          </p>
        )}

        {showLink && (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[#CAF76F]/20 bg-[#CAF76F]/5 px-4 py-2.5 font-mono text-xs text-[#CAF76F] transition-colors hover:bg-[#CAF76F]/15 hover:border-[#CAF76F]/30"
          >
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="min-w-0 break-all" title={linkHref}>{linkHref}</span>
          </a>
        )}
        {issue.location && !showLink && !multi && (
          <p className="truncate font-mono text-xs text-zinc-500" title={issue.location}>{issue.location}</p>
        )}

        {multi && locations.length > 0 && (
          <details className="rounded-lg border border-zinc-600/60 bg-zinc-900/50">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200">
              {locations.length} {locations.length === 1 ? 'location' : 'locations'}
            </summary>
            <ul className="max-h-40 list-none space-y-1 overflow-y-auto border-t border-zinc-700/60 px-3 py-2">
              {[...new Set(locations)].slice(0, 15).map((loc, i) => (
                <li key={i}>
                  <a href={loc.startsWith('http') ? loc : undefined} target={loc.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="block truncate font-mono text-xs text-[#CAF76F]/90 hover:underline" title={loc}>
                    {loc}
                  </a>
                </li>
              ))}
              {locations.length > 15 && <li className="text-xs text-zinc-500">… and {locations.length - 15} more</li>}
            </ul>
          </details>
        )}

        {issue.fix && (
          <div className="rounded-lg border-l-4 border-emerald-500/60 bg-emerald-500/5 py-3 pl-4 pr-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">How to fix</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-zinc-300" style={{ wordBreak: 'break-word' }}>
              {issue.fix}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function TechnicalIssueCard({ grouped }: { grouped: GroupedIssue }) {
  const issue = grouped.representative;
  const s = SEVERITY[issue.severity];
  const multi = grouped.count > 1;
  const locations = multi ? grouped.occurrences.map(o => o.location || o.url).filter(Boolean) as string[] : [];

  return (
    <article className="w-full rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-6 transition-all hover:border-zinc-600/80 hover:bg-zinc-800/50">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
        <h4 className="text-base font-semibold text-zinc-100">{issue.title}</h4>
        {multi && (
          <span className="rounded-full bg-zinc-600/50 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
            {grouped.count} {grouped.count === 1 ? 'occurrence' : 'occurrences'}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500">{getFunnyFlavor(issue.severity)}</p>

      <div className="mt-5 space-y-4">
        {issue.qaComment && (
          <div className="rounded-lg border-l-4 border-[#CAF76F]/60 bg-zinc-900/50 py-3 pl-4 pr-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#CAF76F]/90">{getFindingLabel(issue)}</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-zinc-300" style={{ wordBreak: 'break-word' }}>
              &ldquo;{issue.qaComment}&rdquo;
            </p>
          </div>
        )}
        {!issue.qaComment && (
          <p className="break-words text-sm leading-relaxed text-zinc-400" style={{ wordBreak: 'break-word' }}>
            {issue.description}
          </p>
        )}

        {issue.whyFlagged && (
          <div className="rounded-lg border-l-4 border-amber-500/60 bg-amber-500/5 py-3 pl-4 pr-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">Why Bugtellman flagged this</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-zinc-300" style={{ wordBreak: 'break-word' }}>
              {issue.whyFlagged}
            </p>
          </div>
        )}

        {issue.location && !multi && (
          issue.location.startsWith('http') ? (
            <a
              href={issue.location}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[#CAF76F]/20 bg-[#CAF76F]/5 px-4 py-2.5 font-mono text-xs text-[#CAF76F] transition-colors hover:bg-[#CAF76F]/15 hover:border-[#CAF76F]/30"
            >
              <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="min-w-0 break-all" title={issue.location}>{issue.location}</span>
            </a>
          ) : (
            <div className="rounded-lg border border-zinc-600/60 bg-zinc-950 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-zinc-700/60 text-xs font-medium text-zinc-400 bg-zinc-900/50">Location</div>
              <pre className="p-4 overflow-x-auto text-sm"><code className="font-mono text-zinc-300">{issue.location}</code></pre>
            </div>
          )
        )}

        {multi && locations.length > 0 && (
          <details className="rounded-lg border border-zinc-600/60 bg-zinc-950 overflow-hidden">
            <summary className="cursor-pointer border-b border-zinc-700/60 bg-zinc-900/50 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200">
              {locations.length} {locations.length === 1 ? 'location' : 'locations'}
            </summary>
            <ul className="max-h-40 list-none space-y-1 overflow-y-auto p-3">
              {[...new Set(locations)].slice(0, 15).map((loc, i) => (
                <li key={i}>
                  {loc.startsWith('http') ? (
                    <a href={loc} target="_blank" rel="noopener noreferrer" className="block truncate font-mono text-xs text-[#CAF76F]/90 hover:underline" title={loc}>{loc}</a>
                  ) : (
                    <pre className="truncate font-mono text-xs text-zinc-300"><code>{loc}</code></pre>
                  )}
                </li>
              ))}
              {locations.length > 15 && <li className="text-xs text-zinc-500">… and {locations.length - 15} more</li>}
            </ul>
          </details>
        )}

        {issue.fix && (
          <div className="rounded-lg border-l-4 border-emerald-500/60 bg-emerald-500/5 py-3 pl-4 pr-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90">How to fix</p>
            <p className="mt-2 break-words text-sm leading-relaxed text-zinc-300" style={{ wordBreak: 'break-word' }}>
              {issue.fix}
            </p>
          </div>
        )}

        {issue.suggestedCode && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400/90">Suggested code</p>
            <CodeBlock code={issue.suggestedCode} />
          </div>
        )}

        {issue.snippet && !issue.suggestedCode && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Current code</p>
            <CodeBlock code={issue.snippet} />
          </div>
        )}
      </div>
    </article>
  );
}

function DudeYoureScrewed({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3500);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-screwed-pop rounded-2xl border border-[#CAF76F]/40 bg-zinc-900/95 px-10 py-8 shadow-2xl shadow-[#CAF76F]/20 backdrop-blur-xl">
        <p className="font-display text-2xl font-bold text-[#CAF76F] sm:text-3xl">Dude, you&apos;re screwed 😬</p>
        <p className="mt-3 text-sm text-zinc-500">(But we believe in you. Fix one at a time.)</p>
      </div>
    </div>
  );
}

function downloadIssuesSheet(result: AnalysisResult & { riskScore?: number; riskLevel?: string }) {
  const headers = ['#', 'Title', 'Category', 'Severity', 'Audience', 'Description', 'QA comment', 'Why flagged', 'Fix', 'Location', 'URL', 'Line', 'Selector', 'Suggested code', 'Snippet'];
  const rows = result.issues.map((issue, idx) => ({
    '#': idx + 1,
    Title: issue.title,
    Category: issue.category,
    Severity: issue.severity,
    Audience: issue.audience ?? 'technical',
    Description: (issue.description || '').replace(/\r?\n/g, ' '),
    'QA comment': (issue.qaComment || '').replace(/\r?\n/g, ' '),
    'Why flagged': (issue.whyFlagged || '').replace(/\r?\n/g, ' '),
    Fix: (issue.fix || '').replace(/\r?\n/g, ' '),
    Location: issue.location || '',
    URL: issue.url || '',
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

export function ResultsPanel({ result }: ResultsPanelProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all');
  const [viewSection, setViewSection] = useState<ViewSection>('manual');
  if (!result) return null;

  const { issues, summary, stats, pageScreenshot } = result;
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
      <DudeYoureScrewed show={showScrewed} />

      {/* Results summary header */}
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Results</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Found {summary.total} {summary.total === 1 ? 'issue' : 'issues'} across {stats.totalPages} {stats.totalPages === 1 ? 'page' : 'pages'} · {stats.brokenLinks} broken links
            </p>
            {result.riskScore != null && result.riskLevel && (
              <p className="mt-1 text-xs text-zinc-500">
                Page risk: <span className="font-medium text-zinc-400">{result.riskScore}</span> ({result.riskLevel})
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => downloadIssuesSheet(result)}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-[#CAF76F]/40 bg-[#CAF76F]/10 px-4 py-2.5 text-sm font-medium text-[#CAF76F] transition-colors hover:bg-[#CAF76F]/20 hover:border-[#CAF76F]/60"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download issues sheet
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
        <button
          onClick={() => setViewSection('manual')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-semibold transition-all ${
            viewSection === 'manual'
              ? 'border-[#CAF76F]/50 bg-[#CAF76F]/15 text-[#CAF76F] ring-1 ring-[#CAF76F]/30'
              : 'border-zinc-600/60 bg-zinc-800/40 text-zinc-400 hover:border-zinc-500/60 hover:bg-zinc-800/60 hover:text-zinc-200'
          }`}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Peek-a-Bug</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${viewSection === 'manual' ? 'bg-[#CAF76F]/20 text-[#CAF76F]' : 'bg-zinc-600/40 text-zinc-500'}`}>
            {filteredGroupedManual.length}
          </span>
        </button>
        <button
          onClick={() => setViewSection('technical')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-semibold transition-all ${
            viewSection === 'technical'
              ? 'border-[#CAF76F]/50 bg-[#CAF76F]/15 text-[#CAF76F] ring-1 ring-[#CAF76F]/30'
              : 'border-zinc-600/60 bg-zinc-800/40 text-zinc-400 hover:border-zinc-500/60 hover:bg-zinc-800/60 hover:text-zinc-200'
          }`}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Code Crimes</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${viewSection === 'technical' ? 'bg-[#CAF76F]/20 text-[#CAF76F]' : 'bg-zinc-600/40 text-zinc-500'}`}>
            {filteredGroupedTechnical.length}
          </span>
        </button>
      </div>

      {/* Severity filter */}
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3">
        <p className="mb-2 text-xs font-medium text-zinc-500">Filter by severity</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
              filter === 'all' ? 'bg-[#CAF76F] text-zinc-900' : 'bg-zinc-700/40 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'
            }`}
          >
            All
          </button>
          {(['urgent', 'high', 'medium', 'low', 'minor'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setFilter(filter === sev ? 'all' : sev)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                filter === sev ? 'bg-[#CAF76F] text-zinc-900' : 'bg-zinc-700/40 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200'
              }`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY[sev].dot}`} />
              {SEVERITY[sev].label}
              <span className={filter === sev ? 'text-zinc-700 font-normal' : 'text-zinc-500'}>({summary[sev]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {viewSection === 'manual' && (
        <section className="space-y-4">
          {/* Page preview - compact, collapsible style */}
          {pageScreenshot && result.analyzedUrl && (
            <details className="group rounded-xl border border-zinc-700/60 bg-zinc-800/40">
              <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200">
                <svg className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Page preview
              </summary>
              <a
                href={result.analyzedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block border-t border-zinc-700/60 p-3"
              >
                <img src={pageScreenshot} alt="Analyzed page" className="max-h-48 w-full rounded-lg object-cover object-top opacity-90 transition-opacity group-open:opacity-100" />
              </a>
            </details>
          )}
          <div className="space-y-5">
            {filteredGroupedManual.length === 0 ? (
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/30 py-16 px-6 text-center">
                <p className="text-base font-medium text-zinc-400">No issues in this category</p>
                <p className="mt-1 text-sm text-zinc-500">Try selecting &quot;All&quot; or a different severity filter</p>
              </div>
            ) : (
              filteredGroupedManual.map((grouped, i) => (
                <ManualIssueCard key={grouped.representative.id || `m-${i}`} grouped={grouped} pageScreenshot={pageScreenshot} analyzedUrl={result.analyzedUrl} />
              ))
            )}
          </div>
        </section>
      )}

      {viewSection === 'technical' && (
        <section className="space-y-5">
          {filteredGroupedTechnical.length === 0 ? (
            <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/30 py-16 px-6 text-center">
              <p className="text-base font-medium text-zinc-400">No code issues in this category</p>
              <p className="mt-1 text-sm text-zinc-500">Try selecting &quot;All&quot; or a different severity filter</p>
            </div>
          ) : (
            filteredGroupedTechnical.map((grouped, i) => (
              <TechnicalIssueCard key={grouped.representative.id || `t-${i}`} grouped={grouped} />
            ))
          )}
        </section>
      )}
    </div>
  );
}
