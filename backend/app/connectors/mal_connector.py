"""Jikan API (MyAnimeList) connector.

Jikan v4 docs: https://docs.api.jikan.moe/
Rate limit: 60 req/min, 3 req/sec — we use 1 req/sec to be safe.
No authentication required.
"""
import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.jikan.moe/v4"
REQUEST_INTERVAL = 1.0  # seconds between requests


class MALConnector:
    def __init__(self) -> None:
        self._last_request_at: float = 0

    async def _rate_limit(self) -> None:
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_at
        if elapsed < REQUEST_INTERVAL:
            await asyncio.sleep(REQUEST_INTERVAL - elapsed)
        self._last_request_at = asyncio.get_event_loop().time()

    async def _get(self, path: str, params: dict | None = None) -> dict | None:
        await self._rate_limit()
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(f"{BASE_URL}{path}", params=params)
                if resp.status_code == 429:
                    logger.warning("Jikan rate limited, waiting 2s and retrying")
                    await asyncio.sleep(2.0)
                    resp = await client.get(f"{BASE_URL}{path}", params=params)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                logger.error("Jikan HTTP error %s for %s: %s", e.response.status_code, path, e)
                return None
            except httpx.RequestError as e:
                logger.error("Jikan request error for %s: %s", path, e)
                return None

    async def search_anime(self, name: str, limit: int = 5) -> list[dict]:
        """Search anime by name. Returns list of result dicts."""
        data = await self._get("/anime", params={"q": name, "limit": limit})
        if not data:
            return []
        return data.get("data", [])

    async def get_anime(self, mal_id: int) -> dict | None:
        """Get full anime details by MAL ID."""
        data = await self._get(f"/anime/{mal_id}")
        if not data:
            return None
        return data.get("data")

    async def get_relations(self, mal_id: int) -> list[dict]:
        """Get related anime/manga for a MAL ID."""
        data = await self._get(f"/anime/{mal_id}/relations")
        if not data:
            return []
        return data.get("data", [])
