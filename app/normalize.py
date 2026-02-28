"""Normalization helpers for extractor inputs."""
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
