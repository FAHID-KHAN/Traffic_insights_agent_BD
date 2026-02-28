"""Minimal Ollama chat client for JSON extraction."""
import logging
import time
from typing import Any

import requests

from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_RETRIES, OLLAMA_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)


class OllamaClientError(RuntimeError):
    """Raised when Ollama requests fail after retries."""


class OllamaClient:
    """Simple client around Ollama's /api/chat endpoint."""

    def __init__(
        self,
        base_url: str = OLLAMA_BASE_URL,
        model: str = OLLAMA_MODEL,
        timeout_seconds: int = OLLAMA_TIMEOUT_SECONDS,
        retries: int = OLLAMA_RETRIES,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.retries = retries
        self.session = requests.Session()

    def chat_json(self, messages: list[dict[str, str]]) -> str:
        """Call Ollama chat endpoint and return assistant text content."""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "format": "json",
            "options": {"temperature": 0},
            "stream": False,
        }

        url = f"{self.base_url}/api/chat"
        last_error: Exception | None = None
        attempts = max(1, self.retries + 1)

        for attempt in range(1, attempts + 1):
            try:
                response = self.session.post(url, json=payload, timeout=self.timeout_seconds)
                response.raise_for_status()

                body = response.json()
                message = body.get("message") or {}
                content = message.get("content")
                if not isinstance(content, str):
                    raise OllamaClientError("Missing text content in Ollama response")
                return content
            except (requests.RequestException, ValueError, OllamaClientError) as exc:
                last_error = exc
                logger.warning(
                    "Ollama request failed (attempt %s/%s): %s",
                    attempt,
                    attempts,
                    exc,
                )
                if attempt < attempts:
                    time.sleep(1.5 * attempt)

        raise OllamaClientError(f"Ollama request failed after {attempts} attempts: {last_error}")
