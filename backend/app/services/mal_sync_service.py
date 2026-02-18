"""MAL sync service: fetch anime metadata from Jikan and upsert IPEvent records.

Handles:
- Search by IP name + aliases → match MAL entry → store mal_id
- Fetch anime details + relations → extract upcoming events
- Upsert events into IPEvent (dedup by ip_id + title + event_date + source)
- Update IPSourceHealth for wiki_mal
- Log to SourceRun
- Recompute confidence
"""
import uuid
import logging
from datetime import datetime, date, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import IP, IPAlias, IPEvent, IPSourceHealth, SourceRun
from app.connectors.mal_connector import MALConnector
from app.services.confidence_service import compute_ip_confidence

logger = logging.getLogger(__name__)


def _parse_air_date(aired: dict | None) -> date | None:
    """Extract a date from Jikan's aired.from / aired.to field."""
    if not aired:
        return None
    from_str = aired.get("from")
    if not from_str:
        return None
    try:
        return datetime.fromisoformat(from_str.replace("+00:00", "+00:00")).date()
    except (ValueError, TypeError):
        return None


def _is_title_match(search_term: str, anime_data: dict) -> bool:
    """Check if a MAL search result's titles overlap with our search term.

    Uses bidirectional substring containment: the search term must appear
    within a MAL title, or a MAL title must appear within the search term.
    This prevents false positives like matching "芙莉蓮" to "蓮ノ空" (Love Live).
    """
    titles: list[str] = []
    for key in ("title", "title_english", "title_japanese"):
        val = anime_data.get(key)
        if val:
            titles.append(val)
    for t in anime_data.get("titles", []):
        if t.get("title"):
            titles.append(t["title"])

    term_lower = search_term.lower().strip()
    if not term_lower:
        return False

    for title in titles:
        title_lower = title.lower().strip()
        # Require the matched substring to be at least 2 chars to avoid
        # single-character overlaps (e.g. 蓮 matching 蓮華)
        if len(term_lower) >= 2 and term_lower in title_lower:
            return True
        if len(title_lower) >= 2 and title_lower in term_lower:
            return True

    return False


def _map_event_type(mal_type: str | None, mal_status: str | None) -> str | None:
    """Map MAL type/status to our event_type. Returns None if not relevant."""
    if not mal_type or not mal_status:
        return None
    # Skip already-finished entries — no future event value
    if mal_status == "Finished Airing":
        return None
    mal_type_lower = mal_type.lower()
    if mal_type_lower == "movie":
        return "movie_release"
    if mal_type_lower in ("tv", "ova", "special", "ona"):
        return "anime_air"
    return None


