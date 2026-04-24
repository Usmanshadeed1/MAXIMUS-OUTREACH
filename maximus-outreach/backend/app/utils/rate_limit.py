"""
Simple in-memory sliding-window rate limiter.
Suitable for single-process dev/production on Windows (no Redis required yet).
Upgrade to Redis-backed limiter when Celery/Memurai is added in Phase 11.
"""
import time
from collections import defaultdict, deque
from threading import Lock


class _RateLimiter:
    def __init__(self):
        self._buckets: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def is_allowed(self, key: str, max_calls: int, window_seconds: int) -> bool:
        """Return True if the call is within the allowed rate, False if rate exceeded."""
        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            bucket = self._buckets[key]
            # Evict timestamps outside the window
            while bucket and bucket[0] < cutoff:
                bucket.popleft()

            if len(bucket) >= max_calls:
                return False

            bucket.append(now)
            return True

    def clear(self, key: str) -> None:
        """Clear rate limit record for a key (e.g., after successful login)."""
        with self._lock:
            self._buckets.pop(key, None)


# Shared singleton
limiter = _RateLimiter()
