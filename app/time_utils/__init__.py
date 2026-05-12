"""Time normalization helpers for accident occurrence metadata."""
from __future__ import annotations

import re

PART_OF_DAY_LABELS = {
    "midnight",
    "dawn",
    "morning",
    "noon",
    "afternoon",
    "evening",
    "night",
}

_TIME_RE = re.compile(
    r"^\s*(?P<hour>\d{1,2})(?P<sep>[:.])(?P<minute>\d{2})\s*(?P<ampm>[AaPp]\.?[Mm]\.?)?\s*$"
)

_PART_ALIASES = {
    "midnight": "midnight",
    "late night": "night",
    "night": "night",
    "at night": "night",
    "dawn": "dawn",
    "early morning": "dawn",
    "pre-dawn": "dawn",
    "predawn": "dawn",
    "morning": "morning",
    "in the morning": "morning",
    "noon": "noon",
    "midday": "noon",
    "at noon": "noon",
    "afternoon": "afternoon",
    "in the afternoon": "afternoon",
    "evening": "evening",
    "in the evening": "evening",
}


def normalize_accident_time(value: str | None) -> str | None:
    """Normalize a strict time string to HH:MM, or return None."""
    if not value:
        return None
    match = _TIME_RE.match(value)
    if not match:
        return None

    hour = int(match.group("hour"))
    minute = int(match.group("minute"))
    ampm = match.group("ampm")
    if minute > 59:
        return None

    if ampm:
        if hour < 1 or hour > 12:
            return None
        suffix = ampm.lower().replace(".", "")
        if suffix == "am":
            hour = 0 if hour == 12 else hour
        elif suffix == "pm":
            hour = 12 if hour == 12 else hour + 12
        else:
            return None
    elif hour > 23:
        return None

    return f"{hour:02d}:{minute:02d}"


def part_of_day_for_time(time_value: str | None) -> str | None:
    """Return the fixed part-of-day label for a normalized or strict time."""
    normalized = normalize_accident_time(time_value)
    if not normalized:
        return None
    hour = int(normalized[:2])
    if hour == 0:
        return "midnight"
    if 1 <= hour <= 5:
        return "dawn"
    if 6 <= hour <= 10:
        return "morning"
    if 11 <= hour <= 12:
        return "noon"
    if 13 <= hour <= 16:
        return "afternoon"
    if 17 <= hour <= 19:
        return "evening"
    return "night"


def normalize_part_of_day(value: str | None) -> str | None:
    """Map textual aliases to the fixed part-of-day labels."""
    if not value:
        return None
    text = re.sub(r"\s+", " ", value.strip().lower())
    if not text:
        return None
    if text in PART_OF_DAY_LABELS:
        return text
    return _PART_ALIASES.get(text)


def normalize_time_metadata(
    accident_time: str | None,
    part_of_day: str | None,
) -> tuple[str | None, str | None]:
    """Normalize accident_time and derive or normalize part_of_day."""
    normalized_time = normalize_accident_time(accident_time)
    if normalized_time:
        return normalized_time, part_of_day_for_time(normalized_time)
    return None, normalize_part_of_day(part_of_day)
