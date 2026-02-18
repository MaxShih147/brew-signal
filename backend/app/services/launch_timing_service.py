import math
import uuid
from datetime import date, timedelta

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IP, IPPipeline, DailyTrend, IPEvent, MerchProductCount, IPConfidence
from app.schemas import (
    LaunchPlanResponse, LaunchWeekScore, Milestone, IPEventOut, ConfidenceOut,
)
from app.config import settings


def _clamp(lo: float, hi: float, val: float) -> float:
    return max(lo, min(hi, val))


def _weeks_between(d1: date, d2: date) -> float:
    return (d2 - d1).days / 7.0


def _compute_demand_at_week(
    base_demand: float,
    slope_per_week: float,
    weeks_from_now: float,
) -> float:
    """Linear extrapolation from current ma28 trend."""
    projected = base_demand + slope_per_week * weeks_from_now
    return _clamp(0, 100, projected)


def _compute_event_boost(
    week_start: date,
    events: list[IPEvent],
    peak_weeks_before: int,
    sigma_weeks: float,
) -> float:
    """Gaussian peak centered peak_weeks_before each event; take max across events."""
    if not events:
        return 0.0

    max_boost = 0.0
    for event in events:
        # Peak hype is peak_weeks_before the event date
        peak_date = event.event_date - timedelta(weeks=peak_weeks_before)
        dist_weeks = _weeks_between(peak_date, week_start)
        # Gaussian: e^(-dist^2 / (2*sigma^2))
        boost = 100.0 * math.exp(-(dist_weeks ** 2) / (2 * sigma_weeks ** 2))
        max_boost = max(max_boost, boost)
    return _clamp(0, 100, max_boost)


def _compute_saturation(total_merch_count: int) -> float:
    """Static saturation from merch product counts. More products = more saturated."""
    # Simple mapping: 0 products → 0, 500 → ~50, 2000+ → ~95
    if total_merch_count <= 0:
        return 0.0
    return _clamp(0, 95, 100.0 * (1 - math.exp(-total_merch_count / 800.0)))


def _compute_operational_risk(weeks_buffer: float) -> float:
    """Sigmoid: more buffer = lower risk. <10w = 95, 20w = ~30, 30w+ = 5."""
    # Sigmoid: 100 / (1 + e^(0.3*(x-15)))
    return _clamp(0, 100, 100.0 / (1 + math.exp(0.3 * (weeks_buffer - 15))))


def _generate_milestones(launch_date: date) -> list[Milestone]:
    """Generate 5 operational milestones working backwards from launch."""
    return [
        Milestone(
            label="Launch",
            target_date=launch_date,
            weeks_before_launch=0,
        ),
        Milestone(
            label="Production Start",
            target_date=launch_date - timedelta(weeks=settings.launch_lead_production),
            weeks_before_launch=settings.launch_lead_production,
        ),
        Milestone(
            label="Sample Review",
            target_date=launch_date - timedelta(weeks=settings.launch_lead_sample_review),
            weeks_before_launch=settings.launch_lead_sample_review,
        ),
        Milestone(
            label="Artwork Submission",
            target_date=launch_date - timedelta(weeks=settings.launch_lead_artwork),
            weeks_before_launch=settings.launch_lead_artwork,
        ),
        Milestone(
            label="Design Start",
            target_date=launch_date - timedelta(weeks=settings.launch_lead_design_start),
            weeks_before_launch=settings.launch_lead_design_start,
        ),
    ]


