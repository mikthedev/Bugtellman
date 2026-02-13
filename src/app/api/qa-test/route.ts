import { NextRequest, NextResponse } from 'next/server';
import { runAutomatedTests } from '@/lib/qa-engine/automated-testing';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // #region agent log
    console.log('[DEBUG] qa-test POST called');
    // #endregion
    const body = await req.json();
    const { url, previousSnapshot } = body as { url?: string; previousSnapshot?: object };
    // #region agent log
    console.log('[DEBUG] qa-test received url:', url, 'hasSnapshot:', !!previousSnapshot);
    // #endregion

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const response = await fetch(parsedUrl.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();

    // #region agent log
    console.log('[DEBUG] Running automated tests');
    // #endregion
    const result = await runAutomatedTests(html, parsedUrl.origin, {
      previousSnapshot: previousSnapshot as import('@/lib/qa-engine/visual-regression').DOMSnapshot | undefined,
      pageUrl: parsedUrl.href,
    });
    // #region agent log
    console.log('[DEBUG] Automated tests complete, has result:', !!result);
    // #endregion

    return NextResponse.json(result);
  } catch (err) {
    console.error('[DEBUG] qa-test error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'QA test failed' },
      { status: 500 }
    );
  }
}
