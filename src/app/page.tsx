'use client';

import { useState, useEffect } from 'react';
import { FileDropZone } from '@/components/FileDropZone';
import { LoadingBar } from '@/components/LoadingBar';
import { ResultsPanel } from '@/components/ResultsPanel';
import { AutomatedTestPanel } from '@/components/AutomatedTestPanel';
import { LadybugIcon, BeetleIcon, BeeIcon, ButterflyIcon } from '@/components/BugIcons';
import { usePersistence } from '@/lib/persistence/use-persistence';
import type { AnalysisResult } from '@/lib/qa-engine';
import type { AutomatedTestResult } from '@/lib/qa-engine/automated-testing';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [qaTestResult, setQaTestResult] = useState<AutomatedTestResult | null>(null);
  const [previousSnapshot, setPreviousSnapshot] = useState<{ url: string; snapshot: AutomatedTestResult['visualRegression']['snapshot'] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'url' | 'files'>('url');
  
  // Data persistence hook
  const { isInitialized, saveAnalysis, getAnalysisByUrl } = usePersistence();

  useEffect(() => {
    // #region agent log
    const titleEl = document.querySelector('h1');
    if (titleEl) {
      const computedFont = getComputedStyle(titleEl).fontFamily;
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:20',message:'Title font check',data:{computedFont,hasPhonk:computedFont.includes('Phonk')},timestamp:Date.now(),runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    }
    // #endregion
  }, []);

  // Load previous snapshot from persistence when URL changes
  useEffect(() => {
    if (!isInitialized || !url.trim()) return;

    async function loadPreviousSnapshot() {
      try {
        const persisted = await getAnalysisByUrl(url.trim());
        if (persisted?.snapshot) {
          setPreviousSnapshot({ url: url.trim(), snapshot: persisted.snapshot });
        }
      } catch (err) {
        // Silently fail - persistence is optional
        console.warn('Failed to load previous snapshot:', err);
      }
    }

    loadPreviousSnapshot();
  }, [url, isInitialized, getAnalysisByUrl]);

  async function analyzeByUrl() {
    if (!url.trim()) return;
    const trimmedUrl = url.trim();
    setLoading(true);
    setError(null);
    setResult(null);
    setQaTestResult(null);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:28',message:'Starting analyzeByUrl',data:{url:trimmedUrl,hasPreviousSnapshot:!!previousSnapshot},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const [analyzeRes, qaRes] = await Promise.all([
        fetch('/api/analyze-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmedUrl }),
        }),
        fetch('/api/qa-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: trimmedUrl,
            previousSnapshot: previousSnapshot?.url === trimmedUrl ? previousSnapshot.snapshot : undefined,
          }),
        }),
      ]);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:44',message:'API responses received',data:{analyzeResOk:analyzeRes.ok,qaResOk:qaRes.ok,analyzeStatus:analyzeRes.status,qaStatus:qaRes.status},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const analyzeData = await analyzeRes.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:47',message:'analyzeData parsed',data:{hasError:!!analyzeData.error,hasIssues:!!analyzeData.issues},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      let qaData = null;
      if (qaRes.ok) {
        try {
          qaData = await qaRes.json();
        } catch (parseError) {
          // QA test API returned ok but response body is not valid JSON - log and continue
          console.warn('QA test response was ok but JSON parsing failed:', parseError);
        }
      }
      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Analysis failed');
      setResult(analyzeData);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:58',message:'Setting result state',data:{issuesCount:analyzeData?.issues?.length || 0},timestamp:Date.now(),runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (qaRes.ok && qaData) {
        setQaTestResult(qaData);
        const snapshot = qaData.visualRegression?.snapshot;
        if (snapshot) {
          setPreviousSnapshot({ url: trimmedUrl, snapshot });
        }
        
        // Persist analysis results
        if (isInitialized) {
          try {
            await saveAnalysis(
              trimmedUrl,
              analyzeData,
              qaData,
              snapshot || null
            );
          } catch (persistError) {
            // Log but don't fail - persistence is optional
            console.warn('Failed to persist analysis:', persistError);
          }
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:63',message:'QA test result set',data:{hasSnapshot:!!snapshot},timestamp:Date.now(),runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
      } else {
        // Persist analysis even without QA test results
        if (isInitialized && analyzeData) {
          try {
            await saveAnalysis(trimmedUrl, analyzeData, null, null);
          } catch (persistError) {
            console.warn('Failed to persist analysis:', persistError);
          }
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:67',message:'QA test skipped',data:{qaResOk:qaRes.ok,hasQaData:!!qaData},timestamp:Date.now(),runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:70',message:'Error caught',data:{error:e instanceof Error ? e.message : 'Unknown',errorType:e instanceof Error ? e.constructor.name : typeof e},timestamp:Date.now(),runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:75',message:'analyzeByUrl completed',data:{},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  }

  async function analyzeByFiles(files: File[]) {
    setLoading(true);
    setError(null);
    setResult(null);
    setQaTestResult(null);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:84',message:'Starting analyzeByFiles',data:{filesCount:files.length,fileNames:files.map(f=>f.name)},timestamp:Date.now(),runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      const res = await fetch('/api/analyze-files', {
        method: 'POST',
        body: formData,
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:92',message:'analyze-files response received',data:{resOk:res.ok,status:res.status},timestamp:Date.now(),runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      const data = await res.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:95',message:'analyze-files data parsed',data:{hasError:!!data.error,hasIssues:!!data.issues,issuesCount:data?.issues?.length || 0},timestamp:Date.now(),runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setResult(data);
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0ce93f20-60b8-4990-8edd-ef497586694e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:100',message:'analyzeByFiles error',data:{error:e instanceof Error ? e.message : 'Unknown'},timestamp:Date.now(),runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#1a1b1e]">
      {/* Background — dark but not too dark */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,rgba(202,247,111,0.08),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_100%_0%,rgba(202,247,111,0.05),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_0%_80%,rgba(202,247,111,0.04),transparent_50%)]" />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '64px 64px' }}
      />
      <div className="pointer-events-none fixed left-1/4 top-1/4 h-96 w-96 animate-float rounded-full bg-[#CAF76F]/10 blur-3xl" />
      <div className="pointer-events-none fixed right-1/4 top-1/2 h-80 w-80 animate-glow-pulse rounded-full bg-[#CAF76F]/[0.08] blur-3xl" />

      {/* Decorative bugs */}
      <div className="pointer-events-none fixed left-8 top-1/4 opacity-40">
        <LadybugIcon className="h-12 w-12 bug-crawl" color="#52525b" />
      </div>
      <div className="pointer-events-none fixed right-12 top-1/3 opacity-35" style={{ animationDelay: '-5s' }}>
        <BeetleIcon className="h-14 w-14 bug-crawl" color="#52525b" />
      </div>
      <div className="pointer-events-none fixed left-1/4 bottom-1/3 opacity-30">
        <BeeIcon className="h-10 w-10 bug-crawl" color="#52525b" />
      </div>
      <div className="pointer-events-none fixed right-1/4 bottom-1/4 opacity-40" style={{ animationDelay: '-10s' }}>
        <ButterflyIcon className="h-10 w-10 bug-crawl" color="#52525b" />
      </div>
      <div className="pointer-events-none fixed right-8 top-1/2 opacity-25">
        <LadybugIcon className="h-8 w-8 bug-crawl" color="#52525b" />
      </div>

      <div className="relative flex flex-1 flex-col">
        {/* Header — new editorial layout */}
        <header className="flex flex-col items-center px-6 pt-16 pb-12 text-center sm:pt-24 sm:pb-14">
          <div className="mb-4 flex items-center justify-center gap-2">
            <LadybugIcon className="h-10 w-10 sm:h-12 sm:w-12" />
            <h1 className="font-title text-4xl font-black tracking-tight text-zinc-100 sm:text-6xl sm:tracking-[-0.03em]">
              Bugtellman
            </h1>
          </div>
          <p className="max-w-md text-sm text-zinc-500 sm:text-base">
            Catch the bugs before they catch you
          </p>
        </header>

        <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-12 sm:px-8">
          {/* Mode toggle */}
          <div className="relative mb-6 flex rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-2 backdrop-blur-xl">
            <div
              className="absolute top-2 h-[calc(100%-16px)] rounded-xl bg-[#CAF76F] transition-all duration-300 ease-out"
              style={{
                width: 'calc(50% - 12px)',
                left: mode === 'url' ? '8px' : 'calc(50% + 4px)',
              }}
            />
            <button
              onClick={() => { setMode('url'); setResult(null); setQaTestResult(null); setError(null); }}
              className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors ${
                mode === 'url' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              URL
            </button>
            <button
              onClick={() => { setMode('files'); setResult(null); setQaTestResult(null); setError(null); }}
              className={`relative z-10 flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors ${
                mode === 'files' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Files
            </button>
          </div>

          {/* Input area */}
          <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-8 backdrop-blur-xl">
            {mode === 'url' ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && analyzeByUrl()}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-zinc-600/80 bg-zinc-900/80 px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-[#CAF76F]/50 focus:ring-1 focus:ring-[#CAF76F]/30"
                />
                <button
                  onClick={analyzeByUrl}
                  disabled={loading || !url.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#CAF76F] px-6 py-3.5 text-sm font-bold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <BeetleIcon className="h-5 w-5" />
                  Analyze
                </button>
              </div>
            ) : (
              <FileDropZone onFiles={analyzeByFiles} disabled={loading} />
            )}

            <LoadingBar isActive={loading} message={mode === 'url' ? 'Analyzing & running QA tests...' : 'Scanning files...'} />
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400 backdrop-blur-sm">
              {error}
            </div>
          )}
        </div>

        {result && (
          <div className="mt-12 w-full max-w-6xl mx-auto px-6 pb-12 sm:px-8 space-y-8">
            <ResultsPanel result={result} />
            {qaTestResult && (
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-6">
                <AutomatedTestPanel result={qaTestResult} />
              </div>
            )}
          </div>
        )}

        {qaTestResult && !result && (
          <div className="mt-12 w-full max-w-6xl mx-auto px-6 pb-12 sm:px-8">
            <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-6">
              <AutomatedTestPanel result={qaTestResult} />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-auto border-t border-zinc-200/10 bg-zinc-900/50 backdrop-blur-xl">
          <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
            <p className="text-center text-xs text-zinc-500">
              by <span className="font-semibold text-zinc-400">Mikhael Baytelman</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://mikegtc.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-300/30 px-3 py-2 text-xs text-zinc-500 transition-colors hover:border-[#CAF76F]/40 hover:text-[#CAF76F]"
              >
                mikegtc.com
              </a>
              <a
                href="https://btlr.com/mikhael"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-zinc-300/30 px-3 py-2 text-xs text-zinc-500 transition-colors hover:border-[#CAF76F]/40 hover:text-[#CAF76F]"
              >
                Portfolio
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
