# Traffic Insights Agent BD — Roadmap

> Bangladesh Road Accident Data Platform  
> Last updated: 28 February 2026

---

## Completed Features

### Phase 1 — Core Platform
- [x] Web scraper targeting The Daily Star accident coverage
- [x] NLP-based accident data extraction (casualties, location, vehicles, type)
- [x] SQLite database with WAL mode for concurrent reads
- [x] FastAPI REST API with 11 endpoints
- [x] APScheduler-based automatic scraping every 6 hours
- [x] Basic dashboard with accident stats

### Phase 2 — React Migration & BD Branding
- [x] Migrated frontend from vanilla HTML/JS to **React 19 + Vite 7**
- [x] Bangladesh-themed UI — green/red palette, national flag, govt seal
- [x] Component-based architecture (Dashboard, Daily, Monthly, Zones, Records, Map, Analytics)
- [x] Responsive design for mobile, tablet, and desktop
- [x] Dark / Light theme toggle with persistent preference

### Phase 3 — Interactive Visualizations
- [x] **Chart.js** line, bar, doughnut, and polar area charts
- [x] **Leaflet** interactive danger map with clustered markers
- [x] **Division heatmap** with colour-coded severity
- [x] Daily and monthly drill-down views
- [x] Top danger zones ranking table

### Phase 4 — Search, Export & Alerts
- [x] Full-text search across accidents and articles
- [x] **CSV export** for filtered accident data
- [x] **PDF export** with formatted report layout
- [x] Configurable alert thresholds (deaths/injuries per day)
- [x] Alert badge and notification panel in header

### Phase 5 — Advanced Analytics
- [x] **Time-series forecasting** — linear regression trend projection
- [x] **Day-of-week & hour-of-day** pattern analysis
- [x] **K-means clustering** of danger zones
- [x] **Year-over-year** comparative analytics with percentage changes

### Phase 6 — YouTube Safety Feed
- [x] Embedded Bangladesh road safety videos from YouTube
- [x] Auto-rotating carousel with thumbnail grid
- [x] Thread-safe server-side caching with TTL

### Phase 7 — Backend Hardening (15 Bug Fixes)
- [x] `get_db()` context manager — automatic commit / rollback / close (eliminates connection leaks)
- [x] Non-blocking `/api/scrape` via `asyncio.run_in_executor`
- [x] Thread-safe YouTube cache with `threading.Lock()`
- [x] CORS middleware for cross-origin support
- [x] Graceful SPA fallback — returns 503 with build instructions instead of crashing
- [x] Scraper: early termination on duplicate pages
- [x] Scraper: no silent `date.today()` fallback for unparseable dates
- [x] Scraper: single `AccidentExtractor` instance reused per cycle
- [x] Extractor: division name normalization via `_DIVISION_ALIASES`
- [x] Extractor: boilerplate text filtering in summary generation
- [x] Database: new indexes (`idx_accidents_division`, `idx_accidents_article`)
- [x] `init_db()` moved to lifespan startup (not module import)

### Phase 8 — Documentation
- [x] Comprehensive **README.md** with quick start, feature list, API reference
- [x] Detailed **docs/ARCHITECTURE.md** covering system design, data flow, schema
- [x] Both docs updated to reflect all backend hardening changes

---

## Upcoming Features

### Next Up — Production Readiness
- [ ] **Dockerfile + docker-compose** — one-command deployment with Python + Node build stages
- [ ] **CI/CD pipeline** — GitHub Actions for lint, test, build, and deploy
- [ ] **Unit tests** — pytest suite for extractor, database, and route handlers
- [ ] **E2E tests** — Playwright tests for critical frontend flows
- [ ] **API rate limiting** — token-bucket middleware to protect public endpoints
- [ ] **Environment config** — `.env` file support for secrets, DB path, scrape interval

### Data & Scraping
- [ ] **Multi-source scraping** — add Prothom Alo, Dhaka Tribune, BD Police press releases
- [ ] **Historical backfill** — scrape archived articles for multi-year trend data
- [ ] **Scrape health dashboard** — success/failure rates, response times, source status
- [ ] **Proxy rotation** — resilience against IP blocking during large scrapes
- [ ] **Article deduplication v2** — fuzzy matching to catch republished/reworded articles

### Analytics & ML
- [ ] **ML severity scoring** — classify accidents as fatal / serious / minor from article text
- [ ] **Anomaly detection** — flag unusual spikes in accidents for a region or time window
- [ ] **Natural language querying** — ask questions like "worst district in January?" in plain text
- [ ] **Predictive hotspots** — forecast which zones are likely to see increased accidents
- [ ] **Sentiment analysis** — gauge public/media reaction to road safety measures

### User Experience
- [ ] **Authentication** — JWT login for admin (scrape controls) and reader (saved views) roles
- [ ] **Push notifications** — WebSocket / SSE real-time alerts on new high-severity accidents
- [ ] **Geofencing alerts** — user-defined zones with notification triggers
- [ ] **Bangla language (i18n)** — full UI translation toggle
- [ ] **Accessibility (a11y)** — WCAG 2.1 audit, ARIA labels, keyboard navigation
- [ ] **PWA / mobile** — offline support, installable app, push via service worker

### Reporting & Sharing
- [ ] **Automated weekly/monthly reports** — PDF generation emailed to subscribers
- [ ] **Embeddable widgets** — iframe-ready charts for external websites/blogs
- [ ] **Public API documentation** — Swagger/OpenAPI with interactive playground
- [ ] **Social sharing** — share specific stats or charts with OG meta previews

### Infrastructure
- [ ] **Redis caching** — TTL cache for expensive endpoints (`/api/map-data`, `/api/yearly`)
- [ ] **PostgreSQL migration** — optional upgrade path for high-traffic deployments
- [ ] **Logging & monitoring** — structured JSON logs, Prometheus metrics, health endpoint
- [ ] **Backup automation** — scheduled SQLite snapshots to S3 or local archive

---

## Priority Matrix

| Priority | Feature | Impact | Effort |
|----------|---------|--------|--------|
| P0 | Docker + CI/CD | High | Medium |
| P0 | Unit & E2E tests | High | Medium |
| P1 | Multi-source scraping | High | High |
| P1 | Push notifications | High | Medium |
| P1 | Authentication | Medium | Medium |
| P2 | ML severity scoring | High | High |
| P2 | Bangla i18n | Medium | Medium |
| P2 | Automated reports | Medium | Medium |
| P3 | PostgreSQL migration | Low | High |
| P3 | Embeddable widgets | Low | Low |

---

## Contributing

Pick any unchecked item above, create a branch from `feature/analytics-and-react-migration`, and open a PR. Please include tests for any new backend functionality.
