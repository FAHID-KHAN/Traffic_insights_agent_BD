"""
FastAPI route definitions.
Separated from server setup for clarity.
"""
import logging
import re
import threading
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Depends, Request

import requests
from app.rate_limit import scrape_limiter
from app import database as db
from app.scraper import run_scraper, run_published_date_backfill
from app.extractor import get_extraction_mode

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ─── Overview ───────────────────────────────────────────────────

@router.get("/overview")
async def get_overview(
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
):
    """Get overall statistics overview, optionally filtered by date range."""
    try:
        with db.get_db() as conn:
            if start and end:
                row = conn.execute(
                    """SELECT COUNT(*) as total_accidents,
                              COALESCE(SUM(deaths), 0) as total_deaths,
                              COALESCE(SUM(injuries), 0) as total_injuries
                       FROM accidents
                       WHERE accident_date BETWEEN ? AND ?""",
                    (start, end),
                ).fetchone()
                total_articles = conn.execute(
                    "SELECT COUNT(*) as c FROM articles WHERE published_date BETWEEN ? AND ?",
                    (start, end),
                ).fetchone()["c"]
            else:
                row = conn.execute(
                    """SELECT COUNT(*) as total_accidents,
                              COALESCE(SUM(deaths), 0) as total_deaths,
                              COALESCE(SUM(injuries), 0) as total_injuries
                       FROM accidents"""
                ).fetchone()
                total_articles = conn.execute(
                    "SELECT COUNT(*) as c FROM articles"
                ).fetchone()["c"]

            today = date.today().isoformat()
            today_row = conn.execute(
                """SELECT COUNT(*) as accidents,
                          COALESCE(SUM(deaths), 0) as deaths,
                          COALESCE(SUM(injuries), 0) as injuries
                   FROM accidents WHERE accident_date = ?""",
                (today,),
            ).fetchone()

            last_scrape = conn.execute(
                "SELECT * FROM scrape_logs ORDER BY id DESC LIMIT 1"
            ).fetchone()

            return {
                "total_accidents": row["total_accidents"],
                "total_deaths": row["total_deaths"],
                "total_injuries": row["total_injuries"],
                "total_articles": total_articles,
                "today": {
                    "date": today,
                    "accidents": today_row["accidents"],
                    "deaths": today_row["deaths"],
                    "injuries": today_row["injuries"],
                },
                "last_scrape": dict(last_scrape) if last_scrape else None,
                "extraction_mode": get_extraction_mode(),
            }
    except Exception as e:
        logger.error(f"Error getting overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Daily / Monthly ───────────────────────────────────────────

@router.get("/daily")
async def get_daily(
    date_str: Optional[str] = Query(None, alias="date",
                                     description="YYYY-MM-DD"),
):
    try:
        target = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else date.today()
        return db.get_daily_stats(target)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")


@router.get("/monthly")
async def get_monthly(
    year: int = Query(..., description="Year"),
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
):
    return db.get_monthly_stats(year, month)


# ─── Danger Zones ──────────────────────────────────────────────

@router.get("/danger-zones")
async def get_danger_zones(
    limit: int = Query(20, ge=1, le=100),
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
):
    if start and end:
        with db.get_db() as conn:
            rows = conn.execute(
                """SELECT district, division, COUNT(*) as total_accidents,
                          SUM(deaths) as total_deaths, SUM(injuries) as total_injuries,
                          AVG(latitude) as avg_lat, AVG(longitude) as avg_lon
                   FROM accidents
                   WHERE district IS NOT NULL AND accident_date BETWEEN ? AND ?
                   GROUP BY district
                   ORDER BY total_accidents DESC
                   LIMIT ?""",
                (start, end, limit),
            ).fetchall()
            return [dict(r) for r in rows]
    return db.get_danger_zones(limit)


# ─── Records & Map ─────────────────────────────────────────────

@router.get("/recent")
async def get_recent(limit: int = Query(50, ge=1, le=200)):
    return db.get_recent_accidents(limit)


@router.get("/records")
async def get_records(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    q: Optional[str] = Query(None, min_length=2),
):
    """Paginated accident records with optional search, returns total count."""
    with db.get_db() as conn:
        if q:
            like = f"%{q}%"
            count = conn.execute(
                """SELECT COUNT(*) as c FROM accidents a
                   JOIN articles ar ON a.article_id = ar.id
                   WHERE a.district LIKE ? OR a.location_raw LIKE ?
                         OR a.accident_type LIKE ? OR a.summary LIKE ?
                         OR ar.title LIKE ?""",
                (like, like, like, like, like),
            ).fetchone()["c"]
            rows = conn.execute(
                """SELECT a.*, ar.title as article_title, ar.url as article_url
                   FROM accidents a
                   JOIN articles ar ON a.article_id = ar.id
                   WHERE a.district LIKE ? OR a.location_raw LIKE ?
                         OR a.accident_type LIKE ? OR a.summary LIKE ?
                         OR ar.title LIKE ?
                   ORDER BY a.accident_date DESC, a.id DESC
                   LIMIT ? OFFSET ?""",
                (like, like, like, like, like, limit, offset),
            ).fetchall()
        else:
            count = conn.execute(
                "SELECT COUNT(*) as c FROM accidents"
            ).fetchone()["c"]
            rows = conn.execute(
                """SELECT a.*, ar.title as article_title, ar.url as article_url
                   FROM accidents a
                   JOIN articles ar ON a.article_id = ar.id
                   ORDER BY a.accident_date DESC, a.id DESC
                   LIMIT ? OFFSET ?""",
                (limit, offset),
            ).fetchall()
        return {"total": count, "offset": offset, "limit": limit, "records": [dict(r) for r in rows]}


@router.get("/map-data")
async def get_map_data():
    return db.get_all_accidents_for_map()


@router.get("/yearly")
async def get_yearly():
    return db.get_yearly_overview()


# ─── Scrape ─────────────────────────────────────────────────────

@router.get("/scrape-logs")
async def get_scrape_logs(limit: int = Query(20, ge=1, le=100)):
    return db.get_scrape_logs(limit)


@router.post("/scrape")
async def trigger_scrape(request: Request, _=Depends(scrape_limiter)):
    """Trigger a scrape cycle. Rate-limited to 3 req/min per IP."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_scraper)
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Scrape failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backfill-published-dates")
async def backfill_published_dates(limit: int = Query(0, ge=0, le=5000)):
    try:
        result = run_published_date_backfill(limit=limit or None)
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Published date backfill failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Latest Articles (Live News Feed) ──────────────────────────

@router.get("/articles/latest")
async def get_latest_articles(
    limit: int = Query(12, ge=1, le=50),
):
    """Return the most recent articles with aggregate accident stats."""
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT ar.id, ar.url, ar.title, ar.published_date, ar.source,
                      COUNT(a.id) as accident_count,
                      COALESCE(SUM(a.deaths), 0) as total_deaths,
                      COALESCE(SUM(a.injuries), 0) as total_injuries
               FROM articles ar
               JOIN accidents a ON a.article_id = ar.id
               WHERE ar.title IS NOT NULL AND ar.title != ''
               GROUP BY ar.id
               ORDER BY ar.published_date DESC, ar.id DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


# ─── YouTube Video Feed ────────────────────────────────────────

_yt_cache: dict = {"videos": [], "ts": 0}
_yt_lock = threading.Lock()

@router.get("/youtube-videos")
async def get_youtube_videos(
    limit: int = Query(8, ge=1, le=20),
):
    """
    Fetch YouTube video results for Bangladesh road accident news.
    Results are cached for 30 minutes to avoid hammering YouTube.
    """
    import time
    now = time.time()
    with _yt_lock:
        if _yt_cache["videos"] and (now - _yt_cache["ts"]) < 1800:
            return _yt_cache["videos"][:limit]

    queries = [
        "bangladesh road accident news",
        "bangladesh traffic accident latest",
        "বাংলাদেশ সড়ক দুর্ঘটনা",
    ]

    seen_ids: set = set()
    videos: list = []

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    for query in queries:
        if len(videos) >= 20:
            break
        try:
            resp = requests.get(
                "https://www.youtube.com/results",
                params={"search_query": query, "sp": "EgIQAQ%3D%3D"},
                headers=headers,
                timeout=10,
            )
            if resp.status_code != 200:
                continue

            # Collect shorts IDs to exclude
            shorts_ids = set(re.findall(
                r'/shorts/([a-zA-Z0-9_-]{11})', resp.text
            ))

            vid_matches = re.findall(
                r'"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"', resp.text
            )
            title_matches = re.findall(
                r'"title"\s*:\s*\{"runs"\s*:\s*\[\{"text"\s*:\s*"([^"]{5,})"',
                resp.text,
            )

            for i, vid in enumerate(vid_matches):
                if vid in seen_ids or vid in shorts_ids:
                    continue
                seen_ids.add(vid)
                title = title_matches[i] if i < len(title_matches) else "Bangladesh Road Accident News"
                videos.append({
                    "video_id": vid,
                    "title": title,
                    "thumbnail": f"https://img.youtube.com/vi/{vid}/mqdefault.jpg",
                    "url": f"https://www.youtube.com/watch?v={vid}",
                })
                if len(videos) >= 20:
                    break
        except Exception as e:
            logger.warning(f"YouTube search failed for '{query}': {e}")
            continue

    if videos:
        with _yt_lock:
            _yt_cache["videos"] = videos
            _yt_cache["ts"] = now

    return videos[:limit]


# ─── Comparative Analytics ──────────────────────────────────────

@router.get("/compare/monthly")
async def compare_monthly(
    month: int = Query(..., ge=1, le=12),
    year1: int = Query(...),
    year2: int = Query(...),
):
    """Compare stats for the same month across two years."""
    with db.get_db() as conn:
        results = {}
        for year in (year1, year2):
            prefix = f"{year}-{month:02d}"
            row = conn.execute(
                """SELECT COUNT(*) as accidents,
                          COALESCE(SUM(deaths), 0) as deaths,
                          COALESCE(SUM(injuries), 0) as injuries
                   FROM accidents
                   WHERE strftime('%Y-%m', accident_date) = ?""",
                (prefix,),
            ).fetchone()
            by_type = conn.execute(
                """SELECT accident_type, COUNT(*) as count
                   FROM accidents
                   WHERE strftime('%Y-%m', accident_date) = ?
                   GROUP BY accident_type ORDER BY count DESC""",
                (prefix,),
            ).fetchall()
            by_district = conn.execute(
                """SELECT district, COUNT(*) as count,
                          SUM(deaths) as deaths
                   FROM accidents
                   WHERE strftime('%Y-%m', accident_date) = ? AND district IS NOT NULL
                   GROUP BY district ORDER BY count DESC LIMIT 10""",
                (prefix,),
            ).fetchall()
            daily = conn.execute(
                """SELECT CAST(strftime('%d', accident_date) AS INTEGER) as day,
                          COUNT(*) as accidents, SUM(deaths) as deaths
                   FROM accidents
                   WHERE strftime('%Y-%m', accident_date) = ?
                   GROUP BY day ORDER BY day""",
                (prefix,),
            ).fetchall()
            results[str(year)] = {
                "accidents": row["accidents"],
                "deaths": row["deaths"],
                "injuries": row["injuries"],
                "by_type": [dict(r) for r in by_type],
                "by_district": [dict(r) for r in by_district],
                "daily": [dict(r) for r in daily],
            }
        return results


@router.get("/compare/yearly")
async def compare_yearly(
    year1: int = Query(...),
    year2: int = Query(...),
):
    """Compare full-year stats across two years."""
    with db.get_db() as conn:
        results = {}
        for year in (year1, year2):
            row = conn.execute(
                """SELECT COUNT(*) as accidents,
                          COALESCE(SUM(deaths), 0) as deaths,
                          COALESCE(SUM(injuries), 0) as injuries
                   FROM accidents
                   WHERE strftime('%Y', accident_date) = ?""",
                (str(year),),
            ).fetchone()
            by_month = conn.execute(
                """SELECT CAST(strftime('%m', accident_date) AS INTEGER) as month,
                          COUNT(*) as accidents,
                          SUM(deaths) as deaths, SUM(injuries) as injuries
                   FROM accidents
                   WHERE strftime('%Y', accident_date) = ?
                   GROUP BY month ORDER BY month""",
                (str(year),),
            ).fetchall()
            results[str(year)] = {
                "accidents": row["accidents"],
                "deaths": row["deaths"],
                "injuries": row["injuries"],
                "by_month": [dict(r) for r in by_month],
            }
        return results


# ─── Division-level Stats ──────────────────────────────────────

_DIVISION_CANONICAL = {
    "Chattogram": "Chittagong",
    "Barishal": "Barisal",
}


@router.get("/divisions")
async def get_division_stats():
    """Aggregated stats per division with district breakdown."""
    with db.get_db() as conn:
        divs = conn.execute(
            """SELECT division, COUNT(*) as total_accidents,
                      COALESCE(SUM(deaths), 0) as total_deaths,
                      COALESCE(SUM(injuries), 0) as total_injuries,
                      AVG(latitude) as avg_lat, AVG(longitude) as avg_lon
               FROM accidents
               WHERE division IS NOT NULL AND division != ''
               GROUP BY division
               ORDER BY total_accidents DESC"""
        ).fetchall()

        # Merge alternate division spellings
        merged: dict = {}
        for d in divs:
            canonical = _DIVISION_CANONICAL.get(d["division"], d["division"])
            if canonical in merged:
                m = merged[canonical]
                m["total_accidents"] += d["total_accidents"]
                m["total_deaths"] += d["total_deaths"]
                m["total_injuries"] += d["total_injuries"]
            else:
                merged[canonical] = {
                    "division": canonical,
                    "total_accidents": d["total_accidents"],
                    "total_deaths": d["total_deaths"],
                    "total_injuries": d["total_injuries"],
                    "avg_lat": d["avg_lat"],
                    "avg_lon": d["avg_lon"],
                }

        result = []
        for name, m in sorted(merged.items(), key=lambda x: -x[1]["total_accidents"]):
            # Collect districts from both canonical and alternate names
            alt_names = [name] + [k for k, v in _DIVISION_CANONICAL.items() if v == name]
            placeholders = ",".join("?" * len(alt_names))
            districts = conn.execute(
                f"""SELECT district, COUNT(*) as accidents,
                           COALESCE(SUM(deaths), 0) as deaths,
                           COALESCE(SUM(injuries), 0) as injuries
                    FROM accidents
                    WHERE division IN ({placeholders}) AND district IS NOT NULL
                    GROUP BY district ORDER BY accidents DESC""",
                alt_names,
            ).fetchall()
            acc = m["total_accidents"]
            deaths = m["total_deaths"]
            result.append({
                **m,
                "fatality_rate": round(deaths / acc, 2) if acc > 0 else 0,
                "districts": [dict(r) for r in districts],
            })
        return result


# ─── Fatality / Danger Index ───────────────────────────────────

@router.get("/danger-index")
async def get_danger_index(
    limit: int = Query(30, ge=1, le=100),
):
    """Danger index: deaths-per-accident ratio per district, min 2 accidents."""
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT district, division, COUNT(*) as total_accidents,
                      COALESCE(SUM(deaths), 0) as total_deaths,
                      COALESCE(SUM(injuries), 0) as total_injuries,
                      ROUND(CAST(COALESCE(SUM(deaths), 0) AS REAL) / COUNT(*), 2)
                          as fatality_rate,
                      AVG(latitude) as avg_lat, AVG(longitude) as avg_lon
               FROM accidents
               WHERE district IS NOT NULL
               GROUP BY district
               HAVING COUNT(*) >= 2
               ORDER BY fatality_rate DESC, total_deaths DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()

    result = []
    for r in rows:
        d = dict(r)
        fr = d["fatality_rate"]
        if fr >= 1.5:
            d["severity"] = "critical"
        elif fr >= 1.0:
            d["severity"] = "high"
        elif fr >= 0.5:
            d["severity"] = "moderate"
        else:
            d["severity"] = "low"
        result.append(d)
    return result


@router.get("/danger-zones/summary")
async def get_danger_zones_summary():
    """Aggregate summary stats for the danger zones page."""
    with db.get_db() as conn:
        totals = conn.execute(
            """SELECT COUNT(DISTINCT district) as total_districts,
                      COUNT(*) as total_accidents,
                      COALESCE(SUM(deaths), 0) as total_deaths,
                      COALESCE(SUM(injuries), 0) as total_injuries
               FROM accidents WHERE district IS NOT NULL"""
        ).fetchone()

        divisions = conn.execute(
            """SELECT division, COUNT(DISTINCT district) as districts,
                      COUNT(*) as total_accidents,
                      COALESCE(SUM(deaths), 0) as total_deaths,
                      COALESCE(SUM(injuries), 0) as total_injuries,
                      ROUND(CAST(COALESCE(SUM(deaths), 0) AS REAL) / COUNT(*), 2) as fatality_rate
               FROM accidents
               WHERE division IS NOT NULL
               GROUP BY division
               ORDER BY total_accidents DESC"""
        ).fetchall()

        worst_districts = conn.execute(
            """SELECT district, division, COUNT(*) as total_accidents,
                      COALESCE(SUM(deaths), 0) as total_deaths
               FROM accidents WHERE district IS NOT NULL
               GROUP BY district
               ORDER BY total_deaths DESC LIMIT 5"""
        ).fetchall()

    return {
        "totals": dict(totals),
        "divisions": [dict(r) for r in divisions],
        "worst_districts": [dict(r) for r in worst_districts],
    }


@router.get("/search")
async def search_accidents(
    q: str = Query(..., min_length=2),
    limit: int = Query(50, ge=1, le=200),
):
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT a.*, ar.title as article_title, ar.url as article_url
               FROM accidents a
               JOIN articles ar ON a.article_id = ar.id
               WHERE a.district LIKE ? OR a.location_raw LIKE ?
                     OR a.accident_type LIKE ? OR a.summary LIKE ?
                     OR ar.title LIKE ?
               ORDER BY a.accident_date DESC
               LIMIT ?""",
            (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", limit),
        ).fetchall()
        return [dict(r) for r in rows]


@router.get("/trend")
async def get_trend(
    days: Optional[int] = Query(None, ge=7, le=3650),
    start: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
):
    with db.get_db() as conn:
        if start and end:
            rows = conn.execute(
                """SELECT accident_date, COUNT(*) as accidents,
                          SUM(deaths) as deaths, SUM(injuries) as injuries
                   FROM accidents
                   WHERE accident_date BETWEEN ? AND ?
                   GROUP BY accident_date
                   ORDER BY accident_date""",
                (start, end),
            ).fetchall()
        elif days:
            rows = conn.execute(
                """SELECT accident_date, COUNT(*) as accidents,
                          SUM(deaths) as deaths, SUM(injuries) as injuries
                   FROM accidents
                   WHERE accident_date >= date('now', ? || ' days')
                   GROUP BY accident_date
                   ORDER BY accident_date""",
                (f"-{days}",),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT accident_date, COUNT(*) as accidents,
                          SUM(deaths) as deaths, SUM(injuries) as injuries
                   FROM accidents
                   GROUP BY accident_date
                   ORDER BY accident_date"""
            ).fetchall()
        return [dict(r) for r in rows]


# ─── Search Filter Options ──────────────────────────────────────

@router.get("/search/districts")
async def get_distinct_districts():
    """Return all distinct district names from the accidents table."""
    with db.get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT district FROM accidents WHERE district IS NOT NULL ORDER BY district"
        ).fetchall()
        return [r["district"] for r in rows]


@router.get("/search/types")
async def get_distinct_types():
    """Return all distinct accident types from the accidents table."""
    with db.get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT accident_type FROM accidents WHERE accident_type IS NOT NULL ORDER BY accident_type"
        ).fetchall()
        return [r["accident_type"] for r in rows]


# ─── Advanced Search ────────────────────────────────────────────

@router.get("/search/advanced")
async def search_advanced(
    q: Optional[str] = Query(None, min_length=1),
    district: Optional[str] = Query(None),
    type: Optional[str] = Query(None, alias="type"),
    severity: Optional[str] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Full-text search with optional district, type, severity, date filters."""
    with db.get_db() as conn:
        clauses = []
        params = []

        if q:
            clauses.append(
                "(a.district LIKE ? OR a.location_raw LIKE ? OR a.accident_type LIKE ? "
                "OR a.summary LIKE ? OR ar.title LIKE ?)"
            )
            like = f"%{q}%"
            params.extend([like] * 5)

        if district:
            clauses.append("a.district = ?")
            params.append(district)

        if type:
            clauses.append("a.accident_type LIKE ?")
            params.append(f"%{type}%")

        if severity == "fatal":
            clauses.append("a.deaths >= 1")
        elif severity == "critical":
            clauses.append("a.deaths >= 5")
        elif severity == "mass":
            clauses.append("a.deaths >= 10")
        elif severity == "injury":
            clauses.append("a.deaths = 0 AND a.injuries > 0")
        elif severity == "none":
            clauses.append("a.deaths = 0 AND a.injuries = 0")

        if start:
            clauses.append("a.accident_date >= ?")
            params.append(start)
        if end:
            clauses.append("a.accident_date <= ?")
            params.append(end)

        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

        rows = conn.execute(
            f"""SELECT a.*, ar.title as article_title, ar.url as article_url
                FROM accidents a
                LEFT JOIN articles ar ON a.article_id = ar.id
                {where}
                ORDER BY a.accident_date DESC
                LIMIT ?""",
            (*params, limit),
        ).fetchall()
        return [dict(r) for r in rows]


# ─── High-Severity Alerts ──────────────────────────────────────

@router.get("/alerts/high-severity")
async def get_high_severity_alerts(
    days: int = Query(3, ge=1, le=30),
    min_deaths: int = Query(5, ge=1),
):
    """Return recent high-severity accidents (default: 5+ deaths in last 3 days)."""
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT id, accident_date, accident_type, district, division,
                      location_raw, deaths, injuries, summary
               FROM accidents
               WHERE deaths >= ?
                 AND accident_date >= date('now', ? || ' days')
               ORDER BY deaths DESC, accident_date DESC
               LIMIT 5""",
            (min_deaths, f"-{days}"),
        ).fetchall()
        return [dict(r) for r in rows]


# ─── Trend Forecasting (Moving Average) ─────────────────────────

@router.get("/forecast")
async def get_forecast(
    months: int = Query(6, ge=3, le=24, description="Months of history to use"),
    forecast_months: int = Query(3, ge=1, le=6, description="Months to forecast"),
):
    """Return monthly historical data with a simple moving-average forecast."""
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT strftime('%Y-%m', accident_date) as month,
                      COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths,
                      COALESCE(SUM(injuries), 0) as injuries
               FROM accidents
               WHERE accident_date IS NOT NULL
               GROUP BY strftime('%Y-%m', accident_date)
               ORDER BY month DESC
               LIMIT ?""",
            (months,),
        ).fetchall()

    history = [dict(r) for r in reversed(rows)]  # oldest first

    if len(history) < 3:
        return {"history": history, "forecast": [], "moving_avg": []}

    # 3-month simple moving average
    window = 3
    moving_avg = []
    for i in range(len(history)):
        if i < window - 1:
            moving_avg.append(None)
        else:
            avg_acc = round(sum(h["accidents"] for h in history[i - window + 1 : i + 1]) / window, 1)
            avg_deaths = round(sum(h["deaths"] for h in history[i - window + 1 : i + 1]) / window, 1)
            avg_injuries = round(sum(h["injuries"] for h in history[i - window + 1 : i + 1]) / window, 1)
            moving_avg.append({"accidents": avg_acc, "deaths": avg_deaths, "injuries": avg_injuries})

    # Forecast next N months using last 3-month average
    last_vals = history[-window:]
    forecast = []
    from datetime import datetime as _dt
    import calendar
    last_month_str = history[-1]["month"]
    last_year, last_mon = int(last_month_str[:4]), int(last_month_str[5:])

    for i in range(1, forecast_months + 1):
        m = last_mon + i
        y = last_year
        while m > 12:
            m -= 12
            y += 1
        avg_acc = round(sum(h["accidents"] for h in last_vals) / window, 1)
        avg_deaths = round(sum(h["deaths"] for h in last_vals) / window, 1)
        avg_injuries = round(sum(h["injuries"] for h in last_vals) / window, 1)
        fc = {
            "month": f"{y}-{m:02d}",
            "accidents": avg_acc,
            "deaths": avg_deaths,
            "injuries": avg_injuries,
        }
        forecast.append(fc)
        last_vals = last_vals[1:] + [fc]  # slide window

    return {
        "history": history,
        "moving_avg": moving_avg,
        "forecast": forecast,
    }


# ─── Time-of-Day / Day-of-Week Patterns ────────────────────────

@router.get("/time-patterns")
async def get_time_patterns():
    """
    Return day-of-week distribution for accidents.
    Since articles don't include exact time, we compute day-of-week patterns
    and monthly distribution for a heatmap.
    """
    with db.get_db() as conn:
        # Day-of-week distribution (0=Sunday .. 6=Saturday in SQLite strftime %w)
        dow_rows = conn.execute(
            """SELECT CAST(strftime('%w', accident_date) AS INTEGER) as dow,
                      COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths,
                      COALESCE(SUM(injuries), 0) as injuries
               FROM accidents
               WHERE accident_date IS NOT NULL
               GROUP BY dow
               ORDER BY dow"""
        ).fetchall()

        # Month-of-year distribution
        moy_rows = conn.execute(
            """SELECT CAST(strftime('%m', accident_date) AS INTEGER) as month,
                      COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths,
                      COALESCE(SUM(injuries), 0) as injuries
               FROM accidents
               WHERE accident_date IS NOT NULL
               GROUP BY month
               ORDER BY month"""
        ).fetchall()

        # Month x Day-of-week grid for heatmap
        grid_rows = conn.execute(
            """SELECT CAST(strftime('%m', accident_date) AS INTEGER) as month,
                      CAST(strftime('%w', accident_date) AS INTEGER) as dow,
                      COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths
               FROM accidents
               WHERE accident_date IS NOT NULL
               GROUP BY month, dow
               ORDER BY month, dow"""
        ).fetchall()

        # Week-of-month patterns (week 1-5)
        wom_rows = conn.execute(
            """SELECT CAST(((CAST(strftime('%d', accident_date) AS INTEGER) - 1) / 7) + 1 AS INTEGER) as week,
                      CAST(strftime('%w', accident_date) AS INTEGER) as dow,
                      COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths
               FROM accidents
               WHERE accident_date IS NOT NULL
               GROUP BY week, dow
               ORDER BY week, dow"""
        ).fetchall()

        return {
            "by_dow": [dict(r) for r in dow_rows],
            "by_month": [dict(r) for r in moy_rows],
            "grid": [dict(r) for r in grid_rows],
            "week_grid": [dict(r) for r in wom_rows],
        }


# ─── Accident Clusters ─────────────────────────────────────────

@router.get("/clusters")
async def get_accident_clusters(
    window_days: int = Query(7, ge=2, le=30, description="Cluster window in days"),
    min_accidents: int = Query(3, ge=2, le=20, description="Min accidents to form a cluster"),
):
    """
    Detect clusters: multiple accidents in the same district within N days.
    """
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT id, accident_date, district, division, deaths, injuries,
                      accident_type, location_raw, summary
               FROM accidents
               WHERE district IS NOT NULL AND accident_date IS NOT NULL
               ORDER BY district, accident_date"""
        ).fetchall()

    from collections import defaultdict
    from datetime import datetime as _dt, timedelta

    # Group by district
    by_district = defaultdict(list)
    for r in rows:
        by_district[r["district"]].append(dict(r))

    clusters = []
    cluster_id = 0

    for district, accidents in by_district.items():
        if len(accidents) < min_accidents:
            continue

        # Sliding window: find groups of accidents within window_days
        i = 0
        while i < len(accidents):
            cluster_accs = [accidents[i]]
            j = i + 1
            while j < len(accidents):
                try:
                    d1 = _dt.strptime(accidents[i]["accident_date"], "%Y-%m-%d")
                    d2 = _dt.strptime(accidents[j]["accident_date"], "%Y-%m-%d")
                    if (d2 - d1).days <= window_days:
                        cluster_accs.append(accidents[j])
                        j += 1
                    else:
                        break
                except (ValueError, TypeError):
                    j += 1
                    continue

            if len(cluster_accs) >= min_accidents:
                cluster_id += 1
                total_deaths = sum(a.get("deaths", 0) or 0 for a in cluster_accs)
                total_injuries = sum(a.get("injuries", 0) or 0 for a in cluster_accs)
                date_start = cluster_accs[0]["accident_date"]
                date_end = cluster_accs[-1]["accident_date"]
                severity = (
                    "critical" if total_deaths >= 10
                    else "high" if total_deaths >= 5
                    else "moderate" if total_deaths >= 2
                    else "low"
                )
                clusters.append({
                    "cluster_id": cluster_id,
                    "district": district,
                    "division": cluster_accs[0].get("division"),
                    "accidents_count": len(cluster_accs),
                    "total_deaths": total_deaths,
                    "total_injuries": total_injuries,
                    "date_start": date_start,
                    "date_end": date_end,
                    "span_days": (_dt.strptime(date_end, "%Y-%m-%d") - _dt.strptime(date_start, "%Y-%m-%d")).days if date_start != date_end else 0,
                    "severity": severity,
                    "accidents": cluster_accs,
                })
                i = j  # skip past this cluster
            else:
                i += 1

    # Sort by recency, then severity
    severity_order = {"critical": 0, "high": 1, "moderate": 2, "low": 3}
    clusters.sort(key=lambda c: (c["date_start"]), reverse=True)
    return clusters


# ─── Year-over-Year Summary ────────────────────────────────────

@router.get("/yoy-summary")
async def get_yoy_summary():
    """
    Compare current year vs previous year at-a-glance.
    Also provides monthly breakdown for both years.
    """
    from datetime import date as _date
    current_year = _date.today().year
    prev_year = current_year - 1
    current_month = _date.today().month

    with db.get_db() as conn:
        result = {}

        for year in (current_year, prev_year):
            row = conn.execute(
                """SELECT COUNT(*) as accidents,
                          COALESCE(SUM(deaths), 0) as deaths,
                          COALESCE(SUM(injuries), 0) as injuries
                   FROM accidents
                   WHERE strftime('%Y', accident_date) = ?""",
                (str(year),),
            ).fetchone()

            # Per-month breakdown
            months = conn.execute(
                """SELECT CAST(strftime('%m', accident_date) AS INTEGER) as month,
                          COUNT(*) as accidents,
                          COALESCE(SUM(deaths), 0) as deaths,
                          COALESCE(SUM(injuries), 0) as injuries
                   FROM accidents
                   WHERE strftime('%Y', accident_date) = ?
                   GROUP BY month ORDER BY month""",
                (str(year),),
            ).fetchall()

            # YTD comparison (compare only up to current month)
            ytd = conn.execute(
                """SELECT COUNT(*) as accidents,
                          COALESCE(SUM(deaths), 0) as deaths,
                          COALESCE(SUM(injuries), 0) as injuries
                   FROM accidents
                   WHERE strftime('%Y', accident_date) = ?
                     AND CAST(strftime('%m', accident_date) AS INTEGER) <= ?""",
                (str(year), current_month),
            ).fetchone()

            # Worst month
            worst = conn.execute(
                """SELECT CAST(strftime('%m', accident_date) AS INTEGER) as month,
                          COUNT(*) as accidents,
                          COALESCE(SUM(deaths), 0) as deaths
                   FROM accidents
                   WHERE strftime('%Y', accident_date) = ?
                   GROUP BY month
                   ORDER BY accidents DESC
                   LIMIT 1""",
                (str(year),),
            ).fetchone()

            result[str(year)] = {
                "year": year,
                "total": dict(row),
                "ytd": dict(ytd),
                "by_month": [dict(m) for m in months],
                "worst_month": dict(worst) if worst else None,
            }

        # Compute deltas
        curr = result[str(current_year)]
        prev = result[str(prev_year)]

        def pct_change(new_val, old_val):
            if old_val == 0:
                return 100.0 if new_val > 0 else 0.0
            return round(((new_val - old_val) / old_val) * 100, 1)

        ytd_delta = {
            "accidents": pct_change(curr["ytd"]["accidents"], prev["ytd"]["accidents"]),
            "deaths": pct_change(curr["ytd"]["deaths"], prev["ytd"]["deaths"]),
            "injuries": pct_change(curr["ytd"]["injuries"], prev["ytd"]["injuries"]),
        }

        return {
            "current_year": current_year,
            "previous_year": prev_year,
            "current_month": current_month,
            "data": result,
            "ytd_delta": ytd_delta,
        }


# ─── CSV Export ─────────────────────────────────────────────────

@router.get("/export/csv")
async def export_csv(
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
):
    """Export filtered accident data as CSV."""
    from fastapi.responses import StreamingResponse
    import csv
    import io

    with db.get_db() as conn:
        clauses = []
        params = []

        if start:
            clauses.append("a.accident_date >= ?")
            params.append(start)
        if end:
            clauses.append("a.accident_date <= ?")
            params.append(end)
        if district:
            clauses.append("a.district = ?")
            params.append(district)

        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""

        rows = conn.execute(
            f"""SELECT a.accident_date, a.accident_type, a.district, a.division,
                       a.location_raw, a.deaths, a.injuries, a.vehicles_involved,
                       a.summary, ar.title as article_title, ar.url as article_url
                FROM accidents a
                LEFT JOIN articles ar ON a.article_id = ar.id
                {where}
                ORDER BY a.accident_date DESC""",
            params,
        ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Date', 'Type', 'District', 'Division', 'Location',
        'Deaths', 'Injuries', 'Vehicles', 'Summary', 'Article Title', 'Article URL',
    ])
    for r in rows:
        writer.writerow([
            r['accident_date'], r['accident_type'], r['district'], r['division'],
            r['location_raw'], r['deaths'], r['injuries'], r['vehicles_involved'],
            r['summary'], r['article_title'], r['article_url'],
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=traffic_insight_bd_data.csv"},
    )


# ─── District Detail ────────────────────────────────────────────

@router.get("/district/{district_name}")
async def get_district_detail(district_name: str):
    """Full analytics for a single district: trend, types, vehicles, severity over time."""
    with db.get_db() as conn:
        # Basic totals
        totals = conn.execute(
            """SELECT COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths,
                      COALESCE(SUM(injuries), 0) as injuries,
                      MIN(accident_date) as first_date,
                      MAX(accident_date) as last_date
               FROM accidents WHERE district = ?""",
            (district_name,),
        ).fetchone()

        if not totals or totals["accidents"] == 0:
            raise HTTPException(status_code=404, detail="District not found")

        # Monthly trend
        trend = conn.execute(
            """SELECT strftime('%Y-%m', accident_date) as month,
                      COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths,
                      COALESCE(SUM(injuries), 0) as injuries
               FROM accidents
               WHERE district = ? AND accident_date IS NOT NULL
               GROUP BY month ORDER BY month""",
            (district_name,),
        ).fetchall()

        # By accident type
        by_type = conn.execute(
            """SELECT accident_type, COUNT(*) as count,
                      COALESCE(SUM(deaths), 0) as deaths,
                      COALESCE(SUM(injuries), 0) as injuries
               FROM accidents WHERE district = ? AND accident_type IS NOT NULL
               GROUP BY accident_type ORDER BY count DESC""",
            (district_name,),
        ).fetchall()

        # By vehicle
        vehicles_raw = conn.execute(
            "SELECT vehicles_involved FROM accidents WHERE district = ? AND vehicles_involved IS NOT NULL",
            (district_name,),
        ).fetchall()
        vehicle_counts: dict = {}
        for row in vehicles_raw:
            for v in row["vehicles_involved"].split(","):
                v = v.strip().lower()
                if v:
                    vehicle_counts[v] = vehicle_counts.get(v, 0) + 1
        top_vehicles = sorted(vehicle_counts.items(), key=lambda x: -x[1])[:15]

        # Day-of-week pattern
        dow = conn.execute(
            """SELECT CAST(strftime('%w', accident_date) AS INTEGER) as dow,
                      COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths
               FROM accidents
               WHERE district = ? AND accident_date IS NOT NULL
               GROUP BY dow ORDER BY dow""",
            (district_name,),
        ).fetchall()

        # Fatality rate over time (monthly)
        fatality_trend = []
        for m in trend:
            fr = round(m["deaths"] / m["accidents"], 2) if m["accidents"] > 0 else 0
            fatality_trend.append({"month": m["month"], "fatality_rate": fr})

        # Recent accidents
        recent = conn.execute(
            """SELECT a.id, a.accident_date, a.accident_type, a.deaths, a.injuries,
                      a.location_raw, a.summary, ar.title as article_title, ar.url as article_url
               FROM accidents a
               LEFT JOIN articles ar ON a.article_id = ar.id
               WHERE a.district = ?
               ORDER BY a.accident_date DESC LIMIT 10""",
            (district_name,),
        ).fetchall()

        division = conn.execute(
            "SELECT division FROM accidents WHERE district = ? AND division IS NOT NULL LIMIT 1",
            (district_name,),
        ).fetchone()

    acc = totals["accidents"]
    return {
        "district": district_name,
        "division": division["division"] if division else None,
        "totals": dict(totals),
        "fatality_rate": round(totals["deaths"] / acc, 2) if acc else 0,
        "trend": [dict(r) for r in trend],
        "fatality_trend": fatality_trend,
        "by_type": [dict(r) for r in by_type],
        "top_vehicles": [{"vehicle": v, "count": c} for v, c in top_vehicles],
        "by_dow": [dict(r) for r in dow],
        "recent": [dict(r) for r in recent],
    }


# ─── Road / Highway Analysis ───────────────────────────────────

@router.get("/roads")
async def get_road_analysis(
    limit: int = Query(30, ge=1, le=100),
):
    """Dangerous roads/highways ranked by accident count and fatality rate."""
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT road_name, COUNT(*) as accidents,
                      COALESCE(SUM(deaths), 0) as deaths,
                      COALESCE(SUM(injuries), 0) as injuries,
                      COUNT(DISTINCT district) as districts_affected,
                      ROUND(CAST(COALESCE(SUM(deaths), 0) AS REAL) / COUNT(*), 2) as fatality_rate,
                      GROUP_CONCAT(DISTINCT district) as district_list
               FROM accidents
               WHERE road_name IS NOT NULL AND road_name != ''
               GROUP BY road_name
               HAVING COUNT(*) >= 1
               ORDER BY accidents DESC, deaths DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()

        result = []
        for r in rows:
            d = dict(r)
            fr = d["fatality_rate"]
            if fr >= 1.5:
                d["severity"] = "critical"
            elif fr >= 1.0:
                d["severity"] = "high"
            elif fr >= 0.5:
                d["severity"] = "moderate"
            else:
                d["severity"] = "low"
            d["district_list"] = d["district_list"].split(",") if d["district_list"] else []
            result.append(d)
        return result


# ─── Geographic Blackspot Detection (DBSCAN) ───────────────────

@router.get("/blackspots")
async def get_blackspots(
    eps_km: float = Query(5.0, ge=0.5, le=50, description="Cluster radius in km"),
    min_samples: int = Query(3, ge=2, le=20, description="Min accidents per cluster"),
):
    """Identify geographic accident blackspots using DBSCAN spatial clustering."""
    import numpy as np
    try:
        from sklearn.cluster import DBSCAN
    except ImportError:
        raise HTTPException(status_code=501, detail="scikit-learn not installed")

    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT id, latitude, longitude, deaths, injuries, district,
                      accident_type, accident_date, location_raw
               FROM accidents
               WHERE latitude IS NOT NULL AND longitude IS NOT NULL"""
        ).fetchall()

    if len(rows) < min_samples:
        return []

    coords = np.array([[r["latitude"], r["longitude"]] for r in rows])
    # Convert km radius to approximate radians for haversine
    eps_rad = eps_km / 6371.0

    db_scan = DBSCAN(eps=eps_rad, min_samples=min_samples, metric="haversine")
    labels = db_scan.fit_predict(np.radians(coords))

    # Group accidents by cluster label (ignore noise label -1)
    from collections import defaultdict
    cluster_map = defaultdict(list)
    for i, label in enumerate(labels):
        if label >= 0:
            cluster_map[int(label)].append(dict(rows[i]))

    blackspots = []
    for cid, accidents in cluster_map.items():
        lats = [a["latitude"] for a in accidents]
        lons = [a["longitude"] for a in accidents]
        total_deaths = sum(a.get("deaths", 0) or 0 for a in accidents)
        total_injuries = sum(a.get("injuries", 0) or 0 for a in accidents)
        districts = list({a["district"] for a in accidents if a["district"]})

        severity = (
            "critical" if total_deaths >= 10
            else "high" if total_deaths >= 5
            else "moderate" if total_deaths >= 2
            else "low"
        )

        blackspots.append({
            "cluster_id": cid,
            "center_lat": round(sum(lats) / len(lats), 6),
            "center_lon": round(sum(lons) / len(lons), 6),
            "radius_km": eps_km,
            "accident_count": len(accidents),
            "total_deaths": total_deaths,
            "total_injuries": total_injuries,
            "districts": districts,
            "severity": severity,
            "accidents": accidents,
        })

    blackspots.sort(key=lambda b: (-b["total_deaths"], -b["accident_count"]))
    return blackspots


