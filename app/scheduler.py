"""
Scheduler for periodic scraping using APScheduler.
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.config import SCRAPE_INTERVAL_HOURS

logger = logging.getLogger(__name__)


def _scheduled_scrape():
    """Run the scraper as a scheduled job."""
    try:
        from app.scraper import run_scraper
        logger.info("=== Scheduled scrape starting ===")
        result = run_scraper()
        logger.info(f"=== Scheduled scrape complete: {result} ===")
    except Exception as e:
        logger.error(f"Scheduled scrape failed: {e}")


def start_scheduler() -> BackgroundScheduler:
    """Start the background scheduler for periodic scraping."""
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _scheduled_scrape,
        trigger=IntervalTrigger(hours=SCRAPE_INTERVAL_HOURS),
        id="scrape_daily_star",
        name="Scrape The Daily Star for accident news",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    logger.info(f"Scheduler started: scraping every {SCRAPE_INTERVAL_HOURS} hours")
    return scheduler
