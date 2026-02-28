"""OpenAI Chat Completions client for structured JSON extraction."""
from __future__ import annotations

import logging
import time
from typing import Any

from openai import APIConnectionError, APIError, APITimeoutError, OpenAI, RateLimitError

from app.config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_RETRIES, OPENAI_TIMEOUT_SECONDS

logger = logging.getLogger(__name__)


class OpenAIClientError(RuntimeError):
    """Raised when OpenAI requests fail after retries or malformed responses."""


class OpenAIClient:
    """Simple wrapper around OpenAI Chat Completions."""

    def __init__(
        self,
        api_key: str = OPENAI_API_KEY,
        model: str = OPENAI_MODEL,
        timeout_seconds: int = OPENAI_TIMEOUT_SECONDS,
        retries: int = OPENAI_RETRIES,
    ):
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.retries = retries

        if not self.api_key:
            raise OpenAIClientError("OPENAI_API_KEY is missing. Set it in .env or environment.")

        self.client = OpenAI(api_key=self.api_key, timeout=self.timeout_seconds, max_retries=0)

    def chat_json(
        self,
        messages: list[dict[str, str]],
        response_schema: dict[str, Any],
        schema_name: str = "accident_extraction",
    ) -> str:
        """Call OpenAI and return response content as JSON string."""
        attempts = max(1, self.retries + 1)
        last_error: Exception | None = None

        for attempt in range(1, attempts + 1):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=0,
                    response_format={
                        "type": "json_schema",
                        "json_schema": {
                            "name": schema_name,
                            "schema": response_schema,
                            "strict": True,
                        },
                    },
                )
                content = response.choices[0].message.content
                if not isinstance(content, str) or not content.strip():
                    raise OpenAIClientError("Missing text content in OpenAI response")
                return content
            except (APIConnectionError, APITimeoutError, RateLimitError, APIError, OpenAIClientError) as exc:
                last_error = exc
                logger.warning(
                    "OpenAI request failed (attempt %s/%s): %s",
                    attempt,
                    attempts,
                    exc,
                )
                if attempt < attempts:
                    time.sleep(1.5 * attempt)

        raise OpenAIClientError(f"OpenAI request failed after {attempts} attempts: {last_error}")
