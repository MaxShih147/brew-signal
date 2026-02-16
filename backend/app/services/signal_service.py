from __future__ import annotations

import statistics
from datetime import date
from typing import Sequence

from app.models import DailyTrend
from app.schemas import AlertOut
from app.config import settings


def compute_signal_light(
    wow_growth: float | None,
    acceleration: bool | None,
    breakout_pct: float | None,
    ma7: float | None,
    ma28: float | None,
) -> str:
    """Rule-based traffic light: green / yellow / red."""
    wow_thresh = settings.signal_wow_growth_threshold
    bp_thresh = settings.signal_breakout_percentile

    green_conditions = [
        wow_growth is not None and wow_growth > wow_thresh,
        acceleration is True,
        breakout_pct is not None and breakout_pct >= bp_thresh,
    ]

    if all(green_conditions):
        return "green"

    # Red: MA7 < MA28 and WoW negative, or clearly declining
    if (
        ma7 is not None
        and ma28 is not None
        and ma7 < ma28
        and wow_growth is not None
        and wow_growth < 0
    ):
        return "red"

    # Yellow: 1-2 conditions met, or ambiguous
    return "yellow"


def compute_aggregation(
    values: list[float],
    all_values_6m: list[float],
    prev_wow: float | None,
) -> dict:
    """Compute daily trend aggregation from a list of composite values.

    Args:
        values: all composite values in date order (latest at end)
        all_values_6m: all values in the last ~6 months for percentile calc
        prev_wow: previous week's WoW growth for acceleration check
    """
    if len(values) < 7:
        return {}

    ma7 = statistics.mean(values[-7:])
    ma28 = statistics.mean(values[-28:]) if len(values) >= 28 else None

    # WoW growth
    if len(values) >= 14:
        avg_this = statistics.mean(values[-7:])
        avg_prev = statistics.mean(values[-14:-7])
        wow_growth = (avg_this / avg_prev - 1) if avg_prev > 0 else 0.0
    else:
        wow_growth = None

    # Acceleration: WoW has increased for 2 consecutive weeks
    acceleration = False
    if wow_growth is not None and prev_wow is not None:
        acceleration = wow_growth > 0 and prev_wow > 0 and wow_growth > prev_wow

    # Breakout percentile
    breakout_percentile = None
    if all_values_6m and len(all_values_6m) >= 7:
        current_avg = statistics.mean(values[-7:])
        sorted_vals = sorted(all_values_6m)
        rank = sum(1 for v in sorted_vals if v <= current_avg)
        breakout_percentile = (rank / len(sorted_vals)) * 100

    signal_light = compute_signal_light(wow_growth, acceleration, breakout_percentile, ma7, ma28)

    return {
        "ma7": round(ma7, 2),
        "ma28": round(ma28, 2) if ma28 is not None else None,
        "wow_growth": round(wow_growth, 4) if wow_growth is not None else None,
        "acceleration": acceleration,
        "breakout_percentile": round(breakout_percentile, 1) if breakout_percentile is not None else None,
        "signal_light": signal_light,
    }


def compute_alerts(recent_trends: Sequence[DailyTrend]) -> list[AlertOut]:
    """Compute alert signals from recent daily trend data."""
    alerts = []
    if not recent_trends:
        return alerts

    latest = recent_trends[-1]

    # Breakout alert
    bp_thresh = settings.signal_breakout_percentile
    if latest.breakout_percentile is not None and latest.breakout_percentile >= bp_thresh:
        alerts.append(AlertOut(
            type="breakout",
            message=f"Breakout detected: 7d avg at P{latest.breakout_percentile:.0f} of 6-month range",
            alert_date=str(latest.date),
        ))

    # Peak-turn alert: MA7 crosses below MA28
    if len(recent_trends) >= 2:
        prev = recent_trends[-2]
        if (
            prev.ma7 is not None and prev.ma28 is not None
            and latest.ma7 is not None and latest.ma28 is not None
            and prev.ma7 >= prev.ma28 and latest.ma7 < latest.ma28
        ):
            alerts.append(AlertOut(
                type="peak_turn",
                message="Peak turn: MA7 crossed below MA28 — trend may be declining",
                alert_date=str(latest.date),
            ))

    # Spike alert: value > mean + 2σ
    if len(recent_trends) >= 30:
        vals = [t.composite_value for t in recent_trends if t.composite_value is not None]
        if len(vals) >= 30:
            mean_val = statistics.mean(vals)
            std_val = statistics.stdev(vals)
            if std_val > 0 and latest.composite_value > mean_val + 2 * std_val:
                alerts.append(AlertOut(
                    type="spike",
                    message=f"Spike: current value {latest.composite_value:.0f} exceeds mean+2σ ({mean_val + 2*std_val:.0f})",
                    alert_date=str(latest.date),
                ))

    return alerts
