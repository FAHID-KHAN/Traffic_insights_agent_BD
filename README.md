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

### 1. Install Dependencies

```bash
cd Traffic_insights_agent_BD
pip install -r requirements.txt
```

### 2. Run the Application

```bash
python run.py
```

The server starts at **http://localhost:8000**

### 3. Start Scraping

- Click the **"Scrape Now"** button on the dashboard, or
- Wait for the automatic scheduler (every 6 hours), or
- Manually trigger via API: `POST http://localhost:8000/api/scrape`

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
