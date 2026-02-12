'use client';

import type { AutomatedTestResult } from '@/lib/qa-engine/automated-testing';

interface AutomatedTestPanelProps {
  result: AutomatedTestResult | null;
}

export function AutomatedTestPanel({ result }: AutomatedTestPanelProps) {
  if (!result) return null;

  const { userJourney, stateTesting, visualRegression, performance, authCheck, summary } = result;
  const ujPassed = summary?.userJourney?.passed ?? userJourney.results.filter(r => r.success).length;
  const ujTotal = summary?.userJourney?.total ?? userJourney.results.length;
  const secondLevel = summary?.userJourney;
  const authSummary = summary?.authCheck ?? authCheck?.summary;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-100">Automated QA Test Results</h2>

      {/* Summary bar */}
      {summary && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3 text-sm">
          <span className="text-zinc-400">
            User journey: <strong className={ujPassed === ujTotal ? 'text-emerald-400' : 'text-amber-400'}>{ujPassed}/{ujTotal}</strong>
            {secondLevel && secondLevel.secondLevelTotal > 0 && (
              <span className="ml-1 text-zinc-500">(inner: {secondLevel.secondLevelPassed}/{secondLevel.secondLevelTotal})</span>
            )}
          </span>
          <span className="text-zinc-400">
            State tests: <strong className={(summary.stateTesting?.withFailures ?? 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}>{summary.stateTesting?.passed ?? 0}/{summary.stateTesting?.total ?? 0}</strong>
            {(summary.stateTesting?.withFailures ?? 0) > 0 && (
              <span className="text-amber-400"> · {summary.stateTesting?.withFailures} with issues</span>
            )}
          </span>
          {(summary.visualRegression?.diffCount ?? 0) > 0 && (
            <span className="text-amber-400">Visual diffs: {summary.visualRegression?.diffCount}</span>
          )}
          {(summary.performance?.slowCount ?? 0) > 0 && (
            <span className="text-amber-400">Slow (&gt;{summary.performance?.thresholdMs ?? 0}ms): {summary.performance?.slowCount}/{summary.performance?.total}</span>
          )}
          {authSummary && (
            <span className="text-zinc-400">
              Auth (login/register): {authSummary.found ? 'found' : 'none'} · {authSummary.issuesCount} issue(s)
              {authSummary.highOrUrgentCount > 0 && (
                <span className="text-amber-400"> · {authSummary.highOrUrgentCount} high/urgent</span>
              )}
            </span>
          )}
        </div>
      )}

      {/* User Journey */}
      <section className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-5 py-4">
        <h3 className="text-sm font-semibold text-zinc-300">User Journey Testing</h3>
        <p className="mt-1 text-xs text-zinc-500">
          {ujTotal} flow(s) · {ujPassed} passed
          {secondLevel && secondLevel.secondLevelTotal > 0 && ` · ${secondLevel.secondLevelPassed}/${secondLevel.secondLevelTotal} inner links passed`}
        </p>
        <div className="mt-3 space-y-2">
          {userJourney.results.map((r, i) => (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 text-xs ${
                r.success ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
              }`}
            >
              <span className="font-medium">{r.success ? '✓' : '✗'}</span> {r.path.join(' → ')}
              {r.secondLevel && r.secondLevel.length > 0 && (
                <div className="mt-2 ml-3 border-l-2 border-zinc-600/60 pl-2 space-y-1">
                  {r.secondLevel.map((s, k) => (
                    <div key={k} className={s.success ? 'text-zinc-500' : 'text-amber-400'}>
                      → {s.testedUrl.replace(/^https?:\/\/[^/]+/, '')} {s.success ? '✓' : `✗ ${s.statusCode ?? 'error'}`}
                    </div>
                  ))}
                </div>
              )}
              {r.failures.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-zinc-400">
                  {r.failures.map((f, j) => (
                    <li key={j}>{f.title}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* State Testing */}
      <section className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-5 py-4">
        <h3 className="text-sm font-semibold text-zinc-300">State Testing</h3>
        <p className="mt-1 text-xs text-zinc-500">
          {stateTesting.length} input state(s) tested
          {summary && (summary.stateTesting?.withFailures ?? 0) > 0 && ` · ${summary.stateTesting.withFailures} with validation issues`}
        </p>
        <div className="mt-3 space-y-2">
          {stateTesting.slice(0, 12).map((s, i) => (
            <div key={i} className="rounded-lg border border-zinc-600/60 px-3 py-2 text-xs">
              <span className="text-zinc-400">{s.inputName}</span> • {s.state} • {s.value.slice(0, 30)}
              {s.failures.length > 0 && (
                <span className="ml-2 text-amber-400">{s.failures.length} issue(s)</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Visual Regression */}
      <section className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-5 py-4">
        <h3 className="text-sm font-semibold text-zinc-300">Visual Regression</h3>
        <p className="mt-1 text-xs text-zinc-500">
          {visualRegression.visualDiffs.length} visual diff(s)
        </p>
        {visualRegression.visualDiffs.length > 0 ? (
          <div className="mt-3 space-y-2">
            {visualRegression.visualDiffs.map((d, i) => (
              <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                <span className="font-medium text-amber-400">{d.changeType}</span> {d.selector}
                <p className="mt-1 text-zinc-500">{d.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No visual regressions detected</p>
        )}
      </section>

      {/* Auth (Login/Register) deep check */}
      {authCheck && (
        <section className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-300">Login / Register check</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {authCheck.found
              ? `${authCheck.discoveries.length} auth flow(s) found · ${authCheck.summary.loginFound ? 'Login' : ''}${authCheck.summary.loginFound && authCheck.summary.registerFound ? ' · ' : ''}${authCheck.summary.registerFound ? 'Register' : ''}`
              : 'No login/register links or forms detected on this page'}
            {authCheck.summary.loginFound && (
              <span className="block mt-1 text-zinc-500">Login forms are submitted with invalid credentials to detect faulty acceptance. Email, phone, and other fields are tested with invalid input (e.g. numbers in email, letters in phone, empty/short values) to check validation.</span>
            )}
          </p>
          {authCheck.found && authCheck.discoveries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {authCheck.discoveries.map((d, i) => (
                <span
                  key={i}
                  className="rounded-md border border-zinc-600/60 bg-zinc-800/60 px-2.5 py-1 text-xs text-zinc-300"
                >
                  {d.kind}: {d.label} ({d.inferredType})
                </span>
              ))}
            </div>
          )}
          {authCheck.issues.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-zinc-400">{authCheck.issues.length} issue(s) from deep check</p>
              {authCheck.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    issue.severity === 'urgent' || issue.severity === 'high'
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  <span className="font-medium capitalize text-zinc-200">{issue.severity}</span> · {issue.title}
                  <p className="mt-1 text-zinc-500">{issue.description}</p>
                  {issue.fix && <p className="mt-1 text-zinc-400">Fix: {issue.fix}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Performance */}
      <section className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-5 py-4">
        <h3 className="text-sm font-semibold text-zinc-300">Performance</h3>
        <p className="mt-1 text-xs text-zinc-500">
          {performance.metrics.length} metric(s)
          {summary && summary.performance.slowCount > 0 && ` · ${summary.performance.slowCount} slower than ${summary.performance.thresholdMs}ms`}
        </p>
        <div className="mt-3 space-y-2">
          {performance.metrics.map((m, i) => (
            <div key={i} className="rounded-lg border border-zinc-600/60 px-3 py-2 text-xs">
              <span className="text-zinc-400">{m.type}</span> • {m.durationMs}ms
              {m.url && <span className="ml-2 truncate text-zinc-500">{m.url.slice(0, 40)}...</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
