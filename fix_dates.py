#!/usr/bin/env python3
"""
One-time migration: re-fetch the correct published_date for every article
already in the database, and update the corresponding accident records.
"""
import sys
import os
import time
import re
import sqlite3
import requests
from datetime import datetime, date
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import DB_PATH, USER_AGENT, REQUEST_DELAY

def parse_date(date_str):
    if not date_str:
        return None
    date_str = date_str.strip()
    formats = [
        "%d %B %Y, %H:%M %p",
        "%d %B %Y, %H:%M",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%B %d, %Y",
        "%d %B %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except (ValueError, IndexError):
            continue
    m = re.search(
        r"(\d{1,2})\s+(January|February|March|April|May|June|July|"
        r"August|September|October|November|December)\s+(\d{4})",
        date_str, re.IGNORECASE,
    )
    if m:
        try:
            return datetime.strptime(
                f"{m.group(1)} {m.group(2)} {m.group(3)}", "%d %B %Y"
            ).date()
        except ValueError:
            pass
    return None


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    articles = conn.execute("SELECT id, url, published_date FROM articles ORDER BY id").fetchall()
    print(f"Found {len(articles)} articles to re-check.\n")

    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
    })

    updated = 0
    failed = 0

    for art in articles:
        art_id = art["id"]
        url = art["url"]
        old_date = art["published_date"]

        try:
            r = session.get(url, timeout=15)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")

            new_date = None

            # Strategy 1: <span class="text-gray-600 font-medium">
            tag = soup.select_one("span.text-gray-600.font-medium")
            if tag:
                new_date = parse_date(tag.get_text(strip=True))

            # Strategy 2: JSON-LD
            if not new_date:
                for script in soup.find_all("script", {"type": "application/ld+json"}):
                    text = script.string or ""
                    m = re.search(r'"datePublished"\s*:\s*"([^"]+)"', text)
                    if m:
                        new_date = parse_date(m.group(1))
                        if new_date:
                            break

            if new_date and str(new_date) != str(old_date):
                conn.execute(
                    "UPDATE articles SET published_date = ? WHERE id = ?",
                    (new_date.isoformat(), art_id),
                )
                conn.execute(
                    "UPDATE accidents SET accident_date = ? WHERE article_id = ?",
                    (new_date.isoformat(), art_id),
                )
                conn.commit()
                updated += 1
                print(f"  [{updated}] Article #{art_id}: {old_date} -> {new_date}  ({url.split('/')[-1][:50]})")
            else:
                if new_date:
                    print(f"  [skip] Article #{art_id}: date already correct ({new_date})")
                else:
                    failed += 1
                    print(f"  [FAIL] Article #{art_id}: could not extract date ({url.split('/')[-1][:50]})")

        except Exception as e:
            failed += 1
            print(f"  [ERR] Article #{art_id}: {e}")

        time.sleep(REQUEST_DELAY)

    conn.close()
    print(f"\nDone. Updated: {updated}, Failed: {failed}, Total: {len(articles)}")


if __name__ == "__main__":
    main()
