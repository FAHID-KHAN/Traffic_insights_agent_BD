# Database Schema — Traffic Insight BD

SQLite 3, WAL journal mode, foreign keys enabled.  
File: `data/accidents.db`

---

## Tables

### `articles`

Stores every raw news article fetched by the scanner. One row per unique URL.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | Internal article ID |
| `url` | TEXT | UNIQUE NOT NULL | Canonical article URL |
| `title` | TEXT | NOT NULL | Article headline |
| `content` | TEXT | | Full article body text |
| `published_date` | DATE | | Article publish date (`YYYY-MM-DD`). May be NULL if the scraper could not parse a date from the page; backfilled later via `/api/backfill-published-dates`. |
| `scraped_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When the article was collected |
| `source` | TEXT | DEFAULT `'New Age'` | Source publication name |

**Indexes**
- `idx_articles_url` — unique lookup by URL (duplicate detection)
- `idx_articles_published` — range queries by publish date

---

### `accidents`

One row per discrete accident event extracted from an article. A single article can produce multiple rows (e.g. a report covering 3 districts produces 3 rows).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | Internal accident ID |
| `article_id` | INTEGER | NOT NULL, FK → `articles.id` | Source article |
| `accident_type` | TEXT | | Free-text accident classification (e.g. `head-on collision`, `hit-and-run`, `pedestrian hit`). LLM-extracted; not normalised to a fixed enum. |
| `location_raw` | TEXT | | Raw location string as it appeared in the article (e.g. `"Dhaka-Sylhet Highway, Bahubal upazila"`) |
| `district` | TEXT | | Normalised district name — one of Bangladesh's 64 districts. NULL if the LLM could not map the location. |
| `division` | TEXT | | Normalised division name (Dhaka, Chattogram, Rajshahi, Khulna, Barishal, Sylhet, Rangpur, Mymensingh). May contain legacy spelling variants (`Chittagong`, `Barisal`) — merged at query time. |
| `latitude` | REAL | | District centroid latitude, assigned from `app/geo.py`. NULL if district not in lookup. |
| `longitude` | REAL | | District centroid longitude. NULL if district not in lookup. |
| `deaths` | INTEGER | DEFAULT 0 | Death count extracted by LLM. Always ≥ 0; outliers above `MAX_DEATHS_PER_EVENT` (default 50) are discarded. |
| `injuries` | INTEGER | DEFAULT 0 | Injury count extracted by LLM. Always ≥ 0; outliers above `MAX_INJURIES_PER_EVENT` (default 200) are discarded. |
| `vehicles_involved` | TEXT | | Comma-separated vehicle tokens (e.g. `"bus, truck"`). Canonical tokens: `bus`, `truck`, `car`, `motorcycle`, `train`, `boat`, `auto-rickshaw`, `rickshaw`, `microbus`, `pickup`, `ambulance`. |
| `road_name` | TEXT | | Normalised road/highway name (e.g. `"Dhaka-Sylhet Highway"`). Run through `app/normalize_roads.py` before storage to collapse spelling variants. NULL if no specific road was mentioned. |
| `accident_date` | DATE | | Date of the accident occurrence (`YYYY-MM-DD`). Defaults to the article `published_date` when no explicit occurrence date is stated in the article. |
| `accident_time` | TEXT | | Time of occurrence in 24-hour `HH:MM` format (e.g. `"06:30"`). NULL when not stated. Populated by the time metadata extraction pipeline. |
| `part_of_day` | TEXT | | Normalised time band. One of: `midnight` (00:00–00:59), `dawn` (01:00–05:59), `morning` (06:00–10:59), `noon` (11:00–12:59), `afternoon` (13:00–16:59), `evening` (17:00–19:59), `night` (20:00–23:59). Derived from `accident_time` when available, otherwise extracted directly from article text. NULL if no time information was present. |
| `summary` | TEXT | | Concise LLM-generated summary of the accident, max ~200 characters. |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Row insertion timestamp |

**Indexes**
- `idx_accidents_date` — primary filter for all date-range queries
- `idx_accidents_district` — danger zone and district analytics
- `idx_accidents_division` — division-level aggregations
- `idx_accidents_type` — accident type breakdown charts
- `idx_accidents_article` — JOIN to `articles` and per-article lookups
- `idx_accidents_part_of_day` — time-of-day analytics
- `idx_accidents_time` — hour-of-day analytics

---

### `scrape_logs`

One row per scanner run, updated in place when the run completes.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT | Log entry ID |
| `started_at` | TIMESTAMP | | When the scan cycle began |
| `finished_at` | TIMESTAMP | | When the scan cycle ended. NULL while running. |
| `articles_found` | INTEGER | DEFAULT 0 | Total article links discovered across all pages |
| `articles_new` | INTEGER | DEFAULT 0 | Articles inserted (not already in `articles`) |
| `status` | TEXT | DEFAULT `'running'` | `running` → `completed` or `error: <message>` |

---

## Relationships

```
articles (1) ──── (N) accidents
    id                 article_id
```

Every `accidents` row references exactly one `articles` row. Deleting an article does not cascade-delete its accidents (no `ON DELETE CASCADE`).

---

## Key Design Decisions

**Coordinates are district centroids, not GPS**  
The LLM is explicitly told not to generate coordinates. Latitude/longitude come from a static lookup table (`app/geo.py`) keyed on district name. All accidents within the same district share identical coordinates.

**`accident_type` is free-text**  
The LLM produces natural-language type descriptions rather than a fixed enum. This preserves nuance but means grouping requires `LIKE` or client-side normalisation. Common values: `head-on collision`, `rear-end collision`, `hit-and-run`, `pedestrian hit`, `run over`, `road accident`.

**Division name variants exist in the DB**  
Both `"Chattogram"` and `"Chittagong"`, and `"Barishal"` and `"Barisal"`, may appear in the `division` column depending on which spelling the LLM used. The `/api/divisions` endpoint merges them at query time via `_DIVISION_CANONICAL`. Raw queries against `division` should account for both spellings.

**`part_of_day` populated only for newer records**  
The `accident_time` and `part_of_day` columns were added in the `feature/issue-8-accident-time-metadata` migration. Records inserted before that migration have NULL in both columns. Coverage improves as new articles are scanned.

**Deduplication mutates existing rows**  
When the dedupe pipeline determines two events describe the same accident, it updates the existing `accidents` row (casualties, date, time) rather than inserting a duplicate. The merge decision and before/after state are logged to `data/dedupe/accident_update_events.log`.

---

## Schema Migrations

Migrations are applied via `_migrate_add_column()` in `app/database.py` at startup. They are additive only (no column removal or type changes).

| Migration | Column added | Table |
|---|---|---|
| v1 | `road_name TEXT` | `accidents` |
| v2 | `accident_time TEXT` | `accidents` |
| v2 | `part_of_day TEXT` | `accidents` |

---

## Statistics (as of last scan)

| Metric | Value |
|---|---|
| Total articles | 100 |
| Total accident records | 133 |
| Date range | 2026-01-25 → 2026-05-12 |
| Records with `part_of_day` | ~111 (~83%) |
| Records with `accident_time` | ~21 (~16%) |
