import { analyzeHTML, extractLinks, extractCSSUrls } from './html-analyzer';
import { analyzeCSS } from './css-analyzer';
import type { AnalysisResult, QAIssue, WebsiteFile } from './types';

export type { AnalysisResult, QAIssue, Severity, WebsiteFile } from './types';

export async function analyzeWebsite(
  files: WebsiteFile[],
  options?: { check404?: boolean; baseUrl?: string }
): Promise<{ result: AnalysisResult; progress: number }> {
  const allIssues: QAIssue[] = [];
  const htmlFiles = files.filter(f => f.type === 'html');
  const cssFiles = files.filter(f => f.type === 'css');
  const totalSteps = htmlFiles.length + cssFiles.length + (options?.check404 ? 1 : 0);
  let progress = 0;

  // Analyze HTML files
  for (const file of htmlFiles) {
    const issues = analyzeHTML(file.content, options?.baseUrl);
    issues.forEach(i => {
      i.location = i.location || file.name;
      allIssues.push(i);
    });
    progress = Math.round(((htmlFiles.indexOf(file) + 1) / totalSteps) * 80);
  }

  // Analyze CSS files
  for (const file of cssFiles) {
    const issues = analyzeCSS(file.content, file.name);
    allIssues.push(...issues);
    progress = Math.round(((htmlFiles.length + cssFiles.indexOf(file) + 1) / totalSteps) * 80);
  }

  // Collect all links for 404 check
  const allLinks: { href: string; source: string }[] = [];
  htmlFiles.forEach(f => {
    const links = extractLinks(f.content, options?.baseUrl);
    links.forEach(l => allLinks.push({ href: l.href, source: f.name }));
  });

  let brokenLinks: { href: string; status: number }[] = [];
  if (options?.check404 && allLinks.length > 0) {
    const uniqueUrls = [...new Set(allLinks.map(l => l.href))];
    const toCheck = uniqueUrls.filter(u => u.startsWith('http'));
    for (let i = 0; i < Math.min(toCheck.length, 50); i++) {
      try {
        const res = await fetch(toCheck[i]!, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (res.status >= 400) {
          brokenLinks.push({ href: toCheck[i]!, status: res.status });
          allIssues.push({
            id: `issue-404-${i}`,
            category: 'Links',
            severity: res.status === 404 ? 'high' : 'medium',
            audience: 'manual',
            title: res.status === 404 ? '404 - Page not found' : `Broken link (${res.status})`,
            description: `Link returns HTTP ${res.status}: ${toCheck[i]}`,
            qaComment: res.status === 404
              ? 'I clicked this link and got a 404 error. The page doesn’t exist — it’s either moved, deleted, or the URL is wrong. Users will see a broken page.'
              : `This link returns HTTP ${res.status} when I try to open it. It’s not loading correctly — could be a server error, forbidden, or the page was removed.`,
            fix: res.status === 404
              ? 'Update the link to the correct URL, or remove it if the page no longer exists. If the page moved, add a redirect (301) from the old URL.'
              : 'Check if the URL is correct. If it’s an external link, verify the target site is up. For internal links, fix the path or add proper error handling.',
            location: toCheck[i],
            url: toCheck[i],
          });
        }
      } catch {
        allIssues.push({
          id: `issue-404-${i}`,
          category: 'Links',
          severity: 'medium',
          audience: 'manual',
          title: 'Link may be unreachable',
          description: `Could not verify link: ${toCheck[i]}`,
          qaComment: 'I couldn’t reach this link when testing — it might be behind a firewall, CORS-blocked, or the server might be down. Users could have the same problem.',
          fix: 'If it’s an external link, ensure the target is accessible. For internal links, verify the path. Consider adding a fallback or error state for broken links.',
          location: toCheck[i],
          url: toCheck[i],
        });
      }
    }
  }

  // Count images
  const totalImages = htmlFiles.reduce((acc, f) => {
    const match = f.content.match(/<img[^>]*>/gi);
    return acc + (match?.length || 0);
  }, 0);
  const imagesWithoutAlt = htmlFiles.reduce((acc, f) => {
    const match = f.content.match(/<img(?![^>]*alt=)[^>]*>/gi);
    return acc + (match?.length || 0);
  }, 0);

  const summary = {
    total: allIssues.length,
    urgent: allIssues.filter(i => i.severity === 'urgent').length,
    high: allIssues.filter(i => i.severity === 'high').length,
    medium: allIssues.filter(i => i.severity === 'medium').length,
    low: allIssues.filter(i => i.severity === 'low').length,
    minor: allIssues.filter(i => i.severity === 'minor').length,
  };

  const result: AnalysisResult = {
    issues: allIssues.sort(severityOrder),
    summary,
    stats: {
      totalPages: htmlFiles.length,
      totalLinks: allLinks.length,
      brokenLinks: brokenLinks.length,
      totalImages,
      imagesWithoutAlt,
    },
  };

  return { result, progress: 100 };
}

function severityOrder(a: QAIssue, b: QAIssue): number {
  const order: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
    minor: 4,
  };
  return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
}

export { analyzeHTML, analyzeCSS, extractLinks, extractCSSUrls };

export { runAutomatedTests } from './automated-testing';
export type { AutomatedTestResult, AutomatedTestOptions } from './automated-testing';
