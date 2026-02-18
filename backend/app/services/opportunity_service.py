import uuid
import statistics
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DailyTrend, TrendPoint, IPAlias, IPEvent, OpportunityInput
from app.schemas import IndicatorResult, OpportunityResponse
from app.config import settings


# --- Indicator definitions ---
INDICATOR_DEFS = [
    # (key, label, dimension, type)
    ("search_momentum", "Search Momentum", "demand", "LIVE"),
    ("social_buzz", "Social Buzz", "demand", "MANUAL"),
    ("video_momentum", "Video Momentum", "demand", "MANUAL"),
    ("cross_alias_consistency", "Cross-alias Consistency", "diffusion", "LIVE"),
    ("cross_platform_presence", "Cross-platform Presence", "diffusion", "MANUAL"),
    ("ecommerce_density", "E-commerce Density", "supply", "MANUAL"),
    ("fnb_collab_saturation", "F&B Collab Saturation", "supply", "MANUAL"),
    ("merch_pressure", "Merch Pressure", "supply", "MANUAL"),
    ("rightsholder_intensity", "Rightsholder Intensity", "gatekeeper", "MANUAL"),
    ("timing_window", "Timing Window", "gatekeeper", "LIVE"),
    ("adult_fit", "Adult Fit", "fit", "MANUAL"),
    ("giftability", "Giftability", "fit", "MANUAL"),
    ("brand_aesthetic", "Brand Aesthetic", "fit", "MANUAL"),
]

MANUAL_INDICATORS = {d[0] for d in INDICATOR_DEFS if d[3] == "MANUAL"}
# Also allow timing_window_override as a special key for manual override
VALID_INPUT_KEYS = MANUAL_INDICATORS | {"timing_window_override"}


def _clamp(lo: float, hi: float, val: float) -> float:
    return max(lo, min(hi, val))


# --- LIVE indicator functions ---

def compute_search_momentum(latest: DailyTrend | None) -> IndicatorResult:
    if not latest or latest.wow_growth is None:
        return IndicatorResult(
            key="search_momentum", label="Search Momentum", dimension="demand",
            status="MISSING", score_0_100=50.0, debug=["No daily trend data"],
        )

    score = 50.0
    # WoW contribution: ±20
    wow_contrib = latest.wow_growth * 100 * 0.5
    score += _clamp(-20, 20, wow_contrib)
    # Acceleration bonus: +15
    if latest.acceleration:
        score += 15
    # Breakout contribution: ±15
    if latest.breakout_percentile is not None:
        bp_contrib = (latest.breakout_percentile - 50) * 0.3
        score += _clamp(-15, 15, bp_contrib)

    score = _clamp(0, 100, score)

    return IndicatorResult(
        key="search_momentum", label="Search Momentum", dimension="demand",
        status="LIVE", score_0_100=round(score, 1),
        raw={
            "wow_growth": latest.wow_growth,
            "acceleration": latest.acceleration,
            "breakout_percentile": latest.breakout_percentile,
        },
        debug=[
            f"WoW={latest.wow_growth:.4f}",
            f"accel={latest.acceleration}",
            f"bp={latest.breakout_percentile}",
        ],
    )


async def compute_cross_alias_consistency(
    db: AsyncSession, ip_id: uuid.UUID, geo: str, timeframe: str,
) -> IndicatorResult:
    cutoff = date.today() - timedelta(days=14)

    # Get enabled aliases
    alias_result = await db.execute(
        select(IPAlias).where(
            IPAlias.ip_id == ip_id,
            IPAlias.enabled == True,
        )
    )
    aliases = alias_result.scalars().all()

    if not aliases:
        return IndicatorResult(
            key="cross_alias_consistency", label="Cross-alias Consistency",
            dimension="diffusion", status="MISSING", score_0_100=50.0,
            debug=["No enabled aliases"],
        )

    midpoint = date.today() - timedelta(days=7)
    rising_count = 0
    total_with_data = 0

    for alias in aliases:
        tp_result = await db.execute(
            select(TrendPoint).where(
                TrendPoint.ip_id == ip_id,
                TrendPoint.alias_id == alias.id,
                TrendPoint.geo == geo,
                TrendPoint.timeframe == timeframe,
                TrendPoint.date >= cutoff,
            ).order_by(TrendPoint.date)
        )
        points = tp_result.scalars().all()

        # Require minimum 10 data points
        if len(points) < 10:
            continue

        prior = [p.value for p in points if p.date < midpoint]
        recent = [p.value for p in points if p.date >= midpoint]

        if not prior or not recent:
            continue

        prior_avg = statistics.mean(prior)
        recent_avg = statistics.mean(recent)

        # Skip aliases with avg daily value < 5 (near-zero noise)
        if statistics.mean([p.value for p in points]) < 5:
            continue

        total_with_data += 1
        if recent_avg > prior_avg:
            rising_count += 1

    if total_with_data == 0:
        return IndicatorResult(
            key="cross_alias_consistency", label="Cross-alias Consistency",
            dimension="diffusion", status="MISSING", score_0_100=50.0,
            debug=["No alias data qualifies (min 10 points, avg >= 5)"],
        )

    score = (rising_count / total_with_data) * 100

    return IndicatorResult(
        key="cross_alias_consistency", label="Cross-alias Consistency",
        dimension="diffusion", status="LIVE", score_0_100=round(score, 1),
        raw={"rising": rising_count, "total": total_with_data},
        debug=[f"{rising_count}/{total_with_data} aliases rising in last 14d"],
    )


