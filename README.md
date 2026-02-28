# Traffic Insights Agent - Bangladesh 🇧🇩

**Real-time road accident analysis dashboard** powered by automated web scraping from **The Daily Star Bangladesh** and **LLM-based extraction (Ollama / Llama 3.2)**.

This application scrapes, processes, and visualizes road accident data to identify danger zones, track casualties, and provide daily/monthly analysis.

---

## Features

- **Automated Web Scraping** — Scrapes accident news from The Daily Star road-accident tag page every 6 hours
- **LLM Data Extraction** — Uses Ollama (`llama3.2`) to extract accident type, location, casualties, vehicles, and event date
- **Multi-Event Support** — One article can produce multiple accident records
- **Interactive Dashboard** — Real-time overview with charts showing trends, accident types, and danger districts
- **Daily Analysis** — Date-specific breakdown of accidents, deaths, injuries by type and location
- **Monthly Analysis** — Monthly aggregates with daily breakdown charts and top danger zones
- **Danger Zone Map** — Leaflet map with marker clusters and heatmap visualization
- **Danger Zone Rankings** — Top accident-prone districts ranked by frequency and severity
- **Searchable Records** — Full accident database with search and filter capabilities
- **Manual Scrape Trigger** — One-click button to trigger immediate scraping

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Python, FastAPI |
| **Scraper** | BeautifulSoup4, Requests |
| **Extraction** | Ollama API + Llama 3.2 + Pydantic validation |
| **Database** | SQLite |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Charts** | Chart.js |
| **Maps** | Leaflet.js + MarkerCluster + Heatmap |
| **Scheduler** | APScheduler |

---

## Project Structure

```text
Traffic_insights_agent_BD/
├── run.py
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── config.py              # App + Ollama config
│   ├── database.py            # SQLite models + query functions
│   ├── extractor.py           # Compatibility wrapper (delegates to LLM extractor)
│   ├── geo.py                 # District coordinates + district->division mapping
│   ├── normalize.py           # District normalization helpers
│   ├── routes.py              # FastAPI endpoints
│   ├── scheduler.py           # Periodic scrape scheduler
│   ├── scraper.py             # Daily Star scraping pipeline
│   ├── server.py              # FastAPI app factory
│   └── llm/
│       ├── __init__.py
│       ├── ollama_client.py   # Ollama chat client
│       ├── llm_schema.py      # Pydantic extraction schema
│       └── llm_extractor.py   # LLM extraction + DB insertion
├── data/
│   ├── accidents.db
│   ├── llm_extraction_responses.log   # Created when LLM responses are logged
│   └── llm_extraction_failures.log    # Created on extraction failures
└── static/
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── utils.js
        ├── dashboard.js
        ├── daily.js
        ├── monthly.js
        ├── map.js
        ├── zones.js
        ├── records.js
        └── app.js
```

---

## Quick Start (with Ollama)

### 1. Clone and enter project

```bash
git clone <your-repo-url>
cd Traffic_insights_agent_BD
```

### 2. Create and activate virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Start Ollama (Terminal 1)

```bash
ollama serve
```

If this is first time, Ollama may generate keys. Then pull model:

```bash
ollama pull llama3.2
```

Few Extra Ollama commands: In a new Terminal

```
ollama run llama3.1:8b

/bye #to terminate
```

### 5. Run the app (Terminal 2)

```bash
cd Traffic_insights_agent_BD
source .venv/bin/activate
python run.py
```

Open: **http://localhost:8000**

### 6. Trigger first scrape

- Click **Scrape Now** in UI, or
- Run:

```bash
curl -X POST http://localhost:8000/api/scrape
```

Note:
- If scrape reports `N found, 0 new`, no new article rows were inserted, so LLM extraction is not re-run for old URLs.
- To reprocess existing articles through the LLM extractor:

```bash
python3 -c "from app.extractor import reprocess_all_articles; print(reprocess_all_articles())"
```

---

## Logging

### LLM raw responses

File:

- `data/llm_extraction_responses.log`

Tail command:

```bash
tail -f data/llm_extraction_responses.log
```

### LLM extraction failures

File:

- `data/llm_extraction_failures.log`

Tail command:

```bash
tail -f data/llm_extraction_failures.log
```

Both files are created on demand when events are logged.

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

1. **Scraping**: The scraper visits The Daily Star `/tags/road-accident` pages, collects article links, and fetches content.
2. **Extraction**: For each new article, the LLM extractor calls Ollama (`llama3.2`) and expects strict JSON output.
3. **Normalization**:
   - District names are normalized against Bangladesh aliases.
   - Division is resolved from mapping when missing.
   - Coordinates are assigned from hard-coded district coordinate mapping.
4. **Storage**: One article can insert multiple `accidents` rows (same `article_id`) in SQLite.
5. **Visualization**: Existing API and frontend modules read the same DB schema and render charts/maps/tables.

---

## Configuration

Edit `app/config.py`:

```python
SCRAPE_INTERVAL_HOURS = 6
MAX_PAGES_PER_SCRAPE = 5
REQUEST_DELAY = 2
API_PORT = 8000

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "llama3.2"
OLLAMA_TIMEOUT_SECONDS = 60
OLLAMA_RETRIES = 2
```

---

## Data Source

All data is sourced from **[The Daily Star](https://www.thedailystar.net)**, specifically the [road accident tag](https://www.thedailystar.net/tags/road-accident).

> Disclaimer: This tool is for educational and awareness purposes. Respect The Daily Star terms of service and robots.txt.

---

## License

MIT License
