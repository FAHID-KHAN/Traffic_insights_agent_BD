# Traffic Insights Agent - Bangladesh 🇧🇩

**Real-time road accident analysis dashboard** powered by automated web scraping from **The Daily Star Bangladesh**.

This application scrapes, processes, and visualizes road accident data to identify danger zones, track casualties, provide daily/monthly/yearly analysis, forecast trends, and detect accident clusters — helping raise awareness about road safety in Bangladesh.

---

## Features

### Core
- **Automated Web Scraping** — Scrapes accident news from The Daily Star's road-accident tag page every 6 hours
- **NLP Data Extraction** — Automatically extracts accident type, location (district/division), death & injury counts, vehicles involved
- **Manual Scrape Trigger** — One-click button to trigger immediate scraping

### Dashboard & Visualization
- **Interactive Dashboard** — Real-time overview with stat cards, timeframe filters (7d / 30d / 90d / 6m / Year / All / Custom), trend charts, type breakdowns, and top danger districts
- **Daily Analysis** — Date-specific breakdown of accidents, deaths, injuries by type and location
- **Monthly Analysis** — Monthly aggregates with daily breakdown charts and top danger zones
- **Danger Zone Map** — Interactive Leaflet map with marker clusters, heatmap layer, and division-level breakdown cards with district drill-down
- **Danger Zone Rankings** — Toggle between Fatality Index (severity-scored) and Classic Ranking views
- **Comparative Analytics** — Month-vs-Month and Year-vs-Year comparison with delta indicators, trend overlay chart, type comparison, and district deaths bar chart

### Analytics & Insights
- **Trend Forecasting** — 3-month simple moving-average forecast line on monthly charts with projected accidents/deaths/injuries
- **Time-Pattern Heatmap** — Month × Day-of-Week grid heatmap, Week × Day grid, horizontal bar breakdowns showing when accidents happen most
- **Accident Clustering** — Sliding-window algorithm detects clusters of accidents in the same district within a configurable time window, with severity badges and expandable detail tables
- **Year-over-Year Summary** — Auto-generated dashboard card comparing current year vs previous year YTD, with delta badges and monthly comparison chart
- **Fatality Rate / Danger Index** — Deaths-per-accident scoring for districts with severity classification

### UX & Design
- **Dark / Light Theme Toggle** — BD-themed color palette (bottle-green & red), toggleable with sun/moon button, persisted in localStorage
- **Export & Download** — CSV export of filtered accident data via one-click header button
- **Advanced Search** — Full-text search with district, type, severity, and date range filters; results summary bar; critical row highlighting
- **High-Severity Alert Banner** — Red dismissable banner for 5+ death accidents in the last 3 days, auto-refreshes every 5 minutes
- **Live News Feed** — Latest scraped articles displayed as cards with death/injury badges
- **YouTube News Feed** — Embedded YouTube video results for Bangladesh road accident news (cached 30 minutes)
- **Responsive Design** — Adapts across desktop, tablet, and mobile breakpoints
- **BD Branding** — Custom SVG logo, Bangladesh flag color palette, deep teal-green dark theme

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Python 3.14, FastAPI 0.115, CORS middleware |
| **Frontend** | React 19 + Vite 7 |
| **Routing** | React Router v7 |
| **Charts** | Chart.js + react-chartjs-2 |
| **Maps** | React-Leaflet + MarkerCluster + Heatmap |
| **Icons** | react-icons (Font Awesome) |
| **Scraper** | BeautifulSoup4, Requests, lxml |
| **NLP/Extraction** | Regex-based entity extraction |
| **Database** | SQLite (WAL mode, context-managed connections) |
| **Scheduler** | APScheduler (6-hour interval) |
| **Theme** | CSS custom properties + ThemeProvider context |
| **Backend Testing** | pytest 9+ / pytest-asyncio / httpx (73 tests) |
| **Frontend Testing** | Vitest 4 / Testing Library / jsdom (18 tests) |
| **Rate Limiting** | In-memory sliding-window per-IP limiter |
| **Security** | Custom middleware — CSP, HSTS, X-Frame-Options, etc. |
| **CI/CD** | GitHub Actions (parallel backend + frontend jobs) |

