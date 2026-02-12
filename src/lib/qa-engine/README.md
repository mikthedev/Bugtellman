# QA Engine – Deeper Testing

The automated QA layer runs **deeper interactions** to improve coverage and results.

## What Runs

### 1. User Journey (expanded)
- **CTAs**: Buttons and links (login, checkout, sign up, contact, about, docs, support, etc.).
- **Primary nav**: All links inside the first `<nav>` and `<header>` (same-origin, up to 15).
- **Content links**: Same-origin links from `<main>`, `<article>`, or fallback `body` (up to 15 when enabled).
- **Forms**: Every form on the page (deduplicated by action).
- **Multi-step**: For each successful navigation, the runner fetches that page and tests 1–2 inner links (depth 2).

Defaults: up to **25 flows**, **2 inner links per reached page**.

### 2. State Testing (richer)
- **Input types**: `text`, `email`, `number`, `url`, `tel`, `password`, `search`, `date`, `time`, `month`, `week`, `datetime-local`, `checkbox`, `select`, `textarea`.
- **States per input**: empty, invalid, boundary, valid.
- **Pattern**: When `pattern` is set, invalid value respects it (e.g. single char for regex).
- **Per-form**: Inputs are tied to the correct form (action/method).

Defaults: up to **8 inputs** per run, **4 states** per input.

### 3. Visual Regression
- DOM snapshot for the current page; compared to `previousSnapshot` when provided (e.g. second run on same URL).

### 4. Performance
- Navigation and form-submit timing for same-origin links (including relative URLs).
- **Summary**: Count of metrics over `slowThresholdMs` (default 3000 ms).

## Result Shape

- **summary**: Passed/total for user journey (and second-level), state testing, visual diff count, and slow performance count.
- **userJourney.results[].secondLevel**: For each nav flow, optional inner-link checks (from that page).

## Options (API / `runAutomatedTests`)

| Option | Default | Description |
|--------|---------|-------------|
| `maxFlows` | 25 | Max user-journey flows to run |
| `maxInputs` | 8 | Max form inputs for state testing |
| `maxNavLinks` | 8 | Max links for performance checks |
| `includeContentLinks` | true | Include content-area same-origin links in journey |
| `multiStep` | true | Run second-level (inner link) checks after successful nav |
| `slowThresholdMs` | 3000 | Treat performance metrics above this as “slow” in summary |
| `previousSnapshot` | — | For visual regression comparison |

## Possible Next Steps (even deeper)

- **Browser-based runs**: Use Playwright/Puppeteer for real JS execution, screenshots, and real LCP/FCP.
- **More depth**: Configurable `maxSecondLevelPerFlow` or depth-3 (follow links from inner pages).
- **Accessibility**: Integrate axe-core or similar on the server or in a browser run.
