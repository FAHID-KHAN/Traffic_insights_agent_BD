"""
Database models and operations for the Traffic Insights Agent.
Uses SQLite for simplicity and portability.
"""
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, date
from typing import Optional

from app.config import DB_PATH, NEWS_SOURCE_NAME

# Thread-local storage for connection reuse within the same thread
_local = threading.local()


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    """Context manager for safe database access with automatic cleanup.

    Usage:
        with get_db() as conn:
            rows = conn.execute("SELECT ...").fetchall()
    """
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initialize the database schema."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            published_date DATE,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            source TEXT DEFAULT 'New Age'
        );

        CREATE TABLE IF NOT EXISTS accidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER NOT NULL,
            accident_type TEXT,
            location_raw TEXT,
            district TEXT,
            division TEXT,
            latitude REAL,
            longitude REAL,
            deaths INTEGER DEFAULT 0,
            injuries INTEGER DEFAULT 0,
            vehicles_involved TEXT,
            accident_date DATE,
            summary TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (article_id) REFERENCES articles(id)
        );

        CREATE TABLE IF NOT EXISTS scrape_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TIMESTAMP,
            finished_at TIMESTAMP,
            articles_found INTEGER DEFAULT 0,
            articles_new INTEGER DEFAULT 0,
            status TEXT DEFAULT 'running'
        );

        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            incident_date TEXT NOT NULL,
            incident_time TEXT,
            location_text TEXT,
            district TEXT,
            division TEXT,
            accident_type TEXT DEFAULT 'Road Accident',
            fatalities INTEGER DEFAULT 0,
            injuries INTEGER DEFAULT 0,
            reporter_name TEXT DEFAULT 'Anonymous',
            images TEXT DEFAULT '[]',
            upvotes INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            status TEXT DEFAULT 'active'
        );

        CREATE INDEX IF NOT EXISTS idx_accidents_date ON accidents(accident_date);
        CREATE INDEX IF NOT EXISTS idx_accidents_district ON accidents(district);
        CREATE INDEX IF NOT EXISTS idx_accidents_division ON accidents(division);
        CREATE INDEX IF NOT EXISTS idx_accidents_type ON accidents(accident_type);
        CREATE INDEX IF NOT EXISTS idx_accidents_article ON accidents(article_id);
        CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
        CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_date);
        CREATE INDEX IF NOT EXISTS idx_reports_district ON reports(district);
        CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(incident_date);
        CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

        CREATE TABLE IF NOT EXISTS report_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL,
            author_name TEXT NOT NULL DEFAULT 'Anonymous',
            body TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_comments_report ON report_comments(report_id);
    """)

    conn.commit()
    conn.close()


# ─── Article Operations ────────────────────────────────────────

def article_exists(url: str) -> bool:
    """Check if an article URL already exists in the database."""
    with get_db() as conn:
        row = conn.execute("SELECT 1 FROM articles WHERE url = ?", (url,)).fetchone()
        return row is not None


def insert_article(url: str, title: str, content: str,
                   published_date: Optional[date] = None,
                   source: str = NEWS_SOURCE_NAME) -> int:
    """Insert a new article and return its ID."""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO articles (url, title, content, published_date, source)
               VALUES (?, ?, ?, ?, ?)""",
            (url, title, content, published_date, source)
        )
        return cursor.lastrowid