---

## Project Structure

```
Traffic_insights_agent_BD/
├── run.py                      # Entry point — starts the server
├── requirements.txt            # Python dependencies
├── app/                        # Backend Python package
│   ├── __init__.py
│   ├── config.py               # Configuration, divisions, districts
│   ├── database.py             # SQLite models & queries
│   ├── extractor.py            # NLP-based accident data extraction
│   ├── rate_limit.py            # Sliding-window per-IP rate limiter
│   ├── routes.py               # FastAPI route definitions (30+ endpoints)
│   ├── scheduler.py            # APScheduler background job
│   ├── scraper.py              # Web scraper (The Daily Star)
│   └── server.py               # Application factory + security middleware
├── frontend/                   # React + Vite frontend
│   ├── index.html              # HTML entry point
│   ├── package.json            # Node dependencies
│   ├── vite.config.js          # Vite config (proxy + build output)
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── App.jsx             # Router with 8 routes
│       ├── styles/
│       │   └── global.css      # Dark/light theme, responsive styles
│       ├── __tests__/
│       │   ├── setup.js            # Vitest global setup (jest-dom)
│       │   ├── api.test.js         # 7 tests — api(), formatDate, COLORS
│       │   ├── useToast.test.js    # 4 tests — useToast hook
│       │   ├── ErrorBoundary.test.jsx  # 4 tests — ErrorBoundary
│       │   └── NotFound.test.jsx   # 3 tests — 404 page
│       ├── utils/
│       │   ├── api.js          # Fetch helpers, COLORS, formatDate
│       │   ├── useTheme.jsx    # ThemeProvider context (dark/light)
│       │   └── useToast.js     # Toast notification hook
│       ├── components/
│       │   ├── Layout.jsx      # Header, nav, theme toggle, footer
│       │   ├── StatCard.jsx    # Reusable stat card
│       │   ├── ChartCard.jsx   # Chart.js wrapper
│       │   ├── BDLogo.jsx      # Custom SVG Bangladesh logo
│       │   ├── AlertBanner.jsx # High-severity alert banner
│       │   ├── LiveNews.jsx    # Live news article feed
│       │   ├── YouTubeNews.jsx # YouTube video news grid
│       │   ├── ForecastChart.jsx   # Moving-average forecast
│       │   ├── TimeHeatmap.jsx     # Day/month pattern heatmap
│       │   ├── ClusterTimeline.jsx # Accident cluster detection
│       │   ├── YoYSummary.jsx      # Year-over-year report
│       │   └── ToastContainer.jsx
│       └── pages/
│           ├── Dashboard.jsx   # Overview, stats, charts, forecast, heatmap, clusters, YoY
│           ├── Daily.jsx       # Daily analysis
│           ├── Monthly.jsx     # Monthly analysis
│           ├── DangerMap.jsx   # Leaflet map + division stats
│           ├── Zones.jsx       # Danger zone rankings + fatality index
│           ├── Compare.jsx     # Comparative analytics (month/year)
│           ├── SearchPage.jsx  # Advanced search with filters
│           └── Records.jsx     # Searchable records table
├── static/dist/                # Production build (generated)
├── data/                       # SQLite database (auto-created)
│   └── accidents.db
├── tests/                      # Backend test suite (pytest)
│   ├── __init__.py
│   ├── conftest.py             # Shared fixtures, temp DB isolation
│   ├── test_database.py        # 13 tests — CRUD, stats, danger zones
│   ├── test_extractor.py       # 24 tests — NLP extraction pipeline
│   ├── test_routes.py          # 29 tests — all API endpoints (httpx)
│   └── test_security.py        # 7 tests — headers & rate limiting
├── pyproject.toml              # pytest configuration
├── Dockerfile                  # Multi-stage build (Node 22 + Python 3.13)
├── docker-compose.dev.yml      # Dev environment (port 8000, hot-reload)
├── docker-compose.prod.yml     # Prod environment (port 80, healthcheck)
├── Makefile                    # Quick commands for dev/prod workflows
├── .env.development            # Dev environment variables
├── .env.production             # Prod environment variables
├── .dockerignore               # Docker build exclusions
├── .github/
│   ├── workflows/ci.yml        # CI pipeline (parallel lint + test)
│   └── pull_request_template.md
├── ARCHITECTURE.md             # Detailed architecture documentation
├── CONTRIBUTING.md             # Branch & PR rules
└── .gitignore
```

