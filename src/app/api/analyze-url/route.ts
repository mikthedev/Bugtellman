import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { analyzeHTML, analyzeCSS, extractLinks } from '@/lib/qa-engine';
import { runAuthCheck } from '@/lib/qa-engine/auth-check';
import { runValidationPipeline, mergeValidationIntoResult } from '@/lib/engine';

type LinkCheckOutcome =
  | { kind: 'ok' }
  | { kind: 'broken'; status: number }
  | { kind: 'inconclusive'; status?: number };

const BOT_OR_POLICY_STATUSES = new Set([401, 403, 405, 429]);

/** Hide issues that reference email-protection (e.g. Cloudflare) links to avoid exposing obfuscated emails. */
function isEmailProtectionUrl(s: string | undefined): boolean {
  return !!s && /email-protection/i.test(s);
}

async function checkLinkStatus(url: string): Promise<LinkCheckOutcome> {
  const requestInit = {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)' },
    signal: AbortSignal.timeout(5000),
    redirect: 'follow' as const,
  };

  try {
    let response = await fetch(url, {
      ...requestInit,
      method: 'HEAD',
    });

    // HEAD is commonly blocked or unsupported. Retry with GET before deciding.
    if (!response.ok || BOT_OR_POLICY_STATUSES.has(response.status)) {
      response = await fetch(url, {
        ...requestInit,
        method: 'GET',
      });
    }

    if (response.ok) return { kind: 'ok' };

    // 404/410 are clear broken links; 5xx is likely unreachable from user perspective.
    if (response.status === 404 || response.status === 410 || response.status >= 500) {
      return { kind: 'broken', status: response.status };
    }

    // Auth, anti-bot, throttling, or policy restrictions are not reliable broken-link signals.
    if (BOT_OR_POLICY_STATUSES.has(response.status)) {
      return { kind: 'inconclusive', status: response.status };
    }

    return { kind: 'inconclusive', status: response.status };
  } catch {
    return { kind: 'inconclusive' };
  }
}

