from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import settings
from app.models import IP, IPAlias, TrendPoint, DailyTrend, CollectorRunLog
from app.collectors.base import CollectResult
from app.collectors.pytrends_collector import PytrendsCollector
from app.collectors.official_collector import OfficialTrendsCollector
from app.services.signal_service import compute_aggregation
from app.schemas import CollectRunResponse

logger = logging.getLogger(__name__)


def _get_collector():
    if settings.collector_source == "official" and settings.google_trends_api_key:
        return OfficialTrendsCollector()
    return PytrendsCollector()


async def run_collection(
    db: AsyncSession,
    ip_id: uuid.UUID,
    geo: str,
    timeframe: str,
) -> CollectRunResponse:
    """Run collection for an IP: fetch all enabled aliases, store points, compute daily aggregation."""
    started = time.monotonic()
    collector = _get_collector()
    source = settings.collector_source if settings.collector_source == "official" and settings.google_trends_api_key else "pytrends"

    # Get IP + enabled aliases
    ip_result = await db.execute(select(IP).where(IP.id == ip_id))
    ip = ip_result.scalar_one_or_none()
    if not ip:
        return CollectRunResponse(status="fail", message="IP not found")

    alias_result = await db.execute(
        select(IPAlias).where(IPAlias.ip_id == ip_id, IPAlias.enabled == True)
    )
    aliases = alias_result.scalars().all()
    if not aliases:
        return CollectRunResponse(status="fail", message="No enabled aliases")

    all_success = True
    total_points = 0
    last_error = None

    for alias in aliases:
        run_log = CollectorRunLog(
            source=source,
            ip_id=ip_id,
            geo=geo,
            timeframe=timeframe,
            status="fail",
        )
        db.add(run_log)

        fetch_start = time.monotonic()
        result: CollectResult = await collector.fetch(alias.alias, geo, timeframe)
        fetch_ms = int((time.monotonic() - fetch_start) * 1000)

        run_log.finished_at = datetime.now(timezone.utc)
        run_log.duration_ms = fetch_ms
        run_log.http_code = result.http_code
        run_log.error_code = result.error_code
        run_log.message = result.message

        if result.success:
            run_log.status = "success"
            # Upsert trend points
            for pt in result.points:
                stmt = pg_insert(TrendPoint).values(
                    ip_id=ip_id,
                    alias_id=alias.id,
                    geo=geo,
                    timeframe=timeframe,
                    date=pt.date,
                    value=pt.value,
                    source=source,
                    fetched_at=datetime.now(timezone.utc),
                ).on_conflict_do_update(
                    constraint="uq_trend_point",
                    set_={"value": pt.value, "fetched_at": datetime.now(timezone.utc)},
                )
                await db.execute(stmt)
            total_points += len(result.points)
            logger.info(f"Collected {len(result.points)} points for alias={alias.alias}")
        else:
            all_success = False
            last_error = result.message
            logger.warning(f"Failed to collect alias={alias.alias}: {result.error_code} - {result.message}")

    await db.commit()

    # Compute daily aggregation
    await _compute_daily_aggregation(db, ip_id, geo, timeframe, aliases)

    elapsed_ms = int((time.monotonic() - started) * 1000)

    if all_success:
        return CollectRunResponse(status="success", message=f"Collected {total_points} points across {len(aliases)} aliases", duration_ms=elapsed_ms)
    elif total_points > 0:
        return CollectRunResponse(status="success", message=f"Partial: {total_points} points collected, some aliases failed: {last_error}", duration_ms=elapsed_ms)
    else:
        return CollectRunResponse(status="fail", message=f"All aliases failed: {last_error}", duration_ms=elapsed_ms)


async def _compute_daily_aggregation(
    db: AsyncSession,
    ip_id: uuid.UUID,
    geo: str,
    timeframe: str,
    aliases: list[IPAlias] | None = None,
):
    """Compute weighted composite values and signals for each date."""
    # If aliases not passed, fetch enabled aliases from DB
    if aliases is None:
        alias_result = await db.execute(
            select(IPAlias).where(IPAlias.ip_id == ip_id, IPAlias.enabled == True)
        )
        aliases = list(alias_result.scalars().all())

    # Build weight map from enabled aliases only
    enabled_alias_ids = {a.id for a in aliases if a.enabled}
    weight_map = {a.id: a.weight for a in aliases if a.enabled}

    if not enabled_alias_ids:
        # No enabled aliases — clear daily trend data
        await db.execute(
            delete(DailyTrend).where(
                DailyTrend.ip_id == ip_id,
                DailyTrend.geo == geo,
                DailyTrend.timeframe == timeframe,
            )
        )
        await db.commit()
        return

    # Get trend points only for enabled aliases
    result = await db.execute(
        select(TrendPoint)
        .where(
            TrendPoint.ip_id == ip_id,
            TrendPoint.geo == geo,
            TrendPoint.timeframe == timeframe,
            TrendPoint.alias_id.in_(enabled_alias_ids),
        )
        .order_by(TrendPoint.date)
    )
    points = result.scalars().all()

    if not points:
        return

    # Group by date, compute weighted composite
    from collections import defaultdict
    date_values: dict = defaultdict(list)
    for pt in points:
        w = weight_map.get(pt.alias_id, 0)
        if w > 0:
            date_values[pt.date].append((pt.value, w))

    sorted_dates = sorted(date_values.keys())
    composite_series = []
    for d in sorted_dates:
        vals = date_values[d]
        weighted_sum = sum(v * w for v, w in vals)
        weight_sum = sum(w for _, w in vals)
        composite = weighted_sum / weight_sum if weight_sum > 0 else 0
        composite_series.append((d, composite))

    # 6-month values for percentile
    if len(composite_series) > 180:
        values_6m = [v for _, v in composite_series[-180:]]
    else:
        values_6m = [v for _, v in composite_series]

    # Compute aggregation for each date (only last 90 or so to keep it reasonable)
    to_process = composite_series[-min(len(composite_series), 365):]
    all_values = [v for _, v in composite_series]

    prev_wow = None
    for i, (d, comp_val) in enumerate(to_process):
        idx_in_full = len(composite_series) - len(to_process) + i
        historical = all_values[: idx_in_full + 1]

        agg = compute_aggregation(historical, values_6m, prev_wow)
        if agg.get("wow_growth") is not None:
            prev_wow = agg["wow_growth"]

        stmt = pg_insert(DailyTrend).values(
            ip_id=ip_id,
            geo=geo,
            timeframe=timeframe,
            date=d,
            composite_value=round(comp_val, 2),
            ma7=agg.get("ma7"),
            ma28=agg.get("ma28"),
            wow_growth=agg.get("wow_growth"),
            acceleration=agg.get("acceleration"),
            breakout_percentile=agg.get("breakout_percentile"),
            signal_light=agg.get("signal_light"),
        ).on_conflict_do_update(
            constraint="uq_daily_trend",
            set_={
                "composite_value": round(comp_val, 2),
                "ma7": agg.get("ma7"),
                "ma28": agg.get("ma28"),
                "wow_growth": agg.get("wow_growth"),
                "acceleration": agg.get("acceleration"),
                "breakout_percentile": agg.get("breakout_percentile"),
                "signal_light": agg.get("signal_light"),
            },
        )
        await db.execute(stmt)

    await db.commit()
    logger.info(f"Daily aggregation complete: {len(to_process)} rows for ip={ip_id}")
