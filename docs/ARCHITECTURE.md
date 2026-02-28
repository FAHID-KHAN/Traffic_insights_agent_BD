# Architecture Definition

> Comprehensive guide to the **Traffic Insights Agent – Bangladesh** system architecture, data flow, and component interactions.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Backend Architecture](#backend-architecture)
   - [Entry Point & Application Factory](#entry-point--application-factory)
   - [Configuration Layer](#configuration-layer)
   - [API Layer (Routes)](#api-layer-routes)
   - [Rate Limiting](#rate-limiting)
   - [Security Middleware](#security-middleware)
   - [Database Layer](#database-layer)
   - [Scraper Module](#scraper-module)
   - [NLP Extractor Module](#nlp-extractor-module)
   - [Scheduler](#scheduler)
4. [Frontend Architecture](#frontend-architecture)
   - [React Component Tree](#react-component-tree)
   - [Routing](#routing)
   - [API Communication](#api-communication)
   - [Shared Utilities](#shared-utilities)
5. [Data Flow](#data-flow)
   - [Scraping Pipeline](#scraping-pipeline)
   - [Request / Response Cycle](#request--response-cycle)
6. [Database Schema](#database-schema)
7. [Build & Deployment Pipeline](#build--deployment-pipeline)
8. [Containerised Deployment](#containerised-deployment)
   - [Dockerfile (Multi-Stage Build)](#dockerfile-multi-stage-build)
   - [Docker Compose — Dev](#docker-compose--dev)
   - [Docker Compose — Prod](#docker-compose--prod)
   - [Makefile Targets](#makefile-targets)
9. [Environment Configuration](#environment-configuration)
10. [Development vs Production](#development-vs-production)
11. [CI / CD](#ci--cd)
12. [Testing](#testing)
13. [Dependency Map](#dependency-map)

---

## System Overview

The Traffic Insights Agent is a full-stack web application that:

1. **Scrapes** road accident articles from [The Daily Star Bangladesh](https://www.thedailystar.net/tags/road-accident).
2. **Extracts** structured data (location, casualties, accident type, vehicles) from raw news article text using regex-based NLP.
3. **Stores** everything in a local SQLite database.
4. **Serves** an analytics dashboard via a React single-page application.
5. **Automates** data collection with a background scheduler running every 6 hours.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                          │
│                                                                    │
│   React SPA  ──  React Router  ──  Chart.js  ──  Leaflet Maps     │
│                                                                    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP (port 8000)
                             │ GET/POST /api/*
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI SERVER (Python)                       │
│                                                                    │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────────┐   │
│  │ server.py│──▶│ routes.py│──▶│database.py│──▶│ SQLite (.db)  │   │
│  │ (factory)│   │ (API)    │   │ (queries) │   │               │   │
│  └──────────┘   └──────────┘   └──────────┘   └───────────────┘   │
│       │                              ▲                              │
│       │                              │                              │
│  ┌────▼─────┐   ┌──────────┐   ┌────┴─────┐                       │
│  │scheduler │──▶│scraper.py│──▶│extractor  │                       │
│  │  .py     │   │(BS4+HTTP)│   │  .py      │                       │
│  └──────────┘   └──────────┘   │ (NLP)     │                       │
│                                └──────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTPS (outbound)
                             ▼
                ┌──────────────────────┐
                │  The Daily Star      │
                │  /tags/road-accident │
                └──────────────────────┘
```

---

## Backend Architecture

The backend lives in the `app/` Python package. Every module has a single responsibility and communicates through well-defined imports.

### Entry Point & Application Factory

| File | Purpose |
|------|---------|
| `run.py` | Entry point. Imports `create_app()` from `app.server`, reads `API_HOST`, `API_PORT`, and `DEBUG` from config, and binds to Uvicorn with conditional reload and log level. |
| `app/server.py` | **Application factory** — `create_app()` builds and returns a configured FastAPI instance. Environment-aware: disables Swagger/ReDoc in production, configures logging from `LOG_LEVEL`, sets CORS origins, and applies `SecurityHeadersMiddleware`. |
| `app/rate_limit.py` | **Rate limiter** — `RateLimiter` class used as a FastAPI dependency to throttle the POST `/api/scrape` endpoint (3 requests per 60-second window per IP). |

**Startup sequence (`create_app` → `lifespan`):**

```
run.py
  ├─ Reads API_HOST, API_PORT, DEBUG from app.config
  └─▶ create_app()              [app/server.py]
       ├─ Configure logging      [level from LOG_LEVEL env var]
       ├─ Conditional Swagger     [/docs + /redoc only when DEBUG=True]
       ├─ Add CORS middleware    [origins from CORS_ORIGINS env var]
       ├─ Add SecurityHeadersMiddleware  [CSP, X-Frame-Options, HSTS, etc.]
       ├─ Register API router    [app/routes.py]
       ├─ Mount /assets static   [static/dist/assets/]
       ├─ Register SPA catch-all [serves index.html, or 503 if not built]
       └─ lifespan() context manager
            ├─ db.init_db()      [app/database.py]  ← creates tables if missing
            └─ start_scheduler() [app/scheduler.py]  ← begins 6-hour cron
```

The `lifespan` async context manager ensures:
- **On startup:** database is initialised and the scrape scheduler begins.
- **On shutdown:** the scheduler is cleanly stopped.

The SPA catch-all gracefully returns a 503 JSON response with build instructions if `static/dist/index.html` does not yet exist, instead of crashing with a 500 error.

### Configuration Layer

**File:** `app/config.py`

Centralises every tuneable constant so no other module contains magic values. All settings can be overridden at runtime via environment variables, enabling a single codebase to run in development and production without code changes.

**Environment detection:**

```python
APP_ENV = os.getenv("APP_ENV", "development")   # "development" | "production"
DEBUG   = APP_ENV == "development"
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG" if DEBUG else "WARNING")
```

| Setting | Env Var | Default | Role |
|---------|---------|---------|------|
| `APP_ENV` | `APP_ENV` | `development` | Controls debug mode, logging, docs visibility |
| `DEBUG` | — (derived) | `True` in dev | Enables auto-reload, Swagger, debug logging |
| `LOG_LEVEL` | `LOG_LEVEL` | `DEBUG` / `WARNING` | Python logging level |
| `BASE_DIR` | — | project root | Anchor for all relative paths |
| `DATA_DIR` | `DATA_DIR` | `<root>/data/` | SQLite database location |
| `STATIC_DIR` | — | `<root>/static/` | React production build |
| `DB_PATH` | `DB_PATH` | `data/accidents.db` | Full database file path |
| `DAILY_STAR_ACCIDENT_URL` | — | `thedailystar.net/tags/road-accident` | Scrape target |
| `SCRAPE_INTERVAL_HOURS` | `SCRAPE_INTERVAL_HOURS` | `6` | Background scrape frequency |
| `REQUEST_TIMEOUT` | `REQUEST_TIMEOUT` | `30` | HTTP request timeout (seconds) |
| `REQUEST_DELAY` | `REQUEST_DELAY` | `2` (seconds) | Polite delay between HTTP requests |
| `MAX_PAGES_PER_SCRAPE` | `MAX_PAGES` | `5` | Pagination depth limit |
| `API_HOST` | `API_HOST` | `0.0.0.0` | Server bind address |
| `API_PORT` | `API_PORT` | `8000` | Server port |
| `CORS_ORIGINS` | `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `BANGLADESH_DISTRICTS` | — | 64 entries | NLP location matching list |
| `BANGLADESH_DIVISIONS` | — | 10 entries | Division-level matching list |
| `ACCIDENT_TYPES` | — | 30+ patterns | Keyword list for type classification |

**Environment files** provide pre-configured defaults:

| File | Purpose |
|------|---------|
| `.env.development` | Dev defaults: `APP_ENV=development`, `LOG_LEVEL=DEBUG`, `CORS_ORIGINS=*` |
| `.env.production` | Prod defaults: `APP_ENV=production`, `LOG_LEVEL=WARNING`, restricted CORS |
| `.env.local` | Personal overrides (git-ignored) |

### API Layer (Routes)

**File:** `app/routes.py`

All endpoints are mounted under the `/api` prefix via `APIRouter(prefix="/api")`.

| Method | Endpoint | Description | Used by Page |
|--------|----------|-------------|-------------|
| GET | `/api/overview` | Global stats with optional `start`/`end` date filters | Dashboard |
| GET | `/api/trend?days=N` | Daily accident count for the last N days | Dashboard |
| GET | `/api/daily?date=YYYY-MM-DD` | Stats for a single date (by type, by district) | Daily |
| GET | `/api/monthly?year=Y&month=M` | Stats for a month (daily breakdown, type, district) | Monthly |
| GET | `/api/danger-zones?limit=N` | Top N districts ranked by accident count | Zones |
| GET | `/api/danger-index` | Deaths-per-accident fatality index per district | Zones |
| GET | `/api/divisions` | Division-level aggregated stats | DangerMap |
| GET | `/api/map-data` | All accidents with lat/lon for map plotting | DangerMap |
| GET | `/api/recent?limit=N` | Most recent accident records with article links | Records |
| GET | `/api/search` | Full-text + advanced search (district, type, severity, date range) | SearchPage |
| GET | `/api/yearly` | Month-by-month aggregate for all time | Dashboard |
| GET | `/api/compare/monthly` | Side-by-side month comparison (delta indicators) | Compare |
| GET | `/api/compare/yearly` | Side-by-side year comparison | Compare |
| GET | `/api/forecast` | 3-month simple moving-average forecast | Dashboard (ForecastChart) |
| GET | `/api/time-patterns` | Month × day-of-week accident heatmap data | Dashboard (TimeHeatmap) |
| GET | `/api/clusters` | Sliding-window accident cluster detection | Dashboard (ClusterTimeline) |
| GET | `/api/yoy-summary` | Year-over-year summary with current vs previous year | Dashboard (YoYSummary) |
| GET | `/api/alerts/high-severity` | Recent accidents with 5+ deaths (last 3 days) | AlertBanner |
| GET | `/api/articles/latest?limit=N` | Latest scraped articles with badges | LiveNews |
| GET | `/api/youtube-videos` | YouTube search results (cached 30 min) | YouTubeNews |
| GET | `/api/export/csv` | CSV download (supports date/district filters) | Layout (Export button) |
| GET | `/api/scrape-logs?limit=N` | Scrape history (start time, articles found, status) | — |
| POST | `/api/scrape` | Trigger an on-demand scrape — **rate limited** (3 req/min/IP), non-blocking | Layout (Scrape Now button) |

**How routes connect to data:**

All route handlers use the `get_db()` context manager for safe, leak-free database access:

```
routes.py
  ├─ GET  endpoints ──▶ with db.get_db() as conn: ──▶ SQL queries ──▶ JSON response
  ├─ GET  helper fns ──▶ db.get_daily_stats(), db.get_monthly_stats(), etc.
  └─ POST /api/scrape ─▶ run_in_executor(scraper.run_scraper) ──▶ (non-blocking)
```

**Thread safety:** The YouTube video cache (`_yt_cache`) uses a `threading.Lock()` for safe concurrent access.

### Rate Limiting

**File:** `app/rate_limit.py`

The `RateLimiter` class implements a **sliding-window per-IP rate limiter** using an in-memory dictionary. It is used as a FastAPI `Depends()` dependency.

```python
scrape_limiter = RateLimiter(max_calls=3, window_seconds=60)

@router.post("/scrape")
async def trigger_scrape(request: Request, _=Depends(scrape_limiter)):
    ...
```

| Setting | Value | Notes |
|---------|-------|-------|
| Max calls | 3 | Per IP per window |
| Window | 60 seconds | Sliding (not fixed-bucket) |
| IP detection | `X-Forwarded-For` then `client.host` | Proxy-aware |
| Exceeded response | HTTP `429 Too Many Requests` | Includes `Retry-After` header |
| Storage | In-memory `dict` | Resets on server restart |

Only the scrape endpoint is rate limited — all read (GET) endpoints are unrestricted.

### Security Middleware

**File:** `app/server.py` — `SecurityHeadersMiddleware(BaseHTTPMiddleware)`

Added to every response via Starlette's `BaseHTTPMiddleware`. Sets hardened HTTP security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing attacks |
| `X-Frame-Options` | `DENY` | Blocks clickjacking via iframes |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unused browser APIs |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; ...` | Restricts resource loading origins |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS — **production only** (`APP_ENV=production`) |

### Database Layer

**File:** `app/database.py`

Manages all SQLite operations. Uses `sqlite3.Row` row factory so results behave like dictionaries.

**Connection settings:**
- `PRAGMA journal_mode=WAL` — write-ahead logging for concurrent reads during scrapes.
- `PRAGMA foreign_keys=ON` — enforce referential integrity between `accidents` and `articles`.

**Functional groups:**

| Group | Functions | Purpose |
|-------|-----------|---------|
| **Connection** | `get_connection()`, `get_db()` | Returns a configured `sqlite3.Connection`. `get_db()` is a context manager with automatic commit/rollback/close |
| **Schema** | `init_db()` | Creates tables and indexes if they don't exist |
| **Articles** | `article_exists()`, `insert_article()` | Deduplicate and store scraped articles |
| **Accidents** | `insert_accident()` | Store extracted accident records |
| **Scrape Logs** | `start_scrape_log()`, `finish_scrape_log()` | Track scrape session metadata |
| **Queries** | `get_daily_stats()`, `get_monthly_stats()`, `get_danger_zones()`, `get_recent_accidents()`, `get_all_accidents_for_map()`, `get_yearly_overview()`, `get_scrape_logs()` | Read operations used by API routes |

**Connection management:**

All database operations use the `get_db()` context manager:

```python
with db.get_db() as conn:
    rows = conn.execute("SELECT ...").fetchall()
    # auto-commits on success, rolls back on exception, always closes
```

This eliminates connection leaks that would occur if an exception were raised between `get_connection()` and `conn.close()`. The `init_db()` function is called once during server startup via the lifespan manager — not at module import time.

### Scraper Module

**File:** `app/scraper.py`

**Class:** `DailyStarScraper`

The scraper is a two-phase pipeline:

**Phase 1 — Discover article links:**
1. Fetches the tag page `thedailystar.net/tags/road-accident` (up to `MAX_PAGES_PER_SCRAPE` pages).
2. Uses multiple CSS selectors to find `<a>` elements pointing to news articles.
3. Deduplicates by URL within the current scrape.

**Phase 2 — Scrape individual articles:**
1. For each URL not already in the database (`article_exists()` check):
   - Fetches the full article page.
   - Extracts: **title** (from `<h1>`), **published date** (from `<time>`, `<meta>`, or date `<span>`), **body text** (from article body selectors).
   - Saves the raw article via `insert_article()`.
   - **Immediately** passes the content to `AccidentExtractor.process_article()` to extract structured data.

**Reliability features:**
- **Polite crawling:** A configurable `REQUEST_DELAY` (2 seconds) pause is inserted between each HTTP request to avoid overloading the source.
- **Date integrity:** If the article's published date cannot be parsed from any source (HTML tags, meta, JSON-LD), it is stored as `None` with a warning log — instead of silently defaulting to today's date, which would corrupt time-series analysis.
- **Early duplicate termination:** If all articles on a listing page already exist in the database, the scraper stops pagination early instead of continuing to fetch more pages of duplicates.
- **Extractor reuse:** A single `AccidentExtractor` instance is reused across all articles in a scrape cycle, reducing unnecessary object creation.

**Scrape logging:** Every scrape session is wrapped in a `scrape_log` record (started → completed/error) so the frontend can display scrape history.

### NLP Extractor Module

**File:** `app/extractor.py`

**Class:** `AccidentExtractor`

Extracts structured accident data from free-form English news article text. This is the core intelligence layer.

**Extraction pipeline (per article):**

```
Raw article text
      │
      ▼
┌─────────────────┐    Checks for keywords: "killed", "accident",
│ Relevance Check │───▶ "crash", "collision", etc.
└────────┬────────┘    If none found → skip this article
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ Extract│ │ Extract│
│ Type   │ │Location│
└────┬───┘ └────┬───┘
     │          │
     │     ┌────┴────┐
     │     │         │
     │     ▼         ▼
     │  ┌────────┐ ┌────────┐
     │  │District│ │Division│
     │  │Match   │ │Lookup  │
     │  └────┬───┘ └────┬───┘
     │       │          │
     ▼       ▼          ▼
┌────────┐ ┌─────────────────┐
│Extract │ │ Geo-coordinate  │
│Casualty│ │ lookup from     │
│Numbers │ │ DISTRICT_COORDS │
└────┬───┘ └────────┬────────┘
     │              │
     ▼              ▼
┌────────┐  ┌──────────────┐
│Extract │  │ Generate     │
│Vehicles│  │ Summary      │
└────┬───┘  │ (first 200ch)│
     │      └──────┬───────┘
     │             │
     └──────┬──────┘
            ▼
    insert_accident()
    ── saved to SQLite ──
```

**Sub-extractors:**

| Method | Technique | Output |
|--------|-----------|--------|
| `_extract_accident_type()` | Priority-ordered keyword matching (30+ patterns) | One of: bus accident, truck accident, motorcycle accident, hit-and-run, collision, road accident, etc. |
| `_extract_location()` | Regex `\b` word-boundary matching against 64 district names + 10 divisions | `{district, division, raw}` |
| `_district_to_division()` | Dictionary lookup from `_DIVISION_MAP` | Maps any district to its parent division |
| `_extract_casualties()` | Regex patterns matching `"N killed"`, `"killing N"`, `"N injured"`, etc. with word-to-number conversion ("three" → 3) | `{deaths: int, injuries: int}` |
| `_extract_vehicles()` | Keyword search for 11 vehicle categories | Comma-separated string, e.g. `"bus, truck"` |
| `_generate_summary()` | First 5 sentences (skipping boilerplate like copyright notices, "follow us" prompts), capped at 200 characters | Short text summary |

**Division name normalization:** The `_district_to_division()` method uses `_DIVISION_ALIASES` to handle variant spellings (e.g. "Chattogram" → "Chittagong", "Barishal" → "Barisal") so that all records use canonical division names regardless of which spelling appears in the article.

**Geo-coordinates:** The module contains a `DISTRICT_COORDINATES` dictionary mapping 80+ locations (all 64 districts plus major Dhaka sub-areas) to `(latitude, longitude)` tuples. These coordinates are used for map marker placement and heatmap rendering.

### Scheduler

**File:** `app/scheduler.py`

Uses **APScheduler** `BackgroundScheduler` to run the scraper at a fixed interval.

| Setting | Value |
|---------|-------|
| Trigger | `IntervalTrigger(hours=6)` |
| Job ID | `scrape_daily_star` |
| Max instances | `1` (prevents overlap) |
| `replace_existing` | `True` (safe restart) |

The scheduler is started inside the FastAPI `lifespan` context and shut down cleanly when the server stops.

---

## Frontend Architecture

The frontend is a **React 19 SPA** built with **Vite**, located in the `frontend/` directory. It is a pure client-side application — it does not use server-side rendering.

### React Component Tree

All page components are **lazy-loaded** via `React.lazy()` + `<Suspense>` to reduce initial bundle size. The entire app is wrapped in an `<ErrorBoundary>` for graceful error recovery.

```
<ErrorBoundary>                                       ← catches render errors globally
  <ThemeProvider>                                     ← dark/light theme context
    <BrowserRouter>
      └─ <Routes>
           └─ <Route element={<Layout />}>            ← persistent shell
                ├─ <Route index          element={lazy(<Dashboard />)} />
                ├─ <Route path="daily"   element={lazy(<Daily />)} />
                ├─ <Route path="monthly" element={lazy(<Monthly />)} />
                ├─ <Route path="map"     element={lazy(<DangerMap />)} />
                ├─ <Route path="zones"   element={lazy(<Zones />)} />
                ├─ <Route path="compare" element={lazy(<Compare />)} />
                ├─ <Route path="search"  element={lazy(<SearchPage />)} />
                ├─ <Route path="records" element={lazy(<Records />)} />
                └─ <Route path="*"       element={<NotFound />} />   ← 404
```

### Component Responsibilities

#### Shared Components (`src/components/`)

| Component | Role |
|-----------|------|
| **Layout** | App shell: header with BDLogo, navigation tabs, theme toggle, Export/Scrape Now buttons, `<AlertBanner>`, `<Outlet>` for child pages |
| **BDLogo** | Custom SVG Bangladesh-themed logo with flag colours |
| **StatCard** | Reusable stat display card — accepts title, value, icon, color |
| **ChartCard** | Wrapper around `react-chartjs-2` — supports `line`, `bar`, `doughnut`, `pie` chart types |
| **AlertBanner** | Dismissable red banner for high-severity accidents (5+ deaths in last 3 days), auto-refreshes every 5 minutes |
| **LiveNews** | Grid of latest scraped article cards with death/injury badges |
| **YouTubeNews** | Embedded YouTube video grid for Bangladesh road accident news (30-min server cache) |
| **ForecastChart** | 3-month simple moving-average forecast line overlaid on monthly trend data |
| **TimeHeatmap** | Month × day-of-week accident frequency heatmap grid |
| **ClusterTimeline** | Sliding-window cluster detection — groups accidents in same district within a configurable time window |
| **YoYSummary** | Year-over-year comparison card (current YTD vs previous YTD) with delta badges |
| **ToastContainer** | Renders a stack of auto-dismiss toast notifications |
| **ErrorBoundary** | Class component catching unhandled render errors; displays fallback UI with reset button |

#### Page Components (`src/pages/`)

| Page | API Endpoints Consumed | Visualisations |
|------|----------------------|----------------|
| **Dashboard** | `/overview`, `/trend`, `/forecast`, `/time-patterns`, `/clusters`, `/yoy-summary`, `/articles/latest`, `/youtube-videos` | Stat cards, trend chart, type doughnut, district bar, ForecastChart, TimeHeatmap, ClusterTimeline, YoYSummary, LiveNews, YouTubeNews |
| **Daily** | `/daily` | Date picker, 3 stat cards, type pie, district bar |
| **Monthly** | `/monthly` | Year/month selectors, 3 stat cards, daily line, type doughnut, district bar |
| **DangerMap** | `/map-data`, `/divisions` | Leaflet map with MarkerCluster + heatmap toggle, division breakdown cards with district drill-down |
| **Zones** | `/danger-zones`, `/danger-index` | Toggle between Fatality Index (severity-scored) and Classic Ranking views |
| **Compare** | `/compare/monthly`, `/compare/yearly` | Month-vs-Month and Year-vs-Year comparison — delta indicators, trend overlay, type comparison, district deaths bar |
| **SearchPage** | `/search` | Advanced search with district, type, severity, date range filters; results summary bar; critical row highlighting |
| **Records** | `/recent`, `/search` | Searchable records table with debounced input, links to source articles |
| **NotFound** | — | 404 page with home link |

### Routing

**Library:** `react-router-dom` v7

All routes are nested inside `<Layout>` so the header and navigation persist across page changes. The `<Outlet>` component in Layout renders whichever child route is active.

| URL Path | Component |
|----------|-----------|
| `/` | Dashboard |
| `/daily` | Daily |
| `/monthly` | Monthly |
| `/map` | DangerMap |
| `/zones` | Zones |
| `/compare` | Compare |
| `/search` | SearchPage |
| `/records` | Records |
| `/*` | NotFound (404) |

FastAPI's SPA catch-all (`/{path:path}` → `index.html`) ensures deep links and browser refresh work correctly for all frontend routes.

### API Communication

**File:** `src/utils/api.js`

Two fetch helpers abstract all backend communication:

```
api(endpoint)     → GET  /api{endpoint}  → parsed JSON
postApi(endpoint) → POST /api{endpoint}  → parsed JSON
```

In **development**, Vite's dev server proxy (`/api` → `http://localhost:8000`) forwards API calls to the backend, so the React dev server and FastAPI can run on different ports without CORS issues.

In **production**, both the React SPA and the API are served from the same FastAPI server on port 8000, so no proxy is needed.

### Shared Utilities

| File | Exports | Purpose |
|------|---------|---------|
| `api.js` | `api()`, `postApi()`, `formatDate()`, `COLORS` | HTTP helpers, date formatting, consistent chart colour palette (15 colours) |
| `useToast.js` | `useToast()` hook | Custom React hook managing toast state with auto-dismiss timers || `useTheme.jsx` | `ThemeProvider`, `useTheme()` | React context providing dark/light theme toggle; persisted in `localStorage` |
---

## Data Flow

### Scraping Pipeline

This is the end-to-end flow when data enters the system — either via the scheduled job or the manual "Scrape Now" button.

```
  ┌──────────────┐
  │  Trigger      │   (1) APScheduler every 6 hours
  │               │   (2) POST /api/scrape (manual)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ scraper.py   │
  │ run_scrape() │
  └──────┬───────┘
         │
         ├── start_scrape_log()         → scrape_logs table (status: running)
         │
         ├── Create single AccidentExtractor instance (reused for all articles)
         │
         ├── for page in 0..4:
         │     fetch listing page from The Daily Star
         │     parse <a> links with BeautifulSoup
         │     if all articles on page are duplicates → stop early
         │
         ├── for each article URL:
         │     ├── article_exists(url)?  → skip if already scraped
         │     ├── fetch full article page
         │     ├── extract title, date, body text
         │     │     └── if date unparseable → store None (don't default to today)
         │     ├── insert_article()      → articles table
         │     │
         │     └── AccidentExtractor.process_article()
         │           ├── Relevance check (keyword filter)
         │           ├── _extract_accident_type()
         │           ├── _extract_location()   → district + division (normalized) + coords
         │           ├── _extract_casualties()  → deaths + injuries
         │           ├── _extract_vehicles()
         │           ├── _generate_summary()    → filters boilerplate text
         │           └── insert_accident()      → accidents table
         │
         └── finish_scrape_log()        → scrape_logs table (status: completed)
```

### Request / Response Cycle

This is the flow when a user interacts with the dashboard.

```
  Browser (React SPA)
       │
       │  fetch('/api/overview')
       ▼
  FastAPI Router
       │
       │  @router.get("/overview")
       ▼
  routes.py → get_overview()
       │
       │  with db.get_db() as conn: → SQL query
       ▼
  database.py → SQLite (accidents.db)
       │
       │  sqlite3.Row results
       ▼
  routes.py → dict(row) → JSON serialization
       │
       │  HTTP 200 → JSON body
       ▼
  React component
       │
       │  setState(data)  →  re-render
       ▼
  Chart.js / Leaflet / StatCard
       │
       ▼
  User sees updated UI
```

---

## Database Schema

### Tables

#### `articles`

Stores raw scraped article content. One row per news article URL.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTOINCREMENT | Unique article identifier |
| `url` | TEXT | UNIQUE, NOT NULL | Source article URL |
| `title` | TEXT | NOT NULL | Article headline |
| `content` | TEXT | — | Full article body text |
| `published_date` | DATE | — | Article publication date |
| `scraped_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When we scraped it |
| `source` | TEXT | DEFAULT 'The Daily Star' | News source name |

#### `accidents`

Stores structured data extracted from articles. One article can produce one accident record.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PK, AUTOINCREMENT | Unique accident identifier |
| `article_id` | INTEGER | FK → articles(id) | Link back to source article |
| `accident_type` | TEXT | — | Classified type (bus, truck, hit-and-run, etc.) |
| `location_raw` | TEXT | — | Raw location string from article |
| `district` | TEXT | — | Matched Bangladesh district |
| `division` | TEXT | — | Parent division |
| `latitude` | REAL | — | Approximate lat for map |
| `longitude` | REAL | — | Approximate lon for map |
| `deaths` | INTEGER | DEFAULT 0 | Number killed |
| `injuries` | INTEGER | DEFAULT 0 | Number injured |
| `vehicles_involved` | TEXT | — | Comma-separated vehicle list |
| `accident_date` | DATE | — | Date of accident |
| `summary` | TEXT | — | Auto-generated 200-char summary |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Record creation time |

#### `scrape_logs`

Tracks every scrape session for monitoring and debugging.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | PK, AUTOINCREMENT |
| `started_at` | TIMESTAMP | Session start time |
| `finished_at` | TIMESTAMP | Session end time |
| `articles_found` | INTEGER | Total article links discovered |
| `articles_new` | INTEGER | New articles saved (not duplicates) |
| `status` | TEXT | `running`, `completed`, or `error: <message>` |

### Relationships

```
articles  ◀──── 1:1 ────▶  accidents
   │                           │
   │  articles.id = accidents.article_id (FK)
   │                           │
   └───────────────────────────┘
```

### Indexes

| Index | Table | Column(s) | Purpose |
|-------|-------|-----------|---------|
| `idx_accidents_date` | accidents | `accident_date` | Fast daily/monthly queries |
| `idx_accidents_district` | accidents | `district` | Fast district aggregations |
| `idx_accidents_division` | accidents | `division` | Fast division-level stats |
| `idx_accidents_type` | accidents | `accident_type` | Fast type breakdowns |
| `idx_accidents_article` | accidents | `article_id` | Fast article-accident joins |
| `idx_articles_url` | articles | `url` | O(1) duplicate checking during scraping |
| `idx_articles_published` | articles | `published_date` | Date-range queries |

---

## Build & Deployment Pipeline

### Production Build

```
frontend/                          static/dist/
├── src/                           ├── index.html          (entry, <script> tags)
│   ├── App.jsx        ── Vite ──▶ └── assets/
│   ├── pages/*.jsx      build       ├── index-xxxxx.js    (bundled JS, ~667 KB)
│   ├── components/*.jsx             └── index-xxxxx.css   (bundled CSS, ~25 KB)
│   └── styles/global.css
└── vite.config.js
     └─ outDir: '../static/dist'
```

**Vite build output** goes to `static/dist/` — one level up from `frontend/`. FastAPI mounts this directory:
- `/assets/*` → `StaticFiles(directory="static/dist/assets/")`
- `/*` (catch-all) → `FileResponse("static/dist/index.html")`

### Serving Model (Production)

```
                     Port 8000
                        │
                        ▼
                ┌───────────────┐
                │   FastAPI     │
                │               │
    /api/*  ───▶│  routes.py    │──▶ JSON responses
                │               │
    /assets ───▶│  StaticFiles  │──▶ JS/CSS bundles
                │               │
    /*      ───▶│  catch-all    │──▶ index.html (React SPA)
                └───────────────┘
```

Everything is served from a single process on a single port.

---

## Containerised Deployment

The project includes a complete Docker-based deployment pipeline with separate dev and prod configurations.

### Dockerfile (Multi-Stage Build)

**File:** `Dockerfile`

Uses a two-stage build to keep the final image lean:

```
┌──────────────────────────────────────────────────┐
│  Stage 1: "frontend"  (node:22-alpine)           │
│                                                  │
│  WORKDIR /build/frontend                         │
│  COPY frontend/package*.json → npm ci            │
│  COPY frontend/ → npm run build                  │
│  Output: /build/static/dist/                     │
└──────────────────────┬───────────────────────────┘
                       │ COPY --from=frontend
                       ▼
┌──────────────────────────────────────────────────┐
│  Stage 2: "runtime"  (python:3.13-slim)          │
│                                                  │
│  WORKDIR /app                                    │
│  COPY requirements.txt → pip install             │
│  COPY app/, run.py, static/dist/ (from stage 1)  │
│                                                  │
│  ENV APP_ENV=production                          │
│  ENV PYTHONUNBUFFERED=1                          │
│  EXPOSE 8000                                     │
│  HEALTHCHECK → curl /api/overview                │
│  CMD ["python", "run.py"]                        │
└──────────────────────────────────────────────────┘
```

The final image contains only Python runtime + pip deps + compiled frontend assets — no Node.js, no source `.jsx` files, no `node_modules`.

### Docker Compose — Dev

**File:** `docker-compose.dev.yml`

```yaml
services:
  app:
    container_name: traffic-insight-dev
    build: .
    env_file: .env.development
    ports: 8000:8000
    volumes:
      - ./app:/app/app:ro          # live code mount
      - ./run.py:/app/run.py:ro    # live entry point
      - dev-data:/app/data         # persistent DB
    restart: unless-stopped
```

**Key features:**
- Source code is bind-mounted read-only, so changes to `app/` or `run.py` take effect on container restart without rebuilding the image.
- Database is stored in a named volume (`dev-data`) that persists across container recreations.
- Uses `.env.development` (debug logging, CORS=*, Swagger enabled).

### Docker Compose — Prod

**File:** `docker-compose.prod.yml`

```yaml
services:
  app:
    container_name: traffic-insight-prod
    build: .
    env_file: .env.production
    ports: 80:8000
    volumes:
      - prod-data:/app/data        # persistent DB
    restart: always
    healthcheck:
      test: curl -f http://localhost:8000/api/overview
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 30s
```

**Key features:**
- Maps to port **80** (standard HTTP).
- `restart: always` ensures the container recovers from crashes and host reboots.
- Built-in health check pings `/api/overview` every 60 seconds.
- No source mounts — code is baked into the image for reproducibility.
- Uses `.env.production` (WARNING logging, restricted CORS, Swagger disabled).

### Makefile Targets

**File:** `Makefile`

Provides convenience commands for all workflows:

| Target | Command | Effect |
|--------|---------|--------|
| `make help` | — | List all available targets |
| `make install` | `pip install` + `npm install` | Install all dependencies |
| `make build-frontend` | `npm run build` | Build React into `static/dist/` |
| `make run-local` | `APP_ENV=development python run.py` | Run locally without Docker |
| `make dev` | `docker compose -f dev.yml up --build` | Start dev container (foreground) |
| `make dev-d` | `docker compose -f dev.yml up --build -d` | Start dev container (detached) |
| `make dev-stop` | `docker compose -f dev.yml down` | Stop dev container |
| `make dev-logs` | `docker compose -f dev.yml logs -f` | Tail dev logs |
| `make prod` | `docker compose -f prod.yml up --build -d` | Start prod container |
| `make prod-stop` | `docker compose -f prod.yml down` | Stop prod container |
| `make prod-logs` | `docker compose -f prod.yml logs -f` | Tail prod logs |
| `make prod-restart` | `docker compose -f prod.yml restart` | Restart prod |
| `make status` | `docker ps --filter name=traffic-insight` | Show running containers |
| `make shell-dev` | `docker exec -it ... /bin/sh` | Shell into dev container |
| `make shell-prod` | `docker exec -it ... /bin/sh` | Shell into prod container |
| `make db-backup` | `docker cp ...` | Copy prod DB to `backups/` |
| `make clean` | `docker compose down -v` + `rm` | Tear down everything |

### Deployment Flow Diagram

```
  Developer Machine                    Server / Cloud
  ─────────────────                    ──────────────

  ┌───────────────┐
  │  make run-    │   Local dev
  │  local        │   (no Docker)
  └───────┬───────┘
          │
          │  Code changes
          ▼
  ┌───────────────┐
  │  make dev     │   Docker dev
  │  port 8000    │   (volume mounts,
  │               │    debug logging)
  └───────┬───────┘
          │
          │  git push → PR → merge
          ▼
  ┌───────────────┐   ┌───────────────┐
  │  CI Pipeline  │──▶│  make prod    │   Docker prod
  │  (lint, test) │   │  port 80      │   (baked image,
  └───────────────┘   │  healthcheck  │    restart: always)
                      └───────────────┘
```

---

## Environment Configuration

The application adapts its behaviour based on the `APP_ENV` environment variable:

```
                     APP_ENV
                       │
          ┌────────────┼────────────┐
          ▼                         ▼
    "development"              "production"
          │                         │
    DEBUG = True               DEBUG = False
          │                         │
    ┌─────┴──────┐            ┌─────┴──────┐
    │ LOG: DEBUG │            │ LOG: WARN  │
    │ CORS: *   │            │ CORS: url  │
    │ Swagger ✅ │            │ Swagger ❌  │
    │ Reload ✅  │            │ Reload ❌   │
    │ Port 8000 │            │ Port 80    │
    └────────────┘            └────────────┘
```

**Config file cascade:**

1. Hardcoded defaults in `app/config.py`
2. Overridden by `.env.development` or `.env.production` (loaded by Docker Compose `env_file`)
3. Overridden by `.env.local` (personal, git-ignored)
4. Overridden by explicit `ENV` vars set in shell or `docker run -e`

---

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **APP_ENV** | `development` | `production` |
| **DEBUG** | `True` | `False` |
| **Logging** | `DEBUG` level | `WARNING` level |
| **Swagger/ReDoc** | ✅ Available at `/docs`, `/redoc` | ❌ Disabled |
| **CORS** | `*` (all origins) | Restricted to specific domain(s) |
| **Frontend server** | Vite dev server (port 3000) | None — FastAPI serves the build |
| **Backend server** | FastAPI + Uvicorn (port 8000) | Same (mapped to port 80 via Docker) |
| **API routing** | Vite proxy: `/api` → `localhost:8000` | Same-origin, no proxy needed |
| **Hot reload (frontend)** | ✅ Vite HMR | ❌ Must rebuild (`npm run build`) |
| **Hot reload (backend)** | ✅ Uvicorn `--reload` | ❌ Disabled |
| **Browser URL** | `http://localhost:3000` (Vite) or `:8000` | `http://localhost` (port 80) |
| **JS bundle** | Unbundled ES modules | Single minified bundle (~667 KB) |
| **Container** | `docker-compose.dev.yml` (volume mounts) | `docker-compose.prod.yml` (baked image) |
| **Restart policy** | `unless-stopped` | `always` |
| **Health check** | — | `/api/overview` every 60s |

### Development workflows:

```bash
# Option A — Fully local (no Docker)
make run-local                 # FastAPI on :8000 with DEBUG=True
cd frontend && npm run dev     # Vite on :3000, proxies /api to :8000

# Option B — Docker dev
make dev                       # Builds image, starts on :8000 with volume mounts
```

### Production deployment:

```bash
make prod                      # Builds image, starts on :80 with healthcheck
make db-backup                 # Backup database before upgrades
```

---

## CI / CD

**File:** `.github/workflows/ci.yml`

Runs on **every push to any branch** and on **pull requests targeting `main`**. Markdown-only commits are skipped via `paths-ignore`. A `concurrency` group cancels any superseded run on the same branch automatically.

### Backend Job

```
  push / PR → GitHub Actions (backend job)
       │
       ├── Matrix: Python 3.11, 3.12, 3.13   ← matches Docker runtime (3.13-slim)
       ├── cache: pip                          ← faster installs
       │
       ├── Step 1: pip install -r requirements.txt + flake8 + pytest + httpx
       │
       ├── Step 2: flake8 lint (syntax errors, undefined names, max-line-length=120)
       │
       ├── Step 3: import verification
       │     └── python -c "from app.server import create_app"
       │
       └── Step 4: pytest tests/ -v --tb=short
             └── 73 tests across test_database, test_extractor, test_routes, test_security
             └── Each test runs against an isolated temporary SQLite database
```

### Frontend Job

```
  push / PR → GitHub Actions (frontend job, runs in parallel with backend)
       │
       ├── Node.js 22
       ├── cache: npm (via package-lock.json)
       │
       ├── Step 1: npm ci
       ├── Step 2: npx eslint src/
       ├── Step 3: npx vitest run  ← 18 tests (jsdom environment)
       └── Step 4: npm run build   ← ensures production bundle compiles
```

**Branch rules** (documented in `docs/CONTRIBUTING.md`):
- Feature branches: `feature/<name>`
- Bug fix branches: `bugfix/<name>`
- All changes go through PR review before merging to `main`

---

## Testing

### Backend Tests (`tests/`)

Run with `python -m pytest tests/ -v`. Each test gets an **isolated temporary SQLite database** via the `conftest.py` autouse fixture — no test data bleeds between tests.

| File | Tests | Coverage |
|------|-------|----------|
| `tests/test_database.py` | 13 | Article/accident CRUD, duplicate detection, scrape logs, daily/monthly stats, danger zones, map data, yearly overview |
| `tests/test_extractor.py` | 24 | Accident type detection (8 types), location extraction (district, division, inference), casualty parsing (numeric, word, mixed, zero), vehicles, summary, full `process_article()` pipeline |
| `tests/test_routes.py` | 29 | All API endpoints via `httpx.AsyncClient` — overview, daily, monthly, danger zones, recent, map, yearly, search, trend, compare, divisions, danger index, alerts, forecast, time patterns, clusters, YoY, export CSV, scrape logs, latest articles |
| `tests/test_security.py` | 7 | Security headers (`X-Content-Type-Options`, `X-Frame-Options`, CSP, HSTS, Referrer-Policy, Permissions-Policy), rate limiting integration test, `RateLimiter` unit test |

**Configuration:** `pyproject.toml` sets `asyncio_mode = "auto"` and `testpaths = ["tests"]`.

### Frontend Tests (`frontend/src/__tests__/`)

Run with `npm test` (or `npm run test:watch` for watch mode). Uses jsdom environment.

| File | Tests | Coverage |
|------|-------|----------|
| `api.test.js` | 7 | `api()`, `postApi()`, error handling, `formatDate()`, `COLORS` constant |
| `useToast.test.js` | 4 | Toast show, auto-dismiss timer, manual dismiss, max toast limit |
| `ErrorBoundary.test.jsx` | 4 | Renders children normally, catches errors, shows fallback UI, reset button |
| `NotFound.test.jsx` | 3 | 404 page renders, home link present, status code displayed |

---

## Dependency Map

### Backend (Python)

```
run.py
  └─▶ app.server.create_app()
        ├─▶ app.rate_limit.scrape_limiter    (RateLimiter dependency)
        ├─▶ app.routes.router               (APIRouter)
        │     ├─▶ app.database.*            (all query functions)
        │     └─▶ app.scraper.run_scraper()
        │           ├─▶ app.config.*        (URLs, timeouts)
        │           ├─▶ app.database.*      (article_exists, insert_article, scrape_logs)
        │           └─▶ app.extractor.AccidentExtractor
        │                 ├─▶ app.config.BANGLADESH_DISTRICTS / DIVISIONS
        │                 └─▶ app.database.insert_accident()
        ├─▶ app.database.init_db()
        ├─▶ app.scheduler.start_scheduler()
        │     └─▶ app.scraper.run_scraper()  (deferred import)
        └─▶ app.config.STATIC_DIR
```

### Frontend (Node.js)

```
main.jsx
  └─▶ App.jsx
        └─▶ ErrorBoundary.jsx           (global render-error catcher)
              └─▶ ThemeProvider          (dark/light context, useTheme.jsx)
                    └─▶ BrowserRouter
                          └─▶ Layout.jsx
                                ├─▶ BDLogo.jsx
                                ├─▶ useToast.js           (toast hook)
                                ├─▶ ToastContainer.jsx
                                ├─▶ AlertBanner.jsx        (high-severity alerts)
                                ├─▶ api.js → postApi()    (scrape button)
                                └─▶ <Outlet>              (lazy-loaded pages)
                                      ├─▶ Dashboard.jsx
                                      │     ├─▶ api.js → api()
                                      │     ├─▶ StatCard.jsx
                                      │     ├─▶ ChartCard.jsx (Line, Doughnut, Bar)
                                      │     ├─▶ ForecastChart.jsx
                                      │     ├─▶ TimeHeatmap.jsx
                                      │     ├─▶ ClusterTimeline.jsx
                                      │     ├─▶ YoYSummary.jsx
                                      │     ├─▶ LiveNews.jsx
                                      │     └─▶ YouTubeNews.jsx
                                      ├─▶ Daily.jsx
                                      │     ├─▶ api.js → api()
                                      │     ├─▶ StatCard.jsx
                                      │     └─▶ ChartCard.jsx (Pie, Bar)
                                      ├─▶ Monthly.jsx
                                      │     ├─▶ api.js → api()
                                      │     ├─▶ StatCard.jsx
                                      │     └─▶ ChartCard.jsx (Line, Doughnut, Bar)
                                      ├─▶ DangerMap.jsx
                                      │     ├─▶ api.js → api()
                                      │     └─▶ react-leaflet + markercluster + leaflet.heat
                                      ├─▶ Zones.jsx
                                      │     └─▶ api.js → api()  (danger-zones + danger-index)
                                      ├─▶ Compare.jsx
                                      │     └─▶ api.js → api()  (compare/monthly + compare/yearly)
                                      ├─▶ SearchPage.jsx
                                      │     └─▶ api.js → api()  (search with filters)
                                      ├─▶ Records.jsx
                                      │     └─▶ api.js → api()  (recent + search)
                                      └─▶ NotFound.jsx           (404 catch-all)
```

### Third-party Libraries

| Layer | Library | Purpose |
|-------|---------|---------|
| Backend | `fastapi` | HTTP framework, request validation, dependency injection |
| Backend | `starlette` (`BaseHTTPMiddleware`) | Base class for `SecurityHeadersMiddleware` |
| Backend | `fastapi` (`CORSMiddleware`) | Cross-origin request support |
| Backend | `uvicorn` | ASGI server |
| Backend | `beautifulsoup4` + `lxml` | HTML parsing |
| Backend | `requests` | HTTP client for scraping |
| Backend | `apscheduler` | Background job scheduling |
| Testing | `pytest` + `pytest-asyncio` | Backend test runner + async test support |
| Testing | `httpx` | AsyncClient for API route integration tests |
| Frontend | `react` + `react-dom` | UI rendering |
| Frontend | `react-router-dom` | Client-side routing |
| Frontend | `chart.js` + `react-chartjs-2` | Charts (line, bar, doughnut, pie) |
| Frontend | `leaflet` + `react-leaflet` | Interactive maps |
| Frontend | `leaflet.markercluster` | Clustered map markers |
| Frontend | `leaflet.heat` | Heatmap layer |
| Frontend | `react-icons` | Icon library (Font Awesome set) |
| Build | `vite` + `@vitejs/plugin-react` | Frontend bundler + dev server |
| Testing | `vitest` | Frontend test runner (jsdom environment) |
| Testing | `@testing-library/react` + `@testing-library/jest-dom` | Component rendering + DOM assertions |

---

*Last updated: February 2026 — reflects security middleware, rate limiting, full analytics API, lazy-loaded routes, ErrorBoundary, testing suite, and updated CI pipeline.*
