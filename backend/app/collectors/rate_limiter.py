import asyncio
import time
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple token-bucket rate limiter."""

    def __init__(self, min_interval_sec: float = 5.0):
        self._min_interval = min_interval_sec
        self._last_request = 0.0

    async def wait(self):
        now = time.monotonic()
        elapsed = now - self._last_request
        if elapsed < self._min_interval:
            wait_time = self._min_interval - elapsed
            logger.debug(f"Rate limiter: waiting {wait_time:.1f}s")
            await asyncio.sleep(wait_time)
        self._last_request = time.monotonic()


class CircuitBreaker:
    """Simple circuit breaker that disables requests after N consecutive failures."""

    def __init__(self, threshold: int = 5, cooldown_sec: int = 1800):
        self._threshold = threshold
        self._cooldown_sec = cooldown_sec
        self._consecutive_failures = 0
        self._open_until: float = 0.0

    @property
    def is_open(self) -> bool:
        if self._consecutive_failures >= self._threshold:
            if time.monotonic() < self._open_until:
                return True
            # Cooldown expired, half-open
            self._consecutive_failures = 0
        return False

    def record_success(self):
        self._consecutive_failures = 0

    def record_failure(self):
        self._consecutive_failures += 1
        if self._consecutive_failures >= self._threshold:
            self._open_until = time.monotonic() + self._cooldown_sec
            logger.warning(
                f"Circuit breaker OPEN: {self._consecutive_failures} consecutive failures. "
                f"Disabled for {self._cooldown_sec}s."
            )