# ─── Vehicle Type Analytics ─────────────────────────────────────

@router.get("/vehicle-analytics")
async def get_vehicle_analytics():
    """Deep dive into accident statistics by vehicle type."""
    with db.get_db() as conn:
        rows = conn.execute(
            """SELECT id, vehicles_involved, deaths, injuries, accident_type,
                      accident_date, district
               FROM accidents
               WHERE vehicles_involved IS NOT NULL AND vehicles_involved != ''"""
        ).fetchall()

    from collections import defaultdict, Counter

    vehicle_stats: dict = defaultdict(lambda: {
        "count": 0, "deaths": 0, "injuries": 0, "by_month": defaultdict(int), "districts": Counter()
    })

    for r in rows:
        for v in r["vehicles_involved"].split(","):
            v = v.strip()
            if not v:
                continue
            # Normalize common vehicle names
            vl = v.lower()
            if "bus" in vl:
                key = "Bus"
            elif "truck" in vl or "lorry" in vl:
                key = "Truck"
            elif "motorcycle" in vl or "motorbike" in vl or "bike" in vl:
                key = "Motorcycle"
            elif "cng" in vl or "auto" in vl or "autorickshaw" in vl or "three-wheeler" in vl:
                key = "CNG/Auto-rickshaw"
            elif "car" in vl or "microbus" in vl or "jeep" in vl or "suv" in vl:
                key = "Car/Microbus"
            elif "van" in vl or "pickup" in vl:
                key = "Van/Pickup"
            elif "rickshaw" in vl:
                key = "Rickshaw"
            elif "train" in vl:
                key = "Train"
            elif "boat" in vl or "launch" in vl or "vessel" in vl or "trawler" in vl:
                key = "Watercraft"
            else:
                key = v.title()

            stats = vehicle_stats[key]
            stats["count"] += 1
            stats["deaths"] += r["deaths"] or 0
            stats["injuries"] += r["injuries"] or 0
            if r["accident_date"]:
                month = r["accident_date"][:7]
                stats["by_month"][month] += 1
            if r["district"]:
                stats["districts"][r["district"]] += 1

    result = []
    for vehicle, stats in sorted(vehicle_stats.items(), key=lambda x: -x[1]["count"]):
        acc = stats["count"]
        result.append({
            "vehicle": vehicle,
            "accidents": acc,
            "deaths": stats["deaths"],
            "injuries": stats["injuries"],
            "fatality_rate": round(stats["deaths"] / acc, 2) if acc else 0,
            "trend": [{"month": m, "count": c}
                      for m, c in sorted(stats["by_month"].items())],
            "top_districts": [{"district": d, "count": c}
                              for d, c in stats["districts"].most_common(5)],
        })

    return result