---

## Quick Start

### 1. Clone & Navigate

```bash
git clone <your-repo-url>
cd Traffic_insights_agent_BD
```

### 2. Create a Virtual Environment (recommended)

```bash
python3 -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows
```

### 3. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 4. Install & Build the React Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

This builds the React app into `static/dist/`, which FastAPI serves automatically.

### 5. Run the Application

```bash
python run.py
```

Open **http://localhost:8000** in your browser.

> **Note:** The SQLite database (`data/accidents.db`) is created automatically on first run. No extra setup needed.

### 6. Start Scraping Data

You won't see any data on the dashboard until you run your first scrape:

- Click the **"Scrape Now"** button in the top-right corner of the dashboard, or
- Manually trigger via API:
  ```bash
  curl -X POST http://localhost:8000/api/scrape
  ```
- Or just wait — the built-in scheduler scrapes automatically every 6 hours.

The first scrape may take 1–2 minutes as it fetches and processes articles from The Daily Star.

---

## Development Mode

For frontend hot-reloading during development, run two terminals:

**Terminal 1 — Backend:**
```bash
python run.py
```

**Terminal 2 — Frontend (hot reload):**
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000** — Vite proxies all `/api/*` requests to FastAPI on port 8000.

---

## Using the Dashboard

Once the server is running, open **http://localhost:8000** in any browser. The UI is a React single-page app with dark/light theme support and eight navigation tabs.

### Dashboard (Home)

The landing page shows:
- **Summary cards** — total accidents, deaths, injuries, today's count, and articles scraped
- **Timeframe filter bar** — 7d / 30d / 90d / 6m / Year / All / Custom Range
- **Trend line chart** — accidents, deaths, and injuries over the selected period
- **Accident types doughnut** and **Top danger districts bar chart**
- **Year-over-Year Report** — current year vs previous year summary cards with delta badges and monthly comparison chart
- **Trend Forecast** — moving-average forecast line showing projected accidents for the next 3 months, switchable between accidents/deaths/injuries
- **Time-Pattern Heatmap** — Month × Day-of-Week grid, Week × Day grid, or bar chart views showing when accidents happen most
- **Accident Clusters** — auto-detected repeat-incident zones with configurable window and severity badges
- **YouTube News** — embedded video results for Bangladesh road accident coverage
- **Live News Feed** — latest scraped articles with casualty badges

### Daily Analysis

Pick any date using the date picker. The page shows stat cards, accident type pie chart, and district bar chart for that day.

### Monthly Analysis

Select year and month from dropdowns. Shows monthly totals, daily average, day-by-day breakdown, accident types, and top districts.

### Danger Map

Interactive **Leaflet** map centered on Bangladesh with two views:
- **Markers** — clustered circle markers with popup details (type, date, casualties, source link)
- **Heatmap** — color-coded intensity overlay

Plus **division-level breakdown cards** with expandable district drill-down tables showing accidents, deaths, and injuries per district.

### Danger Zones

Toggle between two views:
- **Fatality Index** — danger meter visualization with severity badges (critical/high/moderate/low) scored by deaths-per-accident ratio
- **Classic Ranking** — top districts ranked by accident frequency

### Compare

Comparative analytics with two modes:
- **Month-vs-Month** — same month across two years with 4 summary cards (Accidents, Deaths, Injuries, Fatality Rate), delta indicators, daily trend overlay, type comparison, and district deaths bar
- **Year-vs-Year** — full year comparison with monthly breakdown chart

### Search

Advanced search page with:
- Full-text query input
- Filter dropdowns for district, accident type, severity level, and date range
- Results summary bar (total results, deaths, injuries)
- One-click CSV export of search results
- Critical row highlighting for mass-casualty incidents (5+ deaths)

