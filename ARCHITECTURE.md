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
8. [Development vs Production](#development-vs-production)
9. [CI / CD](#ci--cd)
10. [Dependency Map](#dependency-map)

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
| `run.py` | Entry point. Imports `create_app()` from `app.server`, binds the app to Uvicorn on `0.0.0.0:8000` with hot-reload. |
| `app/server.py` | **Application factory** — `create_app()` builds and returns a configured FastAPI instance. |

**Startup sequence (`create_app` → `lifespan`):**

```
run.py
  └─▶ create_app()              [app/server.py]
       ├─ Add CORS middleware    [allows cross-origin requests]
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

Centralises every tuneable constant so no other module contains magic values.

| Setting | Default | Role |
|---------|---------|------|
| `BASE_DIR` | project root | Anchor for all relative paths |
| `DATA_DIR` | `<root>/data/` | SQLite database location |
| `STATIC_DIR` | `<root>/static/` | React production build |
| `DB_PATH` | `data/accidents.db` | Full database file path |
| `DAILY_STAR_ACCIDENT_URL` | `thedailystar.net/tags/road-accident` | Scrape target |
| `SCRAPE_INTERVAL_HOURS` | `6` | Background scrape frequency |
| `REQUEST_DELAY` | `2` (seconds) | Polite delay between HTTP requests |
| `MAX_PAGES_PER_SCRAPE` | `5` | Pagination depth limit |
| `BANGLADESH_DISTRICTS` | 64 entries | NLP location matching list |
| `BANGLADESH_DIVISIONS` | 10 entries | Division-level matching list |
| `ACCIDENT_TYPES` | 30+ patterns | Keyword list for type classification |

### API Layer (Routes)

**File:** `app/routes.py`

All endpoints are mounted under the `/api` prefix via `APIRouter(prefix="/api")`.

| Method | Endpoint | Description | Used by Page |
|--------|----------|-------------|-------------|
| GET | `/api/overview` | Global stats (total accidents, deaths, injuries, today's count, last scrape info) | Dashboard |
| GET | `/api/trend?days=N` | Daily accident count for the last N days | Dashboard (line chart) |
| GET | `/api/daily?date=YYYY-MM-DD` | Stats for a single date (by type, by district) | Daily |
| GET | `/api/monthly?year=Y&month=M` | Stats for a month (daily breakdown, type, district) | Monthly |
| GET | `/api/danger-zones?limit=N` | Top N districts ranked by accident count | Zones |
| GET | `/api/map-data` | All accidents with lat/lon for map plotting | DangerMap |
| GET | `/api/recent?limit=N` | Most recent accident records with article links | Records |
| GET | `/api/search?q=text&limit=N` | Full-text search across accidents + articles | Records |
| GET | `/api/yearly` | Month-by-month aggregate for all time | Dashboard |
| GET | `/api/scrape-logs?limit=N` | Scrape history (start time, articles found, status) | — |
| POST | `/api/scrape` | Trigger an on-demand scrape (runs in thread pool, non-blocking) | Layout (Scrape Now button) |

**How routes connect to data:**

All route handlers use the `get_db()` context manager for safe, leak-free database access:

```
routes.py
  ├─ GET  endpoints ──▶ with db.get_db() as conn: ──▶ SQL queries ──▶ JSON response
  ├─ GET  helper fns ──▶ db.get_daily_stats(), db.get_monthly_stats(), etc.
  └─ POST /api/scrape ─▶ run_in_executor(scraper.run_scraper) ──▶ (non-blocking)
```

**Thread safety:** The YouTube video cache (`_yt_cache`) uses a `threading.Lock()` for safe concurrent access.

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

```
<BrowserRouter>
  └─ <Routes>
       └─ <Route element={<Layout />}>                ← persistent shell
            ├─ <Route index      element={<Dashboard />} />
            ├─ <Route path="daily"    element={<Daily />} />
            ├─ <Route path="monthly"  element={<Monthly />} />
            ├─ <Route path="map"      element={<DangerMap />} />
            ├─ <Route path="zones"    element={<Zones />} />
            └─ <Route path="records"  element={<Records />} />
```

### Component Responsibilities

#### Shared Components (`src/components/`)

| Component | Props | Role |
|-----------|-------|------|
| **Layout** | — | App shell: header with title, navigation tabs (`<NavLink>`), "Scrape Now" button, toast notification area, `<Outlet>` for child routes. |
| **StatCard** | `title`, `value`, `icon`, `color` | Reusable stat display card (e.g. "Total Deaths: 142"). Accepts a react-icon component. |
| **ChartCard** | `title`, `type`, `data`, `options` | Wrapper around `react-chartjs-2` — supports `line`, `bar`, `doughnut`, `pie` chart types. |
| **ToastContainer** | `toasts` | Renders a stack of toast notification messages. |

#### Page Components (`src/pages/`)

| Page | API Endpoints Consumed | Visualisations |
|------|----------------------|----------------|
| **Dashboard** | `/api/overview`, `/api/trend?days=30` | 4 stat cards, trend line chart, accident type doughnut, district bar chart |
| **Daily** | `/api/daily?date=YYYY-MM-DD` | Date picker, 3 stat cards, type pie chart, district bar chart |
| **Monthly** | `/api/monthly?year=Y&month=M` | Year + month selectors, 3 stat cards, daily breakdown line, type doughnut, district bar chart |
| **DangerMap** | `/api/map-data` | Full-screen Leaflet map, MarkerCluster layer, heatmap toggle, popup cards with accident details |
| **Zones** | `/api/danger-zones` | Ranked list of danger zone cards with accident/death/injury counts |
| **Records** | `/api/recent`, `/api/search?q=` | Searchable table with debounced input, links back to original articles |

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
| `/records` | Records |

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
| `useToast.js` | `useToast()` hook | Custom React hook managing toast state with auto-dismiss timers |

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

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **Frontend server** | Vite dev server (port 3000) | None — FastAPI serves the build |
| **Backend server** | FastAPI + Uvicorn (port 8000) | Same |
| **API routing** | Vite proxy: `/api` → `localhost:8000` | Same-origin, no proxy needed |
| **Hot reload (frontend)** | ✅ Vite HMR | ❌ Must rebuild (`npm run build`) |
| **Hot reload (backend)** | ✅ Uvicorn `--reload` | Typically disabled |
| **Browser URL** | `http://localhost:3000` | `http://localhost:8000` |
| **JS bundle** | Unbundled ES modules | Single minified bundle (~667 KB) |

### Two-terminal dev workflow:

```bash
# Terminal 1 — Backend
python run.py                  # FastAPI on :8000

# Terminal 2 — Frontend (hot reload)
cd frontend && npm run dev     # Vite on :3000, proxies /api to :8000
```

---

## CI / CD

**File:** `.github/workflows/ci.yml`

Runs on every pull request targeting `main`.

```
  PR opened/updated → GitHub Actions
       │
       ├── Matrix: Python 3.11, 3.12
       │
       ├── Step 1: Install Python deps
       │
       ├── Step 2: flake8 lint check
       │     └── Checks for syntax errors, undefined names, style issues
       │
       └── Step 3: Import verification
             └── python -c "from app.server import create_app"
             └── Ensures the app module loads cleanly
```

**Branch rules** (documented in `CONTRIBUTING.md`):
- Feature branches: `feature/<name>`
- Bug fix branches: `bugfix/<name>`
- All changes go through PR review before merging to `main`

---

## Dependency Map

### Backend (Python)

```
run.py
  └─▶ app.server.create_app()
        ├─▶ app.routes.router          (APIRouter)
        │     └─▶ app.database.*       (all query functions)
        │     └─▶ app.scraper.run_scraper()
        │           ├─▶ app.config.*   (URLs, timeouts)
        │           ├─▶ app.database.* (article_exists, insert_article, scrape_logs)
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
        └─▶ Layout.jsx
              ├─▶ useToast.js           (toast hook)
              ├─▶ ToastContainer.jsx
              ├─▶ api.js → postApi()    (scrape button)
              └─▶ <Outlet>
                    ├─▶ Dashboard.jsx
                    │     ├─▶ api.js → api()
                    │     ├─▶ StatCard.jsx
                    │     └─▶ ChartCard.jsx (Line, Doughnut, Bar)
                    ├─▶ Daily.jsx
                    │     ├─▶ api.js → api()
                    │     ├─▶ StatCard.jsx
                    │     └─▶ ChartCard.jsx (Pie, Bar)
                    ├─▶ Monthly.jsx
                    │     ├─▶ api.js → api()
                    │     ├─▶ StatCard.jsx
                    │     └─▶ ChartCard.jsx (Line, Doughnut, Bar)
                    ├─▶ DangerMap.jsx
                    │     └─▶ api.js → api()
                    │     └─▶ react-leaflet (MapContainer, TileLayer, Marker, Popup)
                    │     └─▶ leaflet.markercluster + leaflet.heat
                    ├─▶ Zones.jsx
                    │     └─▶ api.js → api()
                    └─▶ Records.jsx
                          └─▶ api.js → api() (recent + search)
```

### Third-party Libraries

| Layer | Library | Purpose |
|-------|---------|---------|
| Backend | `fastapi` | HTTP framework, request validation |
| Backend | `fastapi` (CORSMiddleware) | Cross-origin request support |
| Backend | `uvicorn` | ASGI server |
| Backend | `beautifulsoup4` + `lxml` | HTML parsing |
| Backend | `requests` | HTTP client for scraping |
| Backend | `apscheduler` | Background job scheduling |
| Frontend | `react` + `react-dom` | UI rendering |
| Frontend | `react-router-dom` | Client-side routing |
| Frontend | `chart.js` + `react-chartjs-2` | Charts (line, bar, doughnut, pie) |
| Frontend | `leaflet` + `react-leaflet` | Interactive maps |
| Frontend | `leaflet.markercluster` | Clustered map markers |
| Frontend | `leaflet.heat` | Heatmap layer |
| Frontend | `react-icons` | Icon library (Font Awesome set) |
| Build | `vite` + `@vitejs/plugin-react` | Frontend bundler + dev server |

---

*Last updated: February 2026*
