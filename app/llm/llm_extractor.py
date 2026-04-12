"""LLM-based accident extraction and DB insertion pipeline."""
from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from pathlib import Path
from typing import Optional, Any

from pydantic import ValidationError

from app.config import DATA_DIR, MAX_DEATHS_PER_EVENT, MAX_INJURIES_PER_EVENT
from app.database import insert_accident
from app.geo import DISTRICT_COORDINATES, district_to_division
from app.llm.fake_data import NON_INCIDENT_PHRASES
from app.llm.llm_schema import AccidentEvent, ExtractionResult
from app.llm.openai_client import OpenAIClient, OpenAIClientError
from app.normalize import normalize_district

logger = logging.getLogger(__name__)

_FAILURE_LOG_PATH = Path(DATA_DIR) / "llm_extraction_failures.log"
_RESPONSE_LOG_PATH = Path(DATA_DIR) / "llm_extraction_responses.log"
_DISCARD_LOG_PATH = Path(DATA_DIR) / "non_incident_report.log"

_SYSTEM_PROMPT = (
    "You are an information extraction engine. Extract road-accident events from a news article. "
    "Return ONLY valid JSON matching the given schema. Do not include markdown. "
    "Do not invent facts. If a field is not stated, use null (or 0 for counts). "
    "If multiple accidents are described, return multiple entries. "
    "For road_name, extract the specific highway or road name if mentioned "
    "(e.g. 'Dhaka-Chittagong Highway', 'N1', 'Dhaka-Mymensingh Highway'). Use null if not stated."
)

_NON_DISTRICT_LOCATIONS = {
    "Tongi", "Savar", "Keraniganj", "Uttara", "Mirpur", "Mohammadpur",
    "Dhanmondi", "Gulshan", "Motijheel", "Jatrabari", "Demra", "Tejgaon",
    "Turag", "Gabtali", "Ashulia",
}

_ALLOWED_DISTRICTS = sorted(
    district for district in DISTRICT_COORDINATES.keys() if district not in _NON_DISTRICT_LOCATIONS
)

_EXTRACTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "accidents": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "accident_type": {"type": ["string", "null"]},
                    "location_raw": {"type": ["string", "null"]},
                    "district": {"type": ["string", "null"]},
                    "division": {"type": ["string", "null"]},
                    "deaths": {"type": "integer", "minimum": 0},
                    "injuries": {"type": "integer", "minimum": 0},
                    "vehicles_involved": {
                        "type": ["array", "null"],
                        "items": {"type": "string"},
                    },
                    "road_name": {"type": ["string", "null"]},
                    "accident_date": {"type": ["string", "null"]},
                    "summary": {"type": ["string", "null"]},
                    "confidence": {"type": ["number", "null"]},
                },
                "required": [
                    "accident_type",
                    "location_raw",
                    "district",
                    "division",
                    "deaths",
                    "injuries",
                    "vehicles_involved",
                    "road_name",
                    "accident_date",
                    "summary",
                    "confidence",
                ],
            },
        }
    },
    "required": ["accidents"],
}

_AGGREGATE_PATTERNS = [
    r"\bbetween\s+[a-z]+\s+\d{4}\s+and\s+[a-z]+\s+\d{4}\b",
    r"\bbetween\s+\d{4}\s+and\s+\d{4}\b",
    r"\bsince\s+\d{4}\b",
    r"\bin\s+\d{4}\b",
]

_AGGREGATE_KEYWORDS = {
    "this year",
    "last year",
    "throughout",
    "according to report",
    "according to the report",
    "data shows",
    "statistics",
    "reported",
    "brta",
    "jatri kalyan samity",
    "road safety foundation",
    "during january",
    "during february",
    "during march",
}


