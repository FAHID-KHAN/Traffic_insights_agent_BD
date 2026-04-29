"""Schema models for structured accident extraction output."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class AccidentEvent(BaseModel):
    accident_type: str | None = None
    location_raw: str | None = None
    district: str | None = None
    division: str | None = None
    deaths: int = Field(default=0, ge=0)
    injuries: int = Field(default=0, ge=0)
    vehicles_involved: list[str] | None = None
    road_name: str | None = None
    accident_date: str | None = None
    summary: str | None = None
    confidence: float | None = None

    @field_validator(
        "accident_type",
        "location_raw",
        "district",
        "division",
        "road_name",
        "accident_date",
        "summary",
        mode="before",
    )
    @classmethod
    def _strip_optional_strings(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("vehicles_involved", mode="before")
    @classmethod
    def _normalize_vehicle_list(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, list):
            cleaned = [str(item).strip() for item in value if str(item).strip()]
            return cleaned or None
        if isinstance(value, str):
            items = [chunk.strip() for chunk in value.split(",") if chunk.strip()]
            return items or None
        return None

    @field_validator("deaths", "injuries", mode="before")
    @classmethod
    def _coerce_non_negative_int(cls, value: Any) -> int:
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return 0
        return max(0, parsed)


class ExtractionResult(BaseModel):
    article_type: Literal[
        "daily_incident",
        "time_window_roundup",
        "non_incident_report",
        "outside_bangladesh",
        "unknown",
    ] = "unknown"
    skip_reason: str | None = None
    accidents: list[AccidentEvent] = Field(default_factory=list)

    @field_validator("skip_reason", mode="before")
    @classmethod
    def _strip_skip_reason(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value
