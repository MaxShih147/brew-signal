from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CollectorRunLog, DailyTrend
from app.schemas import HealthResponse
from app.config import settings


async def get_health(
    db: AsyncSession,
    ip_id: uuid.UUID,
    geo: str,
    timeframe: str,
) -> HealthResponse:
    source = settings.collector_source
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)

    # All runs in last 14 days
    runs_q = await db.execute(
        select(CollectorRunLog)
        .where(
            CollectorRunLog.ip_id == ip_id,
            CollectorRunLog.geo == geo,
            CollectorRunLog.timeframe == timeframe,
            CollectorRunLog.started_at >= cutoff,
        )
        .order_by(CollectorRunLog.started_at.desc())
    )
    runs = runs_q.scalars().all()

    total_runs = len(runs)
    success_count = sum(1 for r in runs if r.status == "success")
    success_rate = (success_count / total_runs * 100) if total_runs > 0 else None

    last_success_time = None
    last_run_status = None
    if runs:
        last_run_status = runs[0].status
        for r in runs:
            if r.status == "success":
                last_success_time = r.finished_at or r.started_at
                break

    # Error breakdown
    error_breakdown: dict[str, int] = {}
    for r in runs:
        if r.status == "fail" and r.error_code:
            error_breakdown[r.error_code] = error_breakdown.get(r.error_code, 0) + 1

    # Anomaly flags
    anomaly_flags = []
    # Check for all-zero data
    recent_trends_q = await db.execute(
        select(DailyTrend)
        .where(
            DailyTrend.ip_id == ip_id,
            DailyTrend.geo == geo,
            DailyTrend.timeframe == timeframe,
        )
        .order_by(DailyTrend.date.desc())
        .limit(14)
    )
    recent_trends = recent_trends_q.scalars().all()
    if recent_trends and all(t.composite_value == 0 for t in recent_trends):
        anomaly_flags.append("all_zeros")
    if total_runs > 0 and len(recent_trends) == 0:
        anomaly_flags.append("missing_points")

    return HealthResponse(
        ip_id=ip_id,
        geo=geo,
        timeframe=timeframe,
        source=source,
        last_success_time=last_success_time,
        last_run_status=last_run_status,
        success_rate_14d=round(success_rate, 1) if success_rate is not None else None,
        total_runs_14d=total_runs,
        error_breakdown=error_breakdown,
        anomaly_flags=anomaly_flags,
    )
