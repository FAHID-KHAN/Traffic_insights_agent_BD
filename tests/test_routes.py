"""Tests for API routes via the FastAPI TestClient (httpx)."""
import pytest
from datetime import date
from httpx import AsyncClient, ASGITransport
from app.server import create_app
from app import database as db


@pytest.fixture
def app():
    """Create a fresh FastAPI app for testing."""
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Seed helpers ────────────────────────────────────────────────

def _seed(n=3):
    """Insert n articles + accidents for testing."""
    for i in range(n):
        d = date(2025, 6, i + 1)
        aid = db.insert_article(
            f"https://example.com/a{i}", f"Article {i}", "content", d,
        )
        db.insert_accident(
            article_id=aid,
            accident_type="bus accident",
            district="Dhaka",
            division="Dhaka",
            latitude=23.81,
            longitude=90.41,
            deaths=i + 1,
            injuries=(i + 1) * 2,
            accident_date=d,
            accident_time=f"{8 + i:02d}:30",
            part_of_day="morning",
            summary=f"Test accident {i}",
        )


def _seed_road(road_name, deaths=1, injuries=0, district="Sylhet"):
    aid = db.insert_article(
        f"https://example.com/road-{road_name}-{deaths}-{injuries}",
        f"Article {road_name}",
        "content",
        date(2025, 6, 1),
    )
    db.insert_accident(
        article_id=aid,
        accident_type="bus accident",
        district=district,
        division="Sylhet",
        latitude=24.89,
        longitude=91.86,
        deaths=deaths,
        injuries=injuries,
        road_name=road_name,
        accident_date=date(2025, 6, 1),
        summary="Test road accident",
    )


# ── Tests ───────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestOverview:
    async def test_overview_empty(self, client):
        r = await client.get("/api/overview")
        assert r.status_code == 200
        data = r.json()
        assert data["total_accidents"] == 0

    async def test_overview_with_data(self, client):
        _seed(2)
        r = await client.get("/api/overview")
        assert r.status_code == 200
        data = r.json()
        assert data["total_accidents"] == 2
        assert data["total_deaths"] == 3  # 1 + 2

    async def test_overview_date_range(self, client):
        _seed(3)
        r = await client.get("/api/overview?start=2025-06-01&end=2025-06-02")
        assert r.status_code == 200
        data = r.json()
        assert data["total_accidents"] == 2


@pytest.mark.asyncio
class TestDaily:
    async def test_daily(self, client):
        _seed(1)
        r = await client.get("/api/daily?date=2025-06-01")
        assert r.status_code == 200
        data = r.json()
        assert data["total_accidents"] == 1

    async def test_daily_bad_format(self, client):
        r = await client.get("/api/daily?date=not-a-date")
        assert r.status_code == 400


@pytest.mark.asyncio
class TestMonthly:
    async def test_monthly(self, client):
        _seed(2)
        r = await client.get("/api/monthly?year=2025&month=6")
        assert r.status_code == 200
        data = r.json()
        assert data["total_accidents"] == 2


@pytest.mark.asyncio
class TestDangerZones:
    async def test_zones(self, client):
        _seed(2)
        r = await client.get("/api/danger-zones?limit=5")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    async def test_zones_date_range(self, client):
        _seed(3)
        r = await client.get("/api/danger-zones?start=2025-06-01&end=2025-06-02&limit=5")
        assert r.status_code == 200


@pytest.mark.asyncio
class TestRoadAnalysis:
    async def test_roads_aggregates_canonical_duplicates(self, client):
        _seed_road("Dhaka-Sylhet Highway", deaths=1, injuries=2)
        _seed_road("Dhaka-Sylhet highway", deaths=2, injuries=3)

        r = await client.get("/api/roads?limit=10")

        assert r.status_code == 200
        data = r.json()
        road = next(item for item in data if item["road_name"] == "Dhaka-Sylhet Highway")
        assert road["accidents"] == 2
        assert road["deaths"] == 3
        assert road["injuries"] == 5
        assert len([item for item in data if "Dhaka-Sylhet" in item["road_name"]]) == 1

    async def test_backfill_road_names_dry_run_and_apply(self, client, monkeypatch):
        import app.routes as routes

        monkeypatch.setattr(routes, "ADMIN_API_KEY", "test-key")
        _seed_road("Dhaka–Chattogram highway", deaths=1, district="Feni")

        dry_run = await client.post(
            "/api/backfill-road-names?dry_run=true",
            headers={"x-admin-key": "test-key"},
        )

        assert dry_run.status_code == 200
        dry_result = dry_run.json()["result"]
        assert dry_result["dry_run"] is True
        assert dry_result["changed"] == 1
        assert dry_result["sample"][0]["after"] == "Dhaka-Chattogram Highway"
        assert db.get_recent_accidents(1)[0]["road_name"] == "Dhaka–Chattogram highway"

        applied = await client.post(
            "/api/backfill-road-names?dry_run=false",
            headers={"x-admin-key": "test-key"},
        )

        assert applied.status_code == 200
        apply_result = applied.json()["result"]
        assert apply_result["dry_run"] is False
        assert apply_result["changed"] == 1
        assert db.get_recent_accidents(1)[0]["road_name"] == "Dhaka-Chattogram Highway"


