"""
Web scraper for The Daily Star Bangladesh — Accident / Road Crash news.
Extracts article links, titles, and full content from the accident tag page.
"""
import re
import time
import logging
import requests
from bs4 import BeautifulSoup
from datetime import datetime, date
from typing import List, Dict, Optional

from app.config import (
    DAILY_STAR_BASE_URL, DAILY_STAR_ACCIDENT_URL,
    USER_AGENT, REQUEST_TIMEOUT, REQUEST_DELAY, MAX_PAGES_PER_SCRAPE,
)
from app.database import article_exists, insert_article, start_scrape_log, finish_scrape_log

logger = logging.getLogger(__name__)


class DailyStarScraper:
    """Scraper for The Daily Star Bangladesh accident news."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        })

    # ── internal helpers ────────────────────────────────────────

    def _fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch a page and return parsed BeautifulSoup object."""
        try:
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except requests.RequestException as e:
            logger.error(f"Failed to fetch {url}: {e}")
            return None

    def _parse_date(self, date_str: str) -> Optional[date]:
        """Try to parse various date formats from The Daily Star."""
        if not date_str:
            return None

        date_str = date_str.strip()
        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
            "%B %d, %Y",
            "%b %d, %Y",
            "%d %B %Y",
            "%d %b %Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except (ValueError, IndexError):
                continue

        match = re.search(r"(\d{4})-(\d{2})-(\d{2})", date_str)
        if match:
            try:
                return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except ValueError:
                pass
        return None

    # ── public methods ──────────────────────────────────────────

    def get_article_links(self, page: int = 0) -> List[Dict]:
        """Get article links from the accident tag listing page."""
        url = DAILY_STAR_ACCIDENT_URL
        if page > 0:
            url = f"{url}?page={page}"

        logger.info(f"Fetching article list from: {url}")
        soup = self._fetch_page(url)
        if not soup:
            return []

        articles = []
        selectors = [
            "div.card a", "h3 a", "h2 a",
            "div.list-content a", "article a", "div.media-body a",
            "div.row div a[href*='/news/']",
            "a[href*='/news/bangladesh/']",
            "a[href*='/road-accident']",
        ]

        seen_urls: set = set()
        for selector in selectors:
            for link in soup.select(selector):
                href = link.get("href", "")
                title = link.get_text(strip=True)
                if not href or not title or len(title) < 15:
                    continue
                if href.startswith("/"):
                    href = DAILY_STAR_BASE_URL + href
                elif not href.startswith("http"):
                    continue
                if "/news/" not in href and "/city/" not in href:
                    continue
                if href not in seen_urls:
                    seen_urls.add(href)
                    articles.append({"url": href, "title": title})

        logger.info(f"Found {len(articles)} article links on page {page}")
        return articles

    def scrape_article(self, url: str) -> Optional[Dict]:
        """Scrape a single article page for its full content and metadata."""
        logger.info(f"Scraping article: {url}")
        soup = self._fetch_page(url)
        if not soup:
            return None

        result: Dict = {"url": url}

        # Title
        title_tag = soup.select_one("h1") or soup.select_one("h1.title")
        result["title"] = title_tag.get_text(strip=True) if title_tag else ""

        # Published date
        date_tag = (
            soup.select_one("time[datetime]")
            or soup.select_one("meta[property='article:published_time']")
            or soup.select_one("span.date")
            or soup.select_one("div.date")
            or soup.select_one("div.author-info time")
            or soup.select_one("div.published-at")
        )
        pub_date = None
        if date_tag:
            date_str = date_tag.get("datetime") or date_tag.get("content") or date_tag.get_text(strip=True)
            pub_date = self._parse_date(date_str)
        result["published_date"] = pub_date or date.today()

        # Article body
        body_selectors = [
            "div.field-body", "div.article-body", "div.node-body",
            "div.field--name-body", "article div.field-items",
            "div.content-details", "div.article-content",
        ]
        content_parts: List[str] = []
        for selector in body_selectors:
            body = soup.select_one(selector)
            if body:
                paragraphs = body.find_all("p")
                content_parts = (
                    [p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)]
                    if paragraphs
                    else [body.get_text(strip=True)]
                )
                break

        if not content_parts:
            content_parts = [
                p.get_text(strip=True)
                for p in soup.find_all("p")
                if p.get_text(strip=True) and len(p.get_text(strip=True)) > 40
            ]

        result["content"] = "\n\n".join(content_parts)
        return result

    def run_scrape(self) -> Dict:
        """Run a full scrape cycle."""
        log_id = start_scrape_log()
        total_found = 0
        total_new = 0

        try:
            for page in range(MAX_PAGES_PER_SCRAPE):
                article_links = self.get_article_links(page=page)
                total_found += len(article_links)

                if not article_links:
                    logger.info(f"No articles on page {page}, stopping pagination")
                    break

                for article_info in article_links:
                    url = article_info["url"]
                    if article_exists(url):
                        continue

                    time.sleep(REQUEST_DELAY)
                    article_data = self.scrape_article(url)
                    if article_data and article_data.get("content"):
                        article_id = insert_article(
                            url=article_data["url"],
                            title=article_data.get("title", article_info["title"]),
                            content=article_data["content"],
                            published_date=article_data.get("published_date"),
                        )
                        total_new += 1
                        logger.info(f"Saved article #{article_id}: {article_data.get('title', '')[:60]}")

                        from app.llm.llm_extractor import LLMAccidentExtractor
                        LLMAccidentExtractor().process_article(
                            article_id,
                            article_data["content"],
                            article_data.get("published_date"),
                        )

                time.sleep(REQUEST_DELAY)

            finish_scrape_log(log_id, total_found, total_new, "completed")
            logger.info(f"Scrape complete: {total_found} found, {total_new} new")

        except Exception as e:
            logger.error(f"Scrape failed: {e}")
            finish_scrape_log(log_id, total_found, total_new, f"error: {str(e)}")
            raise

        return {"total_found": total_found, "total_new": total_new}


def run_scraper():
    """Convenience function to run the scraper."""
    return DailyStarScraper().run_scrape()
