"""LLM-based accident extraction and DB insertion pipeline."""
from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from pydantic import ValidationError

from app.config import BANGLADESH_DISTRICTS, DATA_DIR
from app.database import insert_accident
from app.geo import DISTRICT_COORDINATES, district_to_division
from app.llm.llm_schema import AccidentEvent, ExtractionResult
from app.llm.ollama_client import OllamaClient, OllamaClientError
from app.normalize import normalize_district

logger = logging.getLogger(__name__)

_FAILURE_LOG_PATH = Path(DATA_DIR) / "llm_extraction_failures.log"
_RESPONSE_LOG_PATH = Path(DATA_DIR) / "llm_extraction_responses.log"

_SYSTEM_PROMPT = (
    "You are an information extraction engine. Extract road-accident events from a news article. "
    "Return ONLY valid JSON matching the given schema. Do not include markdown. "
    "Do not invent facts. If a field is not stated, use null (or 0 for counts). "
    "If multiple accidents are described, return multiple entries."
)


class LLMAccidentExtractor:
    """Extracts one or more accidents from an article using Ollama."""

    def __init__(self, client: Optional[OllamaClient] = None):
        self.client = client or OllamaClient()

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
            raw_content = self.client.chat_json(messages)
            self._log_response(article_id=article_id, raw_response=raw_content)
            payload = self._parse_json_payload(raw_content)
            result = ExtractionResult.model_validate(payload)
            return result.accidents
        except (OllamaClientError, json.JSONDecodeError, ValidationError, ValueError) as exc:
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
            district = normalize_district(event.district)
            division = (event.division.strip() if event.division else None) or (
                district_to_division(district) if district else None
            )
            latitude, longitude = DISTRICT_COORDINATES.get(district, (None, None)) if district else (None, None)
            accident_dt = self._resolve_accident_date(event.accident_date, published_date)
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

    def _build_user_prompt(self, content: str, published_date: Optional[date]) -> str:
        district_list = ", ".join(BANGLADESH_DISTRICTS)
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
            "- If multiple accidents are described, return multiple entries.\n"
            "- Do not invent counts; if unclear use 0.\n"
            "- accident_date must be ISO date if explicitly present; otherwise null.\n"
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
    def _resolve_accident_date(date_str: Optional[str], published_date: Optional[date]) -> Optional[date]:
        if date_str:
            try:
                return datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                pass
        return published_date

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
