"""
Database models and operations for the Traffic Insights Agent.
Uses SQLite for simplicity and portability.
"""
import sqlite3
from datetime import datetime, date
from typing import Optional

from app.config import DB_PATH, NEWS_SOURCE_NAME


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


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

        CREATE INDEX IF NOT EXISTS idx_accidents_date ON accidents(accident_date);
        CREATE INDEX IF NOT EXISTS idx_accidents_district ON accidents(district);
        CREATE INDEX IF NOT EXISTS idx_accidents_type ON accidents(accident_type);
        CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
        CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_date);
    """)

    conn.commit()
    conn.close()


# ─── Article Operations ────────────────────────────────────────

def article_exists(url: str) -> bool:
    """Check if an article URL already exists in the database."""
    conn = get_connection()
    row = conn.execute("SELECT 1 FROM articles WHERE url = ?", (url,)).fetchone()
    conn.close()
    return row is not None


def insert_article(url: str, title: str, content: str,
                   published_date: Optional[date] = None,
                   source: str = NEWS_SOURCE_NAME) -> int:
    """Insert a new article and return its ID."""
    conn = get_connection()
    cursor = conn.execute(
        """INSERT INTO articles (url, title, content, published_date, source)
           VALUES (?, ?, ?, ?, ?)""",
        (url, title, content, published_date, source)
    )
    article_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return article_id


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
    conn = get_connection()
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
    accident_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return accident_id


# ─── Scrape Log Operations ─────────────────────────────────────

def start_scrape_log() -> int:
    conn = get_connection()
    cursor = conn.execute(
        "INSERT INTO scrape_logs (started_at, status) VALUES (?, 'running')",
        (datetime.now(),)
    )
    log_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return log_id


def finish_scrape_log(log_id: int, articles_found: int, articles_new: int,
                      status: str = "completed"):
    conn = get_connection()
    conn.execute(
        """UPDATE scrape_logs
           SET finished_at = ?, articles_found = ?, articles_new = ?, status = ?
           WHERE id = ?""",
        (datetime.now(), articles_found, articles_new, status, log_id)
    )
    conn.commit()
    conn.close()


# ─── Query Operations ──────────────────────────────────────────

def get_daily_stats(target_date: date = None):
    """Get accident statistics for a specific date."""
    if target_date is None:
        target_date = date.today()

    conn = get_connection()
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
    conn.close()
    return stats


def get_monthly_stats(year: int, month: int):
    """Get accident statistics for a specific month."""
    conn = get_connection()
    stats = {}
    date_prefix = f"{year:04d}-{month:02d}"

    row = conn.execute(
        """SELECT COUNT(*) as total,
                  COALESCE(SUM(deaths), 0) as total_deaths,
                  COALESCE(SUM(injuries), 0) as total_injuries
           FROM accidents
           WHERE strftime('%%Y-%%m', accident_date) = ?""",
        (date_prefix,)
    ).fetchone()
    stats["total_accidents"] = row["total"]
    stats["total_deaths"] = row["total_deaths"]
    stats["total_injuries"] = row["total_injuries"]

    rows = conn.execute(
        """SELECT accident_date, COUNT(*) as count,
                  SUM(deaths) as deaths, SUM(injuries) as injuries
           FROM accidents
           WHERE strftime('%%Y-%%m', accident_date) = ?
           GROUP BY accident_date ORDER BY accident_date""",
        (date_prefix,)
    ).fetchall()
    stats["daily_breakdown"] = [dict(r) for r in rows]

    rows = conn.execute(
        """SELECT accident_type, COUNT(*) as count
           FROM accidents
           WHERE strftime('%%Y-%%m', accident_date) = ? AND accident_type IS NOT NULL
           GROUP BY accident_type ORDER BY count DESC""",
        (date_prefix,)
    ).fetchall()
    stats["by_type"] = [dict(r) for r in rows]

    rows = conn.execute(
        """SELECT district, COUNT(*) as count,
                  SUM(deaths) as deaths, SUM(injuries) as injuries
           FROM accidents
           WHERE strftime('%%Y-%%m', accident_date) = ? AND district IS NOT NULL
           GROUP BY district ORDER BY count DESC""",
        (date_prefix,)
    ).fetchall()
    stats["by_district"] = [dict(r) for r in rows]

    stats["year"] = year
    stats["month"] = month
    conn.close()
    return stats


def get_danger_zones(limit: int = 20):
    """Get top danger zones (districts with most accidents)."""
    conn = get_connection()
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
    result = [dict(r) for r in rows]
    conn.close()
    return result


def get_recent_accidents(limit: int = 50):
    """Get most recent accident records with article info."""
    conn = get_connection()
    rows = conn.execute(
        """SELECT a.*, ar.title as article_title, ar.url as article_url
           FROM accidents a
           JOIN articles ar ON a.article_id = ar.id
           ORDER BY a.accident_date DESC, a.created_at DESC
           LIMIT ?""",
        (limit,)
    ).fetchall()
    result = [dict(r) for r in rows]
    conn.close()
    return result


def get_all_accidents_for_map():
    """Get all accidents with coordinates for map display."""
    conn = get_connection()
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
    result = [dict(r) for r in rows]
    conn.close()
    return result


def get_yearly_overview():
    """Get a high-level yearly overview of accidents."""
    conn = get_connection()
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
    result = [dict(r) for r in rows]
    conn.close()
    return result


def get_scrape_logs(limit: int = 20):
    """Get recent scrape logs."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM scrape_logs ORDER BY id DESC LIMIT ?",
        (limit,)
    ).fetchall()
    result = [dict(r) for r in rows]
    conn.close()
    return result


# Initialize DB on import
init_db()