def get_article_by_url(url: str) -> Optional[dict]:
    """Get article metadata by URL."""
    conn = get_connection()
    row = conn.execute(
        "SELECT id, url, published_date FROM articles WHERE url = ?",
        (url,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_articles_missing_published_date(limit: Optional[int] = None) -> list[dict]:
    """Return articles where published_date is not yet captured."""
    conn = get_connection()
    if limit:
        rows = conn.execute(
            "SELECT id, url FROM articles WHERE published_date IS NULL ORDER BY id ASC LIMIT ?",
            (limit,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, url FROM articles WHERE published_date IS NULL ORDER BY id ASC"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_article_published_date(article_id: int, published_date: date):
    """Update article published date."""
    # Single-purpose helper used by scrape-time repair and explicit backfill.
    conn = get_connection()
    conn.execute(
        "UPDATE articles SET published_date = ? WHERE id = ?",
        (published_date, article_id),
    )
    conn.commit()
    conn.close()


def sync_accident_dates_for_article(article_id: int, published_date: date):
    """Sync all accidents for article to canonical article publish date."""
    # Business rule: accident_date is derived from article published_date for
    # all events extracted from that article (including multi-event stories).
    conn = get_connection()
    conn.execute(
        "UPDATE accidents SET accident_date = ? WHERE article_id = ?",
        (published_date, article_id),
    )
    conn.commit()
    conn.close()


def insert_accident(article_id: int, accident_type: str = None,
                    location_raw: str = None, district: str = None,
                    division: str = None, latitude: float = None,
                    longitude: float = None, deaths: int = 0,
                    injuries: int = 0, vehicles_involved: str = None,
                    accident_date: date = None, summary: str = None) -> int:
    """Insert an accident record and return its ID."""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO accidents
               (article_id, accident_type, location_raw, district, division,
                latitude, longitude, deaths, injuries, vehicles_involved,
                accident_date, summary)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (article_id, accident_type, location_raw, district, division,
             latitude, longitude, deaths, injuries, vehicles_involved,
             accident_date, summary)
        )
        return cursor.lastrowid


# ─── Scrape Log Operations ─────────────────────────────────────

def start_scrape_log() -> int:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO scrape_logs (started_at, status) VALUES (?, 'running')",
            (datetime.now(),)
        )
        return cursor.lastrowid


def finish_scrape_log(log_id: int, articles_found: int, articles_new: int,
                      status: str = "completed"):
    with get_db() as conn:
        conn.execute(
            """UPDATE scrape_logs
               SET finished_at = ?, articles_found = ?, articles_new = ?, status = ?
               WHERE id = ?""",
            (datetime.now(), articles_found, articles_new, status, log_id)
        )


# ─── Query Operations ──────────────────────────────────────────

def get_daily_stats(target_date: date = None):
    """Get accident statistics for a specific date."""
    if target_date is None:
        target_date = date.today()

    with get_db() as conn:
        stats = {}

        row = conn.execute(
            "SELECT COUNT(*) as total FROM accidents WHERE accident_date = ?",
            (target_date,)
        ).fetchone()
        stats["total_accidents"] = row["total"]

        row = conn.execute(
            """SELECT COALESCE(SUM(deaths), 0) as total_deaths,
                      COALESCE(SUM(injuries), 0) as total_injuries
               FROM accidents WHERE accident_date = ?""",
            (target_date,)
        ).fetchone()
        stats["total_deaths"] = row["total_deaths"]
        stats["total_injuries"] = row["total_injuries"]

        rows = conn.execute(
            """SELECT accident_type, COUNT(*) as count
               FROM accidents WHERE accident_date = ? AND accident_type IS NOT NULL
               GROUP BY accident_type ORDER BY count DESC""",
            (target_date,)
        ).fetchall()
        stats["by_type"] = [dict(r) for r in rows]

        rows = conn.execute(
            """SELECT district, COUNT(*) as count,
                      SUM(deaths) as deaths, SUM(injuries) as injuries
               FROM accidents WHERE accident_date = ? AND district IS NOT NULL
               GROUP BY district ORDER BY count DESC""",
            (target_date,)
        ).fetchall()
        stats["by_district"] = [dict(r) for r in rows]

        stats["date"] = target_date.isoformat()
        return stats


def get_monthly_stats(year: int, month: int):
    """Get accident statistics for a specific month."""
    with get_db() as conn:
        stats = {}
        date_prefix = f"{year:04d}-{month:02d}"

        row = conn.execute(
            """SELECT COUNT(*) as total,
                      COALESCE(SUM(deaths), 0) as total_deaths,
                      COALESCE(SUM(injuries), 0) as total_injuries
               FROM accidents
               WHERE strftime('%Y-%m', accident_date) = ?""",
            (date_prefix,)
        ).fetchone()
        stats["total_accidents"] = row["total"]
        stats["total_deaths"] = row["total_deaths"]
        stats["total_injuries"] = row["total_injuries"]

        rows = conn.execute(
            """SELECT accident_date, COUNT(*) as count,
                      SUM(deaths) as deaths, SUM(injuries) as injuries
               FROM accidents
               WHERE strftime('%Y-%m', accident_date) = ?
               GROUP BY accident_date ORDER BY accident_date""",
            (date_prefix,)
        ).fetchall()
        stats["daily_breakdown"] = [dict(r) for r in rows]

        rows = conn.execute(
            """SELECT accident_type, COUNT(*) as count
               FROM accidents
               WHERE strftime('%Y-%m', accident_date) = ? AND accident_type IS NOT NULL
               GROUP BY accident_type ORDER BY count DESC""",
            (date_prefix,)
        ).fetchall()
        stats["by_type"] = [dict(r) for r in rows]

        rows = conn.execute(
            """SELECT district, COUNT(*) as count,
                      SUM(deaths) as deaths, SUM(injuries) as injuries
               FROM accidents
               WHERE strftime('%Y-%m', accident_date) = ? AND district IS NOT NULL
               GROUP BY district ORDER BY count DESC""",
            (date_prefix,)
        ).fetchall()
        stats["by_district"] = [dict(r) for r in rows]

        stats["year"] = year
        stats["month"] = month
        return stats


def get_danger_zones(limit: int = 20):
    """Get top danger zones (districts with most accidents)."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT district, division, COUNT(*) as total_accidents,
                      SUM(deaths) as total_deaths, SUM(injuries) as total_injuries,
                      AVG(latitude) as avg_lat, AVG(longitude) as avg_lon
               FROM accidents
               WHERE district IS NOT NULL
               GROUP BY district
               ORDER BY total_accidents DESC
               LIMIT ?""",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_recent_accidents(limit: int = 50):
    """Get most recent accident records with article info."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT a.*, ar.title as article_title, ar.url as article_url
               FROM accidents a
               JOIN articles ar ON a.article_id = ar.id
               ORDER BY a.accident_date DESC, a.created_at DESC
               LIMIT ?""",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_all_accidents_for_map():
    """Get all accidents with coordinates for map display."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT a.id, a.accident_type, a.location_raw, a.district,
                      a.latitude, a.longitude, a.deaths, a.injuries,
                      a.accident_date, a.summary, ar.title as article_title,
                      ar.url as article_url
               FROM accidents a
               JOIN articles ar ON a.article_id = ar.id
               WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
               ORDER BY a.accident_date DESC"""
        ).fetchall()
        return [dict(r) for r in rows]


def get_yearly_overview():
    """Get a high-level yearly overview of accidents."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT strftime('%Y-%m', accident_date) as month,
                      COUNT(*) as total_accidents,
                      SUM(deaths) as total_deaths,
                      SUM(injuries) as total_injuries
               FROM accidents
               WHERE accident_date IS NOT NULL
               GROUP BY strftime('%Y-%m', accident_date)
               ORDER BY month DESC"""
        ).fetchall()
        return [dict(r) for r in rows]


