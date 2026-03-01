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
from app.database import (
    article_exists,
    insert_article,
    start_scrape_log,
    finish_scrape_log,
    get_article_by_url,
    get_articles_missing_published_date,
    update_article_published_date,
    sync_accident_dates_for_article,
)

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

        date_str = " ".join(date_str.strip().split())
        # Source pages occasionally render invalid hybrid times ("18:03 PM").
        # Drop AM/PM for 24h values so date parsing can still succeed.
        date_str = re.sub(
            r"\b(1[3-9]|2[0-3]):([0-5]\d)\s*(AM|PM)\b",
            r"\1:\2",
            date_str,
            flags=re.IGNORECASE,
        )
        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
            "%d %B %Y, %I:%M %p",
            "%d %b %Y, %I:%M %p",
            "%d %B %Y, %H:%M",
            "%d %b %Y, %H:%M",
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

        # Explicit fallback for the most common rendered timestamp format.
        textual_match = re.search(
            r"(\d{1,2}\s+[A-Za-z]+\s+\d{4},\s+\d{1,2}:\d{2}\s*(?:AM|PM))",
            date_str,
            re.IGNORECASE,
        )
        if textual_match:
            candidate = textual_match.group(1)
            for fmt in ("%d %B %Y, %I:%M %p", "%d %b %Y, %I:%M %p"):
                try:
                    return datetime.strptime(candidate, fmt).date()
                except ValueError:
                    continue
        return None

    def _extract_published_date(self, soup: BeautifulSoup) -> Optional[date]:
        """Extract article published date from page markup."""
        # Primary path: article header block used on the current site template.
        primary = soup.select_one(
            "div.mb-\\[14px\\].flex.items-start.gap-\\[16px\\] span.text-gray-600.font-medium"
        )
        if primary:
            primary_text = primary.get_text(" ", strip=True)
            # Same block can include "UPDATED ..."; keep the first token so
            # analytics and accident_date stay tied to original publish time.
            datetime_token = re.search(
                r"(\d{1,2}\s+[A-Za-z]+\s+\d{4},\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)",
                primary_text,
                re.IGNORECASE,
            )
            candidate = datetime_token.group(1) if datetime_token else primary_text
            parsed = self._parse_date(candidate)
            if parsed:
                return parsed

        # Metadata fallbacks handle legacy/alternate article templates.
        date_selectors = [
            "time[datetime]",
            "meta[property='article:published_time']",
            "meta[property='og:published_time']",
            "meta[name='publishdate']",
            "meta[itemprop='datePublished']",
            "span.date",
            "div.date",
            "div.author-info time",
            "div.published-at",
        ]
        for selector in date_selectors:
            tag = soup.select_one(selector)
            if not tag:
                continue
            date_str = tag.get("datetime") or tag.get("content") or tag.get_text(" ", strip=True)
            parsed = self._parse_date(date_str)
            if parsed:
                return parsed

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
        pub_date = self._extract_published_date(soup)
        # Keep unknown source publish dates as NULL to avoid false "today" analytics spikes.
        result["published_date"] = pub_date

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
                        existing = get_article_by_url(url)
                        # Existing URLs are skipped for insertion, but we still
                        # repair missing published_date and re-sync accident dates.
                        if existing and existing.get("published_date") is None:
                            logger.info("Backfilling missing published_date for existing article %s", existing["id"])
                            article_data = self.scrape_article(url)
                            if article_data and article_data.get("published_date"):
                                update_article_published_date(existing["id"], article_data["published_date"])
                                sync_accident_dates_for_article(existing["id"], article_data["published_date"])
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

    def backfill_missing_published_dates(self, limit: Optional[int] = None) -> Dict:
        """Backfill published dates for existing articles and sync accident dates."""
        missing_articles = get_articles_missing_published_date(limit=limit)
        scanned = 0
        updated = 0

        for article in missing_articles:
            scanned += 1
            article_data = self.scrape_article(article["url"])
            if article_data and article_data.get("published_date"):
                # Ensure both tables use the same canonical publish day.
                update_article_published_date(article["id"], article_data["published_date"])
                sync_accident_dates_for_article(article["id"], article_data["published_date"])
                updated += 1
            time.sleep(REQUEST_DELAY)

        return {
            "missing_found": len(missing_articles),
            "scanned": scanned,
            "updated": updated,
            "still_missing": len(missing_articles) - updated,
        }


def run_scraper():
    """Convenience function to run the scraper."""
    return DailyStarScraper().run_scrape()


def run_published_date_backfill(limit: Optional[int] = None):
    """Convenience function to backfill article published dates."""
    return DailyStarScraper().backfill_missing_published_dates(limit=limit)