async def compute_timing_window(
    db: AsyncSession,
    ip_id: uuid.UUID,
    latest: DailyTrend | None,
    manual_override: float | None,
) -> IndicatorResult:
    # 1. Manual override always wins
    if manual_override is not None and manual_override != 0.5:
        score = manual_override * 100
        return IndicatorResult(
            key="timing_window", label="Timing Window", dimension="gatekeeper",
            status="MANUAL", score_0_100=round(_clamp(0, 100, score), 1),
            debug=[f"Manual override: {manual_override}"],
        )

    # 2. Event-based timing (primary)
    today = date.today()
    lead_weeks = settings.signal_lead_time_weeks  # 12

    result = await db.execute(
        select(IPEvent).where(IPEvent.ip_id == ip_id).order_by(IPEvent.event_date)
    )
    events = result.scalars().all()

    if events:
        # Find nearest upcoming event
        upcoming = [e for e in events if e.event_date >= today]
        recent_past = [e for e in events if (today - e.event_date).days <= 28]

        if upcoming:
            nearest = upcoming[0]
            days_until = (nearest.event_date - today).days
            weeks_until = days_until / 7

            # Sweet spot: event is lead_weeks ± 2 weeks away
            center = lead_weeks - 1  # 11 weeks = ideal start
            if 8 <= weeks_until <= 14:
                dist = abs(weeks_until - center) / 3
                score = 95 - dist * 15  # 80-95
            elif 14 < weeks_until <= 20:
                score = 75 - (weeks_until - 14) * 2.5  # 60-75
            elif weeks_until > 20:
                score = max(40, 60 - (weeks_until - 20))
            elif 4 <= weeks_until < 8:
                score = 50 + (weeks_until - 4) * 5  # 50-70
            else:  # < 4 weeks
                score = 25 + weeks_until * 6  # 25-49

            return IndicatorResult(
                key="timing_window", label="Timing Window", dimension="gatekeeper",
                status="LIVE", score_0_100=round(_clamp(0, 100, score), 1),
                raw={"event": nearest.title, "event_date": str(nearest.event_date),
                     "event_type": nearest.event_type, "weeks_until": round(weeks_until, 1)},
                debug=[f"Next event: {nearest.title} in {weeks_until:.1f}w ({nearest.event_date})"],
            )

        if recent_past:
            latest_past = max(recent_past, key=lambda e: e.event_date)
            days_ago = (today - latest_past.event_date).days
            score = max(20, 60 - days_ago * 1.5)
            return IndicatorResult(
                key="timing_window", label="Timing Window", dimension="gatekeeper",
                status="LIVE", score_0_100=round(_clamp(0, 100, score), 1),
                raw={"event": latest_past.title, "event_date": str(latest_past.event_date),
                     "days_ago": days_ago},
                debug=[f"Recent event: {latest_past.title} was {days_ago}d ago — fading momentum"],
            )

    # 3. Fallback: trend-based signal light
    if latest and latest.signal_light:
        light_map = {"green": 75.0, "yellow": 50.0, "red": 25.0}
        score = light_map.get(latest.signal_light, 50.0)
        return IndicatorResult(
            key="timing_window", label="Timing Window", dimension="gatekeeper",
            status="LIVE", score_0_100=score,
            raw={"fallback": "trend", "signal_light": latest.signal_light},
            debug=[f"No events — fallback to trend signal_light={latest.signal_light}"],
        )

    return IndicatorResult(
        key="timing_window", label="Timing Window", dimension="gatekeeper",
        status="MISSING", score_0_100=50.0,
        debug=["No events and no trend data"],
    )


