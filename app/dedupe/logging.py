"""Structured JSONL logging for accident dedupe decisions."""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config import DATA_DIR

logger = logging.getLogger(__name__)

UPDATE_LOG_PATH = Path(DATA_DIR) / "accident_update_events.log"
AMBIGUITY_LOG_PATH = Path(DATA_DIR) / "accident_dedupe_ambiguity.log"


def write_update_log(payload: dict[str, Any]) -> None:
    _write_jsonl(UPDATE_LOG_PATH, payload)


def write_ambiguity_log(payload: dict[str, Any]) -> None:
    _write_jsonl(AMBIGUITY_LOG_PATH, payload)


def _write_jsonl(path: Path, payload: dict[str, Any]) -> None:
    row = {"timestamp": datetime.now().isoformat(), **payload}
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fp:
            fp.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
    except OSError as exc:
        logger.error("Failed to persist accident dedupe log %s: %s", path, exc)