async def sync_ip_from_mal(
    db: AsyncSession, ip_id: uuid.UUID,
) -> dict:
    """Sync one IP from MAL. Returns result dict matching MALSyncResult schema."""
    connector = MALConnector()
    errors: list[str] = []
    events_added = 0
    events_skipped = 0
    matched = False
    mal_id_found: int | None = None

    run_started = datetime.now(timezone.utc)

    # Load IP
    ip_result = await db.execute(select(IP).where(IP.id == ip_id))
    ip = ip_result.scalar_one_or_none()
    if not ip:
        return {
            "ip_id": ip_id, "ip_name": "unknown", "mal_id": None,
            "matched": False, "events_added": 0, "events_skipped": 0,
            "errors": ["IP not found"],
        }

    # 1. Resolve mal_id: use stored or search
    if ip.mal_id:
        mal_id_found = ip.mal_id
        matched = True
        logger.info("IP %s already has mal_id=%d, skipping search", ip.name, ip.mal_id)
    else:
        # Search by name + aliases, prioritizing romaji/Japanese/English
        # (Jikan indexes Japanese/romaji titles, not Chinese)
        alias_result = await db.execute(
            select(IPAlias.alias, IPAlias.locale).where(
                IPAlias.ip_id == ip_id, IPAlias.enabled == True,
            )
        )
        aliases = alias_result.all()

        # Jikan-friendly locales first, then the rest
        jikan_priority = []
        other_terms = [ip.name]
        for row in aliases:
            alias, locale = row[0], row[1]
            if alias in other_terms or alias in jikan_priority:
                continue
            if locale in ("en", "jp"):
                jikan_priority.append(alias)
            else:
                other_terms.append(alias)

        search_terms = jikan_priority + other_terms

        for term in search_terms[:5]:  # limit search attempts
            results = await connector.search_anime(term, limit=5)
            for candidate in results:
                if _is_title_match(term, candidate):
                    mal_id_found = candidate.get("mal_id")
                    matched = True
                    logger.info(
                        "Matched IP '%s' (search='%s') → mal_id=%d (%s)",
                        ip.name, term, mal_id_found, candidate.get("title"),
                    )
                    break
            if matched:
                break

        if mal_id_found:
            ip.mal_id = mal_id_found
            await db.flush()
        else:
            errors.append(
                f"No MAL match found for '{ip.name}' — searched {search_terms[:3]} "
                f"but no result titles matched (add romaji/Japanese aliases for better matching)"
            )

    # 2. Fetch anime details + relations (with sequel-chain following)
    anime_entries: list[dict] = []
    seen_ids: set[int] = set()
    RELEVANT_RELATIONS = {
        "Sequel", "Prequel", "Side Story", "Alternative Version",
        "Summary", "Other", "Spin-off",
    }

    async def _collect_related(root_id: int, depth: int = 0) -> None:
        """Recursively collect related anime entries, following sequel chains."""
        if root_id in seen_ids or depth > 2:
            return
        seen_ids.add(root_id)

        anime = await connector.get_anime(root_id)
        if not anime:
            errors.append(f"Failed to fetch anime details for mal_id={root_id}")
            return
        anime_entries.append(anime)

        relations = await connector.get_relations(root_id)
        for rel_group in relations:
            relation_type = rel_group.get("relation", "")
            if relation_type not in RELEVANT_RELATIONS:
                continue
            for entry in rel_group.get("entry", []):
                if entry.get("type") == "anime" and entry["mal_id"] not in seen_ids:
                    if len(seen_ids) >= 15:  # cap total fetches for rate limits
                        return
                    # Follow sequel chain recursively, others flat
                    next_depth = depth + 1 if relation_type == "Sequel" else 2
                    await _collect_related(entry["mal_id"], depth=next_depth)

    if mal_id_found:
        await _collect_related(mal_id_found)

    # 3. Extract events and upsert
    for anime in anime_entries:
        event_type = _map_event_type(anime.get("type"), anime.get("status"))
        if not event_type:
            continue

        event_date = _parse_air_date(anime.get("aired"))
        if not event_date:
            continue

        title = anime.get("title", "Unknown")
        mal_url = anime.get("url", f"https://myanimelist.net/anime/{anime.get('mal_id', '')}")

        # Dedup: check if this exact event already exists
        existing = await db.execute(
            select(IPEvent.id).where(
                IPEvent.ip_id == ip_id,
                IPEvent.title == title,
                IPEvent.event_date == event_date,
                IPEvent.source == "MAL",
            )
        )
        if existing.scalar_one_or_none():
            events_skipped += 1
            continue

        event = IPEvent(
            ip_id=ip_id,
            event_type=event_type,
            title=title,
            event_date=event_date,
            source="MAL",
            source_url=mal_url,
        )
        db.add(event)
        events_added += 1

    # 4. Update IPSourceHealth for wiki_mal
    now = datetime.now(timezone.utc)
    status = "ok" if matched else "down"
    last_error = errors[0] if errors and not matched else None

    stmt = pg_insert(IPSourceHealth).values(
        id=uuid.uuid4(),
        ip_id=ip_id,
        source_key="wiki_mal",
        last_success_at=now if matched else None,
        last_attempt_at=now,
        status=status,
        staleness_hours=0 if matched else None,
        last_error=last_error,
        updated_items=events_added,
    ).on_conflict_do_update(
        constraint="uq_ip_source_health",
        set_={
            "last_attempt_at": now,
            "status": status,
            "staleness_hours": 0 if matched else None,
            "last_error": last_error,
            "updated_items": events_added,
            **({"last_success_at": now} if matched else {}),
        },
    )
    await db.execute(stmt)

    # 5. Log SourceRun
    run_finished = datetime.now(timezone.utc)
    duration_ms = int((run_finished - run_started).total_seconds() * 1000)
    source_run = SourceRun(
        source_key="wiki_mal",
        started_at=run_started,
        finished_at=run_finished,
        status="ok" if matched else "warn",
        duration_ms=duration_ms,
        items_processed=len(anime_entries),
        items_succeeded=events_added,
        items_failed=len(errors),
        error_sample=errors[0] if errors else None,
    )
    db.add(source_run)

    await db.commit()

    # 6. Recompute confidence
    try:
        await compute_ip_confidence(db, ip_id)
    except Exception as e:
        logger.warning("Failed to recompute confidence for %s: %s", ip_id, e)

    return {
        "ip_id": ip_id,
        "ip_name": ip.name,
        "mal_id": mal_id_found,
        "matched": matched,
        "events_added": events_added,
        "events_skipped": events_skipped,
        "errors": errors,
    }


async def sync_all_ips(db: AsyncSession) -> list[dict]:
    """Sync all IPs from MAL sequentially (rate-limit friendly)."""
    ip_result = await db.execute(select(IP.id).order_by(IP.created_at))
    ip_ids = [row[0] for row in ip_result.all()]

    results = []
    for ip_id in ip_ids:
        result = await sync_ip_from_mal(db, ip_id)
        results.append(result)

    return results
