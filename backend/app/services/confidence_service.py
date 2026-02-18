import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import (
    IP, SourceRegistry, SourceRun, IPSourceHealth, IPConfidence,
    OpportunityInput, DailyTrend,
)
from app.schemas import (
    SourceHealthOut, SourceRunOut, CoverageMatrixRow, IPSourceHealthCell, ConfidenceOut,
)
from app.config import settings

# Key indicators that penalize confidence more when missing
KEY_INDICATORS = {"search_momentum", "video_momentum", "timing_window"}

# Availability factor for risk adjustment
AVAILABILITY_FACTOR = {"high": 1.0, "medium": 0.8, "low": 0.5}

# Total indicators from opportunity system
TOTAL_INDICATORS = 13


def _get_staleness_thresholds(source_key: str) -> tuple[int, int]:
    """Returns (fresh_hours, warn_hours) for a source."""
    mapping = {
        "google_trends": (settings.staleness_google_trends_fresh_h, settings.staleness_google_trends_warn_h),
        "youtube": (settings.staleness_youtube_fresh_h, settings.staleness_youtube_warn_h),
        "news_rss": (settings.staleness_news_rss_fresh_h, settings.staleness_news_rss_warn_h),
        "shopee": (settings.staleness_shopee_fresh_h, settings.staleness_shopee_warn_h),
        "wiki_mal": (settings.staleness_wiki_mal_fresh_h, settings.staleness_wiki_mal_warn_h),
        "amazon_jp": (settings.staleness_amazon_jp_fresh_h, settings.staleness_amazon_jp_warn_h),
    }
    return mapping.get(source_key, (72, 168))


def _compute_source_status(last_success_at: datetime | None, source_key: str) -> str:
    """Derive ok/warn/down from staleness."""
    if not last_success_at:
        return "down"
    fresh_h, warn_h = _get_staleness_thresholds(source_key)
    now = datetime.now(timezone.utc)
    age_hours = (now - last_success_at).total_seconds() / 3600
    if age_hours <= fresh_h:
        return "ok"
    elif age_hours <= warn_h:
        return "warn"
    return "down"


# --- Source Health rollups for admin ---

async def get_source_health_list(db: AsyncSession) -> list[SourceHealthOut]:
    """Get health summary for all registered sources."""
    reg_result = await db.execute(select(SourceRegistry))
    registries = {r.source_key: r for r in reg_result.scalars().all()}

    ip_count_result = await db.execute(select(sa_func.count(IP.id)))
    total_ips = ip_count_result.scalar() or 0

    results = []
    for source_key, reg in registries.items():
        # Last success across all IPs
        last_success_result = await db.execute(
            select(sa_func.max(IPSourceHealth.last_success_at)).where(
                IPSourceHealth.source_key == source_key
            )
        )
        last_success = last_success_result.scalar()

        # Success rates from source_run
        now = datetime.now(timezone.utc)
        for period_name, hours in [("24h", 24), ("7d", 168)]:
            cutoff = datetime.fromtimestamp(now.timestamp() - hours * 3600, tz=timezone.utc)
            runs_result = await db.execute(
                select(
                    sa_func.count(SourceRun.id),
                    sa_func.count(SourceRun.id).filter(SourceRun.status == "ok"),
                ).where(
                    SourceRun.source_key == source_key,
                    SourceRun.started_at >= cutoff,
                )
            )
            row = runs_result.one()
            if period_name == "24h":
                rate_24h = (row[1] / row[0]) if row[0] > 0 else None
            else:
                rate_7d = (row[1] / row[0]) if row[0] > 0 else None

        # Coverage: IPs with ok status for this source
        coverage_result = await db.execute(
            select(sa_func.count(IPSourceHealth.id)).where(
                IPSourceHealth.source_key == source_key,
                IPSourceHealth.status == "ok",
            )
        )
        coverage = coverage_result.scalar() or 0

        # Last error
        err_result = await db.execute(
            select(SourceRun.error_sample).where(
                SourceRun.source_key == source_key,
                SourceRun.error_sample.isnot(None),
            ).order_by(SourceRun.started_at.desc()).limit(1)
        )
        last_error = err_result.scalar()

        status = _compute_source_status(last_success, source_key)

        results.append(SourceHealthOut(
            source_key=source_key,
            status=status,
            availability_level=reg.availability_level,
            risk_type=reg.risk_type,
            is_key_source=reg.is_key_source,
            last_success_at=last_success,
            success_rate_24h=rate_24h,
            success_rate_7d=rate_7d,
            coverage=coverage,
            total_ips=total_ips,
            last_error=last_error,
        ))

    return results


