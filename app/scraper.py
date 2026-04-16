"""
Web scraper for New Age Bangladesh road-accident news.
Extracts article links, titles, and full content from the accident tag pages.
"""
import logging
import re
import time
from datetime import date, datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from app.config import (
    NEWS_SOURCE_ACCIDENT_URL,
    NEWS_SOURCE_BASE_URL,
    NEWS_SOURCE_NAME,
    MAX_PAGES_PER_SCRAPE,
    REQUEST_DELAY,
    REQUEST_TIMEOUT,
    USER_AGENT,
)
from app.database import (
    article_exists,
    finish_scrape_log,
    get_article_by_url,
    get_articles_missing_published_date,
    insert_article,
    start_scrape_log,
    sync_accident_dates_for_article,
    update_article_published_date,
)

logger = logging.getLogger(__name__)


class NewAgeScraper:
    """Scraper for New Age Bangladesh accident news."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        })

    def _fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch a page and return a parsed BeautifulSoup object."""
        try:
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except requests.RequestException as exc:
            logger.error("Failed to fetch %s: %s", url, exc)
            return None

    def _parse_date(self, date_str: str) -> Optional[date]:
        """Parse common New Age date representations into a date."""
        if not date_str:
            return None

        candidate = " ".join(date_str.strip().split())
        candidate = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", candidate, flags=re.IGNORECASE)
        candidate = candidate.replace("Published:", "").replace("Updated:", "").strip(" |,-")
        candidate = re.sub(r"\b([A-Za-z]+)\.?(\d{1,2},\s+\d{4})", r"\1 \2", candidate)

        formats = [
            "%d %B %Y, %H:%M %p",   # 19 February 2026, 12:08 PM  (Daily Star)
            "%d %B %Y, %H:%M",      # 19 February 2026, 12:08
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
            "%B %d, %Y",
            "%b %d, %Y",
            "%d %B %Y",
            "%d %b %Y",
            "%d %B, %Y",
            "%d %b, %Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%I:%M %p, %B %d, %Y",
            "%I:%M %p %B %d, %Y",
            "%H:%M, %B %d, %Y",
            "%H:%M %B %d, %Y",
            "%d %B %Y, %H:%M",
            "%d %b %Y, %H:%M",
            "%d %B, %Y, %H:%M",
            "%d %b, %Y, %H:%M",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(candidate, fmt).date()
            except ValueError:
                continue

        iso_match = re.search(r"(\d{4}-\d{2}-\d{2})", candidate)
        if iso_match:
            return datetime.strptime(iso_match.group(1), "%Y-%m-%d").date()

        textual_match = re.search(
            r"([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})",
            candidate,
        )
        if textual_match:
            for fmt in ("%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%d %b %Y"):
                try:
                    return datetime.strptime(textual_match.group(1), fmt).date()
                except ValueError:
                    continue

        # Regex fallbacks
        match = re.search(
            r"(\d{1,2})\s+(January|February|March|April|May|June|July|"
            r"August|September|October|November|December)\s+(\d{4})",
            candidate, re.IGNORECASE,
        )
        if match:
            try:
                return datetime.strptime(
                    f"{match.group(1)} {match.group(2)} {match.group(3)}",
                    "%d %B %Y",
                ).date()
            except ValueError:
                pass

        return None

    def _extract_date_from_text(self, text: str, anchor: Optional[str] = None) -> Optional[date]:
        """Extract a date from a focused text block near the article header."""
        if not text:
            return None

        candidate = " ".join(text.split())
        if anchor:
            anchor_text = " ".join(anchor.split())
            anchor_index = candidate.find(anchor_text)
            if anchor_index != -1:
                candidate = candidate[anchor_index + len(anchor_text):]

        # Keep the search window narrow so we do not accidentally parse
        # page-header or "Read More" dates from elsewhere in the document.
        candidate = candidate[:800]

        patterns = [
            r"\b(\d{1,2}\s+[A-Za-z]+,\s+\d{4},\s+\d{1,2}:\d{2})\b",
            r"\b([A-Za-z]+\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2})\b",
            r"(Published|Updated)\s*:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})",
            r"\b(\d{1,2}\s+[A-Za-z]+,\s+\d{4})\b",
            r"\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b",
            r"\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b",
        ]
        for pattern in patterns:
            match = re.search(pattern, candidate, re.IGNORECASE)
            if not match:
                continue
            captured = match.group(match.lastindex or 1)
            parsed = self._parse_date(captured)
            if parsed:
                return parsed

        return None

    def _extract_header_date(self, soup: BeautifulSoup) -> Optional[date]:
        """Extract the article publish date from the title/byline region."""
        title_tag = soup.select_one("h1")
        title_text = title_tag.get_text(" ", strip=True) if title_tag else None

        candidate_blocks: List[str] = []
        if title_tag:
            current = title_tag
            for _ in range(4):
                current = current.parent
                if current is None:
                    break
                text = current.get_text(" ", strip=True)
                if text and text not in candidate_blocks:
                    candidate_blocks.append(text)

            for sibling in title_tag.find_next_siblings(limit=5):
                text = sibling.get_text(" ", strip=True)
                if text and text not in candidate_blocks:
                    candidate_blocks.append(text)

        for selector in (
            "article",
            "main",
            "div.news-detail",
            "div.news-content",
            "div.detail-content",
            "div.post-content",
        ):
            tag = soup.select_one(selector)
            if not tag:
                continue
            text = tag.get_text(" ", strip=True)
            if text and text not in candidate_blocks:
                candidate_blocks.append(text)

        for block in candidate_blocks:
            parsed = self._extract_date_from_text(block, anchor=title_text)
            if parsed:
                return parsed

        return None

    def _extract_published_date(self, soup: BeautifulSoup) -> Optional[date]:
        """Extract article published date from page markup."""
        meta_selectors = [
            "meta[property='article:published_time']",
            "meta[property='og:published_time']",
            "meta[name='publish_date']",
            "meta[name='pubdate']",
            "meta[itemprop='datePublished']",
        ]
        for selector in meta_selectors:
            tag = soup.select_one(selector)
            if not tag:
                continue
            date_str = tag.get("content") or tag.get("datetime") or tag.get_text(" ", strip=True)
            parsed = self._parse_date(date_str)
            if parsed:
                return parsed

        header_date = self._extract_header_date(soup)
        if header_date:
            return header_date

        text_selectors = [
            "div.news-time",
            "div.post-date",
            "div.publish-time",
            "div.article-time",
            "span.news-date",
            "span.publish-date",
            "span.date",
            "p.date",
        ]
        for selector in text_selectors:
            tag = soup.select_one(selector)
            if not tag:
                continue
            parsed = self._extract_date_from_text(tag.get_text(" ", strip=True))
            if parsed:
                return parsed

        article_block = soup.select_one("article") or soup.select_one("main")
        if article_block:
            parsed = self._extract_date_from_text(article_block.get_text(" ", strip=True))
            if parsed:
                return parsed

        return None

    def get_article_links(self, page: int = 1) -> List[Dict]:
        """Get article links from a New Age accident tag page."""
        url = f"{NEWS_SOURCE_ACCIDENT_URL}?page={page}"
        logger.info("Fetching article list from: %s", url)
        soup = self._fetch_page(url)
        if not soup:
            return []

        articles: List[Dict] = []
        seen_urls: set[str] = set()
        for link in soup.select("a[href]"):
            href = (link.get("href") or "").strip()
            title = link.get_text(" ", strip=True)
            if not href or len(title) < 15:
                continue
            absolute_url = urljoin(NEWS_SOURCE_BASE_URL, href)
            if not any(
                token in absolute_url
                for token in ("/post/", "/article/", "/print/article/")
            ):
                continue
            if absolute_url in seen_urls:
                continue
            seen_urls.add(absolute_url)
            articles.append({"url": absolute_url, "title": title})

        logger.info("Found %s article links on page %s", len(articles), page)
        return articles

    def scrape_article(self, url: str) -> Optional[Dict]:
        """Scrape a single article page for its full content and metadata."""
        logger.info("Scraping article: %s", url)
        soup = self._fetch_page(url)
        if not soup:
            return None

        result: Dict = {"url": url}

        title_tag = (
            soup.select_one("h1")
            or soup.select_one("meta[property='og:title']")
            or soup.select_one("title")
        )
        if title_tag and title_tag.name == "meta":
            result["title"] = (title_tag.get("content") or "").strip()
        else:
            result["title"] = title_tag.get_text(" ", strip=True) if title_tag else ""

        result["published_date"] = self._extract_published_date(soup)

        content_parts: List[str] = []
        body_selectors = [
            "div.news-article-text",
            "div.news-content",
            "div.article-body",
            "div.detail-content",
            "div.post-content",
            "article",
        ]
        for selector in body_selectors:
            body = soup.select_one(selector)
            if not body:
                continue
            paragraphs = [
                p.get_text(" ", strip=True)
                for p in body.find_all("p")
                if p.get_text(" ", strip=True)
            ]
            if paragraphs:
                content_parts = paragraphs
                break

        if not content_parts:
            paragraphs = [
                p.get_text(" ", strip=True)
                for p in soup.find_all("p")
                if p.get_text(" ", strip=True) and len(p.get_text(" ", strip=True)) > 40
            ]
            content_parts = paragraphs

        result["content"] = "\n\n".join(content_parts)
        return result

    def run_scrape(self) -> Dict:
        """Run a full scrape cycle."""
        from app.extractor import AccidentExtractor

        log_id = start_scrape_log()
        total_found = 0
        total_new = 0
        extractor = AccidentExtractor()  # reuse one instance

        try:
            for page in range(1, MAX_PAGES_PER_SCRAPE + 1):
                article_links = self.get_article_links(page=page)
                total_found += len(article_links)

                if not article_links:
                    logger.info("No articles on page %s, stopping pagination", page)
                    break

                page_new = 0
                page_dupes = 0
                for article_info in article_links:
                    url = article_info["url"]
                    if article_exists(url):
                        existing = get_article_by_url(url)
                        if existing and existing.get("published_date") is None:
                            logger.info(
                                "Backfilling missing published_date for existing article %s",
                                existing["id"],
                            )
                            article_data = self.scrape_article(url)
                            if article_data and article_data.get("published_date"):
                                update_article_published_date(existing["id"], article_data["published_date"])
                                sync_accident_dates_for_article(existing["id"], article_data["published_date"])
                        page_dupes += 1
                        continue

                    time.sleep(REQUEST_DELAY)
                    article_data = self.scrape_article(url)
                    if article_data and article_data.get("content"):
                        # Use published_date from article, fall back to listing title hint, then None
                        pub_date = article_data.get("published_date")
                        if pub_date is None:
                            logger.warning(
                                f"Could not parse date for article: {url} — storing without date"
                            )

                        article_title = article_data.get("title", article_info["title"])
                        article_url = article_data["url"]

                        article_id = insert_article(
                            url=article_url,
                            title=article_title,
                            content=article_data["content"],
                            published_date=article_data.get("published_date"),
                            source=NEWS_SOURCE_NAME,
                        )
                        page_new += 1
                        total_new += 1
                        logger.info("Saved article #%s: %s", article_id, article_data.get("title", "")[:60])

                        extractor.process_article(
                            article_id,
                            article_data["content"],
                            pub_date,
                            title=article_title,
                            url=article_url,
                        )

                # Early termination: if all articles on this page were duplicates, stop
                if page_dupes > 0 and page_new == 0:
                    logger.info(
                        f"All {page_dupes} articles on page {page} already exist, "
                        f"stopping pagination early"
                    )
                    break

                time.sleep(REQUEST_DELAY)

            finish_scrape_log(log_id, total_found, total_new, "completed")
            logger.info("Scrape complete: %s found, %s new", total_found, total_new)
        except Exception as exc:
            logger.error("Scrape failed: %s", exc)
            try:
                finish_scrape_log(log_id, total_found, total_new, f"error: {str(exc)}")
            except Exception as log_exc:
                logger.error("Failed to finish scrape log: %s", log_exc)
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
    return NewAgeScraper().run_scrape()


def run_published_date_backfill(limit: Optional[int] = None):
    """Convenience function to backfill article published dates."""
    return NewAgeScraper().backfill_missing_published_dates(limit=limit)