### Records

Full searchable table of every extracted accident with columns for date, type, location, district, deaths, injuries, vehicles, and source article link.

### Header Actions

- **Theme Toggle** — sun/moon button switches between dark and light modes
- **Export CSV** — downloads all accident data as CSV
- **Scrape Now** — triggers an immediate scrape with spinner and toast notification

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard frontend (SPA) |
| `GET` | `/api/overview` | Overall statistics (supports `?start=&end=` date filters) |
| `GET` | `/api/daily?date=YYYY-MM-DD` | Daily accident stats |
| `GET` | `/api/monthly?year=2026&month=2` | Monthly accident stats |
| `GET` | `/api/danger-zones?limit=20` | Top danger zones (supports date filters) |
| `GET` | `/api/recent?limit=50` | Recent accident records |
| `GET` | `/api/map-data` | All accidents with coordinates |
| `GET` | `/api/trend` | Accident trend data (supports `?days=`, `?start=&end=`) |
| `GET` | `/api/yearly` | Yearly/monthly overview |
| `GET` | `/api/search?q=Dhaka` | Search accidents |
| `GET` | `/api/search/advanced` | Advanced search with `?q=&district=&type=&severity=&start=&end=` |
| `GET` | `/api/forecast` | Moving-average forecast (`?months=12&forecast_months=3`) |
| `GET` | `/api/time-patterns` | Day-of-week / month patterns for heatmap |
| `GET` | `/api/clusters` | Accident cluster detection (`?window_days=7&min_accidents=3`) |
| `GET` | `/api/yoy-summary` | Year-over-year comparison summary |
| `GET` | `/api/compare/monthly` | Monthly comparison (`?month=&year1=&year2=`) |
| `GET` | `/api/compare/yearly` | Yearly comparison (`?year1=&year2=`) |
| `GET` | `/api/divisions` | Division-level stats with district breakdown |
| `GET` | `/api/danger-index` | Fatality rate danger index |
| `GET` | `/api/articles/latest` | Latest scraped articles with stats |
| `GET` | `/api/youtube-videos` | YouTube search results (cached 30min) |
| `GET` | `/api/alerts/high-severity` | Recent high-severity alerts |
| `GET` | `/api/export/csv` | CSV download (supports date/district filters) |
| `POST` | `/api/scrape` | Trigger manual scrape (non-blocking) |
| `GET` | `/api/scrape-logs` | Recent scrape history |

---

## How It Works

1. **Scraping**: The scraper visits The Daily Star's `/tags/road-accident` page, collects article links, and fetches full article content

2. **Extraction**: Each article is processed by the NLP extractor which uses regex patterns to identify:
   - **Accident type** (bus crash, hit-and-run, collision, etc.)
   - **Location** (maps to 64 districts + 10 divisions of Bangladesh)
   - **Casualties** (death and injury counts from text)
   - **Vehicles involved** (bus, truck, motorcycle, etc.)

3. **Storage**: Structured data is stored in SQLite (WAL mode) with proper indexing for fast queries. All database access uses context-managed connections to prevent leaks.

4. **Analysis**: Backend computes forecasts, clusters, YoY comparisons, danger indices, and time patterns from the raw data

5. **Visualization**: The React frontend fetches data via REST APIs and renders interactive charts, maps, heatmaps, and tables

---

## Backend Robustness

The backend has been hardened with the following reliability improvements:

### Connection Safety
- **Context-managed database access** — All database operations use a `get_db()` context manager (`with db.get_db() as conn:`) that guarantees connections are closed on both success and failure, with automatic commit/rollback
- **No connection leaks** — All 20+ route handlers and database functions migrated from manual `get_connection()`/`close()` to context managers

### Scraper Reliability
- **No silent date corruption** — If the published date cannot be parsed, it is stored as `None` (with a warning log) instead of silently defaulting to today's date
- **Early termination on duplicates** — If all articles on a page already exist in the database, pagination stops early instead of continuing to fetch more duplicate pages
- **Extractor reuse** — A single `AccidentExtractor` instance is created per scrape cycle instead of per article, reducing overhead

