import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { analyzeHTML, analyzeCSS, extractLinks } from '@/lib/qa-engine';
import { runValidationPipeline, mergeValidationIntoResult } from '@/lib/engine';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
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
    const allIssues: Awaited<ReturnType<typeof analyzeHTML>>[number][] = [];

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

    // Fetch and analyze linked CSS
    const cssLinks = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get();
    for (const href of cssLinks.slice(0, 10)) {
      try {
        const cssUrl = new URL(href, baseUrl).href;
        const cssRes = await fetch(cssUrl, { signal: AbortSignal.timeout(5000) });
        if (cssRes.ok) {
          const css = await cssRes.text();
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

    // Check links for 404
    // HEAD can return 404 while GET returns 200 (server doesn't support HEAD). Retry with GET before reporting.
    const links = extractLinks(html, baseUrl);
    const uniqueUrls = [...new Set(links.map(l => l.href))].filter(u => u.startsWith('http'));
    for (let i = 0; i < Math.min(uniqueUrls.length, 30); i++) {
      try {
        let res = await fetch(uniqueUrls[i]!, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)' },
        });
        if (res.status === 404) {
          const getRes = await fetch(uniqueUrls[i]!, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bugtellman QA/1.0)' },
          });
          if (getRes.status >= 200 && getRes.status < 300) continue;
        }
        if (res.status === 404) {
          allIssues.push({
            id: `issue-404-${i}`,
            category: 'Links',
            severity: 'high',
            audience: 'manual',
            pageUrl: uniqueUrls[i],
            title: '404 - Page not found',
            description: `Link returns 404: ${uniqueUrls[i]}`,
            qaComment: 'I clicked this link and got a 404 error. The page doesn’t exist — it’s either moved, deleted, or the URL is wrong. Users will see a broken page.',
            fix: 'Update the link to the correct URL, or remove it if the page no longer exists. If the page moved, add a redirect (301) from the old URL.',
            location: uniqueUrls[i],
            url: uniqueUrls[i],
          });
        } else if (res.status >= 400) {
          allIssues.push({
            id: `issue-404-${i}`,
            category: 'Links',
            severity: 'medium',
            audience: 'manual',
            pageUrl: uniqueUrls[i],
            title: `Broken link (${res.status})`,
            description: `Link returns HTTP ${res.status}: ${uniqueUrls[i]}`,
            qaComment: `This link returns HTTP ${res.status} when I try to open it. It’s not loading correctly — could be a server error, forbidden, or the page was removed.`,
            fix: 'Check if the URL is correct. If it’s an external link, verify the target site is up. For internal links, fix the path or add proper error handling.',
            location: uniqueUrls[i],
            url: uniqueUrls[i],
          });
        }
      } catch {
        // Skip - could be CORS, timeout, etc.
      }
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
          .filter((p): p is string => !!p && p !== '/' && !p.startsWith('#'))
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

    // Run validation pipeline: detector → validation → scoring → decision
    const { issues: validatedIssues, risk } = runValidationPipeline(allIssues);
    const severityOrder = ['urgent', 'high', 'medium', 'low', 'minor'] as const;
    validatedIssues.sort((a, b) =>
      severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
    );

    // Fetch precise screenshots for each manual issue (reported only)
    const manualIssues = validatedIssues.filter(
      (i) => i.audience === 'manual' && i.verdict !== 'ignore'
    );
    const screenshotLimit = 8;
    for (let idx = 0; idx < Math.min(manualIssues.length, screenshotLimit); idx++) {
      const issue = manualIssues[idx]!;
      try {
        let screenshotUrl: string | undefined;
        const targetUrl = issue.pageUrl || issue.url || parsedUrl.href;

        if (issue.url && (issue.title.includes('404') || issue.title.includes('Broken link'))) {
          // 404/broken: screenshot the error page
          const res = await fetch(
            `https://api.microlink.io/?url=${encodeURIComponent(issue.url)}&screenshot=true&meta=false`,
            { signal: AbortSignal.timeout(6000) }
          );
          const data = await res.json();
          if (data?.status === 'success' && data?.data?.screenshot?.url) {
            screenshotUrl = data.data.screenshot.url;
          }
        } else if (issue.screenshotSelector && targetUrl) {
          // Element screenshot
          const params = new URLSearchParams({
            url: targetUrl,
            screenshot: 'true',
            'screenshot.element': issue.screenshotSelector,
            meta: 'false',
          });
          if (issue.screenshotDevice) {
            params.set('device', issue.screenshotDevice);
          }
          const res = await fetch(`https://api.microlink.io/?${params}`, {
            signal: AbortSignal.timeout(8000),
          });
          const data = await res.json();
          if (data?.status === 'success' && data?.data?.screenshot?.url) {
            screenshotUrl = data.data.screenshot.url;
          }
        } else if (targetUrl && !issue.screenshotUrl) {
          // Fallback: full page screenshot
          const res = await fetch(
            `https://api.microlink.io/?url=${encodeURIComponent(targetUrl)}&screenshot=true&meta=false`,
            { signal: AbortSignal.timeout(6000) }
          );
          const data = await res.json();
          if (data?.status === 'success' && data?.data?.screenshot?.url) {
            screenshotUrl = data.data.screenshot.url;
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

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
