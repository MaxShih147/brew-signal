from __future__ import annotations

import logging

from app.collectors.base import BaseTrendCollector, CollectResult
from app.config import settings

logger = logging.getLogger(__name__)


class OfficialTrendsCollector(BaseTrendCollector):
    """Stub for Google Trends official API (alpha).

    Enable by setting GOOGLE_TRENDS_API_KEY and GOOGLE_TRENDS_PROJECT_ID
    and COLLECTOR_SOURCE=official in .env.
    """

    async def fetch(self, keyword: str, geo: str, timeframe_str: str) -> CollectResult:
        if not settings.google_trends_api_key:
            return CollectResult(
                success=False,
                error_code="auth",
                message="Official Google Trends API key not configured. Set GOOGLE_TRENDS_API_KEY in .env",
            )

        # TODO: Implement actual API call when credentials are available.
        # The official API endpoint and auth flow should be added here.
        logger.info(f"Official collector stub called for keyword={keyword}, geo={geo}, tf={timeframe_str}")

        return CollectResult(
            success=False,
            error_code="unknown",
            message="Official collector not yet implemented — use pytrends fallback",
        )
