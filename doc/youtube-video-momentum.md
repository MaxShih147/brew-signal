# YouTube Video Momentum — Scoring Algorithm

## Overview

`video_momentum` is one of 3 demand indicators (weight 0.30 in BD score).
It measures how much video attention an IP is getting on YouTube right now,
with emphasis on recency and velocity rather than absolute view counts.

**Source**: YouTube Data API v3
**Indicator type**: LIVE (auto-computed), falls back to MANUAL slider if no YouTube data
**API cost**: ~103 units per IP sync (3 search calls + 1 stats batch)
**Free tier budget**: 10,000 units/day → ~97 IPs/day

---

## Data Collection Pipeline

```
youtube_connector.py  →  youtube_sync_service.py  →  collect.py router  →  IpDetail.tsx button
     (API client)           (orchestrator)              (endpoint)            (UI trigger)
```

### Step 1: Search (youtube_connector.py)

For each IP, search YouTube using the IP's aliases:
- **Priority order**: en/jp aliases first (better YouTube search results), then zh/other
- **Limit**: top 3 search terms, 10 results each (= 300 units max)
- **Recency filter**: only videos published in the last 90 days (`youtube_recency_days` config)
- **Dedup**: video IDs are deduped across search queries

### Step 2: Stats Fetch

All unique video IDs are batched into a single `videos.list` call (up to 50 per batch, 1 unit each).
Returns: view count, like count, comment count, publish date, channel name.

### Step 3: Title Validation

Each video's title is checked against ALL IP aliases (including the IP name itself).
A video is **kept** only if its title contains at least one alias (case-insensitive, min 2 chars).

This prevents false positives — e.g. searching "Frieren" might return unrelated videos,
but only videos with "Frieren", "フリーレン", or "芙莉蓮" in the title are stored.

### Step 4: Upsert

Videos are stored in `youtube_video_metric` table with unique constraint on `(ip_id, video_id)`.
Re-syncing updates stats (views/likes/comments) without creating duplicates.

---

## Scoring Formula

```python
For each video published in last 90 days:
    age_days = max(1, (now - published_at).days)
    velocity = view_count / age_days           # views per day
    recency_weight = 1.0 / (1.0 + age_days / 30)  # newer = heavier

Aggregate:
    weighted_velocity = sum(velocity * recency_weight) / video_count
    raw = log10(1 + weighted_velocity) / log10(1 + 10000) * 100
    score = clamp(0, 100, raw)

Viral boost:
    If ANY video has > 1,000,000 views AND < 14 days old → score += 15
    (clamped to 100)
```

### Why this formula?

| Component | Purpose |
|-----------|---------|
| `velocity = views / age_days` | Normalizes for video age — a 1-day-old video with 100K views is more impressive than a 90-day-old one |
| `recency_weight = 1 / (1 + age/30)` | Exponential-ish decay — videos from this week matter 3x more than 90-day-old ones |
| `log10` normalization | Compresses the huge range of YouTube view counts (100 vs 10M) into 0-100 |
| `log10(1 + 10000)` as denominator | Sets the "100 point" calibration — ~10K views/day weighted velocity = score 100 |
| Viral boost (+15) | Captures explosive moments (trailer drops, episode releases) that signal immediate BD urgency |

### Score Interpretation

| Score Range | Meaning |
|------------|---------|
| 80-100 | Viral / explosive momentum — multiple high-velocity recent videos |
| 60-79 | Strong momentum — active video content with good view velocity |
| 40-59 | Moderate — some video activity, not exceptional |
| 20-39 | Low — few videos or old/low-view content |
| 0-19 | Minimal — almost no recent YouTube presence |

---

## Database Schema

```sql
youtube_video_metric:
    id              UUID PK
    ip_id           UUID FK → ip.id (CASCADE)
    video_id        String(11)      -- YouTube video ID
    title           String(255)
    channel_title   String(255)
    published_at    DateTime(tz)
    view_count      Integer
    like_count      Integer
    comment_count   Integer
    recorded_at     DateTime(tz)    -- when we fetched this data

    UNIQUE(ip_id, video_id)         -- one row per video per IP, updated on re-sync
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `YOUTUBE_API_KEY` | (required) | Google API key with YouTube Data API v3 enabled |
| `youtube_max_results` | 10 | Max videos per search query |
| `youtube_recency_days` | 90 | Only consider videos published within this window |
| `staleness_youtube_fresh_h` | 72 | Hours before YouTube data is considered stale |
| `staleness_youtube_warn_h` | 168 | Hours before YouTube source status goes to "down" |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/collect/youtube-sync/{ip_id}` | Sync one IP |
| POST | `/api/collect/youtube-sync-all` | Sync all IPs (sequential, rate-limited) |

### Response Schema (YouTubeSyncResult)

```json
{
    "ip_id": "uuid",
    "ip_name": "芙莉蓮",
    "videos_added": 20,
    "videos_updated": 0,
    "errors": []
}
```

---

## Integration with BD Score

`video_momentum` feeds into the **demand dimension** alongside `search_momentum` and `social_buzz`.
The demand dimension has weight 0.30 in the BD score formula:

```
bd_score = 0.35 * timing_urgency
         + 0.30 * demand_trajectory    ← video_momentum contributes here
         + 0.20 * market_gap
         + 0.15 * feasibility
```

When YouTube data exists, `video_momentum` becomes LIVE and also:
- Increases the IP's **confidence score** (one more active indicator + active source)
- Removes `video_momentum` from the **missing key indicators** penalty in confidence calculation

---

## Quota Budget Planning

| Operation | Units | Per IP |
|-----------|-------|--------|
| search.list (up to 3 queries) | 100 each | 300 |
| videos.list (1 batch) | 1 | 1 |
| **Total per IP** | | **~301** |

Free tier: 10,000 units/day → **~33 IPs/day** (with 3 search queries each)

To optimize: reduce `youtube_max_results` or search fewer aliases.
