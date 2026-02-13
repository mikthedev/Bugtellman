# Bugtellman — Intelligent QA for Websites

**Catch the bugs before they catch you.**

An intelligent QA tool that analyzes websites for bugs, accessibility issues, layout problems, broken links (404s), and more. Combines detectors, a **Decision Intelligence Layer**, and a **Human-Behavior Testing Layer** so results feel like a senior QA review, not a linter dump.

## Pipeline

```
scanner → detectors → behavior engine → logic engine → judgment engine → results
                    ↘ intelligence layer (filter, rank, reduce false positives)
```

- **Detectors** (qa-engine): HTML/CSS/link/accessibility/resource checks.
- **Behavior engine** (behaviorEngine): Explores user flows, edge cases, state rules; finds logical and interaction inconsistencies.
- **Logic engine**: Expectation validation and inconsistency detection (part of behaviorEngine).
- **Judgment engine**: Turns behavior/logic outputs into reportable findings (behaviorEngine).
- **Intelligence layer** (intelligence): Intent analysis, user-impact validation, verdict (report/ignore/downgrade), importance ranking, result optimization. Reduces noise and ranks issues like a human QA.

## What Bugtellman Can Do

### Two Analysis Modes

- **URL mode**: Enter any live website URL — Bugtellman fetches the page, follows linked CSS, discovers subpages (same domain), and checks external links for 404s
- **File drop**: Drag and drop your HTML, CSS, and JS files for local analysis (no network needed)

### URL Analysis

- Fetches the main page and follows up to 10 linked stylesheets
- Discovers up to 5 internal subpages and analyzes them
- Checks up to 30 external links for 404 and other HTTP errors
- Captures screenshots of the page and per-issue thumbnails (via Microlink API)
- **Automated QA tests** (run with Analyze): user journey (nav + forms + multi-step inner links), form state testing (empty/invalid/boundary/valid), visual regression baseline, performance metrics, and **authentication checks** (login/register form discovery, security validation, input validation testing)

### Authentication Testing

Bugtellman automatically discovers and tests authentication forms (login, register, signin, signup):

- **Discovery**: Finds auth links and forms on the main page and linked auth pages
- **Security checks**: Validates CSRF tokens, password field security, form structure
- **Input validation**: Tests invalid credentials, malformed inputs (email, phone, etc.), empty required fields
- **Accessibility**: Checks form labels, error messages, and ARIA attributes
- **Consistency**: Validates form structure and field requirements across discovered auth pages

### Issue Categories

| Category | Examples |
|----------|----------|
| **Links** | 404s, broken links, placeholder links (`#`, `javascript:void(0)`) |
| **Accessibility** | Missing alt text, form labels, heading hierarchy, empty buttons, tables without headers |
| **HTML** | Missing DOCTYPE, missing `lang`, duplicate IDs, deprecated elements (`<center>`, `<font>`, `<marquee>`) |
| **Responsive** | Missing viewport meta, no media queries, fixed widths that overflow on mobile |
| **Security** | Mixed content (HTTP links on HTTPS pages) |
| **CSS** | Empty rules, excessive `!important`, invalid hex colors, z-index abuse, vendor prefixes |
| **Resources** | Failed CSS loads |
| **Authentication** | Missing CSRF tokens, insecure password fields, missing form validation, invalid credential acceptance, accessibility issues in auth forms |

### Results Panel

- **Peek-a-Bug** (manual): UI-facing issues with QA-style comments, screenshots, and fix instructions
- **Code Crimes** (technical): Code-level issues with suggested fixes, `whyFlagged` explanations, and code snippets
- **Automated QA Test Results**: User journey pass/fail, state tests, visual diffs, performance, and authentication checks (when URL analyzed)
- Severity filter: Urgent → High → Medium → Low → Minor
- Stats: total pages, broken links, images without alt

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Enter URL**: Type a site URL (e.g. `https://example.com`) and click Analyze
2. **Drop Files**: Switch to "Drop Files" and drag HTML/CSS/JS files

Results are sorted by severity: **Urgent** → **High** → **Medium** → **Low** → **Minor**

## Architecture (lib)

| Folder | Purpose |
|--------|---------|
| **qa-engine** | Detectors (HTML, CSS, links, a11y, resources), automated tests (user journey, state, visual regression, performance, **auth-check** for login/register forms) |
| **engine** | Validation pipeline: reproducibility, impact, aggregation, component awareness, flow validator, confidence, decision, risk |
| **intelligence** | Decision Intelligence Layer: intent analyzer, context validator, issue judge, importance ranker, result optimizer. Filters noise and ranks like a human QA. |
| **behaviorEngine** | Human-Behavior Testing Layer: explorer, edge-case tester, state tester, expectation validator, inconsistency detector, judgment engine. Simulates user testing and finds behavioral/logical/interaction bugs. |

See each folder's `README.md` for module details and integration.

## Recent Improvements

- **Enhanced Error Handling**: Improved resilience when QA test APIs fail - main analysis continues successfully even if automated tests encounter issues
- **Custom Typography**: Updated title font to Phonk for a bold, distinctive look
