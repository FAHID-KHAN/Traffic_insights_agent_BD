# Traffic Insight BD — Complete Architecture & Developer Guide

> A full reference for how every layer of the project was built, how the  
> pieces connect to each other, and what every file and dependency does.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Repository Layout](#2-repository-layout)
3. [Technology Stack & Why Each Was Chosen](#3-technology-stack--why-each-was-chosen)
4. [Backend Architecture (Python / FastAPI)](#4-backend-architecture-python--fastapi)
   - 4.1 Entry Point — `run.py`
   - 4.2 Application Factory — `app/server.py`
   - 4.3 Configuration — `app/config.py`
   - 4.4 Database Layer — `app/database.py`
   - 4.5 Scraper — `app/scraper.py`
   - 4.6 NLP Extractor — `app/extractor.py`
   - 4.7 API Routes — `app/routes.py`
   - 4.8 Rate Limiter — `app/rate_limit.py`
   - 4.9 Scheduler — `app/scheduler.py`
5. [Frontend Architecture (React / Vite)](#5-frontend-architecture-react--vite)
   - 5.1 Entry Point — `main.jsx`
   - 5.2 App Root — `App.jsx`
   - 5.3 Routing Strategy
   - 5.4 Pages (lazy-loaded route components)
   - 5.5 Shared Components
   - 5.6 Utility Hooks & Helpers
   - 5.7 Styles — `global.css`
6. [Data Pipeline — End-to-End Flow](#6-data-pipeline--end-to-end-flow)
7. [API Reference](#7-api-reference)
8. [Database Schema](#8-database-schema)
9. [Build System & Vite Configuration](#9-build-system--vite-configuration)
10. [PWA Support](#10-pwa-support)
11. [Dev vs Production Modes](#11-dev-vs-production-modes)
12. [Running the Project](#12-running-the-project)
13. [Testing](#13-testing)
14. [Docker & Deployment](#14-docker--deployment)
15. [Security Model](#15-security-model)
16. [Dependency Map (What Uses What)](#16-dependency-map-what-uses-what)
17. [Component–API–Data Wiring Table](#17-componentapidata-wiring-table)
18. [Design System & CSS Architecture](#18-design-system--css-architecture)

---

## 1. Project Overview

**Traffic Insight BD** is a full-stack single-page application that:

1. **Scrapes** accident news from *The Daily Star* Bangladesh.
2. **Extracts** structured data (location, district, deaths, injuries, accident type) from raw article text using regex-based NLP.
3. **Stores** everything in a local SQLite database.
4. **Serves** a FastAPI JSON API consumed by a React SPA.
5. **Visualises** the data across nine pages: dashboard, daily, monthly, danger map, danger zones, compare, search, records, and community.

The key architectural decision is **one process, one port**: FastAPI serves both the JSON API at `/api/*` and the compiled React SPA at `/`. There is no separate Node server in production.

---

## 2. Repository Layout

```
Traffic_insights_agent_BD/
│
├── app/                        # Python backend package
│   ├── __init__.py
│   ├── config.py               # All config / env vars
│   ├── database.py             # SQLite schema + context manager
│   ├── extractor.py            # NLP extraction from article text
│   ├── rate_limit.py           # In-memory sliding-window rate limiter
│   ├── routes.py               # All FastAPI endpoint definitions
│   ├── scheduler.py            # APScheduler background scrape job
│   ├── scraper.py              # The Daily Star HTTP scraper
│   └── server.py               # FastAPI app factory + lifecycle
│
├── frontend/                   # React 19 SPA (Vite)
│   ├── public/                 # Static assets (icons, favicon)
│   │   ├── favicon.png
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── src/
│   │   ├── App.jsx             # Router tree + providers
│   │   ├── main.jsx            # React DOM entry point
│   │   ├── components/         # Reusable UI components
│   │   │   ├── AlertBanner.jsx
│   │   │   ├── BDLogo.jsx
│   │   │   ├── ChartCard.jsx
│   │   │   ├── ClusterTimeline.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   ├── ForecastChart.jsx
│   │   │   ├── Layout.jsx
│   │   │   ├── LiveNews.jsx
│   │   │   ├── ReportCard.jsx
│   │   │   ├── SplashScreen.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── TimeHeatmap.jsx
│   │   │   ├── ToastContainer.jsx
│   │   │   ├── YoYSummary.jsx
│   │   │   └── YouTubeNews.jsx
│   │   ├── pages/              # One file per route
│   │   │   ├── CommunityFeed.jsx
│   │   │   ├── Compare.jsx
│   │   │   ├── Daily.jsx
│   │   │   ├── DangerMap.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Monthly.jsx
│   │   │   ├── NotFound.jsx
│   │   │   ├── Records.jsx
│   │   │   ├── SearchPage.jsx
│   │   │   └── Zones.jsx
│   │   ├── styles/
│   │   │   └── global.css      # Single stylesheet (~4100 lines)
│   │   ├── utils/
│   │   │   ├── api.js          # fetch wrappers + shared helpers
│   │   │   ├── useTheme.jsx    # Dark/light theme context
│   │   │   └── useToast.js     # Toast notification hook
│   │   └── __tests__/         # Vitest unit tests
│   ├── vite.config.js
│   └── package.json
│
├── static/                     # Served by FastAPI
│   ├── dist/                   # Vite build output (generated, git-ignored)
│   └── uploads/reports/        # User-uploaded images for community reports
│
├── data/
│   └── accidents.db            # SQLite database (git-ignored)
│
├── tests/                      # Python pytest suite
│   ├── conftest.py
│   ├── test_database.py
│   ├── test_extractor.py
│   ├── test_routes.py
│   └── test_security.py
│
├── scripts/                    # Utility scripts
├── docs/                       # Extra documentation
├── run.py                      # Python server entry point
├── start.sh                    # One-command dev launcher
├── Makefile                    # Common task shortcuts
├── requirements.txt            # Python dependencies
├── pyproject.toml              # Python project metadata
├── Dockerfile                  # Container image
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── .env.development
├── .env.production
└── GUIDE.md                    # ← this file
```

---

## 3. Technology Stack & Why Each Was Chosen

### Backend

| Package | Version | Role | Why |
|---|---|---|---|
| **FastAPI** | 0.115 | HTTP framework + OpenAPI | Automatic validation, async, fast, built-in docs at `/docs` |
| **Uvicorn** | 0.30 | ASGI server | Works with FastAPI, hot-reload in dev |
| **SQLite** (stdlib) | — | Database | Zero setup, file-based, sufficient for single-process; WAL mode for concurrency |
| **requests** | 2.32 | HTTP client for scraper | Simple, session-based, widely known |
| **BeautifulSoup4** | 4.12 | HTML parser | Tolerant of messy real-world HTML |
| **lxml** | ≥5.3 | BS4 fast parser backend | Speed; used via `html.parser` fallback too |
| **APScheduler** | 3.10 | Background job scheduler | Runs the scraper every N hours inside the same process |
| **python-multipart** | — | File upload support | Required for FastAPI `File(...)` uploads (community reports) |

### Frontend

| Package | Version | Role | Why |
|---|---|---|---|
| **React** | 19 | UI library | Latest concurrent features, automatic batching |
| **react-dom** | 19 | DOM renderer | Paired with React 19 |
| **Vite** | 7.3 | Build tool + dev server | Extremely fast HMR, native ESM, built-in code-splitting |
| **react-router-dom** | 7.13 | Client-side routing | Nested routes, `NavLink` active state, `Outlet` layout pattern |
| **Chart.js** | 4.5 | Canvas charting engine | Fully declarative, great performance, responsive |
| **react-chartjs-2** | 5.3 | React wrapper for Chart.js | Syncs React lifecycle with Chart.js canvas |
| **leaflet** | 1.9 | Interactive maps | Open-source, powerful, works offline |
| **react-leaflet** | 5.0 | React wrapper for Leaflet | First-class React integration |
| **leaflet.heat** | 0.2 | Heatmap layer for Leaflet | Accident density visualisation |
| **leaflet.markercluster** | 1.5 | Cluster markers | Prevents map clutter with many pins |
| **react-icons** | 5.5 | Icon library | Includes FontAwesome, Material, Feather; tree-shakeable |
| **vite-plugin-pwa** | 1.2 | PWA / service worker | Install to home screen, offline caching via Workbox |

### Dev/Test Tools

| Package | Role |
|---|---|
| **Vitest** | Unit test runner (compatible with Vite config) |
| **@testing-library/react** | Component testing utilities |
| **jsdom** | DOM simulation for tests |
| **ESLint** + plugins | Linting with React Hooks rules |
| **pytest** | Python backend tests |

---

## 4. Backend Architecture (Python / FastAPI)

### 4.1 Entry Point — `run.py`

```
run.py  →  app.server.create_app()  →  uvicorn.run()
```

`run.py` is the script you execute directly (`python run.py`). It:

1. Calls `create_app()` to get a configured `FastAPI` instance.
2. Passes it to `uvicorn.run()` with `reload=True` in development.

In production (via Docker), it is invoked the same way; `APP_ENV=production` disables reload and changes log level to `warning`.

---

### 4.2 Application Factory — `app/server.py`

The **factory pattern** is used so the app can be instantiated multiple times (e.g., in tests) without global state leaking.

`create_app()` does the following in order:

1. **Creates** a `FastAPI(lifespan=lifespan)` instance.
2. **Adds CORS middleware** — in development allows all origins (`*`); in production locked to `CORS_ORIGINS`.
3. **Adds `SecurityHeadersMiddleware`** — injects `X-Content-Type-Options`, `X-Frame-Options`, CSP, etc. on every response.
4. **Mounts the API router** — all routes from `app/routes.py` are registered under `/api`.
5. **Mounts static files** — `static/dist/assets` served at `/assets`; `static/uploads` at `/uploads`.
6. **Adds SPA catch-all** — any request that does not match an API route returns `static/dist/index.html` so the React Router can handle client-side navigation.

The `lifespan` async context manager (FastAPI 0.95+ pattern) handles startup/shutdown:

- **Startup**: `db.init_db()` creates tables if they do not exist; `start_scheduler()` starts the APScheduler background job.
- **Shutdown**: `scheduler.shutdown()` cleanly stops the background job.

---

### 4.3 Configuration — `app/config.py`

All configuration lives in one file and reads from environment variables with sensible defaults. Key constants:

| Variable | Default | Description |
|---|---|---|
| `APP_ENV` | `development` | Switches between dev/prod behaviour |
| `DB_PATH` | `data/accidents.db` | SQLite file location |
| `STATIC_DIR` | `static/` | Where Vite build output lands |
| `SCRAPE_INTERVAL_HOURS` | `6` | How often the scheduler runs |
| `MAX_PAGES_PER_SCRAPE` | `5` | Safety cap on scraper pagination |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `BANGLADESH_DISTRICTS` | list (75 entries) | Used by the NLP extractor |
| `BANGLADESH_DIVISIONS` | list (10 entries) | Used by the NLP extractor |
| `ACCIDENT_TYPES` | list (30+ patterns) | Regex seeds for type detection |

The two `.env.development` / `.env.production` files are loaded by the OS or a process manager before the app starts — they are not read inside the Python code itself; production sets `APP_ENV=production`.

---

### 4.4 Database Layer — `app/database.py`

**Design**: a thin wrapper around Python's `sqlite3` standard library. No ORM.

#### Schema (4 tables)

```
articles            — raw scraped news articles
accidents           — structured accident records extracted from articles
scrape_logs         — one row per scrape run (for diagnostics)
reports             — user-submitted community accident reports
report_comments     — comments on community reports
```

#### Key patterns

**Thread-safe context manager**:
```python
@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```
Every route handler wraps its queries in `with db.get_db() as conn:`. This ensures automatic commit/rollback and connection cleanup, and is safe across Uvicorn's thread pool.

**WAL mode**: `PRAGMA journal_mode=WAL` is set on every connection. This allows concurrent reads while a write is in progress — important because the background scheduler writes while API requests read.

**Performance indexes**: separate indexes on `accident_date`, `district`, `division`, `accident_type`, and `article_id` keep queries fast even as the dataset grows.

---

### 4.5 Scraper — `app/scraper.py`

`DailyStarScraper` uses a `requests.Session` to:

1. **Paginate** `thedailystar.net/tags/road-accident` (up to `MAX_PAGES_PER_SCRAPE`).
2. For each article link found, **check** if the URL already exists in `articles` (deduplication via `UNIQUE` constraint).
3. **Fetch and parse** new articles using BeautifulSoup.
4. **Extract** date, title, content and call `insert_article()`.
5. Each new article is then passed to `extractor.py` to extract structured accident data.
6. Log the run in `scrape_logs`.

A `REQUEST_DELAY` sleep between requests avoids hammering the source server.

---

### 4.6 NLP Extractor — `app/extractor.py`

Pure regex + string search — no ML model; fast and dependency-free.

Given article text it returns a dict with:

| Field | How extracted |
|---|---|
| `accident_type` | Scans text against `ACCIDENT_TYPES` keyword list |
| `district` | Finds first occurrence of any `BANGLADESH_DISTRICTS` name |
| `division` | Finds first occurrence of any `BANGLADESH_DIVISIONS` name |
| `latitude/longitude` | Looked up from `DISTRICT_COORDINATES` dict |
| `deaths` | Regex: `(\d+)\s+(?:people?\s+)?(?:were\s+)?killed` etc. |
| `injuries` | Regex: `(\d+)\s+(?:people?\s+)?\b(?:injured|hurt)\b` etc. |
| `vehicles_involved` | Looks for bus, truck, car, motorcycle tokens |
| `summary` | First 2–3 sentences of article body |

The extracted dict is passed to `insert_accident()` which writes to the `accidents` table linked to the `article_id`.

---

### 4.7 API Routes — `app/routes.py`

All prefixed `/api` via `router = APIRouter(prefix="/api")`.

#### Full endpoint list

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/overview` | Total accidents, deaths, injuries, today's stats, last scrape |
| `GET` | `/api/daily` | Stats for a specific date (`?date=YYYY-MM-DD`) |
| `GET` | `/api/monthly` | Stats for a year+month (`?year=&month=`) |
| `GET` | `/api/danger-zones` | Top N districts ranked by total accidents |
| `GET` | `/api/recent` | Latest N accident records |
| `GET` | `/api/map-data` | All accidents with lat/lon for map plotting |
| `GET` | `/api/yearly` | Aggregated stats by year |
| `GET` | `/api/scrape-logs` | History of scrape runs |
| `POST` | `/api/scrape` | Manually trigger a scrape (rate-limited: 5 calls/60 s) |
| `GET` | `/api/articles/latest` | Latest scraped article summaries |
| `GET` | `/api/youtube-videos` | YouTube search results for BD road accident news |
| `GET` | `/api/compare/monthly` | Side-by-side monthly stats for two date ranges |
| `GET` | `/api/compare/yearly` | Side-by-side yearly stats |
| `GET` | `/api/divisions` | Per-division aggregated stats |
| `GET` | `/api/danger-index` | Composite danger score per district |
| `GET` | `/api/search` | Full-text search over accidents (`?q=`) |
| `GET` | `/api/trend` | 30-day rolling accident + death + injury counts |
| `GET` | `/api/search/advanced` | Filter by district, type, date range, min casualties |
| `GET` | `/api/alerts/high-severity` | Accidents with deaths ≥ threshold in recent N days |
| `GET` | `/api/forecast` | Simple linear-regression accident count forecast |
| `GET` | `/api/time-patterns` | Accidents grouped by hour-of-day and day-of-week |
| `GET` | `/api/export/csv` | Download all accident records as a CSV file |
| `GET` | `/api/reports` | Community-submitted reports |
| `POST` | `/api/reports` | Submit a new community report (with optional images) |
| `POST` | `/api/reports/{id}/upvote` | Upvote a report |
| `GET` | `/api/reports/{id}/comments` | Fetch comments for a report |
| `POST` | `/api/reports/{id}/comments` | Post a comment |

---

### 4.8 Rate Limiter — `app/rate_limit.py`

`RateLimiter` is a minimal sliding-window limiter keyed by client IP.

- Stores a list of timestamps per IP in a plain `dict`.
- Thread-safe via `threading.Lock`.
- Used on `POST /api/scrape`: max 5 calls per 60 seconds.
- Returns `HTTP 429` with a `Retry-After` header if the limit is exceeded.

> For multi-worker / multi-node deployments, swap the in-memory dict for a Redis backend.

---

### 4.9 Scheduler — `app/scheduler.py`

`APScheduler.BackgroundScheduler` runs inside the same Python process.

- Fires `_scheduled_scrape()` every `SCRAPE_INTERVAL_HOURS` hours (default: 6).
- `max_instances=1` prevents overlapping runs if a scrape takes longer than the interval.
- Started in the `lifespan` startup hook, shut down in the lifespan cleanup.

---

## 5. Frontend Architecture (React / Vite)

### 5.1 Entry Point — `main.jsx`

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

Imports `global.css` globally and mounts the React tree onto `<div id="root">` in `static/dist/index.html`.

---

### 5.2 App Root — `App.jsx`

`App` is the composition root. It wires together:

```
<ErrorBoundary>              ← catches unhandled render errors
  <ThemeProvider>            ← dark/light theme context (localStorage)
    <SplashScreen />         ← shown once on first load, then hidden
    <BrowserRouter>
      <Suspense>             ← lazy-chunk loading fallback (spinner)
        <Routes>
          <Route element={<Layout />}>   ← persistent shell (header, nav, footer)
            <Route index   → Dashboard />
            <Route daily   → Daily />
            <Route monthly → Monthly />
            <Route map     → DangerMap />
            <Route zones   → Zones />
            <Route compare → Compare />
            <Route search  → SearchPage />
            <Route records → Records />
            <Route community → CommunityFeed />
            <Route *       → NotFound />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </ThemeProvider>
</ErrorBoundary>
```

Every page component is **lazy-loaded** (`React.lazy` + dynamic `import()`). Vite automatically splits each page into its own JS chunk, so the user only downloads the code for the page they visit.

---

### 5.3 Routing Strategy

React Router v7 with a **nested layout route**:

- `Layout` is the persistent shell rendered for every route. It contains the header, nav wrapper, and footer. Page content renders into `<Outlet />` inside `<main>`.
- `NavLink` provides the `active` class automatically based on the current URL.
- All routes are client-side. When the user refreshes `/map`, FastAPI's SPA catch-all serves `index.html`, React Router takes over, and renders `DangerMap`.

---

### 5.4 Pages (lazy-loaded route components)

| File | Route | API calls | Key libraries |
|---|---|---|---|
| `Dashboard.jsx` | `/` | `/api/overview`, `/api/trend`, `/api/danger-zones`, `/api/monthly`, `/api/articles/latest`, `/api/alerts/high-severity`, `/api/forecast`, `/api/time-patterns` | Chart.js, react-chartjs-2, StatCard, ChartCard, LiveNews, ForecastChart, TimeHeatmap, AlertBanner, YoYSummary |
| `Daily.jsx` | `/daily` | `/api/daily` | Chart.js, date picker |
| `Monthly.jsx` | `/monthly` | `/api/monthly` | Chart.js, ClusterTimeline |
| `DangerMap.jsx` | `/map` | `/api/map-data` | react-leaflet, leaflet.heat, leaflet.markercluster |
| `Zones.jsx` | `/zones` | `/api/danger-zones`, `/api/danger-index`, `/api/divisions` | StatCard, bar rankings |
| `Compare.jsx` | `/compare` | `/api/compare/monthly`, `/api/compare/yearly` | Chart.js side-by-side charts |
| `SearchPage.jsx` | `/search` | `/api/search`, `/api/search/advanced` | Table, filter UI |
| `Records.jsx` | `/records` | `/api/recent`, `/api/export/csv` | Table, pagination |
| `CommunityFeed.jsx` | `/community` | `/api/reports`, `POST /api/reports`, `/api/reports/{id}/comments` | File upload, ReportCard |
| `NotFound.jsx` | `*` | — | Static error display |

---

### 5.5 Shared Components

| Component | File | What it does |
|---|---|---|
| **Layout** | `Layout.jsx` | Header (logo, scrape btn, theme toggle, export), nav wrapper with pill-style tabs, footer |
| **BDLogo** | `BDLogo.jsx` | Inline SVG logo: green rounded square, BD-flag red circle with rising bar chart bars, perspective road at base |
| **StatCard** | `StatCard.jsx` | Individual KPI card with icon, value, label, left-accent border |
| **ChartCard** | `ChartCard.jsx` | Wrapper for any Chart.js chart: title, optional toolbar, responsive canvas container |
| **ForecastChart** | `ForecastChart.jsx` | Renders the linear-regression forecast from `/api/forecast` |
| **TimeHeatmap** | `TimeHeatmap.jsx` | 7×24 grid heatmap of accident frequency by day/hour |
| **ClusterTimeline** | `ClusterTimeline.jsx` | Visual timeline of accident clusters for monthly view |
| **YoYSummary** | `YoYSummary.jsx` | Year-on-year percentage change summary panel |
| **LiveNews** | `LiveNews.jsx` | Latest scraped article cards from `/api/articles/latest` |
| **YouTubeNews** | `YouTubeNews.jsx` | Embeds YouTube search results from `/api/youtube-videos` |
| **ReportCard** | `ReportCard.jsx` | Community report display with upvote + comment actions |
| **AlertBanner** | `AlertBanner.jsx` | Dismissible banner shown when high-severity alerts exist |
| **SplashScreen** | `SplashScreen.jsx` | Full-screen animated intro shown once per session |
| **ToastContainer** | `ToastContainer.jsx` | Renders floating toast notification queue from `useToast` |
| **ErrorBoundary** | `ErrorBoundary.jsx` | Class component to catch React render errors, shows fallback UI |

---

### 5.6 Utility Hooks & Helpers

#### `utils/api.js`

- `api(endpoint)` — `GET /api{endpoint}`, returns parsed JSON, throws on non-2xx.
- `postApi(endpoint)` — `POST /api{endpoint}` (no body), returns parsed JSON.
- `formatDate(dateStr)` — Formats `YYYY-MM-DD` into `DD Mon YYYY` using `en-GB` locale.
- `COLORS` — Shared array of 15 brand-palette colours used across all Chart.js charts for visual consistency.

#### `utils/useTheme.jsx`

React context providing `{ theme, toggle }`.

- Persists to `localStorage` under key `tibd-theme`.
- Sets `data-theme="light"` or `data-theme="dark"` attribute on `<html>`.
- All CSS light/dark overrides are driven by `[data-theme="light"] selector {}` blocks in `global.css`.

#### `utils/useToast.js`

- `addToast(message, type)` — appends to toast queue.
- `toasts` state — consumed by `ToastContainer`.
- Types: `info`, `success`, `error`.
- Auto-dismiss after 4 seconds.

---

### 5.7 Styles — `global.css`

One 4100-line stylesheet — no CSS modules, no Tailwind. Reasons:

- Full design-system control.
- Theme toggling via `data-theme` attribute is trivial.
- All component styles are co-located in one predictable place.

#### Structure

```
1–45    CSS custom properties (design tokens: colours, spacing, radii, fonts, shadows)
46–100  Light theme overrides  ([data-theme="light"] block)
101–164 Typography (Rajdhani display font, Inter body)
165–230 Header + logo
231–315 Nav wrapper + nav tabs (pill-style active state)
316–400 Main layout, Timeframe toolbar
401–550 Stat cards + chart cards
551–650 Buttons (primary, outline, icon)
651–720 Tables + badges
721–850 Danger zone cards, page-header, section-label utils
851–1100 Search, Records, Compare, Community, Map page styles
1101–1350 Responsive media queries (≤1200px, ≤900px, ≤600px, ≤400px)
1351+   Component-specific rules (toast, splash, alert banner, report cards, etc.)
```

#### Design tokens (CSS vars)

```css
--bg-base          /* page background */
--bg-card          /* card/panel background */
--bd-green         /* #006A4E — Bangladesh flag green */
--bd-green-bright  /* #00b882 — lighter accent green */
--bd-red           /* #F42A41 — Bangladesh flag red */
--text-primary / --text-secondary / --text-muted
--border-color
--radius           /* 12px standard border-radius */
--font-display     /* Rajdhani — headings */
--font-body        /* inherit from system → Inter */
--shadow-sm / --shadow-lg / --shadow-green / --glow-green
```

---

## 6. Data Pipeline — End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Background Scheduler                        │
│  APScheduler fires every 6 hours                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ calls
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DailyStarScraper                             │
│  1. GET thedailystar.net/tags/road-accident (paginated)         │
│  2. Parse article list with BeautifulSoup                       │
│  3. For each new URL: fetch full article page                   │
│  4. Extract title, content, published_date                      │
│  5. INSERT into articles table                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ for each new article
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NLP Extractor                                 │
│  Regex patterns applied to article text:                        │
│  • accident_type  (bus, truck, motorcycle, train, boat…)        │
│  • district/division  (75 district names scanned)               │
│  • deaths  ("\d+ killed / dead")                                │
│  • injuries  ("\d+ injured / hurt")                             │
│  • vehicles_involved                                            │
│  • lat/lon  (looked up from DISTRICT_COORDINATES dict)          │
│  • summary  (first 2–3 sentences)                               │
│  → INSERT into accidents table (FK → article_id)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ stored in
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLite Database                            │
│  data/accidents.db                                              │
│  WAL mode, 8 indexes for fast querying                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ queried by
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Routes                               │
│  25+ endpoints aggregate, filter, and shape data for the UI     │
│  All access DB through get_db() context manager                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ JSON over HTTP
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React SPA                                     │
│  api() utility fetches data                                     │
│  Pages render charts, maps, tables, cards                       │
│  User sees live insights in browser                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. API Reference

All endpoints are prefixed `/api`. Query parameters are optional unless noted.

### `/api/overview`
**GET** `?start=YYYY-MM-DD&end=YYYY-MM-DD`  
Returns: `{ total_accidents, total_deaths, total_injuries, total_articles, today: {...}, last_scrape: {...} }`

### `/api/daily`
**GET** `?date=YYYY-MM-DD`  
Returns: daily breakdown by type and district.

### `/api/monthly`
**GET** `?year=YYYY&month=MM`  
Returns: monthly counts by type, district, trend.

### `/api/danger-zones`
**GET** `?limit=N`  
Returns: top N districts ranked by total accidents, deaths, fatality rate.

### `/api/map-data`
**GET**  
Returns: array of `{ lat, lon, district, deaths, injuries, accident_type, accident_date }` for all accidents with coordinates.

### `/api/trend`
**GET** `?days=30`  
Returns: daily `{ date, accidents, deaths, injuries }` for past N days.

### `/api/forecast`
**GET** `?days=30`  
Returns: linear regression projection of accident counts for next N days.

### `/api/time-patterns`
**GET**  
Returns: 7×24 matrix of accident counts by `{ hour_of_day, day_of_week }`.

### `/api/search`
**GET** `?q=text&limit=50`  
Full-text search on location, summary, article title.

### `/api/search/advanced`
**GET** `?district=&type=&start=&end=&min_deaths=&min_injuries=`  
Multi-filter search.

### `/api/compare/monthly`
**GET** `?year1=&month1=&year2=&month2=`  
Side-by-side stats for two months.

### `/api/export/csv`
**GET**  
Streams the full accidents table as a downloadable CSV.

### `POST /api/scrape`
Triggers a manual scrape. Rate-limited: 5 calls per IP per 60 seconds.

### `POST /api/reports`
Submit a community report. Accepts `multipart/form-data` with optional image uploads.

---

## 8. Database Schema

```sql
-- Raw article store
CREATE TABLE articles (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    url            TEXT UNIQUE NOT NULL,    -- deduplication key
    title          TEXT NOT NULL,
    content        TEXT,
    published_date DATE,
    scraped_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source         TEXT DEFAULT 'The Daily Star'
);

-- Structured accident data extracted from articles
CREATE TABLE accidents (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id        INTEGER NOT NULL,     -- FK → articles.id
    accident_type     TEXT,
    location_raw      TEXT,
    district          TEXT,
    division          TEXT,
    latitude          REAL,
    longitude         REAL,
    deaths            INTEGER DEFAULT 0,
    injuries          INTEGER DEFAULT 0,
    vehicles_involved TEXT,
    accident_date     DATE,
    summary           TEXT,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- One row per scrape run
CREATE TABLE scrape_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at     TIMESTAMP,
    finished_at    TIMESTAMP,
    articles_found INTEGER DEFAULT 0,
    articles_new   INTEGER DEFAULT 0,
    status         TEXT DEFAULT 'running'   -- 'running' | 'done' | 'error'
);

-- Community-submitted reports
CREATE TABLE reports (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT NOT NULL,
    description    TEXT,
    incident_date  TEXT NOT NULL,
    incident_time  TEXT,
    location_text  TEXT,
    district       TEXT,
    division       TEXT,
    accident_type  TEXT DEFAULT 'Road Accident',
    fatalities     INTEGER DEFAULT 0,
    injuries       INTEGER DEFAULT 0,
    reporter_name  TEXT DEFAULT 'Anonymous',
    images         TEXT DEFAULT '[]',      -- JSON array of file paths
    upvotes        INTEGER DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now')),
    status         TEXT DEFAULT 'active'
);

CREATE TABLE report_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id  INTEGER NOT NULL,
    author     TEXT DEFAULT 'Anonymous',
    body       TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(id)
);
```

**Indexes** (for query performance):

```sql
idx_accidents_date       ON accidents(accident_date)
idx_accidents_district   ON accidents(district)
idx_accidents_division   ON accidents(division)
idx_accidents_type       ON accidents(accident_type)
idx_accidents_article    ON accidents(article_id)
idx_articles_url         ON articles(url)
idx_articles_published   ON articles(published_date)
idx_reports_district     ON reports(district)
idx_reports_date         ON reports(incident_date)
idx_reports_created      ON reports(created_at)
```

---

## 9. Build System & Vite Configuration

`frontend/vite.config.js` controls the entire frontend build.

### Key settings

```js
// Dev proxy: forwards /api requests to FastAPI
server.proxy['/api'] → 'http://localhost:8000'

// Production build output
build.outDir = '../static/dist'    // Vite writes here; FastAPI serves it

// Code splitting
// Each lazy import() in App.jsx becomes a separate JS chunk automatically

// Test environment
test.environment = 'jsdom'
test.globals = true
```

### Build artefacts

After `npm run build` inside `frontend/`:

```
static/dist/
├── index.html
├── sw.js                        ← Workbox service worker
├── workbox-{hash}.js
└── assets/
    ├── index-{hash}.js          ← shared vendor chunk
    ├── Dashboard-{hash}.js      ← per-page lazy chunks
    ├── DangerMap-{hash}.js
    ├── ChartCard-{hash}.js      ← Chart.js + react-chartjs-2
    ├── CommunityFeed-{hash}.js
    └── *.css
```

---

## 10. PWA Support

`vite-plugin-pwa` wraps **Workbox** to generate a service worker at build time.

### Manifest (`vite.config.js`)

- Name: `Traffic Insight BD`
- Theme colour: `#006A4E` (BD green)
- Background: `#0f172a` (splash background)
- Icons: `icon-192.png`, `icon-512.png` (generated with Pillow)
- Display: `standalone` (no browser chrome when installed)

### Caching strategy

| Resource | Strategy | Notes |
|---|---|---|
| App shell (JS/CSS/HTML) | Pre-cache on install | Always fresh after build |
| `/api/*` endpoints | Network-first, 10s timeout | Falls back to cache (5-min TTL, 50 entries) |
| Map tiles (CartoCDN) | Cache-first | 7-day TTL, 500 entries |

### Apple PWA meta tags (`index.html`)

`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, and `apple-touch-icon` are set so the app installs correctly on iOS.

---

## 11. Dev vs Production Modes

### Development

```bash
# Terminal 1: backend with hot-reload
source .venv/bin/activate
python run.py                   # APP_ENV=development by default

# Terminal 2: frontend with HMR
cd frontend && npm run dev      # Vite dev server on :3000
                                # Proxies /api → :8000
```

In this setup the browser talks to Vite on `:3000`. The proxy transparently forwards API calls to FastAPI on `:8000`. Hot module replacement means React components update instantly without page reload.

### Production

```bash
cd frontend && npm run build    # outputs to static/dist/
python run.py                   # APP_ENV=production
# → one process on :8000 serves everything
```

FastAPI serves the compiled `index.html` + assets. There is no separate Node.js process.

### Environment variables

| Variable | Development | Production |
|---|---|---|
| `APP_ENV` | `development` | `production` |
| `DEBUG` | `True` | `False` |
| `LOG_LEVEL` | `DEBUG` | `WARNING` |
| `CORS_ORIGINS` | `*` | specific domain(s) |
| Uvicorn reload | `True` | `False` |

---

## 12. Running the Project

### Quick start (one command)

```bash
./start.sh
```

This script:
1. Kills any process on port 8000.
2. Activates `.venv`.
3. Starts `python run.py` in background.
4. Polls until the server responds.
5. Opens the browser automatically.
6. Traps `Ctrl+C` to cleanly kill the server.

### Manual steps

```bash
# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install Node dependencies and build frontend
cd frontend
npm install
npm run build
cd ..

# 4. Start the server
python run.py
# → open http://localhost:8000
```

### Makefile targets

```bash
make install    # pip install + npm install
make build      # npm run build
make run        # python run.py
make test       # pytest + vitest
make lint       # eslint + ruff
```

---

## 13. Testing

### Python tests (`tests/`)

```bash
source .venv/bin/activate
pytest tests/ -v
```

| File | Tests |
|---|---|
| `test_database.py` | Schema creation, insert/query, context manager |
| `test_extractor.py` | NLP extraction on sample article text |
| `test_routes.py` | FastAPI endpoints via `TestClient` |
| `test_security.py` | Security headers present, CSP correct |
| `conftest.py` | Shared fixtures (in-memory DB, test app) |

### JavaScript tests (`frontend/src/__tests__/`)

```bash
cd frontend && npm test
```

Vitest runs in jsdom environment. `@testing-library/react` provides `render`, `screen`, `fireEvent`.

---

## 14. Docker & Deployment

### Development container

```bash
docker compose -f docker-compose.dev.yml up
```

Mounts the source tree and enables hot-reload.

### Production container

```bash
docker compose -f docker-compose.prod.yml up
```

The `Dockerfile`:

1. `python:3.12-slim` base image.
2. Installs Node.js, runs `npm run build`.
3. Installs Python deps.
4. Exposes port 8000.
5. `CMD ["python", "run.py"]`.

The `static/dist` output is baked into the image at build time; no Node.js runtime is needed in production.

---

## 15. Security Model

All security is enforced by `SecurityHeadersMiddleware` in `server.py`.

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Block iframe embedding (clickjacking) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | camera/mic/geo all denied | Minimal permission surface |
| `Strict-Transport-Security` | 2-year max-age (prod only) | Enforce HTTPS |
| `Content-Security-Policy` | self + inline-styles + OSM tiles + YouTube embeds | XSS mitigation |

**CORS**: open (`*`) in development, locked to configured origins in production.

**Rate limiting**: `POST /api/scrape` limited to 5 calls per IP per 60 seconds.

**File uploads**: stored in `static/uploads/reports/` with UUID filenames. Only images accepted.

---

## 16. Dependency Map (What Uses What)

```
run.py
└── app.server.create_app()
    ├── app.config           (env vars, paths, constants)
    ├── app.database.init_db()
    ├── app.scheduler.start_scheduler()
    │   └── app.scraper.run_scraper()
    │       ├── app.config   (URLs, delays, limits)
    │       ├── app.database (insert_article, article_exists)
    │       └── app.extractor.extract_accident_data()
    │           ├── app.config   (BANGLADESH_DISTRICTS, ACCIDENT_TYPES, etc.)
    │           └── app.database (insert_accident)
    └── app.routes.router
        ├── app.database.get_db()
        ├── app.rate_limit.scrape_limiter
        └── app.scraper.run_scraper()  (manual trigger)


main.jsx
└── App.jsx
    ├── utils/useTheme.jsx   (ThemeProvider — wraps whole tree)
    ├── components/ErrorBoundary.jsx
    ├── components/SplashScreen.jsx
    ├── components/Layout.jsx         (rendered for every route)
    │   ├── components/BDLogo.jsx
    │   ├── components/ToastContainer.jsx  ← utils/useToast.js
    │   ├── components/AlertBanner.jsx
    │   └── utils/api.js (postApi → /api/scrape)
    └── pages/* (lazy)
        ├── utils/api.js      (api() for all data fetching)
        ├── components/StatCard.jsx
        ├── components/ChartCard.jsx
        ├── components/ForecastChart.jsx
        ├── components/TimeHeatmap.jsx
        ├── components/ClusterTimeline.jsx
        ├── components/YoYSummary.jsx
        ├── components/LiveNews.jsx
        ├── components/YouTubeNews.jsx
        ├── components/ReportCard.jsx
        ├── chart.js / react-chartjs-2
        └── leaflet / react-leaflet / leaflet.heat / leaflet.markercluster
```

---

## 17. Component–API–Data Wiring Table

| Page | API endpoints consumed | Components used |
|---|---|---|
| **Dashboard** | `/overview`, `/trend`, `/danger-zones`, `/monthly`, `/articles/latest`, `/alerts/high-severity`, `/forecast`, `/time-patterns` | StatCard ×5, ChartCard, ForecastChart, TimeHeatmap, LiveNews, YoYSummary, AlertBanner |
| **Daily** | `/daily` | StatCard, ChartCard (type pie, district bar) |
| **Monthly** | `/monthly` | StatCard, ChartCard, ClusterTimeline |
| **DangerMap** | `/map-data` | react-leaflet Map, TileLayer, MarkerCluster, HeatLayer, MapInvalidator (fixes tile render bug) |
| **Zones** | `/danger-zones`, `/danger-index`, `/divisions` | StatCard, ranked list cards |
| **Compare** | `/compare/monthly`, `/compare/yearly` | ChartCard (grouped bar), tabbed date pickers |
| **SearchPage** | `/search`, `/search/advanced` | Table, filter panel |
| **Records** | `/recent`, `/export/csv` | Table, pagination, CSV download link |
| **CommunityFeed** | `/reports`, `POST /reports`, `/reports/{id}/comments` | ReportCard, image upload form |

---

## 18. Design System & CSS Architecture

### Colour palette

| Token | Hex | Usage |
|---|---|---|
| `--bd-green` | `#006A4E` | Primary: active nav pill, buttons, accents |
| `--bd-green-bright` | `#00b882` | Hover states, chart highlights, glows |
| `--bd-red` | `#F42A41` | Danger indicators, BD flag accent |
| `--bg-base` | `#0a1512` (dark) / `#f0f4f2` (light) | Page background |
| `--bg-card` | `#111f18` (dark) / `#ffffff` (light) | Card backgrounds |

### Theme switching mechanism

```
User clicks theme toggle button
  → useTheme.toggle()
    → setTheme('light' | 'dark')
      → document.documentElement.setAttribute('data-theme', theme)
        → CSS: [data-theme="light"] .nav-wrapper { background: ... }
        → CSS: [data-theme="light"] .header { background: ... }
        → etc.
```

No class toggling, no JS style injection — purely CSS attribute selectors.

### Typography

- **Rajdhani** (Google Fonts) — display/heading font; uppercase, variable weight. Used for logo text, stat card values, section headers.
- **System font stack** — body text uses `system-ui, -apple-system, 'Segoe UI'` for maximum legibility and zero network cost.

### BD flag strip

The `3px` colour strip at the very top of the header is a CSS `::before` pseudo-element:

```css
.header::before {
  content: '';
  height: 3px;
  background: linear-gradient(90deg,
    #006A4E 0%, #006A4E 60%,   /* BD green  */
    #F42A41 60%, #F42A41 100%  /* BD red    */
  );
}
```

### Nav pill tabs

Inactive tabs are transparent with muted text. The active tab receives a filled green pill:

```css
.nav-tab.active {
  background: var(--bd-green);
  color: #fff;
  border-radius: 20px;
  box-shadow: 0 3px 10px rgba(0,106,78,0.40);
}
```

In light mode the `nav-wrapper` (full-width background band) overrides to a translucent white with backdrop blur, so the nav sits cleanly against the light header.

### Shadows & elevation

Cards use `--shadow-lg` (`0 4px 24px rgba(0,0,0,0.35)`) with a left `3px` border accent in the BD green colour for visual hierarchy. Danger zone cards use a red left border instead.

---

*End of guide.*
