import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models import IP, IPPipeline
from app.schemas import BDScoreResponse, IndicatorResult
from app.config import settings
from app.services.opportunity_service import get_opportunity_data


def _clamp(lo: float, hi: float, val: float) -> float:
    return max(lo, min(hi, val))


def _find_indicator(indicators: list[IndicatorResult], key: str) -> IndicatorResult | None:
    return next((i for i in indicators if i.key == key), None)


def generate_bd_explanations(
    fit_gate_score: float,
    fit_gate_passed: bool,
    timing_urgency: float,
    demand_trajectory: float,
    market_gap: float,
    feasibility: float,
    confidence_multiplier: float,
    bd_decision: str,
) -> list[str]:
    explanations: list[str] = []

    # Line 1: Decision driver
    if not fit_gate_passed:
        explanations.append(
            f"Fit gate failed ({fit_gate_score:.0f}) — IP does not meet minimum brand fit criteria"
        )
    elif timing_urgency >= 70:
        explanations.append(
            f"High timing urgency ({timing_urgency:.0f}) — start BD now or risk missing the launch window"
        )
    elif timing_urgency >= 50:
        explanations.append(
            f"Moderate timing urgency ({timing_urgency:.0f}) — window is approaching, monitor closely"
        )
    else:
        explanations.append(
            f"Low timing urgency ({timing_urgency:.0f}) — no immediate pressure to start BD"
        )

    # Line 2: Demand/market signal
    if demand_trajectory >= 65 and market_gap >= 60:
        explanations.append(
            f"Strong demand trajectory ({demand_trajectory:.0f}) with open market gap ({market_gap:.0f})"
        )
    elif demand_trajectory >= 50:
        explanations.append(
            f"Moderate demand ({demand_trajectory:.0f}), market gap at {market_gap:.0f}"
        )
    else:
        explanations.append(
            f"Weak demand trajectory ({demand_trajectory:.0f}), market gap at {market_gap:.0f}"
        )

    # Line 3: Confidence or feasibility note
    if confidence_multiplier < 0.5:
        explanations.append(
            f"Low data confidence ({confidence_multiplier:.0%}) — score significantly discounted"
        )
    elif feasibility < 40:
        explanations.append(
            f"Feasibility concern ({feasibility:.0f}) — difficult rightsholder or limited platform presence"
        )
    else:
        explanations.append(
            f"Feasibility OK ({feasibility:.0f}), confidence {confidence_multiplier:.0%}"
        )

    return explanations[:3]


