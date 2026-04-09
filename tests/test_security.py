"""Tests for rate limiting and security headers."""
import pytest
from unittest.mock import patch, MagicMock
from httpx import AsyncClient, ASGITransport
from app.server import create_app
from app import database as db
from app.rate_limit import RateLimiter


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ── Security Headers ────────────────────────────────────────────

@pytest.mark.asyncio
class TestSecurityHeaders:
    async def test_x_content_type_options(self, client):
        r = await client.get("/api/overview")
        assert r.headers.get("x-content-type-options") == "nosniff"

    async def test_x_frame_options(self, client):
        r = await client.get("/api/overview")
        assert r.headers.get("x-frame-options") == "DENY"

    async def test_referrer_policy(self, client):
        r = await client.get("/api/overview")
        assert r.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    async def test_content_security_policy(self, client):
        r = await client.get("/api/overview")
        csp = r.headers.get("content-security-policy", "")
        assert "default-src 'self'" in csp
        assert "script-src 'self'" in csp
        assert "object-src 'none'" in csp

    async def test_permissions_policy(self, client):
        r = await client.get("/api/overview")
        pp = r.headers.get("permissions-policy", "")
        assert "camera=()" in pp


# ── Rate Limiting ───────────────────────────────────────────────

@pytest.mark.asyncio
class TestRateLimiting:
    async def test_scrape_endpoint_rate_limited(self, app):
        """POST /api/scrape should return 429 after 3 rapid calls."""
        from app.rate_limit import scrape_limiter
        scrape_limiter._hits.clear()

        # Build a lightweight app without the lifespan (no scheduler)
        from fastapi import FastAPI
        from app.routes import router as api_router
        test_app = FastAPI()
        test_app.include_router(api_router)

        transport = ASGITransport(app=test_app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            with patch("app.routes.run_scraper", return_value={"total_found": 0, "total_new": 0}):
                headers = {"X-Admin-Key": "test-key"}
                with patch("app.routes.ADMIN_API_KEY", "test-key"):
                    for _ in range(3):
                        r = await c.post("/api/scrape", headers=headers)
                        assert r.status_code == 200

                    r = await c.post("/api/scrape", headers=headers)
                    assert r.status_code == 429
                    assert "Retry-After" in r.headers
                    assert "Rate limit" in r.json()["detail"]

    def test_rate_limiter_unit(self):
        """Direct unit test of the RateLimiter without hitting any route."""
        limiter = RateLimiter(max_calls=2, window_seconds=60)
        mock_request = MagicMock()
        mock_request.headers = {}
        mock_request.client.host = "127.0.0.1"

        # First 2 calls allowed
        allowed1, _ = limiter.check(mock_request)
        assert allowed1 is True
        allowed2, _ = limiter.check(mock_request)
        assert allowed2 is True

        # 3rd blocked
        allowed3, retry = limiter.check(mock_request)
        assert allowed3 is False
        assert retry > 0
