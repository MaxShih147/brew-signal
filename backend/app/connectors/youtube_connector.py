"""YouTube Data API v3 connector.

Docs: https://developers.google.com/youtube/v3/docs
Quota: 10,000 units/day (free tier).
  - search.list: 100 units/call
  - videos.list: 1 unit/call (batch up to 50)
Rate limit: 1 req/sec to stay safe.
"""
import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://www.googleapis.com/youtube/v3"
REQUEST_INTERVAL = 1.0  # seconds between requests


class YouTubeConnector:
    def __init__(self) -> None:
        self._last_request_at: float = 0
        self._api_key = settings.youtube_api_key

    async def _rate_limit(self) -> None:
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_at
        if elapsed < REQUEST_INTERVAL:
            await asyncio.sleep(REQUEST_INTERVAL - elapsed)
        self._last_request_at = asyncio.get_event_loop().time()

    async def _get(self, path: str, params: dict) -> dict | None:
        await self._rate_limit()
        params["key"] = self._api_key
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(f"{BASE_URL}{path}", params=params)
                if resp.status_code == 403:
                    body = resp.json()
                    reason = body.get("error", {}).get("errors", [{}])[0].get("reason", "")
                    if reason == "quotaExceeded":
                        logger.error("YouTube API quota exceeded")
                        return None
                    logger.error("YouTube API forbidden: %s", body)
                    return None
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                logger.error("YouTube HTTP error %s for %s: %s", e.response.status_code, path, e)
                return None
            except httpx.RequestError as e:
                logger.error("YouTube request error for %s: %s", path, e)
                return None

    async def search_videos(
        self, query: str, max_results: int = 10, published_after: str | None = None,
    ) -> list[dict]:
        """Search videos by query. Returns list of search result items.

        Cost: 100 units per call.
        """
        params: dict = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": max_results,
            "order": "relevance",
        }
        if published_after:
            params["publishedAfter"] = published_after

        data = await self._get("/search", params)
        if not data:
            return []
        return data.get("items", [])

    async def get_video_stats(self, video_ids: list[str]) -> list[dict]:
        """Get video statistics for a batch of video IDs.

        Cost: 1 unit per call, batches up to 50 IDs.
        """
        if not video_ids:
            return []

        all_results = []
        # Batch in groups of 50
        for i in range(0, len(video_ids), 50):
            batch = video_ids[i:i + 50]
            data = await self._get("/videos", {
                "part": "snippet,statistics",
                "id": ",".join(batch),
            })
            if data:
                all_results.extend(data.get("items", []))
        return all_results
