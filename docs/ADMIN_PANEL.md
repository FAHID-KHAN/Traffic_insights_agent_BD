# Admin Panel (`/health`)

Hidden developer-only page — **not listed in public navigation**.  
Access: navigate directly to `/health` in the browser.

## Authentication
- Requires the `X-Admin-Key` header value (same as `ADMIN_API_KEY` in `.env`)
- Key is validated by calling `POST /api/scrape` with the header
- Stored in `sessionStorage` (`tibd-admin-key`) — clears when the tab closes
- Login screen shows if no key is stored; Logout button clears it

## Admin Actions (3 buttons)
1. **Trigger Scrape** — `POST /api/scrape` — runs the scraping pipeline on demand
2. **Backfill Dates** — `POST /api/backfill-published-dates` — fixes missing `published_date` on articles
3. **Download PDF Report** — `GET /api/reports/monthly-pdf?year=YYYY&month=M` — generates a branded PDF with monthly summary (totals, top districts, accident types, daily breakdown)

## System Metrics (3 cards)

### Scrape Pipeline
- Last scrape timestamp + status dot (green/yellow/red)
- Total scrapes count
- Success rate (percentage, color-coded)
- Failed scrapes count

### Data & Storage
- Total accident records in DB
- Total articles collected
- Extraction mode (Standard / AI Powered)
- Database file size (MB)

### Date Range
- Latest article date
- Oldest article date
- Today's accidents count
- Today's deaths count (red if > 0)

## Scrape Logs Table
- Shows last 20 scrape runs
- Columns: #, Status, Started, Finished, Found, New, Duration
- Duration is computed client-side from started/finished timestamps
- Refresh button to reload data
- Auto-refreshes every 30 seconds

## Backend Endpoints Used
- `GET /api/overview` — general stats + last scrape info
- `GET /api/scrape-logs?limit=20` — scrape log history
- `GET /api/health-check` — DB size, article dates, totals, extraction mode, scrape success rate
- `POST /api/scrape` (admin-protected) — trigger scrape
- `POST /api/backfill-published-dates` (admin-protected) — backfill dates
- `GET /api/reports/monthly-pdf` — PDF download

## Files
- Frontend: `frontend/src/pages/Health.jsx`
- Backend health endpoint: `app/routes.py` (`/api/health-check`)
- Backend PDF endpoint: `app/routes.py` (`/api/reports/monthly-pdf`)
- API helper: `frontend/src/utils/api.js` (`adminPost()`)
- CSS: `frontend/src/styles/global.css` (search "ADMIN PANEL")
- i18n keys: `health.*` in `frontend/src/i18n/en.json` and `bn.json`
- Route registered in `frontend/src/App.jsx` (lazy-loaded)
- **Not** in Layout.jsx nav — hidden from public users
