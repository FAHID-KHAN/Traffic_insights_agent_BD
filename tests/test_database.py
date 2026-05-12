"""Tests for app/database.py — CRUD helpers & query functions."""
from datetime import date
from app import database as db


class TestArticleCRUD:
    def test_insert_and_exists(self):
        url = "https://example.com/article-1"
        assert not db.article_exists(url)
        aid = db.insert_article(url, "Test Title", "Body text", date(2025, 6, 1))
        assert aid >= 1
        assert db.article_exists(url)

    def test_duplicate_url_raises(self):
        url = "https://example.com/dup"
        db.insert_article(url, "A", "content", None)
        import sqlite3
        with pytest.raises(sqlite3.IntegrityError):
            db.insert_article(url, "B", "other content", None)


class TestAccidentCRUD:
    def test_insert_accident(self):
        aid = db.insert_article("https://x.com/1", "T", "C", date(2025, 1, 1))
        acc_id = db.insert_accident(
            article_id=aid,
            accident_type="bus accident",
            district="Dhaka",
            division="Dhaka",
            deaths=3,
            injuries=10,
            accident_date=date(2025, 1, 1),
            summary="Test",
        )
        assert acc_id >= 1

    def test_insert_accident_defaults(self):
        aid = db.insert_article("https://x.com/2", "T", "C", None)
        acc_id = db.insert_accident(article_id=aid)
        assert acc_id >= 1

    def test_insert_accident_time_metadata(self):
        aid = db.insert_article("https://x.com/time", "T", "C", date(2025, 1, 1))
        acc_id = db.insert_accident(
            article_id=aid,
            accident_time="17:30",
            part_of_day="evening",
        )
        with db.get_db() as conn:
            row = conn.execute(
                "SELECT accident_time, part_of_day FROM accidents WHERE id = ?",
                (acc_id,),
            ).fetchone()
        assert row["accident_time"] == "17:30"
        assert row["part_of_day"] == "evening"


class TestScrapeLog:
    def test_start_and_finish_log(self):
        log_id = db.start_scrape_log()
        assert log_id >= 1
        db.finish_scrape_log(log_id, 10, 3, "completed")
        logs = db.get_scrape_logs(1)
        assert len(logs) == 1
        assert logs[0]["articles_found"] == 10
        assert logs[0]["articles_new"] == 3
        assert logs[0]["status"] == "completed"


class TestDailyStats:
    def test_empty_day(self):
        stats = db.get_daily_stats(date(2099, 1, 1))
        assert stats["total_accidents"] == 0
        assert stats["total_deaths"] == 0

    def test_stats_for_date(self):
        d = date(2025, 3, 15)
        aid = db.insert_article("https://x.com/3", "T", "C", d)
        db.insert_accident(article_id=aid, deaths=2, injuries=5,
                           accident_date=d, district="Dhaka",
                           accident_type="bus accident")
        stats = db.get_daily_stats(d)
        assert stats["total_accidents"] == 1
        assert stats["total_deaths"] == 2
        assert stats["total_injuries"] == 5


class TestMonthlyStats:
    def test_monthly(self):
        d = date(2025, 7, 10)
        aid = db.insert_article("https://x.com/4", "T", "C", d)
        db.insert_accident(article_id=aid, deaths=1, injuries=2,
                           accident_date=d, district="Khulna")
        stats = db.get_monthly_stats(2025, 7)
        assert stats["total_accidents"] == 1
        assert stats["total_deaths"] == 1


class TestDangerZones:
    def test_returns_grouped(self):
        aid = db.insert_article("https://x.com/5", "T", "C", date(2025, 1, 1))
        db.insert_accident(article_id=aid, district="Dhaka",
                           deaths=1, accident_date=date(2025, 1, 1))
        db.insert_accident(article_id=aid, district="Dhaka",
                           deaths=2, accident_date=date(2025, 1, 2))
        zones = db.get_danger_zones(5)
        assert len(zones) >= 1
        assert zones[0]["district"] == "Dhaka"
        assert zones[0]["total_accidents"] == 2


class TestRecentAccidents:
    def test_recent(self):
        aid = db.insert_article("https://x.com/6", "Hello", "C", date(2025, 1, 1))
        db.insert_accident(article_id=aid, district="Sylhet",
                           deaths=0, accident_date=date(2025, 1, 1))
        rows = db.get_recent_accidents(10)
        assert len(rows) == 1
        assert rows[0]["article_title"] == "Hello"


class TestMapData:
    def test_map_data_requires_coords(self):
        aid = db.insert_article("https://x.com/7", "T", "C", date(2025, 1, 1))
        # No lat/lon → should NOT appear
        db.insert_accident(article_id=aid, district="Dhaka",
                           accident_date=date(2025, 1, 1))
        data = db.get_all_accidents_for_map()
        assert len(data) == 0

    def test_map_data_with_coords(self):
        aid = db.insert_article("https://x.com/8", "T", "C", date(2025, 1, 1))
        db.insert_accident(article_id=aid, district="Dhaka",
                           latitude=23.81, longitude=90.41,
                           accident_date=date(2025, 1, 1))
        data = db.get_all_accidents_for_map()
        assert len(data) == 1


class TestYearlyOverview:
    def test_overview(self):
        aid = db.insert_article("https://x.com/9", "T", "C", date(2025, 5, 1))
        db.insert_accident(article_id=aid, deaths=1,
                           accident_date=date(2025, 5, 1))
        overview = db.get_yearly_overview()
        assert any(r["month"] == "2025-05" for r in overview)


# Needed for TestArticleCRUD.test_duplicate_url_raises
import pytest  # noqa: E402
