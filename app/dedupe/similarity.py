"""Deterministic accident-event similarity scoring."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

UPDATE_WORDING_PATTERNS = [
    r"\bdeath toll rises\b",
    r"\brises to\b",
    r"\bsuccumbed to injuries\b",
    r"\blater died\b",
    r"\binjured rises\b",
    r"\binjuries rise\b",
    r"\binjury toll rises\b",
    r"\bupdated\b",
]

_STOPWORDS = {
    "a", "an", "and", "area", "as", "at", "by", "in", "near", "of", "on",
    "crossing", "level", "rail", "railway", "road", "the", "to",
    "upazila", "union", "under",
}

_ACCIDENT_ACTION_SYNONYMS = {
    "collide": "collision",
    "collided": "collision",
    "collides": "collision",
    "colliding": "collision",
    "collision": "collision",
    "crash": "crash",
    "crashed": "crash",
    "crashes": "crash",
    "crashing": "crash",
    "hit": "hit",
    "hits": "hit",
    "hitting": "hit",
    "ram": "hit",
    "rammed": "hit",
    "ramming": "hit",
    "rams": "hit",
    "struck": "hit",
    "strike": "hit",
    "strikes": "hit",
    "striking": "hit",
}


@dataclass(frozen=True)
class SimilarityResult:
    score: int
    matched_signals: list[str]


def score_accident_similarity(
    new_event: dict[str, Any],
    candidate: dict[str, Any],
    title: str | None = None,
) -> SimilarityResult:
    """Return a capped 0-100 score and the signal names that contributed."""
    score = 0
    signals: list[str] = []

    if _same_text(new_event.get("district"), candidate.get("district")):
        score += 20
        signals.append("same_district")

    if _same_text(new_event.get("road_name"), candidate.get("road_name")):
        score += 25
        signals.append("same_road_name")

    if _strong_location_overlap(new_event, candidate):
        score += 20
        signals.append("location_overlap")

    if _has_token_overlap(new_event.get("vehicles_involved"), candidate.get("vehicles_involved")):
        score += 15
        signals.append("vehicle_overlap")

    if _compatible_accident_type(new_event.get("accident_type"), candidate.get("accident_type")):
        score += 10
        signals.append("compatible_accident_type")

    if _same_accident_family(new_event, candidate):
        score += 10
        signals.append("same_accident_family")

    if _casualties_compatible(new_event, candidate):
        score += 10
        signals.append("casualties_compatible")

    if has_update_wording(title, new_event.get("summary")):
        score += 15
        signals.append("update_wording")

    return SimilarityResult(score=min(score, 100), matched_signals=signals)


def has_update_wording(*parts: str | None) -> bool:
    text = " ".join(part for part in parts if part).lower()
    return any(re.search(pattern, text) for pattern in UPDATE_WORDING_PATTERNS)


def _same_text(left: str | None, right: str | None) -> bool:
    return bool(left and right and left.strip().casefold() == right.strip().casefold())


def _strong_location_overlap(new_event: dict[str, Any], candidate: dict[str, Any]) -> bool:
    new_tokens = _location_tokens(new_event)
    candidate_tokens = _location_tokens(candidate)
    if not new_tokens or not candidate_tokens:
        return False
    overlap = new_tokens & candidate_tokens
    if len(overlap) >= 2:
        return True
    return bool(overlap) and len(overlap) / min(len(new_tokens), len(candidate_tokens)) >= 0.5


def _location_tokens(event: dict[str, Any]) -> set[str]:
    text = " ".join(
        str(event.get(field) or "")
        for field in ("location_raw", "road_name")
    )
    tokens = _tokens(text)
    district = str(event.get("district") or "").casefold()
    if district:
        tokens.discard(district)
    return tokens


def _has_token_overlap(left: str | None, right: str | None) -> bool:
    left_tokens = _tokens(left or "")
    right_tokens = _tokens(right or "")
    return bool(left_tokens & right_tokens)


def _compatible_accident_type(left: str | None, right: str | None) -> bool:
    if _same_text(left, right):
        return True
    left_tokens = _accident_type_tokens(left or "")
    right_tokens = _accident_type_tokens(right or "")
    if not left_tokens or not right_tokens:
        return False
    return bool(left_tokens & right_tokens & {
        "accident", "collision", "crash", "hit", "overturn", "run",
    })


def accident_families(event: dict[str, Any]) -> set[str]:
    """Return deterministic incident-family labels from local event wording."""
    text = _event_text(event)
    tokens = _tokens(text)
    families: set[str] = set()

    has_train = "train" in tokens or "railway" in tokens
    has_bus = "bus" in tokens
    has_rail_crossing = bool(re.search(r"\b(?:rail|level|railway)\s+crossing\b", text))
    has_train_hit_bus = bool(
        re.search(r"\btrain\s+(?:hit|hits|struck|rammed|collided|crashed)", text)
        and has_bus
    )
    if has_train and has_bus and (has_rail_crossing or has_train_hit_bus):
        families.add("rail_crossing_collision")

    if re.search(r"\bhead[\s-]?on\b", text):
        families.add("head_on_collision")

    has_pedestrian = bool(tokens & {"pedestrian", "pedestrians", "woman", "man", "child", "boy", "girl"})
    has_pedestrian_action = bool(
        tokens & {"hit", "hits", "struck", "rammed"}
        or re.search(r"\br[au]n[\s-]?over\b|\brun[\s-]?over\b", text)
        or re.search(r"\bcross(?:ed|ing)?\s+(?:the\s+)?road\b", text)
    )
    if has_pedestrian and has_pedestrian_action:
        families.add("pedestrian_collision")

    if (
        re.search(r"\b(?:plunged?|fell|fallen|lost control|skidded|swerved|overturned)\b", text)
        and re.search(r"\b(?:ditch|canal|pond|water|roadside)\b", text)
    ):
        families.add("vehicle_into_ditch")

    if re.search(r"\b(?:hit|hits|struck|rammed|crash(?:ed|es)?|collided)\b", text) and re.search(
        r"\b(?:road\s+)?divider\b", text
    ):
        families.add("road_divider_collision")

    if re.search(r"\brear[\s-]?end(?:ed)?\b|\bfrom behind\b", text):
        families.add("rear_end_collision")

    return families


def _same_accident_family(new_event: dict[str, Any], candidate: dict[str, Any]) -> bool:
    return bool(accident_families(new_event) & accident_families(candidate))


def _event_text(event: dict[str, Any]) -> str:
    return " ".join(
        str(event.get(field) or "")
        for field in ("accident_type", "summary", "location_raw")
    ).casefold()


def _accident_type_tokens(text: str) -> set[str]:
    return {
        _ACCIDENT_ACTION_SYNONYMS.get(token, token)
        for token in _tokens(text)
    }


def _casualties_compatible(new_event: dict[str, Any], candidate: dict[str, Any]) -> bool:
    new_deaths = int(new_event.get("deaths") or 0)
    old_deaths = int(candidate.get("deaths") or 0)
    new_injuries = int(new_event.get("injuries") or 0)
    old_injuries = int(candidate.get("injuries") or 0)
    return new_deaths >= old_deaths and new_injuries >= old_injuries


def _tokens(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", text.casefold())
        if len(token) > 2 and token not in _STOPWORDS
    }
