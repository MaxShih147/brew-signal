"""Merch sync service: query TW e-commerce platforms for product counts per IP.

Follows the YouTube sync pattern:
- Search by IP aliases (zh/en priority — TW platforms index Chinese)
- Take max product count per platform (best alias match)
- Upsert MerchProductCount rows
- Update IPSourceHealth for source_key="shopee"
- Log SourceRun
- Recompute confidence
"""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import IP, IPAlias, MerchProductCount, IPSourceHealth, SourceRun
from app.connectors.tw_ecommerce_connector import ShopeeConnector, RutenConnector
from app.services.confidence_service import compute_ip_confidence

logger = logging.getLogger(__name__)


async def sync_ip_merch(db: AsyncSession, ip_id: uuid.UUID) -> dict:
    """Sync one IP's merch product counts from Shopee TW + Ruten.

    Returns result dict matching MerchSyncResult schema.
    """
    shopee = ShopeeConnector()
    ruten = RutenConnector()
    errors: list[str] = []
    run_started = datetime.now(timezone.utc)

    # Load IP
    ip_result = await db.execute(select(IP).where(IP.id == ip_id))
    ip = ip_result.scalar_one_or_none()
    if not ip:
        return {
            "ip_id": ip_id, "ip_name": "unknown",
            "shopee_count": None, "ruten_count": None,
            "errors": ["IP not found"],
        }

    # Get aliases — prioritize zh for TW e-commerce, then en, then others
    alias_result = await db.execute(
        select(IPAlias.alias, IPAlias.locale).where(
            IPAlias.ip_id == ip_id, IPAlias.enabled == True,
        )
    )
    aliases = alias_result.all()

    zh_terms: list[str] = []
    en_terms: list[str] = []
    other_terms: list[str] = [ip.name]
    for row in aliases:
        alias, locale = row[0], row[1]
        if alias in zh_terms or alias in en_terms or alias in other_terms:
            continue
        if locale == "zh":
            zh_terms.append(alias)
        elif locale in ("en", "jp"):
            en_terms.append(alias)
        else:
            other_terms.append(alias)

    # zh first (best for TW platforms), then en/jp, then others — limit to 3 queries per platform
    search_terms = (zh_terms + en_terms + other_terms)[:3]

    if not search_terms:
        search_terms = [ip.name]

    # Query each platform with each alias, take max count
    best_shopee: int | None = None
    best_shopee_term: str = ""
    best_ruten: int | None = None
    best_ruten_term: str = ""

    for term in search_terms:
        # Shopee
        count = await shopee.search_product_count(term)
        if count is not None and (best_shopee is None or count > best_shopee):
            best_shopee = count
            best_shopee_term = term

        # Ruten
        count = await ruten.search_product_count(term)
        if count is not None and (best_ruten is None or count > best_ruten):
            best_ruten = count
            best_ruten_term = term

    if best_shopee is None:
        errors.append("Shopee: all queries failed (likely anti-bot block)")
    if best_ruten is None:
        errors.append("Ruten: all queries failed")

    now = datetime.now(timezone.utc)

    # Upsert MerchProductCount rows
    for platform, count, term in [
        ("shopee", best_shopee, best_shopee_term),
        ("ruten", best_ruten, best_ruten_term),
    ]:
        if count is None:
            continue
        stmt = pg_insert(MerchProductCount).values(
            id=uuid.uuid4(),
            ip_id=ip_id,
            platform=platform,
            query_term=term[:255],
            product_count=count,
            recorded_at=now,
        ).on_conflict_do_update(
            constraint="uq_merch_product_count",
            set_={
                "query_term": term[:255],
                "product_count": count,
                "recorded_at": now,
            },
        )
        await db.execute(stmt)

    # Update IPSourceHealth for source_key="shopee" (covers both TW ecommerce platforms)
    success = best_shopee is not None or best_ruten is not None
    total_items = sum(1 for c in [best_shopee, best_ruten] if c is not None)
    status = "ok" if success else "down"
    last_error = errors[0] if errors else None

    stmt = pg_insert(IPSourceHealth).values(
        id=uuid.uuid4(),
        ip_id=ip_id,
        source_key="shopee",
        last_success_at=now if success else None,
        last_attempt_at=now,
        status=status,
        staleness_hours=0 if success else None,
        last_error=last_error,
        updated_items=total_items,
    ).on_conflict_do_update(
        constraint="uq_ip_source_health",
        set_={
            "last_attempt_at": now,
            "status": status,
            "staleness_hours": 0 if success else None,
            "last_error": last_error,
            "updated_items": total_items,
            **({"last_success_at": now} if success else {}),
        },
    )
    await db.execute(stmt)

    # Log SourceRun
    run_finished = datetime.now(timezone.utc)
    duration_ms = int((run_finished - run_started).total_seconds() * 1000)
    source_run = SourceRun(
        source_key="shopee",
        started_at=run_started,
        finished_at=run_finished,
        status="ok" if success else "down",
        duration_ms=duration_ms,
        items_processed=2,  # 2 platforms
        items_succeeded=total_items,
        items_failed=2 - total_items,
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
        "shopee_count": best_shopee,
        "ruten_count": best_ruten,
        "errors": errors,
    }


async def sync_all_ips(db: AsyncSession) -> list[dict]:
    """Sync all IPs' merch product counts sequentially (rate-limit friendly)."""
    ip_result = await db.execute(select(IP.id).order_by(IP.created_at))
    ip_ids = [row[0] for row in ip_result.all()]

    results = []
    for ip_id in ip_ids:
        result = await sync_ip_merch(db, ip_id)
        results.append(result)

    return results
