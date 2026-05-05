"""Road and highway name normalization helpers."""
from __future__ import annotations

import re
from typing import Optional

_DASH_RE = re.compile(r"\s*[-–—]\s*")
_SPACE_RE = re.compile(r"\s+")
_SUFFIX_RE = re.compile(r"\b(highway|road|expressway|bridge)\b", re.IGNORECASE)

_PLACE_ALIASES = {
    "barisal": "Barishal",
    "barishal": "Barishal",
    "bogra": "Bogura",
    "bogura": "Bogura",
    "chittagong": "Chattogram",
    "chattogram": "Chattogram",
    "comilla": "Cumilla",
    "cumilla": "Cumilla",
    "jessore": "Jashore",
    "jashore": "Jashore",
}

_SUFFIX_CANONICAL = {
    "highway": "Highway",
    "road": "Road",
    "expressway": "Expressway",
    "bridge": "Bridge",
}

_KNOWN_ALIASES = {
    "chattogram-cox's bazar highway": "Chattogram-Cox's Bazar Highway",
    "chattogram-cox's bazar road": "Chattogram-Cox's Bazar Road",
    "coxs bazar-chattogram highway": "Cox's Bazar-Chattogram Highway",
    "cox's bazar-chattogram highway": "Cox's Bazar-Chattogram Highway",
    "cox's bazar-teknaf highway": "Cox's Bazar-Teknaf Highway",
    "cox's bazar-teknaf marine drive road": "Cox's Bazar-Teknaf Marine Drive Road",
    "dhaka-chattogram highway": "Dhaka-Chattogram Highway",
    "chattogram-dhaka highway": "Chattogram-Dhaka Highway",
    "dhaka-sylhet highway": "Dhaka-Sylhet Highway",
    "dhaka-mymensingh highway": "Dhaka-Mymensingh Highway",
    "dhaka-mawa expressway": "Dhaka-Mawa Expressway",
    "dhaka-aricha highway": "Dhaka-Aricha Highway",
    "dhaka-bhanga expressway": "Dhaka-Bhanga Expressway",
    "dhaka-khulna highway": "Dhaka-Khulna Highway",
    "dhaka-barishal highway": "Dhaka-Barishal Highway",
    "dhaka-barisal highway": "Dhaka-Barishal Highway",
    "barishal-dhaka highway": "Barishal-Dhaka Highway",
    "barisal-dhaka highway": "Barishal-Dhaka Highway",
    "barishal-kuakata highway": "Barishal-Kuakata Highway",
    "barisal-patuakhali-kuakata highway": "Barishal-Patuakhali-Kuakata Highway",
    "cumilla-sylhet highway": "Cumilla-Sylhet Highway",
    "sylhet-tamabil highway": "Sylhet-Tamabil Highway",
    "sylhet-sunamganj highway": "Sylhet-Sunamganj Highway",
    "sylhet-zakiganj road": "Sylhet-Zakiganj Road",
    "bogura-naogaon highway": "Bogura-Naogaon Highway",
    "bogura-naogaon road": "Bogura-Naogaon Road",
    "bogura-dhaka highway": "Bogura-Dhaka Highway",
    "bogura-nagarbari highway": "Bogura-Nagarbari Highway",
    "bogura-rangpur highway": "Bogura-Rangpur Highway",
}


def normalize_road_name(name: Optional[str]) -> Optional[str]:
    """Return a canonical road/highway name, or None for empty values."""
    if name is None:
        return None

    cleaned = str(name).strip()
    if not cleaned:
        return None

    cleaned = (
        cleaned.replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u02bc", "'")
    )
    cleaned = _DASH_RE.sub("-", cleaned)
    cleaned = _SPACE_RE.sub(" ", cleaned).strip(" ,.;")
    cleaned = _SUFFIX_RE.sub(lambda m: _SUFFIX_CANONICAL[m.group(1).lower()], cleaned)
    cleaned = _canonicalize_tokens(cleaned)

    alias_key = cleaned.lower()
    if alias_key in _KNOWN_ALIASES:
        return _KNOWN_ALIASES[alias_key]

    return cleaned


def _canonicalize_tokens(value: str) -> str:
    parts = value.split("-")
    return "-".join(_canonicalize_segment(part) for part in parts)


def _canonicalize_segment(segment: str) -> str:
    words = segment.split(" ")
    return " ".join(_canonicalize_word(word) for word in words if word)


def _canonicalize_word(word: str) -> str:
    lowered = word.lower()
    if lowered in _PLACE_ALIASES:
        return _PLACE_ALIASES[lowered]
    if lowered in _SUFFIX_CANONICAL:
        return _SUFFIX_CANONICAL[lowered]
    if len(word) > 1 and word.isupper():
        return word
    if re.fullmatch(r"[A-Za-z]\d+[A-Za-z0-9]*", word):
        return word.upper()
    if "'" in word:
        return "'".join(piece.capitalize() for piece in lowered.split("'"))
    return lowered.capitalize()