# --- Manual indicator function ---

def get_manual_score(key: str, label: str, dimension: str, manual_inputs: dict[str, float]) -> IndicatorResult:
    if key in manual_inputs:
        score = manual_inputs[key] * 100
        return IndicatorResult(
            key=key, label=label, dimension=dimension,
            status="MANUAL", score_0_100=round(_clamp(0, 100, score), 1),
            debug=[f"User input: {manual_inputs[key]}"],
        )
    return IndicatorResult(
        key=key, label=label, dimension=dimension,
        status="MISSING", score_0_100=50.0,
        debug=["Default neutral (no user input)"],
    )


# --- Score computation ---

def compute_opportunity_score(
    indicators: list[IndicatorResult],
) -> tuple[float, str, float, float, float, dict[str, float]]:
    """Returns (score, light, base, risk_mult, timing_mult, dimension_scores)."""
    by_dim: dict[str, list[float]] = {}
    for ind in indicators:
        by_dim.setdefault(ind.dimension, []).append(ind.score_0_100)

    demand = statistics.mean(by_dim.get("demand", [50.0]))
    diffusion = statistics.mean(by_dim.get("diffusion", [50.0]))
    fit = statistics.mean(by_dim.get("fit", [50.0]))
    supply = statistics.mean(by_dim.get("supply", [50.0]))

    # Gatekeeper: separate rightsholder_intensity from timing
    rightsholder = next(
        (ind.score_0_100 for ind in indicators if ind.key == "rightsholder_intensity"),
        50.0,
    )
    timing = next(
        (ind.score_0_100 for ind in indicators if ind.key == "timing_window"),
        50.0,
    )

    # Base score (positive dimensions)
    base = (
        settings.opp_weight_demand * demand
        + settings.opp_weight_diffusion * diffusion
        + settings.opp_weight_fit * fit
    )

    # Timing as decision accelerator
    timing_mult = settings.opp_timing_low + settings.opp_timing_high * (timing / 100)

    # Risk dampener
    risk_mult = 1.0 / (
        1.0
        + settings.opp_risk_weight_supply * (supply / 100)
        + settings.opp_risk_weight_gatekeeper * (rightsholder / 100)
    )

    # Final score
    score = _clamp(0, 100, base * timing_mult * risk_mult * settings.opp_scaling_factor)
    light = "green" if score >= 70 else "yellow" if score >= 40 else "red"

    dimension_scores = {
        "demand": round(demand, 1),
        "diffusion": round(diffusion, 1),
        "fit": round(fit, 1),
        "supply": round(supply, 1),
        "gatekeeper": round(rightsholder, 1),
        "timing": round(timing, 1),
    }

    return (round(score, 1), light, round(base, 2), round(risk_mult, 4), round(timing_mult, 4), dimension_scores)


# --- Coverage ratio ---

def compute_coverage(indicators: list[IndicatorResult]) -> float:
    live_count = sum(1 for ind in indicators if ind.status == "LIVE")
    return round(live_count / len(indicators), 2) if indicators else 0.0


# --- Explanation engine ---

def generate_explanations(
    indicators: list[IndicatorResult],
    dimension_scores: dict[str, float],
) -> list[str]:
    weight_map = {
        "demand": settings.opp_weight_demand,
        "diffusion": settings.opp_weight_diffusion,
        "fit": settings.opp_weight_fit,
        "supply": settings.opp_risk_weight_supply,
        "gatekeeper": settings.opp_risk_weight_gatekeeper,
    }

    deltas = []
    for dim, score in dimension_scores.items():
        if dim == "timing":
            continue
        weight = weight_map.get(dim, 0.1)
        delta = weight * (score - 50)
        deltas.append((dim, delta, score))

    deltas.sort(key=lambda x: abs(x[1]), reverse=True)

    explanations = []

    # Top positive driver
    positive = [d for d in deltas if d[1] > 0]
    if positive:
        dim, delta, score = positive[0]
        top_ind = max(
            (i for i in indicators if i.dimension == dim),
            key=lambda i: i.score_0_100,
            default=None,
        )
        label = top_ind.label if top_ind else dim.title()
        explanations.append(f"Strong {dim}: {label} at {score:.0f}")

    # Top risk / negative
    negative = [d for d in deltas if d[1] < 0]
    risk_dims = [d for d in deltas if d[0] in ("supply", "gatekeeper") and d[2] > 50]
    if negative:
        dim, delta, score = negative[0]
        top_ind = min(
            (i for i in indicators if i.dimension == dim),
            key=lambda i: i.score_0_100,
            default=None,
        )
        label = top_ind.label if top_ind else dim.title()
        explanations.append(f"Risk: {label} at {score:.0f}")
    elif risk_dims:
        dim, delta, score = risk_dims[0]
        explanations.append(f"Risk: {dim} pressure at {score:.0f}")

    # Timing recommendation
    timing_score = dimension_scores.get("timing", 50)
    if timing_score >= 70:
        explanations.append("Timing is favorable — consider starting BD now")
    elif timing_score >= 40:
        explanations.append("Timing is neutral — monitor for momentum shift")
    else:
        explanations.append("Timing is unfavorable — wait for better signals")

    return explanations[:3]