def _generate_explanations(
    grid: list[LaunchWeekScore],
    recommended: date | None,
    events_in_window: list[IPEvent],
    saturation: float,
    confidence_score: int | None,
) -> list[str]:
    explanations: list[str] = []
    if not grid or not recommended:
        explanations.append("Insufficient data to generate a launch plan")
        return explanations

    # Find the recommended week's scores
    rec = next((w for w in grid if w.week_start == recommended), None)
    if not rec:
        return ["Could not find scores for recommended week"]

    # Line 1: Why this week
    if rec.event_boost > 30:
        near_events = [e for e in events_in_window
                       if abs((e.event_date - recommended).days) < 56]
        event_names = ", ".join(e.title for e in near_events[:2]) if near_events else "upcoming event"
        explanations.append(
            f"Recommended week aligns with {event_names} — event boost {rec.event_boost:.0f}/100"
        )
    elif rec.demand_score > 60:
        explanations.append(
            f"Recommended week captures projected demand peak ({rec.demand_score:.0f}/100)"
        )
    else:
        explanations.append(
            f"Recommended week balances demand ({rec.demand_score:.0f}) vs. risk ({rec.operational_risk:.0f})"
        )

    # Line 2: Saturation/competition
    if saturation > 50:
        explanations.append(
            f"High market saturation ({saturation:.0f}/100) — consider differentiating launch positioning"
        )
    elif saturation > 20:
        explanations.append(
            f"Moderate market saturation ({saturation:.0f}/100) — reasonable competitive landscape"
        )
    else:
        explanations.append(
            f"Low market saturation ({saturation:.0f}/100) — open market opportunity"
        )

    # Line 3: Ops risk
    if rec.operational_risk > 50:
        explanations.append(
            f"Tight operational timeline (risk {rec.operational_risk:.0f}/100) — start production planning immediately"
        )
    else:
        explanations.append(
            f"Comfortable operational buffer (risk {rec.operational_risk:.0f}/100)"
        )

    # Line 4: Confidence caveat
    if confidence_score is not None and confidence_score < 50:
        explanations.append(
            f"Low data confidence ({confidence_score}%) — timing recommendation has wide uncertainty"
        )

    return explanations[:4]