class LLMAccidentExtractor:
    """Extracts one or more accidents from an article using OpenAI."""

    def __init__(self, client: Optional[OpenAIClient] = None):
        self.client = client or OpenAIClient()

    def extract_events(
        self,
        content: str,
        published_date: Optional[date] = None,
        article_id: Optional[int] = None,
    ) -> list[AccidentEvent]:
        """Extract accident events from article content."""
        if not content or len(content.strip()) < 50:
            return []

        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": self._build_user_prompt(content=content, published_date=published_date),
            },
        ]

        try:
            raw_content = self.client.chat_json(
                messages,
                response_schema=_EXTRACTION_SCHEMA,
            )
            self._log_response(article_id=article_id, raw_response=raw_content)
            payload = self._parse_json_payload(raw_content)
            result = ExtractionResult.model_validate(payload)
            return result.accidents
        except (OpenAIClientError, json.JSONDecodeError, ValidationError, ValueError) as exc:
            self._log_failure("extract_events", exc, content_preview=content[:500], raw_response=locals().get("raw_content"))
            return []

    def process_article(self, article_id: int, content: str, published_date: Optional[date] = None) -> list[int]:
        """Extract accidents with LLM and insert all rows for the article."""
        accidents = self.extract_events(
            content=content,
            published_date=published_date,
            article_id=article_id,
        )
        inserted_ids: list[int] = []

        for event in accidents:
            skip_reason = self._skip_reason(event)
            if skip_reason:
                self._log_discarded_event(
                    article_id=article_id,
                    published_date=published_date,
                    reason=skip_reason,
                    event=event,
                )
                logger.info(
                    "Article %s: skipped %s event: %s",
                    article_id,
                    skip_reason,
                    event.summary,
                )
                continue

            # Guardrails against unrealistic casualty values from aggregate reports.
            if self._is_casualty_outlier(event):
                self._log_discarded_event(
                    article_id=article_id,
                    published_date=published_date,
                    reason="casualty_outlier",
                    event=event,
                )
                logger.info(
                    "Article %s: skipped outlier event deaths=%s injuries=%s",
                    article_id,
                    event.deaths,
                    event.injuries,
                )
                continue

            district = normalize_district(event.district)
            if district and district not in _ALLOWED_DISTRICTS:
                district = None
            division = (event.division.strip() if event.division else None) or (
                district_to_division(district) if district else None
            )
            latitude, longitude = DISTRICT_COORDINATES.get(district, (None, None)) if district else (None, None)
            # Canonical accident date is the article publish date for consistent daily/monthly grouping.
            accident_dt = published_date
            vehicles = ", ".join(event.vehicles_involved) if event.vehicles_involved else None

            accident_id = insert_accident(
                article_id=article_id,
                accident_type=event.accident_type,
                location_raw=event.location_raw,
                district=district,
                division=division,
                latitude=latitude,
                longitude=longitude,
                deaths=event.deaths,
                injuries=event.injuries,
                vehicles_involved=vehicles,
                road_name=event.road_name,
                accident_date=accident_dt,
                summary=event.summary,
            )
            inserted_ids.append(accident_id)

        if inserted_ids:
            logger.info(
                "Article %s: inserted %s accident event(s) via LLM extraction",
                article_id,
                len(inserted_ids),
            )
        else:
            logger.info("Article %s: no accident events inserted", article_id)

        return inserted_ids

    _MAX_CONTENT_CHARS = 8000

    def _build_user_prompt(self, content: str, published_date: Optional[date]) -> str:
        content = content[:self._MAX_CONTENT_CHARS]
        district_list = ", ".join(_ALLOWED_DISTRICTS)
        pub = published_date.isoformat() if published_date else "null"
        return (
            f"Published date: {pub}\n\n"
            f"Allowed districts (must choose exactly one or null): {district_list}\n\n"
            "Task:\n"
            "Extract accident events into JSON with schema: \n"
            "{\"accidents\":[{\"accident_type\":string|null,\"location_raw\":string|null,"
            "\"district\":string|null,\"division\":string|null,\"deaths\":int,"
            "\"injuries\":int,\"vehicles_involved\":string[]|null,"
            "\"accident_date\":\"YYYY-MM-DD\"|null,\"summary\":string|null,"
            "\"confidence\":float|null}]}\n\n"
            "Rules:\n"
            "- Return ONLY JSON.\n"
            "- district must be one from allowed list or null.\n"
            "- Do not output locality names (e.g., Uttara, Mirpur, Tongi) as district.\n"
            "- Never generate latitude/longitude. Coordinates are handled by backend mapping.\n"
            "- Return only concrete accident incidents, not annual/monthly aggregate statistics.\n"
            "- If multiple accidents are described, return multiple entries.\n"
            "- Do not invent counts; if unclear use 0.\n"
            "- Set accident_date to null. Backend will assign article published date as canonical event date.\n"
            "- vehicles_involved should be canonical tokens (bus, truck, car, motorcycle, train, boat, auto-rickshaw, rickshaw, microbus, pickup, ambulance).\n"
            "- summary should be concise and <= 200 characters.\n\n"
            "Article:\n"
            f"{content}"
        )

    @staticmethod
    def _parse_json_payload(raw_content: str) -> dict:
        """Parse model output and tolerate fenced JSON."""
        text = raw_content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise ValueError("LLM response is not a JSON object")
        return parsed

    @staticmethod
    def _is_casualty_outlier(event: AccidentEvent) -> bool:
        return event.deaths > MAX_DEATHS_PER_EVENT or event.injuries > MAX_INJURIES_PER_EVENT

    @staticmethod
    def _is_aggregate_or_historical_event(event: AccidentEvent) -> bool:
        combined_text = " ".join(
            part for part in [event.summary, event.location_raw, event.accident_type] if part
        ).lower()

        if not combined_text:
            return False

        if any(keyword in combined_text for keyword in _AGGREGATE_KEYWORDS):
            return True

        return any(re.search(pattern, combined_text) for pattern in _AGGREGATE_PATTERNS)

    @staticmethod
    def _skip_reason(event: AccidentEvent) -> Optional[str]:
        combined_text = " ".join(
            part for part in [event.summary, event.location_raw, event.accident_type] if part
        ).lower()
        has_metadata = any(
            [
                event.accident_type,
                event.location_raw,
                event.district,
                event.division,
                event.road_name,
                event.vehicles_involved,
                event.summary,
            ]
        )
        has_concrete_signal = any(
            [event.accident_type, event.location_raw, event.district, event.road_name]
        )
        has_casualties = event.deaths > 0 or event.injuries > 0

        if LLMAccidentExtractor._is_aggregate_or_historical_event(event):
            return "aggregate_or_historical"

        if combined_text and any(phrase in combined_text for phrase in NON_INCIDENT_PHRASES):
            return "non_incident"

        if not has_metadata:
            return "empty_payload"

        if not has_casualties and not has_concrete_signal:
            return "no_concrete_incident"

        return None

    def _log_discarded_event(
        self,
        article_id: int,
        published_date: Optional[date],
        reason: str,
        event: AccidentEvent,
    ):
        """Persist skipped LLM events for manual QA without inserting DB rows."""
        payload = {
            "timestamp": datetime.now().isoformat(),
            "article_id": article_id,
            "published_date": published_date.isoformat() if published_date else None,
            "reason": reason,
            "event": {
                "accident_type": event.accident_type,
                "location_raw": event.location_raw,
                "district": event.district,
                "division": event.division,
                "deaths": event.deaths,
                "injuries": event.injuries,
                "vehicles_involved": event.vehicles_involved,
                "road_name": event.road_name,
                "summary": event.summary,
            },
        }
        try:
            _DISCARD_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with _DISCARD_LOG_PATH.open("a", encoding="utf-8") as fp:
                fp.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except OSError as log_error:
            logger.error("Failed to persist LLM discard log: %s", log_error)

    def _log_failure(
        self,
        stage: str,
        exc: Exception,
        content_preview: str,
        raw_response: Optional[str] = None,
    ):
        logger.error("LLM extraction failed at %s: %s", stage, exc)

        try:
            _FAILURE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with _FAILURE_LOG_PATH.open("a", encoding="utf-8") as fp:
                fp.write(f"[{datetime.now().isoformat()}] stage={stage} error={exc}\n")
                fp.write(f"content_preview={content_preview}\n")
                if raw_response:
                    fp.write(f"raw_response={raw_response}\n")
                fp.write("-" * 80 + "\n")
        except OSError as log_error:
            logger.error("Failed to persist LLM failure log: %s", log_error)

    def _log_response(self, article_id: Optional[int], raw_response: str):
        """Persist every raw LLM JSON response for debugging/auditing."""
        try:
            _RESPONSE_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
            with _RESPONSE_LOG_PATH.open("a", encoding="utf-8") as fp:
                fp.write(
                    f"[{datetime.now().isoformat()}] article_id={article_id if article_id is not None else 'unknown'}\n"
                )
                fp.write(f"raw_response={raw_response}\n")
                fp.write("-" * 80 + "\n")
        except OSError as log_error:
            logger.error("Failed to persist LLM response log: %s", log_error)