### Server Hardening
- **Graceful SPA fallback** — If the React frontend hasn't been built yet, the SPA catch-all returns a 503 JSON response with build instructions instead of crashing with a 500 error
- **CORS middleware** — Configured for cross-origin access during development and external API consumption
- **Non-blocking scrape** — The `/api/scrape` POST endpoint runs the synchronous scraper in a thread pool via `run_in_executor()`, preventing it from blocking the async event loop
- **Thread-safe YouTube cache** — The YouTube video cache uses a `threading.Lock()` for safe concurrent access

### Data Quality
- **Division name normalization** — Handles variant spellings (Chattogram→Chittagong, Barishal→Barisal) consistently via alias mapping
- **Boilerplate-filtered summaries** — Article summaries now filter out copyright notices, "follow us" prompts, and other boilerplate text
- **Additional database indexes** — Added indexes on `division` and `article_id` columns for faster aggregation queries
- **Single initialization** — Database schema is initialized once during server startup (via the lifespan manager) instead of redundantly at module import time

---

## Testing

The project has **91 automated tests** across backend and frontend, all runnable locally and in CI.

### Backend Tests (pytest)

73 tests covering the database layer, NLP extractor, all API routes, security headers, and rate limiting.

```bash
# Activate your virtual environment first
source .venv/bin/activate

# Run all backend tests
python -m pytest tests/ -v

# Run a specific test file
python -m pytest tests/test_routes.py -v

# Run with coverage (if pytest-cov is installed)
python -m pytest tests/ --cov=app
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `test_database.py` | 13 | Article/accident CRUD, stats queries, danger zones, map data |
| `test_extractor.py` | 24 | Accident type detection, location extraction, casualty parsing, vehicles, full pipeline |
| `test_routes.py` | 29 | All API endpoints via `httpx.AsyncClient` — overview, daily, monthly, search, trend, compare, export, forecast, clusters, YoY |
| `test_security.py` | 7 | Security headers verification, rate limiting integration + unit tests |

Each test runs against an **isolated temporary SQLite database** that is created and destroyed per test via the `conftest.py` fixtures. No test data leaks between tests.

### Frontend Tests (Vitest)

18 tests covering utility functions, hooks, and key components.

```bash
cd frontend

# Run all frontend tests
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `api.test.js` | 7 | `api()`, `postApi()`, `formatDate()`, `COLORS` constant |
| `useToast.test.js` | 4 | Toast hook — show, auto-dismiss, manual dismiss, max limit |
| `ErrorBoundary.test.jsx` | 4 | Renders children, catches errors, shows fallback UI, reset |
| `NotFound.test.jsx` | 3 | 404 page rendering, home link, status code display |

---

## Security

### Security Headers

All responses include hardened HTTP headers via `SecurityHeadersMiddleware` in `app/server.py`:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Block clickjacking via iframes |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disable unnecessary browser APIs |
| `Content-Security-Policy` | `default-src 'self'; ...` | Restrict resource loading origins |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS (**production only**) |

### Rate Limiting

The `POST /api/scrape` endpoint is protected by an **in-memory sliding-window rate limiter**:

- **Limit**: 3 requests per 60-second window per IP address
- **IP detection**: Uses `X-Forwarded-For` header (proxy-aware) or falls back to `client.host`
- **Exceeded response**: Returns `429 Too Many Requests` with a `Retry-After` header indicating seconds until the window resets
- **Implementation**: `app/rate_limit.py` — lightweight, no external dependencies

---

## CI / CD Pipeline

GitHub Actions runs **two parallel jobs** on every push and pull request (`.github/workflows/ci.yml`):

### Backend Job
| Step | Detail |
|------|--------|
| **Matrix** | Python 3.11 + 3.12 |
| **Lint** | `flake8` with relaxed line-length (120 chars) |
| **Import Check** | Verifies all app modules import without errors |
| **Tests** | `pytest tests/ -v` against isolated temp databases |