@pytest.mark.asyncio
class TestRecent:
    async def test_recent(self, client):
        _seed(5)
        r = await client.get("/api/recent?limit=3")
        assert r.status_code == 200
        assert len(r.json()) == 3


@pytest.mark.asyncio
class TestMapData:
    async def test_map_with_coords(self, client):
        _seed(1)
        r = await client.get("/api/map-data")
        assert r.status_code == 200
        assert len(r.json()) == 1


@pytest.mark.asyncio
class TestYearly:
    async def test_yearly(self, client):
        _seed(1)
        r = await client.get("/api/yearly")
        assert r.status_code == 200


@pytest.mark.asyncio
class TestSearch:
    async def test_search(self, client):
        _seed(2)
        r = await client.get("/api/search?q=Dhaka")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    async def test_search_advanced(self, client):
        _seed(2)
        r = await client.get("/api/search/advanced?district=Dhaka")
        assert r.status_code == 200
        assert len(r.json()) >= 1


@pytest.mark.asyncio
class TestTrend:
    async def test_trend_all(self, client):
        _seed(3)
        r = await client.get("/api/trend")
        assert r.status_code == 200

    async def test_trend_days(self, client):
        r = await client.get("/api/trend?days=30")
        assert r.status_code == 200

    async def test_trend_date_range(self, client):
        r = await client.get("/api/trend?start=2025-01-01&end=2025-12-31")
        assert r.status_code == 200


@pytest.mark.asyncio
class TestCompare:
    async def test_compare_monthly(self, client):
        r = await client.get("/api/compare/monthly?month=6&year1=2024&year2=2025")
        assert r.status_code == 200
        data = r.json()
        assert "2024" in data
        assert "2025" in data

    async def test_compare_yearly(self, client):
        r = await client.get("/api/compare/yearly?year1=2024&year2=2025")
        assert r.status_code == 200


@pytest.mark.asyncio
class TestDivisions:
    async def test_divisions(self, client):
        _seed(2)
        r = await client.get("/api/divisions")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert "districts" in data[0]


@pytest.mark.asyncio
class TestDangerIndex:
    async def test_danger_index(self, client):
        _seed(3)
        r = await client.get("/api/danger-index")
        assert r.status_code == 200


@pytest.mark.asyncio
class TestAlerts:
    async def test_high_severity(self, client):
        r = await client.get("/api/alerts/high-severity?days=30&min_deaths=1")
        assert r.status_code == 200


@pytest.mark.asyncio
class TestForecast:
    async def test_forecast(self, client):
        r = await client.get("/api/forecast?months=6&forecast_months=3")
        assert r.status_code == 200
        data = r.json()
        assert "history" in data
        assert "forecast" in data


@pytest.mark.asyncio
class TestTimePatterns:
    async def test_time_patterns(self, client):
        _seed(2)
        r = await client.get("/api/time-patterns")
        assert r.status_code == 200
        data = r.json()
        assert "by_dow" in data
        assert "by_month" in data
        assert "by_part_of_day" in data
        assert "by_hour" in data
        assert data["by_part_of_day"][0]["part_of_day"] == "morning"
        assert data["by_hour"][0]["hour"] == 8


@pytest.mark.asyncio
class TestClusters:
    async def test_clusters(self, client):
        r = await client.get("/api/clusters?window_days=7&min_accidents=2")
        assert r.status_code == 200


@pytest.mark.asyncio
class TestYOY:
    async def test_yoy_summary(self, client):
        r = await client.get("/api/yoy-summary")
        assert r.status_code == 200
        data = r.json()
        assert "ytd_delta" in data


@pytest.mark.asyncio
class TestExportCSV:
    async def test_export_csv(self, client):
        _seed(2)
        r = await client.get("/api/export/csv")
        assert r.status_code == 200
        assert "text/csv" in r.headers["content-type"]
        lines = r.text.strip().split("\n")
        assert len(lines) >= 2  # header + at least 1 row

    async def test_export_csv_filtered(self, client):
        _seed(2)
        r = await client.get("/api/export/csv?district=Dhaka")
        assert r.status_code == 200


@pytest.mark.asyncio
class TestScrapeLogEndpoint:
    async def test_scrape_logs(self, client):
        db.start_scrape_log()
        r = await client.get("/api/scrape-logs")
        assert r.status_code == 200
        assert len(r.json()) >= 1


@pytest.mark.asyncio
class TestLatestArticles:
    async def test_latest_articles(self, client):
        _seed(2)
        r = await client.get("/api/articles/latest?limit=5")
        assert r.status_code == 200
