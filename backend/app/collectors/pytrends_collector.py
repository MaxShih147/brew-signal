from __future__ import annotations

import asyncio
import logging
from datetime import datetime, date, timedelta
from functools import partial

from pytrends.request import TrendReq

from app.collectors.base import BaseTrendCollector, CollectResult, TrendDataPoint
from app.collectors.rate_limiter import RateLimiter, CircuitBreaker
from app.config import settings

logger = logging.getLogger(__name__)

# Module-level singletons
_rate_limiter = RateLimiter(min_interval_sec=settings.pytrends_request_interval_sec)
_circuit_breaker = CircuitBreaker(
    threshold=settings.pytrends_circuit_breaker_threshold,
    cooldown_sec=settings.pytrends_circuit_breaker_cooldown_sec,
)

TIMEFRAME_MAP = {
    "90d": "today 3-m",
    "12m": "today 12-m",
    "5y": "today 5-y",
}

GEO_MAP = {
    "TW": "TW",
    "JP": "JP",
    "US": "US",
    "WW": "",
}


def _fetch_sync(keyword: str, geo: str, timeframe: str) -> CollectResult:
    """Blocking pytrends call — run in executor."""
    try:
        pytrends = TrendReq(hl="en-US", tz=480)
        pytrends.build_payload([keyword], cat=0, timeframe=timeframe, geo=geo)
        df = pytrends.interest_over_time()

        if df is None or df.empty:
            return CollectResult(success=False, error_code="empty", message="No data returned")

        # Drop isPartial column if present
        if "isPartial" in df.columns:
            df = df.drop(columns=["isPartial"])

        points = []
        for idx, row in df.iterrows():
            d = idx.date() if hasattr(idx, "date") else idx
            points.append(TrendDataPoint(date=d, value=int(row[keyword])))

        return CollectResult(success=True, points=points, http_code=200)

    except Exception as e:
        error_str = str(e).lower()
        error_code = "unknown"
        http_code = None

        if "429" in error_str or "rate" in error_str:
            error_code = "rate_limit"
            http_code = 429
        elif "401" in error_str:
            error_code = "auth"
            http_code = 401
        elif "403" in error_str:
            error_code = "auth"
            http_code = 403
        elif "timeout" in error_str:
            error_code = "timeout"

        return CollectResult(success=False, http_code=http_code, error_code=error_code, message=str(e))


class PytrendsCollector(BaseTrendCollector):
    async def fetch(self, keyword: str, geo: str, timeframe_str: str) -> CollectResult:
        if _circuit_breaker.is_open:
            return CollectResult(
                success=False,
                error_code="rate_limit",
                message="Circuit breaker is open — collector disabled temporarily",
            )

        mapped_tf = TIMEFRAME_MAP.get(timeframe_str, "today 12-m")
        mapped_geo = GEO_MAP.get(geo, "")

        retries = settings.pytrends_max_retries
        last_result = None

        for attempt in range(1, retries + 1):
            await _rate_limiter.wait()

            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, partial(_fetch_sync, keyword, mapped_geo, mapped_tf))

            if result.success:
                _circuit_breaker.record_success()
                return result

            last_result = result
            logger.warning(f"pytrends attempt {attempt}/{retries} failed: {result.error_code} - {result.message}")

            if result.error_code in ("auth",):
                break  # Don't retry auth errors

            if attempt < retries:
                backoff = 2 ** attempt
                logger.info(f"Backing off {backoff}s before retry")
                await asyncio.sleep(backoff)

        _circuit_breaker.record_failure()
        return last_result or CollectResult(success=False, error_code="unknown", message="All retries exhausted")
