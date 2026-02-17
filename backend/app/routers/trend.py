import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import TrendPoint, DailyTrend, IPAlias
from app.schemas import TrendResponse, TrendPointOut, DailyTrendOut, HealthResponse, SignalsResponse, AlertOut
from app.services.health_service import get_health
from app.services.signal_service import compute_alerts

router = APIRouter(prefix="/api/ip", tags=["trend"])


@router.get("/{ip_id}/trend", response_model=TrendResponse)
async def get_trend(
    ip_id: uuid.UUID,
    geo: str = Query("TW"),
    timeframe: str = Query("12m"),
    mode: str = Query("composite"),  # composite | by_alias
    db: AsyncSession = Depends(get_db),
):
    if mode == "by_alias":
        result = await db.execute(
            select(TrendPoint, IPAlias.alias)
            .join(IPAlias, TrendPoint.alias_id == IPAlias.id)
            .where(
                TrendPoint.ip_id == ip_id,
                TrendPoint.geo == geo,
                TrendPoint.timeframe == timeframe,
                IPAlias.enabled == True,
            )
            .order_by(TrendPoint.date)
        )
        rows = result.all()
        points = [
            TrendPointOut(date=tp.date, value=tp.value, alias=alias_name, source=tp.source)
            for tp, alias_name in rows
        ]
        return TrendResponse(ip_id=ip_id, geo=geo, timeframe=timeframe, mode=mode, points=points)
    else:
        result = await db.execute(
            select(DailyTrend)
            .where(
                DailyTrend.ip_id == ip_id,
                DailyTrend.geo == geo,
                DailyTrend.timeframe == timeframe,
            )
            .order_by(DailyTrend.date)
        )
        rows = result.scalars().all()
        points = [
            DailyTrendOut(
                date=r.date,
                composite_value=r.composite_value,
                ma7=r.ma7,
                ma28=r.ma28,
                wow_growth=r.wow_growth,
                acceleration=r.acceleration,
                breakout_percentile=r.breakout_percentile,
                signal_light=r.signal_light,
            )
            for r in rows
        ]
        return TrendResponse(ip_id=ip_id, geo=geo, timeframe=timeframe, mode=mode, points=points)


@router.get("/{ip_id}/health", response_model=HealthResponse)
async def get_ip_health(
    ip_id: uuid.UUID,
    geo: str = Query("TW"),
    timeframe: str = Query("12m"),
    db: AsyncSession = Depends(get_db),
):
    return await get_health(db, ip_id, geo, timeframe)


@router.get("/{ip_id}/signals", response_model=SignalsResponse)
async def get_signals(
    ip_id: uuid.UUID,
    geo: str = Query("TW"),
    timeframe: str = Query("12m"),
    db: AsyncSession = Depends(get_db),
):
    # Get the latest daily trend row
    result = await db.execute(
        select(DailyTrend)
        .where(
            DailyTrend.ip_id == ip_id,
            DailyTrend.geo == geo,
            DailyTrend.timeframe == timeframe,
        )
        .order_by(DailyTrend.date.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()

    # Compute alerts from recent data
    all_result = await db.execute(
        select(DailyTrend)
        .where(
            DailyTrend.ip_id == ip_id,
            DailyTrend.geo == geo,
            DailyTrend.timeframe == timeframe,
        )
        .order_by(DailyTrend.date.desc())
        .limit(90)
    )
    recent = list(reversed(all_result.scalars().all()))
    alerts = compute_alerts(recent)

    if not latest:
        return SignalsResponse(ip_id=ip_id, geo=geo, timeframe=timeframe, alerts=alerts)

    return SignalsResponse(
        ip_id=ip_id,
        geo=geo,
        timeframe=timeframe,
        wow_growth=latest.wow_growth,
        acceleration=latest.acceleration,
        breakout_percentile=latest.breakout_percentile,
        signal_light=latest.signal_light,
        alerts=alerts,
    )