export async function POST(req: NextRequest) {
  try {
    // #region agent log
    console.log('[DEBUG] analyze-url POST called');
    // #endregion
    const { url } = await req.json();
    // #region agent log
    console.log('[DEBUG] analyze-url received url:', url);
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

    const baseUrl = parsedUrl.origin;
    let allIssues: Awaited<ReturnType<typeof analyzeHTML>>[number][] = [];

    // Fetch main page
    const mainRes = await fetch(parsedUrl.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)' },
      signal: AbortSignal.timeout(15000),
    });

    if (!mainRes.ok) {
      return NextResponse.json({
        error: `Failed to fetch: ${mainRes.status} ${mainRes.statusText}`,
      }, { status: 400 });
    }

    const html = await mainRes.text();
    const $ = cheerio.load(html);

    // Analyze main HTML
    allIssues.push(...analyzeHTML(html, baseUrl, parsedUrl.href));

    // Fetch and analyze linked CSS; track which files have @media so we don't falsely claim "no responsive CSS"
    const cssLinks = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get();
    const pageHasMediaQueriesInSomeCss = { current: false };
    for (const href of cssLinks.slice(0, 10)) {
      try {
        const cssUrl = new URL(href, baseUrl).href;
        const cssRes = await fetch(cssUrl, { signal: AbortSignal.timeout(5000) });
        if (cssRes.ok) {
          const css = await cssRes.text();
          if (/@media\s/i.test(css)) pageHasMediaQueriesInSomeCss.current = true;
          allIssues.push(...analyzeCSS(css, cssUrl));
        }
      } catch {
        allIssues.push({
          id: `issue-css-${Math.random()}`,
          category: 'Resources',
          severity: 'medium',
          audience: 'manual',
          title: 'CSS file could not be loaded',
          description: `Failed to fetch: ${href}`,
          qaComment: 'The stylesheet failed to load when I tried to fetch it. The page might be missing styles or broken layout — could be a wrong path, CORS, or the file is down.',
          fix: 'Check the href path is correct. For relative paths, ensure they resolve from the page URL. If the file is on another domain, CORS headers may be needed.',
          location: href,
        });
      }
    }
    // If at least one stylesheet has @media, don't report "no media queries" — the site has responsive CSS
    if (pageHasMediaQueriesInSomeCss.current) {
      allIssues = allIssues.filter((i) => i.title !== 'No media queries in this CSS file');
    }

    // Check links for 404
    // HEAD can return 404 while GET returns 200 (server doesn't support HEAD). Retry with GET before reporting.
    const links = extractLinks(html, baseUrl);
    const uniqueUrls = [...new Set(links.map(l => l.href))].filter(u => u.startsWith('http'));
    for (let i = 0; i < Math.min(uniqueUrls.length, 30); i++) {
      const url = uniqueUrls[i]!;
      const outcome = await checkLinkStatus(url);

      if (outcome.kind !== 'broken') continue;

      const isNotFound = outcome.status === 404 || outcome.status === 410;
      allIssues.push({
        id: `issue-404-${i}`,
        category: 'Links',
        severity: isNotFound ? 'high' : 'medium',
        audience: 'manual',
        pageUrl: url,
        title: isNotFound ? '404 - Page not found' : `Broken link (${outcome.status})`,
        description: isNotFound
          ? `Link returns ${outcome.status}: ${url}`
          : `Link returns HTTP ${outcome.status}: ${url}`,
        qaComment: isNotFound
          ? 'I clicked this link and got a not-found error. The page appears missing or moved, so users will hit a dead end.'
          : `I tried opening this link and got an HTTP ${outcome.status} server error. Users may not be able to access the destination reliably.`,
        fix: isNotFound
          ? 'Update the link to the correct URL, or remove it if the page no longer exists. If the page moved, add a redirect (301) from the old URL.'
          : 'Check the destination service health and URL validity. If this endpoint is temporarily unstable, monitor and retry before shipping.',
        location: url,
        url,
      });
    }

    // Discover subpages from same domain
    const subpageLinks = Array.from(
      new Set(
        $('a[href]')
          .map((_, el) => $(el).attr('href'))
          .get()
          .filter((h): h is string => !!h && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('tel:'))
          .map(h => {
            try {
              const u = new URL(h, baseUrl);
              return u.origin === parsedUrl.origin ? u.pathname : null;
            } catch {
              return null;
            }
          })
          .filter((p): p is string => !!p && p !== '/' && !p.startsWith('#') && !/email-protection/i.test(p))
      )
    ).slice(0, 5);

    for (const path of subpageLinks) {
      try {
        const pageUrl = new URL(path, baseUrl);
        const pageRes = await fetch(pageUrl.href, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        if (pageRes.ok) {
          const pageHtml = await pageRes.text();
          const pageIssues = analyzeHTML(pageHtml, baseUrl, pageUrl.href);
          pageIssues.forEach(i => {
            i.location = i.location || path;
            allIssues.push(i);
          });
        } else if (pageRes.status === 404) {
          allIssues.push({
            id: `issue-404-page-${path}`,
            category: 'Links',
            severity: 'high',
            audience: 'manual',
            title: '404 - Page not found',
            description: `Link to ${path} returns 404`,
            qaComment: `I followed a link to ${path} and got a 404. This internal page is missing or the route is wrong. Users clicking it will hit a dead end.`,
            fix: 'Fix the link path or create the missing page. If the page was moved, add a redirect so old links still work.',
            location: path,
            url: pageUrl.href,
            pageUrl: pageUrl.href,
          });
        }
      } catch {
        // Skip failed fetches
      }
    }

    const totalImages = (html.match(/<img[^>]*>/gi) || []).length;
    const imagesWithoutAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;

    // Deep check for login/register flows (discovery + form structure, security, a11y)
    const authCheck = await runAuthCheck(html, baseUrl, parsedUrl.href, {
      fetchAuthPages: true,
      maxAuthPagesToFetch: 5,
    });
    for (const issue of authCheck.issues) {
      allIssues.push({
        ...issue,
        pageUrl: issue.pageUrl || issue.url || parsedUrl.href,
        url: issue.url || issue.pageUrl || parsedUrl.href,
        location: issue.url || issue.selector || 'Login/Register',
      });
    }

    // Never show issues that reference email-protection links (could expose obfuscated emails)
    allIssues = allIssues.filter(
      (i) =>
        !isEmailProtectionUrl(i.url) &&
        !isEmailProtectionUrl(i.pageUrl) &&
        !isEmailProtectionUrl(i.location)
    );

    // Run validation pipeline: detector → validation → scoring → decision
    // #region agent log
    console.log('[DEBUG] Running validation pipeline, issues count:', allIssues.length);
    // #endregion
    const { issues: validatedIssues, risk } = runValidationPipeline(allIssues);
    // #region agent log
    console.log('[DEBUG] Validation complete, validated issues:', validatedIssues.length, 'risk:', risk);
    // #endregion
    const severityOrder = ['urgent', 'high', 'medium', 'low', 'minor'] as const;
    validatedIssues.sort((a, b) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );

    // Fetch precise screenshots for each manual issue (reported only)
    const manualIssues = validatedIssues.filter(
      (i) => i.audience === 'manual' && i.verdict !== 'ignore'
    );
    
    // Track unique selector+pageUrl combinations to avoid duplicate screenshots
    const screenshotCache = new Map<string, string>();
    
    // Prioritize issues with selectors for element screenshots
    const issuesWithSelectors = manualIssues.filter(
      (i) => i.screenshotSelector || i.selector
    );
    const issuesWithoutSelectors = manualIssues.filter(
      (i) => !i.screenshotSelector && !i.selector
    );
    // Process selector-based issues first, then others
    const prioritizedIssues = [...issuesWithSelectors, ...issuesWithoutSelectors];
    
    const screenshotLimit = 15; // Increased limit to capture more element screenshots
    let screenshotsGenerated = 0;
    
    for (let idx = 0; idx < prioritizedIssues.length && screenshotsGenerated < screenshotLimit; idx++) {
      const issue = prioritizedIssues[idx]!;
      try {
        let screenshotUrl: string | undefined;
        const targetUrl = issue.pageUrl || issue.url || parsedUrl.href;
        
        // Use selector or screenshotSelector (selector takes precedence as it's more reliable)
        const elementSelector = issue.selector || issue.screenshotSelector;
        
        // Create cache key for this selector+pageUrl combination
        const cacheKey = elementSelector && targetUrl 
          ? `${targetUrl}::${elementSelector}` 
          : targetUrl || '';

        if (issue.url && (issue.title.includes('404') || issue.title.includes('Broken link'))) {
          // 404/broken: screenshot the error page
          const cacheKey404 = `404::${issue.url}`;
          if (screenshotCache.has(cacheKey404)) {
            screenshotUrl = screenshotCache.get(cacheKey404);
          } else {
            const res = await fetch(
              `https://api.microlink.io/?url=${encodeURIComponent(issue.url)}&screenshot=true&meta=false`,
              { signal: AbortSignal.timeout(6000) }
            );
            const data = await res.json();
            if (data?.status === 'success' && data?.data?.screenshot?.url) {
              const url = data.data.screenshot.url;
              screenshotUrl = url;
              screenshotCache.set(cacheKey404, url);
              screenshotsGenerated++;
            }
          }
        } else if (elementSelector && targetUrl) {
          // Element screenshot - prioritize this for pinpointed issues
          if (screenshotCache.has(cacheKey)) {
            screenshotUrl = screenshotCache.get(cacheKey);
          } else {
            const params = new URLSearchParams({
              url: targetUrl,
              screenshot: 'true',
              'screenshot.element': elementSelector,
              meta: 'false',
            });
            if (issue.screenshotDevice) {
              params.set('device', issue.screenshotDevice);
            }
            const res = await fetch(`https://api.microlink.io/?${params}`, {
              signal: AbortSignal.timeout(12000), // Increased timeout for element screenshots
            });
            const data = await res.json();
            if (data?.status === 'success' && data?.data?.screenshot?.url) {
              const url = data.data.screenshot.url;
              screenshotUrl = url;
              screenshotCache.set(cacheKey, url);
              screenshotsGenerated++;
            }
          }
        } else if (targetUrl && !issue.screenshotUrl) {
          // Fallback: full page screenshot (only if not already cached)
          if (!screenshotCache.has(cacheKey)) {
            const res = await fetch(
              `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false`,
              { signal: AbortSignal.timeout(6000) }
            );
            const data = await res.json();
            if (data?.status === 'success' && data?.data?.screenshot?.url) {
              const url = data.data.screenshot.url;
              screenshotUrl = url;
              screenshotCache.set(cacheKey, url);
              screenshotsGenerated++;
            }
          } else {
            screenshotUrl = screenshotCache.get(cacheKey);
          }
        }

        if (screenshotUrl) {
          issue.screenshotUrl = screenshotUrl;
        }
      } catch {
        // Skip failed screenshot
      }
    }

    // Page screenshot for Manual section header (legacy)
    let pageScreenshot: string | undefined;
    try {
      const screenshotRes = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(parsedUrl.href)}&screenshot=true&meta=false`,
        { signal: AbortSignal.timeout(8000) }
      );
      const screenshotData = await screenshotRes.json();
      if (screenshotData?.status === 'success' && screenshotData?.data?.screenshot?.url) {
        pageScreenshot = screenshotData.data.screenshot.url;
      }
    } catch {
      // Screenshot optional
    }

    const result = mergeValidationIntoResult(
      {
        issues: validatedIssues,
        pageScreenshot,
        analyzedUrl: parsedUrl.href,
        summary: { total: 0, urgent: 0, high: 0, medium: 0, low: 0, minor: 0 },
        stats: {
          totalPages: 1 + subpageLinks.length,
          totalLinks: links.length,
          brokenLinks: validatedIssues.filter(i => i.category === 'Links' && i.title.includes('404')).length,
          totalImages,
          imagesWithoutAlt,
        },
      },
      validatedIssues,
      risk,
      true
    );

    // #region agent log
    console.log('[DEBUG] analyze-url returning result, issues:', result.issues?.length || 0);
    // #endregion
    return NextResponse.json(result);
  } catch (err) {
    console.error('[DEBUG] analyze-url error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