# --- Orchestrator ---

async def get_opportunity_data(
    db: AsyncSession,
    ip_id: uuid.UUID,
    geo: str = "TW",
    timeframe: str = "12m",
) -> OpportunityResponse:
    # 1. Get latest DailyTrend
    result = await db.execute(
        select(DailyTrend).where(
            DailyTrend.ip_id == ip_id,
            DailyTrend.geo == geo,
            DailyTrend.timeframe == timeframe,
        ).order_by(DailyTrend.date.desc()).limit(1)
    )
    latest = result.scalar_one_or_none()

    # 2. Get stored manual inputs
    input_result = await db.execute(
        select(OpportunityInput).where(OpportunityInput.ip_id == ip_id)
    )
    stored_inputs = {row.indicator_key: row.value for row in input_result.scalars().all()}

    # 3. Compute all indicators
    indicators: list[IndicatorResult] = []

    # A1: Search Momentum (LIVE)
    indicators.append(compute_search_momentum(latest))

    # A2, A3: Social Buzz, Video Momentum (MANUAL)
    for key, label, dimension, _ in INDICATOR_DEFS:
        if key in ("social_buzz", "video_momentum"):
            indicators.append(get_manual_score(key, label, dimension, stored_inputs))

    # B1: Cross-alias Consistency (LIVE)
    indicators.append(await compute_cross_alias_consistency(db, ip_id, geo, timeframe))

    # B2: Cross-platform Presence (MANUAL)
    indicators.append(get_manual_score("cross_platform_presence", "Cross-platform Presence", "diffusion", stored_inputs))

    # C1-C3: Supply/Competition (MANUAL)
    for key, label, dimension, _ in INDICATOR_DEFS:
        if dimension == "supply":
            indicators.append(get_manual_score(key, label, dimension, stored_inputs))

    # D1: Rightsholder Intensity (MANUAL)
    indicators.append(get_manual_score("rightsholder_intensity", "Rightsholder Intensity", "gatekeeper", stored_inputs))

    # D2: Timing Window (LIVE from events, fallback to trend, manual override)
    timing_override = stored_inputs.get("timing_window_override")
    indicators.append(await compute_timing_window(db, ip_id, latest, timing_override))

    # E1-E3: Fit (MANUAL)
    for key, label, dimension, _ in INDICATOR_DEFS:
        if dimension == "fit":
            indicators.append(get_manual_score(key, label, dimension, stored_inputs))

    # 4. Compute score
    score, light, base, risk_mult, timing_mult, dim_scores = compute_opportunity_score(indicators)

    # 5. Coverage
    coverage = compute_coverage(indicators)

    # 6. Explanations
    explanations = generate_explanations(indicators, dim_scores)

    # 7. Confidence (lazy compute)
    from app.services.confidence_service import get_ip_confidence
    confidence = await get_ip_confidence(db, ip_id)

    return OpportunityResponse(
        ip_id=ip_id,
        geo=geo,
        timeframe=timeframe,
        opportunity_score=score,
        opportunity_light=light,
        base_score=base,
        risk_multiplier=risk_mult,
        timing_multiplier=timing_mult,
        demand_score=dim_scores["demand"],
        diffusion_score=dim_scores["diffusion"],
        fit_score=dim_scores["fit"],
        supply_risk=dim_scores["supply"],
        gatekeeper_risk=dim_scores["gatekeeper"],
        timing_score=dim_scores["timing"],
        coverage_ratio=coverage,
        explanations=explanations,
        indicators=indicators,
        confidence=confidence,
    )
