"""TW e-commerce connectors: Shopee TW + Ruten.

Used to estimate merch_pressure (supply saturation) by querying product counts
for an IP keyword on Taiwanese e-commerce platforms.

Both platforms may block automated requests — failures are expected and handled
gracefully (returns None).
"""
import asyncio
import logging
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

REQUEST_INTERVAL = 3.0  # seconds between requests (conservative for anti-bot)
REQUEST_TIMEOUT = 15.0


class ShopeeConnector:
    """Query Shopee TW search API for product counts."""

    def __init__(self) -> None:
        self._last_request_at: float = 0

    async def _rate_limit(self) -> None:
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_at
        if elapsed < REQUEST_INTERVAL:
            await asyncio.sleep(REQUEST_INTERVAL - elapsed)
        self._last_request_at = asyncio.get_event_loop().time()

    async def search_product_count(self, query: str) -> int | None:
        """Search Shopee TW and return total product count, or None on failure."""
        await self._rate_limit()
        encoded = urllib.parse.quote(query)
        url = f"https://shopee.tw/api/v4/search/search_items?keyword={encoded}&limit=1&newest=0&order=relevancy&page_type=search&scenario=PAGE_GLOBAL_SEARCH&version=2"
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://shopee.tw/",
            "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
            "Accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    logger.warning("Shopee returned %d for query '%s'", resp.status_code, query)
                    return None
                data = resp.json()
                total = data.get("total_count")
                if total is not None:
                    return int(total)
                # Alternative key in some API versions
                total = data.get("nomore")
                if total is not None:
                    # nomore=true means <60 items; approximate as count of items
                    items = data.get("items") or []
                    return len(items)
                logger.warning("Shopee response missing total_count for '%s'", query)
                return None
        except httpx.HTTPStatusError as e:
            logger.warning("Shopee HTTP error for '%s': %s", query, e)
            return None
        except httpx.RequestError as e:
            logger.warning("Shopee request error for '%s': %s", query, e)
            return None
        except Exception as e:
            logger.warning("Shopee unexpected error for '%s': %s", query, e)
            return None


class RutenConnector:
    """Query Ruten (露天) search API for product counts."""

    def __init__(self) -> None:
        self._last_request_at: float = 0

    async def _rate_limit(self) -> None:
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_at
        if elapsed < REQUEST_INTERVAL:
            await asyncio.sleep(REQUEST_INTERVAL - elapsed)
        self._last_request_at = asyncio.get_event_loop().time()

    async def search_product_count(self, query: str) -> int | None:
        """Search Ruten and return total product count, or None on failure."""
        await self._rate_limit()
        params = {
            "q": query,
            "type": "direct",
            "sort": "rnk/dc",
            "offset": "1",
            "limit": "1",
        }
        url = "https://rtapi.ruten.com.tw/api/search/v3/index.php/core/prod"
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code != 200:
                    logger.warning("Ruten returned %d for query '%s'", resp.status_code, query)
                    return None
                data = resp.json()
                # Ruten returns various keys depending on API version
                for key in ("TotalCount", "TotalRows", "totalRows", "total_count", "totalPage"):
                    val = data.get(key)
                    if val is not None:
                        return int(val)
                logger.warning("Ruten response missing total count for '%s': keys=%s", query, list(data.keys()))
                return None
        except httpx.HTTPStatusError as e:
            logger.warning("Ruten HTTP error for '%s': %s", query, e)
            return None
        except httpx.RequestError as e:
            logger.warning("Ruten request error for '%s': %s", query, e)
            return None
        except Exception as e:
            logger.warning("Ruten unexpected error for '%s': %s", query, e)
            return None
