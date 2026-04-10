"""
Lightweight in-memory rate limiter for FastAPI.

Uses a per-IP sliding-window counter stored in a dict.
No external dependencies — suitable for single-process deployments.
For multi-worker / multi-node setups swap to Redis-backed limiter.
"""
import time
import threading
from collections import defaultdict
from typing import Dict, Tuple

from fastapi import Request, HTTPException


class RateLimiter:
    """Simple sliding-window rate limiter keyed by client IP."""

    def __init__(self, max_calls: int = 5, window_seconds: int = 60):
        self.max_calls = max_calls
        self.window = window_seconds
        self._hits: Dict[str, list] = defaultdict(list)
        self._lock = threading.Lock()

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def check(self, request: Request) -> Tuple[bool, int]:
        """
        Returns (allowed: bool, retry_after: int).
        Cleans stale entries on every call.
        """
        ip = self._client_ip(request)
        now = time.monotonic()
        cutoff = now - self.window

        with self._lock:
            self._hits[ip] = [t for t in self._hits[ip] if t > cutoff]
            if not self._hits[ip]:
                del self._hits[ip]
                return True, 0

            if len(self._hits[ip]) >= self.max_calls:
                retry_after = int(self._hits[ip][0] - cutoff) + 1
                return False, retry_after

            self._hits[ip].append(now)
            return True, 0

    def __call__(self, request: Request):
        """Use as a FastAPI dependency: Depends(rate_limiter)."""
        allowed, retry_after = self.check(request)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )


# Pre-configured instance for the /api/scrape endpoint
# 3 calls per 60 seconds per IP
scrape_limiter = RateLimiter(max_calls=3, window_seconds=60)
