"""
FastAPI route definitions.
Separated from server setup for clarity.
"""
import logging
from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from app import database as db
from app.scraper import run_scraper, run_published_date_backfill

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


# ─── Overview ───────────────────────────────────────────────────

@router.get("/overview")
async def get_overview():
    """Get overall statistics overview."""
    try:
        conn = db.get_connection()

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

        conn.close()

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
):
    return db.get_danger_zones(limit)


# ─── Records & Map ─────────────────────────────────────────────

@router.get("/recent")
async def get_recent(limit: int = Query(50, ge=1, le=200)):
    return db.get_recent_accidents(limit)


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
async def trigger_scrape():
    try:
        result = run_scraper()
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Scrape failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backfill-published-dates")
async def backfill_published_dates(limit: int = Query(0, ge=0, le=5000)):
    try:
        # Repair endpoint for legacy rows scraped before published_date capture
        # was stable. Safe to run multiple times; only NULL dates are targeted.
        result = run_published_date_backfill(limit=limit or None)
        return {"status": "success", "result": result}
    except Exception as e:
        logger.error(f"Published date backfill failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Search & Trend ────────────────────────────────────────────

@router.get("/search")
async def search_accidents(
    q: str = Query(..., min_length=2),
    limit: int = Query(50, ge=1, le=200),
):
    conn = db.get_connection()
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
    conn.close()
    return [dict(r) for r in rows]


@router.get("/trend")
async def get_trend(days: int = Query(30, ge=7, le=365)):
    conn = db.get_connection()
    rows = conn.execute(
        """SELECT accident_date, COUNT(*) as accidents,
                  SUM(deaths) as deaths, SUM(injuries) as injuries
           FROM accidents
           WHERE accident_date >= date('now', ? || ' days')
           GROUP BY accident_date
           ORDER BY accident_date""",
        (f"-{days}",),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
