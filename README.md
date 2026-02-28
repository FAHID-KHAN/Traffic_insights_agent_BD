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
| **Backend** | Python 3.14, FastAPI 0.115 |
| **Frontend** | React 19 + Vite 7 |
| **Routing** | React Router v7 |
| **Charts** | Chart.js + react-chartjs-2 |
| **Maps** | React-Leaflet + MarkerCluster + Heatmap |
| **Icons** | react-icons (Font Awesome) |
| **Scraper** | BeautifulSoup4, Requests, lxml |
| **NLP/Extraction** | Regex-based entity extraction |
| **Database** | SQLite (WAL mode) |
| **Scheduler** | APScheduler (6-hour interval) |
| **Theme** | CSS custom properties + ThemeProvider context |

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
│   ├── routes.py               # FastAPI route definitions (30+ endpoints)
│   ├── scheduler.py            # APScheduler background job
│   ├── scraper.py              # Web scraper (The Daily Star)
│   └── server.py               # Application factory + SPA serving
├── frontend/                   # React + Vite frontend
│   ├── index.html              # HTML entry point
│   ├── package.json            # Node dependencies
│   ├── vite.config.js          # Vite config (proxy + build output)
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── App.jsx             # Router with 8 routes
│       ├── styles/
│       │   └── global.css      # Dark/light theme, responsive styles
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
├── .github/
│   ├── workflows/ci.yml        # CI pipeline (lint + test)
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
| `POST` | `/api/scrape` | Trigger manual scrape |
| `GET` | `/api/scrape-logs` | Recent scrape history |

---

## How It Works

1. **Scraping**: The scraper visits The Daily Star's `/tags/road-accident` page, collects article links, and fetches full article content

2. **Extraction**: Each article is processed by the NLP extractor which uses regex patterns to identify:
   - **Accident type** (bus crash, hit-and-run, collision, etc.)
   - **Location** (maps to 64 districts + 10 divisions of Bangladesh)
   - **Casualties** (death and injury counts from text)
   - **Vehicles involved** (bus, truck, motorcycle, etc.)

3. **Storage**: Structured data is stored in SQLite (WAL mode) with proper indexing for fast queries

4. **Analysis**: Backend computes forecasts, clusters, YoY comparisons, danger indices, and time patterns from the raw data

5. **Visualization**: The React frontend fetches data via REST APIs and renders interactive charts, maps, heatmaps, and tables

---

## Configuration

Edit `app/config.py` to customize:

```python
SCRAPE_INTERVAL_HOURS = 6     # Scraping frequency
MAX_PAGES_PER_SCRAPE = 5      # Pages to scrape per cycle
REQUEST_DELAY = 2             # Politeness delay between requests
API_PORT = 8000               # Server port
```

---

## Data Source

All data is sourced from **[The Daily Star](https://www.thedailystar.net)**, one of Bangladesh's leading English-language newspapers. The scraper specifically targets their [road accident tag](https://www.thedailystar.net/tags/road-accident) page.

> **Disclaimer**: This tool is for educational and awareness purposes. Please respect The Daily Star's terms of service and robots.txt. Use responsibly with appropriate rate limiting.

---

## License

MIT License — Use freely for educational and research purposes.
