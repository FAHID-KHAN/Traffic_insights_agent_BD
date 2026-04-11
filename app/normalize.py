"""Normalization helpers for extractor inputs."""
import re
from typing import Optional

from app.config import BANGLADESH_DISTRICTS
from app.geo import DISTRICT_COORDINATES

_DISTRICT_ALIASES = {
    "chittagong": "Chattogram",
    "chattogram": "Chattogram",
    "comilla": "Cumilla",
    "cumilla": "Cumilla",
    "barisal": "Barishal",
    "barishal": "Barishal",
    "bogra": "Bogura",
    "bogura": "Bogura",
    "jessore": "Jashore",
    "jashore": "Jashore",
}

# Map well-known localities/upazilas to their parent district.
_LOCALITY_TO_DISTRICT = {
    "uttara": "Dhaka",
    "mirpur": "Dhaka",
    "mohammadpur": "Dhaka",
    "dhanmondi": "Dhaka",
    "gulshan": "Dhaka",
    "motijheel": "Dhaka",
    "jatrabari": "Dhaka",
    "demra": "Dhaka",
    "tejgaon": "Dhaka",
    "turag": "Dhaka",
    "gabtali": "Dhaka",
    "ashulia": "Dhaka",
    "keraniganj": "Dhaka",
    "savar": "Dhaka",
    "tongi": "Gazipur",
}

_VALID_DISTRICTS = set(BANGLADESH_DISTRICTS)
_VALID_DISTRICTS.update(DISTRICT_COORDINATES.keys())


def normalize_district(name: Optional[str]) -> Optional[str]:
    """Normalize and validate district names against known Bangladesh locations."""
    if not name:
        return None

    cleaned = " ".join(str(name).strip().split())
    if not cleaned:
        return None

    lowered = cleaned.lower()
    if lowered in _LOCALITY_TO_DISTRICT:
        normalized = _LOCALITY_TO_DISTRICT[lowered]
    else:
        normalized = _DISTRICT_ALIASES.get(lowered, cleaned)

    if normalized in _VALID_DISTRICTS:
        return normalized

    title_variant = normalized.title()
    alias_from_title = _DISTRICT_ALIASES.get(title_variant.lower(), title_variant)
    if alias_from_title in _VALID_DISTRICTS:
        return alias_from_title

    return None


# ── Canonical accident types ─────────────────────────────────
# Ordered from most specific to most general so the first keyword match wins.
_ACCIDENT_TYPE_KEYWORDS: list[tuple[str, list[str]]] = [
    ("train accident", ["train accident", "train crash", "rail accident", "derail", "train collid"]),
    ("boat accident", ["boat capsize", "boat sank", "launch capsize", "launch accident",
                        "ferry accident", "boat accident", "trawler capsize"]),
    ("hit-and-run", ["hit-and-run", "hit and run", "fled the scene", "fled after hitting"]),
    ("head-on collision", ["head-on collision", "head on collision", "head-on crash"]),
    ("bus accident", ["bus accident", "bus crash", "bus overturn", "bus collid", "bus fell", "bus plunge"]),
    ("truck accident", ["truck accident", "truck crash", "truck overturn", "truck collid", "covered van"]),
    ("motorcycle accident", ["motorcycle accident", "motorbike", "motorcycle crash",
                              "motorcycle hit", "bike accident", "bike crash"]),
    ("auto-rickshaw accident", ["auto-rickshaw", "autorickshaw", "cng", "three-wheeler", "auto rickshaw"]),
    ("rickshaw accident", ["rickshaw accident", "rickshaw crash", "van puller"]),
    ("car accident", ["car accident", "car crash", "private car", "microbus", "sedan"]),
    ("pedestrian accident", ["pedestrian", "run over", "run-over", "ran over",
                              "walking", "crossing the road", "hit while crossing"]),
    ("vehicle fire", ["vehicle fire", "caught fire", "bus fire", "truck fire"]),
    ("collision", ["collision", "collided", "crashed into", "vehicle hit"]),
    ("overturn", ["overturn", "overturned", "fell off", "plunged"]),
]


def normalize_accident_type(value: Optional[str]) -> Optional[str]:
    """Map a free-form accident_type string to a canonical category.

    Handles LLM-produced variants like "run-over", "motorcycle hit pedestrian",
    compound entries with semicolons, etc. Falls back to "road accident" when a
    non-empty string cannot be matched.
    """
    if not value:
        return None

    cleaned = re.sub(r"[;|]+", " ", str(value))  # split compound entries
    lowered = " ".join(cleaned.lower().split())
    if not lowered:
        return None

    for canonical, keywords in _ACCIDENT_TYPE_KEYWORDS:
        if any(kw in lowered for kw in keywords):
            return canonical

    return "road accident"
