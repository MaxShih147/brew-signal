# Merch Pressure — LIVE Indicator

## Overview

`merch_pressure` measures supply saturation by querying Taiwanese e-commerce platforms for product listings related to an IP. More products = more saturated market = higher supply risk.

**Dimension**: Supply/Competition
**Type**: LIVE (with MANUAL fallback)
**Sources**: Shopee TW (蝦皮), Ruten (露天)

## Data Flow

```
tw_ecommerce_connector.py  →  merch_sync_service.py  →  collect.py router  →  IpDetail.tsx button
     (Shopee + Ruten)            (orchestrator)             (endpoint)           (UI trigger)
```

## Connectors

### Shopee TW
- Endpoint: `https://shopee.tw/api/v4/search/search_items?keyword={query}&limit=1`
- Extracts `total_count` from JSON response
- Anti-bot: Aggressive. Expects failure ~50% of the time. Returns `None` on any error.

### Ruten (露天)
- Endpoint: `https://rtapi.ruten.com.tw/api/search/v3/index.php/core/prod?q={query}&type=direct&sort=rnk/dc&offset=1&limit=1`
- Extracts `TotalCount` from JSON response
- More accessible than Shopee, but still may rate-limit.

### Rate Limiting
- 3 seconds between requests (conservative for anti-bot)
- Max 3 search terms per platform per IP

## Alias Priority

TW e-commerce platforms index primarily in Chinese:
1. `zh` locale aliases (best match for 蝦皮 / 露天)
2. `en` / `jp` locale aliases
3. IP name (fallback)

Takes the **max product count** across aliases per platform (best alias match).

## Scoring Formula

```python
total = sum(product_counts across all platforms)  # skip None/failed
raw = log10(1 + total) / log10(1 + 10000) * 100
score = clamp(0, 100, raw)
```

### Interpretation

| Product Count | Score | Meaning |
|--------------|-------|---------|
| 0 | 0 | No merch — wide open market |
| ~10 | ~25 | Minimal — early/niche IP |
| ~100 | ~50 | Moderate — some competition |
| ~1,000 | ~75 | Heavy — saturated market |
| ~10,000+ | ~100 | Extremely saturated |

## BD Score Impact

`merch_pressure` is in the **supply dimension**, which acts as a risk dampener:
- High merch_pressure → high supply → lower BD score (risky to enter saturated market)
- Low merch_pressure → open market → higher BD score (opportunity to be first mover)

## Database

### Table: `merch_product_count`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| ip_id | UUID FK → ip.id | |
| platform | String(20) | "shopee" or "ruten" |
| query_term | String(255) | The alias used for search |
| product_count | Integer | Total products found |
| recorded_at | DateTime | When data was fetched |

Unique constraint: `(ip_id, platform)` — one row per platform, updated on re-sync.

## API

- `POST /api/collect/merch-sync/{ip_id}` — Sync single IP
- `POST /api/collect/merch-sync-all` — Sync all IPs

### Response: `MerchSyncResult`
```json
{
  "ip_id": "...",
  "ip_name": "葬送的芙莉蓮",
  "shopee_count": 1234,
  "ruten_count": 567,
  "errors": []
}
```

`null` for a platform count means that platform's queries all failed (anti-bot block, timeout, etc.).

## Fallback Behavior

If no `MerchProductCount` data exists for an IP, `merch_pressure` falls back to MANUAL slider input (default 50 = neutral).