async def compute_bd_score(
    db: AsyncSession,
    ip_id: uuid.UUID,
    geo: str = "TW",
    timeframe: str = "12m",
) -> BDScoreResponse:
    # 1. Get shared indicators via existing opportunity service
    opp = await get_opportunity_data(db, ip_id, geo, timeframe)
    indicators = opp.indicators

    # 2. Fit Gate (hard constraint)
    adult_fit_ind = _find_indicator(indicators, "adult_fit")
    giftability_ind = _find_indicator(indicators, "giftability")
    brand_aesthetic_ind = _find_indicator(indicators, "brand_aesthetic")

    adult_fit = adult_fit_ind.score_0_100 if adult_fit_ind else 50.0
    giftability = giftability_ind.score_0_100 if giftability_ind else 50.0
    brand_aesthetic = brand_aesthetic_ind.score_0_100 if brand_aesthetic_ind else 50.0
    fit_gate_score = min(adult_fit, giftability, brand_aesthetic)
    fit_gate_passed = fit_gate_score >= settings.bd_fit_gate_threshold

    # 3. Timing Urgency (weight 0.35)
    # Gatekeeper difficulty increases urgency — harder licensor = need to start earlier
    timing_raw = opp.timing_score
    rightsholder = opp.gatekeeper_risk
    timing_urgency = _clamp(0, 100,
        timing_raw * (1 + settings.bd_gatekeeper_urgency_factor * rightsholder / 100)
    )

    # 4. Demand Trajectory (weight 0.30)
    # Demand average + acceleration bonus from search_momentum
    search_mom = _find_indicator(indicators, "search_momentum")
    accel_bonus = 10 if (search_mom and search_mom.raw and search_mom.raw.get("acceleration")) else 0
    demand_trajectory = _clamp(0, 100, opp.demand_score + accel_bonus)

    # 5. Market Gap (weight 0.20)
    # Low supply = high opportunity
    market_gap = 100 - opp.supply_risk

    # 6. Feasibility (weight 0.15)
    # Cross-platform presence + inverse rightsholder intensity
    feasibility = _clamp(0, 100,
        0.5 * opp.diffusion_score + 0.5 * (100 - rightsholder)
    )

    # 7. BD Score (raw)
    raw_score = (
        settings.bd_weight_timing * timing_urgency
        + settings.bd_weight_demand * demand_trajectory
        + settings.bd_weight_market_gap * market_gap
        + settings.bd_weight_feasibility * feasibility
    )

    # 8. Confidence multiplier
    confidence = opp.confidence
    conf_mult = (confidence.confidence_score / 100) if confidence else 0.5
    bd_score = _clamp(0, 100, raw_score * conf_mult)

    # 9. Decision
    if not fit_gate_passed:
        bd_decision = "REJECT"
    elif bd_score >= settings.bd_start_threshold:
        bd_decision = "START"
    elif bd_score >= settings.bd_monitor_threshold:
        bd_decision = "MONITOR"
    else:
        bd_decision = "REJECT"

    # 10. Explanations
    explanations = generate_bd_explanations(
        fit_gate_score=fit_gate_score,
        fit_gate_passed=fit_gate_passed,
        timing_urgency=timing_urgency,
        demand_trajectory=demand_trajectory,
        market_gap=market_gap,
        feasibility=feasibility,
        confidence_multiplier=conf_mult,
        bd_decision=bd_decision,
    )

    # 11. Cache to IPPipeline (upsert)
    pipeline_stmt = pg_insert(IPPipeline).values(
        ip_id=ip_id,
        bd_score=round(bd_score, 1),
        bd_decision=bd_decision,
    ).on_conflict_do_update(
        index_elements=["ip_id"],
        set_={"bd_score": round(bd_score, 1), "bd_decision": bd_decision},
    )
    await db.execute(pipeline_stmt)
    await db.commit()

    # Get pipeline stage
    pipeline_result = await db.execute(
        select(IPPipeline).where(IPPipeline.ip_id == ip_id)
    )
    pipeline = pipeline_result.scalar_one_or_none()
    pipeline_stage = pipeline.stage if pipeline else "candidate"

    # Get IP name
    ip_result = await db.execute(select(IP.name).where(IP.id == ip_id))
    ip_name = ip_result.scalar_one_or_none() or "Unknown"

    return BDScoreResponse(
        ip_id=ip_id,
        ip_name=ip_name,
        geo=geo,
        timeframe=timeframe,
        bd_score=round(bd_score, 1),
        bd_decision=bd_decision,
        fit_gate_score=round(fit_gate_score, 1),
        fit_gate_passed=fit_gate_passed,
        timing_urgency=round(timing_urgency, 1),
        demand_trajectory=round(demand_trajectory, 1),
        market_gap=round(market_gap, 1),
        feasibility=round(feasibility, 1),
        raw_score=round(raw_score, 1),
        confidence_multiplier=round(conf_mult, 2),
        explanations=explanations,
        pipeline_stage=pipeline_stage,
        indicators=indicators,
        confidence=confidence,
    )


async def rank_candidates(
    db: AsyncSession,
    geo: str = "TW",
    timeframe: str = "12m",
) -> list[BDScoreResponse]:
    result = await db.execute(select(IP.id))
    ip_ids = [row[0] for row in result.all()]

    scores: list[BDScoreResponse] = []
    for ip_id in ip_ids:
        score = await compute_bd_score(db, ip_id, geo, timeframe)
        scores.append(score)

    scores.sort(key=lambda s: s.bd_score, reverse=True)
    return scores