async def get_coverage_matrix(
    db: AsyncSession, limit: int = 50, only_issues: bool = False,
) -> list[CoverageMatrixRow]:
    """Get IP × source coverage matrix."""
    reg_result = await db.execute(select(SourceRegistry.source_key))
    source_keys = [r[0] for r in reg_result.all()]

    ip_query = select(IP).order_by(IP.created_at.desc()).limit(limit)
    ip_result = await db.execute(ip_query)
    ips = ip_result.scalars().all()

    rows = []
    for ip in ips:
        health_result = await db.execute(
            select(IPSourceHealth).where(IPSourceHealth.ip_id == ip.id)
        )
        health_map = {h.source_key: h for h in health_result.scalars().all()}

        cells = []
        has_issue = False
        for sk in source_keys:
            h = health_map.get(sk)
            status = h.status if h else "down"
            if status != "ok":
                has_issue = True
            cells.append(IPSourceHealthCell(
                source_key=sk,
                status=status,
                last_success_at=h.last_success_at if h else None,
                staleness_hours=h.staleness_hours if h else None,
                last_error=h.last_error if h else None,
            ))

        if only_issues and not has_issue:
            continue

        rows.append(CoverageMatrixRow(ip_id=ip.id, ip_name=ip.name, sources=cells))

    return rows


async def get_recent_runs(
    db: AsyncSession, source_key: str | None = None, limit: int = 50,
) -> list[SourceRunOut]:
    """Get recent source runs, optionally filtered."""
    query = select(SourceRun).order_by(SourceRun.started_at.desc()).limit(limit)
    if source_key:
        query = query.where(SourceRun.source_key == source_key)
    result = await db.execute(query)
    return [SourceRunOut.model_validate(r) for r in result.scalars().all()]


# --- IP Confidence computation ---