### Frontend Job
| Step | Detail |
|------|--------|
| **Runtime** | Node.js 22 |
| **Install** | `npm ci` (locked dependencies) |
| **Lint** | `npx eslint src/` |
| **Tests** | `npx vitest run` (jsdom environment) |
| **Build** | `npm run build` — ensures production bundle compiles |

Both jobs must pass before a pull request can be merged.

---

## Deployment

The project supports **local**, **Docker dev**, and **Docker prod** workflows.

### Local (no Docker)

```bash
make install        # pip install + npm install
make build-frontend # build React into static/dist/
make run-local      # APP_ENV=development python run.py
```

### Docker — Development

```bash
make dev            # docker compose up (port 8000, live-reload volumes)
make dev-d          # same, but detached
make dev-logs       # tail container logs
make dev-stop       # stop dev container
```

Dev mode mounts `./app` and `./run.py` as read-only volumes so code changes are picked up on restart without rebuilding the image.

### Docker — Production

```bash
make prod           # docker compose up -d (port 80, restart: always)
make prod-logs      # tail prod logs
make prod-restart   # restart without rebuild
make prod-stop      # stop prod container
```

### Utility Commands

```bash
make status         # show running traffic-insight containers
make shell-dev      # open shell in dev container
make shell-prod     # open shell in prod container
make db-backup      # copy prod DB to backups/ with timestamp
make clean          # tear down all containers, volumes, and build artifacts
make help           # list all available targets
```

### Environment Files

| File | Purpose |
|------|---------|
| `.env.development` | Dev defaults — `APP_ENV=development`, `LOG_LEVEL=DEBUG`, `CORS_ORIGINS=*` |
| `.env.production` | Prod defaults — `APP_ENV=production`, `LOG_LEVEL=WARNING`, restricted CORS |
| `.env.local` | **Your local overrides** (git-ignored) — create this to customize without touching tracked files |

### Dockerfile

Multi-stage build:
1. **Stage 1** (`node:22-alpine`) — installs npm deps and runs `npm run build`
2. **Stage 2** (`python:3.13-slim`) — installs pip deps, copies app code + built frontend, runs `python run.py`

Includes a `HEALTHCHECK` on `/api/overview` and sets `PYTHONUNBUFFERED=1`.

### Recommended Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Local Dev  │ ──▶ │  Docker Dev │ ──▶ │  Docker Prod│
│  make run-  │     │  make dev   │     │  make prod  │
│  local      │     │  port 8000  │     │  port 80    │
└─────────────┘     └─────────────┘     └─────────────┘
```

Develop locally → test in containerized dev → deploy to prod.

---

## Configuration

All settings in `app/config.py` can be overridden via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | `development` or `production` |
| `LOG_LEVEL` | `DEBUG` (dev) / `WARNING` (prod) | Python logging level |
| `DATA_DIR` | `data/` | Directory for SQLite database |
| `DB_PATH` | `data/accidents.db` | Database file path |
| `SCRAPE_INTERVAL_HOURS` | `6` | Scraping frequency |
| `MAX_PAGES` | `5` | Pages to scrape per cycle |
| `REQUEST_TIMEOUT` | `30` | HTTP request timeout (seconds) |
| `REQUEST_DELAY` | `2` | Politeness delay between requests |
| `API_HOST` | `0.0.0.0` | Server bind address |
| `API_PORT` | `8000` | Server port |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

**In development**, `DEBUG=True` enables auto-reload, debug logging, and Swagger docs at `/docs`.

**In production**, `DEBUG=False` disables Swagger/ReDoc, sets WARNING-level logging, and restricts CORS origins.

---

## Data Source

All data is sourced from **[The Daily Star](https://www.thedailystar.net)**, one of Bangladesh's leading English-language newspapers. The scraper specifically targets their [road accident tag](https://www.thedailystar.net/tags/road-accident) page.

> **Disclaimer**: This tool is for educational and awareness purposes. Please respect The Daily Star's terms of service and robots.txt. Use responsibly with appropriate rate limiting.

---

## License

MIT License — Use freely for educational and research purposes.
