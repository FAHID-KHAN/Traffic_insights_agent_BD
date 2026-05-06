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
    "road", "the", "to", "upazila", "union", "under",
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
    return _tokens(text)


def _has_token_overlap(left: str | None, right: str | None) -> bool:
    left_tokens = _tokens(left or "")
    right_tokens = _tokens(right or "")
    return bool(left_tokens & right_tokens)


def _compatible_accident_type(left: str | None, right: str | None) -> bool:
    if _same_text(left, right):
        return True
    left_tokens = _tokens(left or "")
    right_tokens = _tokens(right or "")
    if not left_tokens or not right_tokens:
        return False
    return bool(left_tokens & right_tokens & {"collision", "crash", "hit", "run", "overturning", "accident"})


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