async def compute_ip_confidence(db: AsyncSession, ip_id: uuid.UUID) -> ConfidenceOut:
    """Compute and store confidence for an IP."""
    # Get source registry
    reg_result = await db.execute(select(SourceRegistry))
    registries = {r.source_key: r for r in reg_result.scalars().all()}
    expected_sources = len(registries)

    # Get IP source health
    health_result = await db.execute(
        select(IPSourceHealth).where(IPSourceHealth.ip_id == ip_id)
    )
    health_map = {h.source_key: h for h in health_result.scalars().all()}

    # Count active sources (ok status)
    active_sources = sum(1 for h in health_map.values() if h.status == "ok")
    missing_sources = [
        sk for sk in registries
        if sk not in health_map or health_map[sk].status == "down"
    ]

    # Get opportunity indicators
    opp_result = await db.execute(
        select(OpportunityInput).where(OpportunityInput.ip_id == ip_id)
    )
    stored_inputs = {r.indicator_key for r in opp_result.scalars().all()}

    # Check daily trend data exists
    dt_result = await db.execute(
        select(DailyTrend.id).where(DailyTrend.ip_id == ip_id).limit(1)
    )
    has_trends = dt_result.scalar() is not None

    # Count active indicators (LIVE or MANUAL with stored input)
    active_indicators = len(stored_inputs)
    if has_trends:
        active_indicators += 2  # search_momentum + cross_alias_consistency (LIVE)
    total_indicators = TOTAL_INDICATORS

    missing_indicators = []
    for key in KEY_INDICATORS:
        if key not in stored_inputs and not (key == "search_momentum" and has_trends):
            missing_indicators.append(key)

    # Compute confidence
    indicator_coverage = active_indicators / total_indicators if total_indicators > 0 else 0
    source_coverage = active_sources / expected_sources if expected_sources > 0 else 0

    base = 100 * (
        settings.confidence_indicator_weight * indicator_coverage
        + settings.confidence_source_weight * source_coverage
    )

    # Penalties
    penalty = 0
    for sk, reg in registries.items():
        if not reg.is_key_source:
            continue
        h = health_map.get(sk)
        status = h.status if h else "down"
        if status == "down":
            penalty += settings.confidence_key_source_down_penalty
        elif status == "warn":
            penalty += settings.confidence_key_source_warn_penalty

    key_ind_penalty = len(missing_indicators) * settings.confidence_key_indicator_missing_penalty
    penalty += min(key_ind_penalty, settings.confidence_key_indicator_penalty_cap)

    # Risk adjustment from availability levels
    risk_sum = 0
    risk_count = 0
    for sk, reg in registries.items():
        factor = AVAILABILITY_FACTOR.get(reg.availability_level, 0.8)
        risk_sum += reg.priority_weight * factor
        risk_count += reg.priority_weight
    risk_adjustment = (risk_sum / risk_count) if risk_count > 0 else 1.0

    confidence_score = max(0, min(100, int(base * risk_adjustment - penalty)))

    if confidence_score >= 80:
        band = "high"
    elif confidence_score >= 60:
        band = "medium"
    elif confidence_score >= 40:
        band = "low"
    else:
        band = "insufficient"

    now = datetime.now(timezone.utc)

    # Upsert
    stmt = pg_insert(IPConfidence).values(
        ip_id=ip_id,
        confidence_score=confidence_score,
        confidence_band=band,
        active_indicators=active_indicators,
        total_indicators=total_indicators,
        active_sources=active_sources,
        expected_sources=expected_sources,
        missing_sources_json=json.dumps(missing_sources[:3]),
        missing_indicators_json=json.dumps(missing_indicators[:3]),
        last_calculated_at=now,
    ).on_conflict_do_update(
        index_elements=["ip_id"],
        set_={
            "confidence_score": confidence_score,
            "confidence_band": band,
            "active_indicators": active_indicators,
            "total_indicators": total_indicators,
            "active_sources": active_sources,
            "expected_sources": expected_sources,
            "missing_sources_json": json.dumps(missing_sources[:3]),
            "missing_indicators_json": json.dumps(missing_indicators[:3]),
            "last_calculated_at": now,
        },
    )
    await db.execute(stmt)
    await db.commit()

    return ConfidenceOut(
        confidence_score=confidence_score,
        confidence_band=band,
        active_indicators=active_indicators,
        total_indicators=total_indicators,
        active_sources=active_sources,
        expected_sources=expected_sources,
        missing_sources=missing_sources[:3],
        missing_indicators=missing_indicators[:3],
        last_calculated_at=now,
    )


async def get_ip_confidence(db: AsyncSession, ip_id: uuid.UUID) -> ConfidenceOut:
    """Get stored confidence or compute fresh."""
    result = await db.execute(
        select(IPConfidence).where(IPConfidence.ip_id == ip_id)
    )
    row = result.scalar_one_or_none()
    if row:
        return ConfidenceOut(
            confidence_score=row.confidence_score,
            confidence_band=row.confidence_band,
            active_indicators=row.active_indicators,
            total_indicators=row.total_indicators,
            active_sources=row.active_sources,
            expected_sources=row.expected_sources,
            missing_sources=json.loads(row.missing_sources_json) if row.missing_sources_json else [],
            missing_indicators=json.loads(row.missing_indicators_json) if row.missing_indicators_json else [],
            last_calculated_at=row.last_calculated_at,
        )
    # Compute fresh
    return await compute_ip_confidence(db, ip_id)
