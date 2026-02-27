"""
FastAPI application factory.
Creates and configures the app instance.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app import database as db
from app.config import STATIC_DIR
from app.routes import router as api_router

logger = logging.getLogger(__name__)


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
    )

    # API routes
    application.include_router(api_router)

    # Static assets
    application.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    # Serve the SPA
    @application.get("/")
    async def serve_frontend():
        return FileResponse(f"{STATIC_DIR}/index.html")

    return application