def get_scrape_logs(limit: int = 20):
    """Get recent scrape logs."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM scrape_logs ORDER BY id DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


# ─── Community Reports ─────────────────────────────────────────

def insert_report(
    title: str,
    description: str,
    incident_date: str,
    incident_time: Optional[str],
    location_text: str,
    district: Optional[str],
    division: Optional[str],
    accident_type: str,
    fatalities: int,
    injuries: int,
    reporter_name: str,
    images: list,
) -> int:
    """Insert a community-submitted incident report and return its ID."""
    import json
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO reports
               (title, description, incident_date, incident_time, location_text,
                district, division, accident_type, fatalities, injuries,
                reporter_name, images)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                title, description, incident_date, incident_time, location_text,
                district, division, accident_type, fatalities, injuries,
                reporter_name, json.dumps(images),
            ),
        )
        return cursor.lastrowid


def get_reports(
    limit: int = 20,
    offset: int = 0,
    district: Optional[str] = None,
    division: Optional[str] = None,
    accident_type: Optional[str] = None,
) -> dict:
    """Get community reports (newest first), with optional filters."""
    conditions = ["status = 'active'"]
    filter_params: list = []
    if district:
        conditions.append("district = ?")
        filter_params.append(district)
    if division:
        conditions.append("division = ?")
        filter_params.append(division)
    if accident_type:
        conditions.append("accident_type = ?")
        filter_params.append(accident_type)
    where = " AND ".join(conditions)

    with get_db() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) as c FROM reports WHERE {where}",
            filter_params,
        ).fetchone()["c"]
        rows = conn.execute(
            f"""SELECT * FROM reports WHERE {where}
                ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            filter_params + [limit, offset],
        ).fetchall()
    return {"items": [dict(r) for r in rows], "total": total}


def get_report_by_id(report_id: int) -> Optional[dict]:
    """Get a single community report by ID."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM reports WHERE id = ?", (report_id,)
        ).fetchone()
        return dict(row) if row else None


def upvote_report(report_id: int) -> int:
    """Increment upvotes for a report and return new count."""
    with get_db() as conn:
        conn.execute(
            "UPDATE reports SET upvotes = upvotes + 1 WHERE id = ?", (report_id,)
        )
        row = conn.execute(
            "SELECT upvotes FROM reports WHERE id = ?", (report_id,)
        ).fetchone()
        return row["upvotes"] if row else 0


# ─── Report Comments ───────────────────────────────────────────

def get_comments(report_id: int) -> list:
    """Return all comments for a report, oldest first."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, report_id, author_name, body, created_at
               FROM report_comments
               WHERE report_id = ?
               ORDER BY created_at ASC""",
            (report_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def insert_comment(report_id: int, author_name: str, body: str) -> dict:
    """Insert a comment and return the newly created row."""
    with get_db() as conn:
        cursor = conn.execute(
            """INSERT INTO report_comments (report_id, author_name, body)
               VALUES (?, ?, ?)""",
            (report_id, author_name or "Anonymous", body.strip()),
        )
        row = conn.execute(
            "SELECT id, report_id, author_name, body, created_at FROM report_comments WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return dict(row)
