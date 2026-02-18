"""YouTube sync service: search videos for an IP, fetch stats, and store metrics.

Follows the MAL sync pattern:
- Search by IP aliases (en/jp first)
- Title validation: video title must contain an alias
- Upsert YouTubeVideoMetric rows
- Update IPSourceHealth for source_key="youtube"
- Log SourceRun
- Recompute confidence
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import IP, IPAlias, YouTubeVideoMetric, IPSourceHealth, SourceRun
from app.connectors.youtube_connector import YouTubeConnector
from app.services.confidence_service import compute_ip_confidence
from app.config import settings

logger = logging.getLogger(__name__)


def _is_title_match(aliases: list[str], video_title: str) -> bool:
    """Check if a video title contains any of the IP aliases (case-insensitive)."""
    title_lower = video_title.lower().strip()
    for alias in aliases:
        alias_lower = alias.lower().strip()
        if len(alias_lower) >= 2 and alias_lower in title_lower:
            return True
    return False


async def sync_ip_from_youtube(db: AsyncSession, ip_id: uuid.UUID) -> dict:
    """Sync one IP from YouTube. Returns result dict matching YouTubeSyncResult schema."""
    connector = YouTubeConnector()
    errors: list[str] = []
    videos_added = 0
    videos_updated = 0
    run_started = datetime.now(timezone.utc)

    if not settings.youtube_api_key:
        return {
            "ip_id": ip_id, "ip_name": "unknown",
            "videos_added": 0, "videos_updated": 0,
            "errors": ["YOUTUBE_API_KEY not configured"],
        }

    # Load IP
    ip_result = await db.execute(select(IP).where(IP.id == ip_id))
    ip = ip_result.scalar_one_or_none()
    if not ip:
        return {
            "ip_id": ip_id, "ip_name": "unknown",
            "videos_added": 0, "videos_updated": 0,
            "errors": ["IP not found"],
        }

    # Get aliases — prioritize en/jp for YouTube search (better results)
    alias_result = await db.execute(
        select(IPAlias.alias, IPAlias.locale).where(
            IPAlias.ip_id == ip_id, IPAlias.enabled == True,
        )
    )
    aliases = alias_result.all()

    # Build search terms: en/jp first, then others
    priority_terms = []
    other_terms = [ip.name]
    all_alias_strings = [ip.name]
    for row in aliases:
        alias, locale = row[0], row[1]
        all_alias_strings.append(alias)
        if alias in priority_terms or alias in other_terms:
            continue
        if locale in ("en", "jp"):
            priority_terms.append(alias)
        else:
            other_terms.append(alias)

    search_terms = priority_terms + other_terms

    # Search YouTube for videos using top search terms
    recency_cutoff = datetime.now(timezone.utc) - timedelta(days=settings.youtube_recency_days)
    published_after = recency_cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")

    all_video_ids: list[str] = []
    seen_video_ids: set[str] = set()

    for term in search_terms[:3]:  # limit to 3 search queries = 300 units
        results = await connector.search_videos(
            query=term,
            max_results=settings.youtube_max_results,
            published_after=published_after,
        )
        for item in results:
            vid_id = item.get("id", {}).get("videoId")
            if vid_id and vid_id not in seen_video_ids:
                seen_video_ids.add(vid_id)
                all_video_ids.append(vid_id)

    if not all_video_ids:
        errors.append(f"No YouTube videos found for '{ip.name}' (searched: {search_terms[:3]})")
    else:
        # Fetch stats for all discovered videos (1 unit per batch of 50)
        video_details = await connector.get_video_stats(all_video_ids)

        for video in video_details:
            snippet = video.get("snippet", {})
            stats = video.get("statistics", {})
            video_title = snippet.get("title", "")

            # Title validation: video must mention one of the IP aliases
            if not _is_title_match(all_alias_strings, video_title):
                continue

            video_id = video.get("id", "")
            published_at_str = snippet.get("publishedAt", "")
            try:
                published_at = datetime.fromisoformat(published_at_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                published_at = datetime.now(timezone.utc)

            view_count = int(stats.get("viewCount", 0))
            like_count = int(stats.get("likeCount", 0))
            comment_count = int(stats.get("commentCount", 0))
            channel_title = snippet.get("channelTitle", "")

            now = datetime.now(timezone.utc)

            # Upsert: one row per (ip_id, video_id)
            stmt = pg_insert(YouTubeVideoMetric).values(
                id=uuid.uuid4(),
                ip_id=ip_id,
                video_id=video_id,
                title=video_title[:255],
                channel_title=channel_title[:255],
                published_at=published_at,
                view_count=view_count,
                like_count=like_count,
                comment_count=comment_count,
                recorded_at=now,
            ).on_conflict_do_update(
                constraint="uq_youtube_video_metric",
                set_={
                    "title": video_title[:255],
                    "view_count": view_count,
                    "like_count": like_count,
                    "comment_count": comment_count,
                    "recorded_at": now,
                },
            )

            result = await db.execute(stmt)
            # Check if this was an insert or update
            if result.rowcount > 0:
                # We can't easily distinguish insert vs update with pg_insert,
                # but the unique constraint means it's either new or updated
                videos_added += 1

    # Update IPSourceHealth for youtube
    now = datetime.now(timezone.utc)
    success = videos_added > 0 or videos_updated > 0
    status = "ok" if success else ("warn" if all_video_ids else "down")
    last_error = errors[0] if errors else None

    stmt = pg_insert(IPSourceHealth).values(
        id=uuid.uuid4(),
        ip_id=ip_id,
        source_key="youtube",
        last_success_at=now if success else None,
        last_attempt_at=now,
        status=status,
        staleness_hours=0 if success else None,
        last_error=last_error,
        updated_items=videos_added,
    ).on_conflict_do_update(
        constraint="uq_ip_source_health",
        set_={
            "last_attempt_at": now,
            "status": status,
            "staleness_hours": 0 if success else None,
            "last_error": last_error,
            "updated_items": videos_added,
            **({"last_success_at": now} if success else {}),
        },
    )
    await db.execute(stmt)

    # Log SourceRun
    run_finished = datetime.now(timezone.utc)
    duration_ms = int((run_finished - run_started).total_seconds() * 1000)
    source_run = SourceRun(
        source_key="youtube",
        started_at=run_started,
        finished_at=run_finished,
        status="ok" if success else "warn",
        duration_ms=duration_ms,
        items_processed=len(all_video_ids),
        items_succeeded=videos_added,
        items_failed=len(errors),
        error_sample=errors[0] if errors else None,
    )
    db.add(source_run)

    await db.commit()

    # Recompute confidence
    try:
        await compute_ip_confidence(db, ip_id)
    except Exception as e:
        logger.warning("Failed to recompute confidence for %s: %s", ip_id, e)

    return {
        "ip_id": ip_id,
        "ip_name": ip.name,
        "videos_added": videos_added,
        "videos_updated": videos_updated,
        "errors": errors,
    }


async def sync_all_ips(db: AsyncSession) -> list[dict]:
    """Sync all IPs from YouTube sequentially (rate-limit friendly)."""
    ip_result = await db.execute(select(IP.id).order_by(IP.created_at))
    ip_ids = [row[0] for row in ip_result.all()]

    results = []
    for ip_id in ip_ids:
        result = await sync_ip_from_youtube(db, ip_id)
        results.append(result)

    return results
