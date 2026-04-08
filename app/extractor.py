"""Compatibility wrapper for LLM-based extraction.

Regex extraction has been removed. This module now delegates to the OpenAI extractor.
"""
from __future__ import annotations

import logging
from datetime import datetime

from app import database as db
from app.llm.llm_extractor import LLMAccidentExtractor

logger = logging.getLogger(__name__)


class AccidentExtractor:
    """Backward-compatible name that delegates to LLM extraction."""

    def __init__(self):
        self._delegate = LLMAccidentExtractor()

    def process_article(self, article_id: int, content: str, published_date=None):
        """Extract and insert accident events for an article."""
        inserted_ids = self._delegate.process_article(article_id, content, published_date)
        return inserted_ids[0] if inserted_ids else None


def reprocess_all_articles() -> int:
    """Re-process all existing articles using the LLM extractor."""
    conn = db.get_connection()
    articles = conn.execute("SELECT id, content, published_date FROM articles").fetchall()
    conn.close()

    extractor = LLMAccidentExtractor()
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

    logger.info("Reprocessed %s/%s articles", processed, len(articles))
    return processed
