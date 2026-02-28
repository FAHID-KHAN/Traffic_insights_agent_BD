"""
FastAPI application factory.
Creates and configures the app instance.
"""
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app import database as db
from app.config import STATIC_DIR, APP_ENV, DEBUG, LOG_LEVEL, CORS_ORIGINS
from app.routes import router as api_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        # HSTS — only in production to avoid dev issues
        if APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        # CSP — allow inline styles (needed for Leaflet/Chart.js),
        # restrict scripts to self + CDN, images to self + tile servers
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https://*.tile.openstreetmap.org https://img.youtube.com; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-src https://www.youtube.com; "
            "object-src 'none'; "
            "base-uri 'self'"
        )
        return response

# Configure logging based on environment
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# React production build directory
REACT_DIST = os.path.join(STATIC_DIR, "dist")


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup / shutdown lifecycle."""
    db.init_db()
    logger.info("Database initialized")

    from app.scheduler import start_scheduler
    scheduler = start_scheduler()
    logger.info("Scheduler started")

    yield

    if scheduler:
        scheduler.shutdown()
    logger.info("Application shutdown")


def create_app() -> FastAPI:
    """Build and return the configured FastAPI instance."""
    application = FastAPI(
        title="Traffic Insights Agent - Bangladesh",
        description="Real-time accident data analysis from The Daily Star Bangladesh",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if DEBUG else None,
        redoc_url="/redoc" if DEBUG else None,
    )

    # CORS middleware
    origins = [o.strip() for o in CORS_ORIGINS.split(",")]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security headers
    application.add_middleware(SecurityHeadersMiddleware)

    # API routes
    application.include_router(api_router)

    # React production build assets (JS/CSS bundles)
    assets_dir = os.path.join(REACT_DIST, "assets")
    if os.path.isdir(assets_dir):
        application.mount("/assets", StaticFiles(directory=assets_dir), name="react-assets")

    # SPA catch-all: serve React index.html for all non-API routes
    @application.get("/{path:path}")
    async def serve_react_spa(path: str = ""):
        index_path = os.path.join(REACT_DIST, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Frontend not built yet. "
                          "Run 'cd frontend && npm run build' first, "
                          "or use the API at /api/ and /docs."
            },
        )

    return application
