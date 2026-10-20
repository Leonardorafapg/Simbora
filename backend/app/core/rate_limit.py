# backend/app/core/rate_limit.py
"""Limitador de tentativas em memória (janela deslizante). Vale por instância — o backend roda com 1 réplica."""
import threading
import time
from collections import defaultdict, deque

from fastapi import Request


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, window: float, now: float) -> deque[float]:
        hits = self._hits[key]
        while hits and now - hits[0] > window:
            hits.popleft()
        return hits

    def is_limited(self, key: str, limit: int, window_seconds: float) -> bool:
        with self._lock:
            return len(self._prune(key, window_seconds, time.monotonic())) >= limit

    def hit(self, key: str, window_seconds: float) -> None:
        with self._lock:
            now = time.monotonic()
            self._prune(key, window_seconds, now).append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
