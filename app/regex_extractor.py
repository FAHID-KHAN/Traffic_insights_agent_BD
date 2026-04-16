"""Regex-based accident data extractor — zero-dependency fallback.

Works offline without any API key. Uses pattern matching to extract
accident type, location, casualties, and vehicles from article text.
"""
from __future__ import annotations

import logging
import re
from datetime import date
from typing import Dict, List, Optional

from app.config import BANGLADESH_DISTRICTS, BANGLADESH_DIVISIONS
from app.database import insert_accident
from app.geo import DISTRICT_COORDINATES, district_to_division
from app.normalize import normalize_district

logger = logging.getLogger(__name__)


class RegexAccidentExtractor:
    """Extract structured accident data using regex patterns."""

    def process_article(
        self,
        article_id: int,
        content: str,
        published_date: Optional[date] = None,
        title: Optional[str] = None,
        url: Optional[str] = None,
    ) -> list[int]:
        """Extract accident data and insert rows. Returns list of inserted IDs."""
        if not content or len(content.strip()) < 50:
            return []

        accident_keywords = [
            "killed", "died", "dead", "death", "injured",
            "accident", "crash", "collision", "overturn",
            "hit", "struck", "plunged", "crushed", "drowned",
            "capsize", "derail",
        ]
        if not any(kw in content.lower() for kw in accident_keywords):
            logger.info("Article %s: no accident keywords found, skipping", article_id)
            return []

        accident_type = self._extract_accident_type(content)
        location = self._extract_location(content)
        casualties = self._extract_casualties(content)
        vehicles = self._extract_vehicles(content)
        summary = self._generate_summary(content)

        district = normalize_district(location.get("district"))
        division = location.get("division") or (
            district_to_division(district) if district else None
        )
        lat, lon = DISTRICT_COORDINATES.get(district, (None, None)) if district else (None, None)

        accident_id = insert_accident(
            article_id=article_id,
            accident_type=accident_type,
            location_raw=location.get("raw", ""),
            district=district,
            division=division,
            latitude=lat,
            longitude=lon,
            deaths=casualties.get("deaths", 0),
            injuries=casualties.get("injuries", 0),
            vehicles_involved=vehicles,
            accident_date=published_date,
            summary=summary,
        )
        logger.info(
            "Regex extracted accident #%s from article #%s: type=%s, loc=%s, "
            "deaths=%s, injuries=%s",
            accident_id, article_id, accident_type, district,
            casualties.get("deaths", 0), casualties.get("injuries", 0),
        )
        return [accident_id]

    # ── Private helpers ─────────────────────────────────────────

    def _extract_accident_type(self, content: str) -> str:
        cl = content.lower()
        type_priority = [
            ("train accident", ["train accident", "train crash", "rail accident", "derail", "train collid"]),
            ("boat accident", ["boat capsize", "boat sank", "launch capsize", "launch accident", "ferry accident", "boat accident", "trawler capsize"]),
            ("hit-and-run", ["hit-and-run", "hit and run", "fled the scene", "fled after hitting"]),
            ("head-on collision", ["head-on collision", "head on collision", "head-on crash"]),
            ("bus accident", ["bus accident", "bus crash", "bus overturn", "bus collid", "bus fell", "bus plunge"]),
            ("truck accident", ["truck accident", "truck crash", "truck overturn", "truck collid", "covered van"]),
            ("motorcycle accident", ["motorcycle accident", "motorbike", "bike accident", "motorcycle crash", "bike crash"]),
            ("auto-rickshaw accident", ["auto-rickshaw", "cng", "three-wheeler", "auto rickshaw"]),
            ("rickshaw accident", ["rickshaw accident", "rickshaw crash", "van puller"]),
            ("car accident", ["car accident", "car crash", "private car", "microbus", "sedan"]),
            ("pedestrian accident", ["pedestrian", "walking", "crossing the road", "hit while crossing"]),
            ("vehicle fire", ["vehicle fire", "caught fire", "bus fire", "truck fire"]),
            ("road accident", ["road accident", "road crash", "highway accident", "highway crash"]),
            ("collision", ["collision", "collided", "crashed into"]),
            ("overturn", ["overturn", "overturned", "fell off", "plunged"]),
        ]
        for type_name, keywords in type_priority:
            if any(kw in cl for kw in keywords):
                return type_name
        return "road accident"

    def _extract_location(self, content: str) -> Dict:
        result: Dict = {"raw": "", "district": None, "division": None}

        found_districts: List[str] = []
        for district in BANGLADESH_DISTRICTS:
            if re.search(r"\b" + re.escape(district) + r"\b", content, re.IGNORECASE):
                found_districts.append(district)

        if found_districts:
            specific = [d for d in found_districts if d not in BANGLADESH_DIVISIONS]
            result["district"] = specific[0] if specific else found_districts[0]

        for division in BANGLADESH_DIVISIONS:
            if re.search(r"\b" + re.escape(division) + r"\b", content, re.IGNORECASE):
                result["division"] = division
                break

        if result["district"] and not result["division"]:
            result["division"] = district_to_division(result["district"])

        location_patterns = [
            r"(?:in|at|near|on|from)\s+([A-Z][a-zA-Z\s]+(?:highway|road|bridge|area|district|upazila|union|village|town|city))",
            r"([A-Z][a-zA-Z]+\s+(?:highway|expressway|bridge|road))",
            r"(?:on the|on a)\s+([A-Z][a-zA-Z\s-]+)\s+(?:highway|road|bridge)",
        ]
        for pattern in location_patterns:
            match = re.search(pattern, content)
            if match:
                result["raw"] = match.group(1).strip()
                break

        if not result["raw"] and result["district"]:
            result["raw"] = result["district"]
        return result

    def _extract_casualties(self, content: str) -> Dict:
        deaths, injuries = 0, 0
        cl = content.lower()

        word_to_num = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
            "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
            "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
            "fifty": 50, "a": 1, "an": 1, "several": 3, "many": 5,
            "dozens": 24, "hundreds": 100,
        }
        num = (
            r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten|"
            r"eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|"
            r"eighteen|nineteen|twenty|thirty|forty|fifty|a|an|several|many|dozens)"
        )

        for pattern in [
            rf"({num})\s+(?:people\s+)?(?:were\s+)?(?:killed|died|dead|perished|lost (?:their|his|her) lives?)",
            rf"(?:killed|claimed the lives? of|death toll[:\s]+)\s*({num})",
            rf"({num})\s+(?:people\s+)?(?:death|fatalities|casualties)",
            rf"(?:at least\s+)?({num})\s+(?:people\s+)?(?:were\s+)?killed",
            rf"killing\s+(?:at least\s+)?({num})",
        ]:
            for m in re.findall(pattern, cl):
                ns = m if isinstance(m, str) else m[0]
                n = word_to_num.get(ns)
                if n is None:
                    try:
                        n = int(ns)
                    except ValueError:
                        n = 0
                deaths = max(deaths, n)

        for pattern in [
            rf"({num})\s+(?:people\s+)?(?:were\s+)?(?:injured|hurt|wounded|hospitalized|hospitalised)",
            rf"(?:injuring|injured)\s+(?:at least\s+)?({num})",
            rf"({num})\s+(?:others?\s+)?(?:were\s+)?injured",
        ]:
            for m in re.findall(pattern, cl):
                ns = m if isinstance(m, str) else m[0]
                n = word_to_num.get(ns)
                if n is None:
                    try:
                        n = int(ns)
                    except ValueError:
                        n = 0
                injuries = max(injuries, n)

        return {"deaths": deaths, "injuries": injuries}

    @staticmethod
    def _extract_vehicles(content: str) -> Optional[str]:
        cl = content.lower()
        vehicles = [
            ("bus", ["bus", "buses"]),
            ("truck", ["truck", "lorry", "covered van"]),
            ("car", ["car", "private car", "sedan"]),
            ("microbus", ["microbus", "micro bus"]),
            ("motorcycle", ["motorcycle", "motorbike", "bike"]),
            ("auto-rickshaw", ["auto-rickshaw", "cng", "three-wheeler", "auto rickshaw"]),
            ("rickshaw", ["rickshaw", "easy bike"]),
            ("train", ["train"]),
            ("boat", ["boat", "launch", "ferry", "trawler"]),
            ("pickup", ["pickup", "pick-up"]),
            ("ambulance", ["ambulance"]),
        ]
        found = [name for name, kws in vehicles if any(kw in cl for kw in kws)]
        return ", ".join(found) if found else None

    @staticmethod
    def _generate_summary(content: str, max_length: int = 200) -> str:
        boilerplate_patterns = [
            r"©|copyright|all rights reserved",
            r"^photo\s*:", r"^file\s+photo",
            r"published\s+at\s+\d", r"updated\s+at\s+\d",
            r"follow\s+us\s+on", r"subscribe\s+to", r"click\s+here",
        ]
        sentences = re.split(r"(?<=[.!?])\s+", content)
        summary = ""
        for s in sentences[:5]:
            s_stripped = s.strip()
            if len(s_stripped) < 15:
                continue
            if any(re.search(bp, s_stripped, re.IGNORECASE) for bp in boilerplate_patterns):
                continue
            if len(summary) + len(s_stripped) <= max_length:
                summary += s_stripped + " "
            else:
                break
        return summary.strip() or content[:max_length].strip()
