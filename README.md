# Traffic Insights Agent - Bangladesh 🇧🇩

**Real-time road accident analysis dashboard** powered by automated web scraping from **The Daily Star Bangladesh**.

This application scrapes, processes, and visualizes road accident data to identify danger zones, track casualties, and provide daily/monthly analysis — helping raise awareness about road safety in Bangladesh.

---

## Features

- **Automated Web Scraping** — Scrapes accident news from The Daily Star's road-accident tag page every 6 hours
- **NLP Data Extraction** — Automatically extracts accident type, location (district/division), death & injury counts, vehicles involved
- **Interactive Dashboard** — Real-time overview with charts showing trends, accident types, and danger districts
- **Daily Analysis** — Date-specific breakdown of accidents, deaths, injuries by type and location
- **Monthly Analysis** — Monthly aggregates with daily breakdown charts, top danger zones
- **Danger Zone Map** — Interactive Leaflet map with marker clusters and heatmap visualization
- **Danger Zone Rankings** — Top accident-prone districts ranked by frequency and severity
- **Searchable Records** — Full accident database with search and filter capabilities
- **Manual Scrape Trigger** — One-click button to trigger immediate scraping

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Python, FastAPI |
| **Scraper** | BeautifulSoup4, Requests |
| **NLP/Extraction** | Regex-based entity extraction |
| **Database** | SQLite |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Charts** | Chart.js |
| **Maps** | Leaflet.js + MarkerCluster + Heatmap |
| **Scheduler** | APScheduler |

---

## Project Structure

```
Traffic_insights_agent_BD/
├── run.py                  # Entry point — starts the server
├── requirements.txt        # Python dependencies
├── app/                    # Backend Python package
│   ├── __init__.py
│   ├── config.py           # Configuration & constants
│   ├── database.py         # SQLite models & queries
│   ├── extractor.py        # NLP-based data extraction
│   ├── routes.py           # FastAPI route definitions
│   ├── scheduler.py        # APScheduler background job
│   ├── scraper.py          # Web scraper (The Daily Star)
│   └── server.py           # Application factory
├── data/                   # SQLite database (auto-created)
│   └── accidents.db
└── static/                 # Frontend assets
    ├── index.html           # Dashboard markup
    ├── css/
    │   └── styles.css       # All styles
    └── js/
        ├── utils.js         # Shared state & helpers
        ├── dashboard.js     # Dashboard tab logic
        ├── daily.js         # Daily analysis tab
        ├── monthly.js       # Monthly analysis tab
        ├── map.js           # Leaflet map & heatmap
        ├── zones.js         # Danger zones tab
        ├── records.js       # Records table & search
        └── app.js           # Tab switching & init
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

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Application

```bash
python run.py
```

The server starts at **http://localhost:8000** — open it in your browser to see the dashboard.

> **Note:** The SQLite database (`data/accidents.db`) is created automatically on first run. No extra setup needed.

### 5. Start Scraping Data

You won't see any data on the dashboard until you run your first scrape:

- Click the **"Scrape Now"** button in the top-right corner of the dashboard, or
- Manually trigger via API:
  ```bash
  curl -X POST http://localhost:8000/api/scrape
  ```
- Or just wait — the built-in scheduler scrapes automatically every 6 hours.

The first scrape may take 1–2 minutes as it fetches and processes articles from The Daily Star.

---

## Using the Dashboard

Once the server is running, open **http://localhost:8000** in any browser. The UI is a single-page dark-themed dashboard with six tabs across the top:

### Dashboard (Home)

This is the landing page. It shows:
- **Summary cards** — total accidents, deaths, injuries, today's count, and number of articles scraped.
- **30-day trend line** — accidents, deaths, and injuries over the last month.
- **Accident types doughnut** — breakdown of the current month by type (bus crash, hit-and-run, etc.).
- **Top danger districts bar chart** — the most accident-prone districts.

### Daily Analysis

Pick any date using the date picker at the top. The page updates with:
- Stat cards for that day (accidents, deaths, injuries).
- A pie chart of accident types and a bar chart by district for that specific day.

### Monthly Analysis

Select a year and month from the dropdowns. You'll see:
- Monthly totals plus the daily average.
- A bar chart showing the day-by-day breakdown within that month.
- Accident types and top districts for the selected month.

### Danger Map

An interactive **Leaflet** map centered on Bangladesh. Toggle between two views:
- **Markers** — clustered circle markers; click a cluster to zoom in, click an individual marker to see accident details (type, date, casualties, link to source article).
- **Heatmap** — color-coded intensity overlay highlighting the most dangerous areas.

### Danger Zones

A ranked list of the top 20 most accident-prone **districts**, showing total accidents, deaths, and injuries for each. Cards are sorted by frequency.

### Records

A full searchable table of every extracted accident. Columns include date, type, location, district, deaths, injuries, vehicles, and a link to the original article. Use the search box to filter by location, type, or any keyword.

### Scrape Now Button

The **"Scrape Now"** button in the header triggers an immediate scrape. While running, the button shows a spinner. When done, a toast notification reports how many articles were found and how many were new. The dashboard auto-refreshes with the latest data.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard frontend |
| `GET` | `/api/overview` | Overall statistics |
| `GET` | `/api/daily?date=YYYY-MM-DD` | Daily accident stats |
| `GET` | `/api/monthly?year=2026&month=2` | Monthly accident stats |
| `GET` | `/api/danger-zones?limit=20` | Top danger zones |
| `GET` | `/api/recent?limit=50` | Recent accident records |
| `GET` | `/api/map-data` | All accidents with coordinates |
| `GET` | `/api/trend?days=30` | Accident trend data |
| `GET` | `/api/yearly` | Yearly/monthly overview |
| `GET` | `/api/search?q=Dhaka` | Search accidents |
| `POST` | `/api/scrape` | Trigger manual scrape |
| `GET` | `/api/scrape-logs` | Recent scrape history |

---

## How It Works

1. **Scraping**: The scraper visits The Daily Star's `/tags/road-accident` page, collects article links, and fetches full article content

2. **Extraction**: Each article is processed by the NLP extractor which uses regex patterns to identify:
   - **Accident type** (bus crash, hit-and-run, collision, etc.)
   - **Location** (maps to 64 districts + sub-areas of Bangladesh)
   - **Casualties** (death and injury counts from text)
   - **Vehicles involved** (bus, truck, motorcycle, etc.)

3. **Storage**: Structured data is stored in SQLite with proper indexing for fast queries

4. **Visualization**: The frontend fetches data via REST APIs and renders interactive charts, maps, and tables

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