async def compute_launch_plan(
    db: AsyncSession,
    ip_id: uuid.UUID,
    geo: str = "TW",
    timeframe: str = "12m",
) -> LaunchPlanResponse:
    # 1. Get IP
    ip_result = await db.execute(select(IP).where(IP.id == ip_id))
    ip = ip_result.scalar_one_or_none()
    ip_name = ip.name if ip else "Unknown"

    # 2. Get pipeline for license window
    pipeline_result = await db.execute(
        select(IPPipeline).where(IPPipeline.ip_id == ip_id)
    )
    pipeline = pipeline_result.scalar_one_or_none()

    today = date.today()

    if pipeline and pipeline.license_start_date and pipeline.license_end_date:
        window_start = pipeline.license_start_date
        window_end = pipeline.license_end_date
    else:
        # Fallback: 6 months from today
        window_start = today + timedelta(weeks=12)
        window_end = today + timedelta(days=30 * settings.launch_fallback_window_months)

    # Ensure window_start is in the future
    if window_start < today:
        window_start = today + timedelta(weeks=4)

    license_start_date = window_start
    license_end_date = window_end

    # 3. Get DailyTrend data for demand slope
    trend_result = await db.execute(
        select(DailyTrend)
        .where(DailyTrend.ip_id == ip_id, DailyTrend.geo == geo)
        .order_by(DailyTrend.date.desc())
        .limit(60)
    )
    trend_rows = list(trend_result.scalars().all())

    # Compute base demand and slope from ma28
    base_demand = 50.0
    slope_per_week = 0.0
    if trend_rows:
        ma28_values = [(r.date, r.ma28) for r in trend_rows if r.ma28 is not None]
        if len(ma28_values) >= 2:
            ma28_values.sort(key=lambda x: x[0])
            recent = ma28_values[-1]
            older = ma28_values[0]
            weeks_span = max(_weeks_between(older[0], recent[0]), 1.0)
            base_demand = _clamp(0, 100, recent[1])
            slope_per_week = (recent[1] - older[1]) / weeks_span
        elif ma28_values:
            base_demand = _clamp(0, 100, ma28_values[0][1])

    # 4. Get events in/near window
    event_margin = timedelta(weeks=8)
    event_result = await db.execute(
        select(IPEvent)
        .where(
            IPEvent.ip_id == ip_id,
            IPEvent.event_date >= window_start - event_margin,
            IPEvent.event_date <= window_end + event_margin,
        )
        .order_by(IPEvent.event_date)
    )
    events = list(event_result.scalars().all())

    events_in_window_out = [
        IPEventOut(
            id=e.id, ip_id=e.ip_id, event_type=e.event_type, title=e.title,
            event_date=e.event_date, source=e.source, source_url=e.source_url,
            created_at=e.created_at,
        )
        for e in events
    ]

    # 5. Get merch saturation
    merch_result = await db.execute(
        select(sa_func.sum(MerchProductCount.product_count))
        .where(MerchProductCount.ip_id == ip_id)
    )
    total_merch = merch_result.scalar() or 0
    saturation = _compute_saturation(total_merch)

    # 6. Get confidence
    conf_result = await db.execute(
        select(IPConfidence).where(IPConfidence.ip_id == ip_id)
    )
    conf_row = conf_result.scalar_one_or_none()
    confidence_out = None
    if conf_row:
        import json
        confidence_out = ConfidenceOut(
            confidence_score=conf_row.confidence_score,
            confidence_band=conf_row.confidence_band,
            active_indicators=conf_row.active_indicators,
            total_indicators=conf_row.total_indicators,
            active_sources=conf_row.active_sources,
            expected_sources=conf_row.expected_sources,
            missing_sources=json.loads(conf_row.missing_sources_json) if conf_row.missing_sources_json else [],
            missing_indicators=json.loads(conf_row.missing_indicators_json) if conf_row.missing_indicators_json else [],
            last_calculated_at=conf_row.last_calculated_at,
        )

    # 7. Build weekly time grid
    grid: list[LaunchWeekScore] = []
    current_week = window_start
    # Align to Monday
    current_week = current_week - timedelta(days=current_week.weekday())

    while current_week <= window_end:
        weeks_from_now = _weeks_between(today, current_week)

        demand = _compute_demand_at_week(base_demand, slope_per_week, weeks_from_now)
        event_boost = _compute_event_boost(
            current_week, events,
            settings.launch_event_peak_weeks_before,
            settings.launch_event_sigma_weeks,
        )
        ops_risk = _compute_operational_risk(weeks_from_now)

        launch_value = (
            settings.launch_weight_demand * demand
            + settings.launch_weight_event * event_boost
            - settings.launch_weight_saturation * saturation
            - settings.launch_weight_ops_risk * ops_risk
        )

        grid.append(LaunchWeekScore(
            week_start=current_week,
            launch_value=round(launch_value, 2),
            demand_score=round(demand, 2),
            event_boost=round(event_boost, 2),
            saturation_score=round(saturation, 2),
            operational_risk=round(ops_risk, 2),
        ))

        current_week += timedelta(weeks=1)

    # 8. Recommend top 3 weeks
    sorted_grid = sorted(grid, key=lambda w: w.launch_value, reverse=True)
    recommended = sorted_grid[0].week_start if sorted_grid else None
    backup_weeks = [w.week_start for w in sorted_grid[1:3]] if len(sorted_grid) > 1 else []

    # 9. Generate milestones
    milestones = _generate_milestones(recommended) if recommended else []

    # 10. Generate explanations
    explanations = _generate_explanations(
        grid, recommended, events,
        saturation,
        conf_row.confidence_score if conf_row else None,
    )

    return LaunchPlanResponse(
        ip_id=ip_id,
        ip_name=ip_name,
        recommended_launch_week=recommended,
        backup_weeks=backup_weeks,
        launch_value_grid=grid,
        milestones=milestones,
        explanations=explanations,
        confidence=confidence_out,
        license_start_date=license_start_date,
        license_end_date=license_end_date,
        events_in_window=events_in_window_out,
    )
