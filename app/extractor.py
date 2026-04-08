"""Smart extraction router — uses advanced (LLM) when available, falls back to standard (regex)."""
from __future__ import annotations

import logging
from datetime import datetime

from app import database as db
from app.config import OPENAI_API_KEY
from app.regex_extractor import RegexAccidentExtractor

logger = logging.getLogger(__name__)

# ── Extraction mode detection ────────────────────────────────
_extraction_mode: str = "standard"  # default: regex

try:
    if OPENAI_API_KEY:
        from app.llm.llm_extractor import LLMAccidentExtractor
        _extraction_mode = "advanced"
        logger.info("Extraction mode: advanced (LLM pipeline available)")
    else:
        logger.info("Extraction mode: standard (no API key configured)")
except Exception as exc:
    logger.warning("Could not initialise advanced extractor: %s — using standard mode", exc)


def get_extraction_mode() -> str:
    """Return current extraction mode label: 'advanced' or 'standard'."""
    return _extraction_mode


class AccidentExtractor:
    """Auto-selects advanced or standard extraction based on available keys."""

    def __init__(self):
        if _extraction_mode == "advanced":
            self._delegate = LLMAccidentExtractor()
        else:
            self._delegate = RegexAccidentExtractor()

    def process_article(self, article_id: int, content: str, published_date=None):
        """Extract and insert accident events for an article."""
        inserted_ids = self._delegate.process_article(article_id, content, published_date)
        return inserted_ids[0] if inserted_ids else None


def reprocess_all_articles() -> int:
    """Re-process all existing articles using the active extractor."""
    with db.get_db() as conn:
        articles = conn.execute("SELECT id, content, published_date FROM articles").fetchall()

    if _extraction_mode == "advanced":
        extractor = LLMAccidentExtractor()
    else:
        extractor = RegexAccidentExtractor()

    processed = 0

    for article in articles:
        pub_date = None
        if article["published_date"]:
            try:
                pub_date = datetime.strptime(article["published_date"], "%Y-%m-%d").date()
            except (ValueError, TypeError):
                pub_date = None

        inserted = extractor.process_article(article["id"], article["content"], pub_date)
        if inserted:
            processed += 1

    logger.info("Reprocessed %s/%s articles (%s mode)", processed, len(articles), _extraction_mode)
    return processed
