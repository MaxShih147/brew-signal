# Brew Signal — Scoring Reference

All calculation formulas used by the Brew Signal decision system, extracted from source code. This document covers the indicator engine, BD allocation scoring, opportunity scoring, and confidence computation.

**Source files:**
- `backend/app/services/opportunity_service.py` — indicators + opportunity score
- `backend/app/services/bd_allocation_service.py` — BD score formula
- `backend/app/services/confidence_service.py` — confidence formula
- `backend/app/config.py` — all configurable defaults

---

## 1. System Overview

Brew Signal is a two-stage decision system for IP licensing:

| Stage | Question | Output |
|-------|----------|--------|
| **Stage 1 — BD Slot Allocation** | Should we start negotiation now? Is this IP worth a BD slot + MG? | START / MONITOR / REJECT |
| **Stage 2 — Launch Timing** | We secured the license. When should we launch? | Recommended launch window |

Both stages share 13 indicators across 5 dimensions, a confidence system, and a data health layer.

---

## 2. Indicators (13)

Each indicator produces a score from 0-100, a status (`LIVE`, `MANUAL`, or `MISSING`), and debug metadata.

### 2.1 Indicator Map

| # | Key | Label | Dimension | Type | Source |
|---|-----|-------|-----------|------|--------|
| 1 | `search_momentum` | Search Momentum | Demand | LIVE | Google Trends daily data |
| 2 | `social_buzz` | Social Buzz | Demand | MANUAL | User input (0-1 slider) |
| 3 | `video_momentum` | Video Momentum | Demand | MANUAL | User input (0-1 slider) |
| 4 | `cross_alias_consistency` | Cross-alias Consistency | Diffusion | LIVE | Trend data across aliases |
| 5 | `cross_platform_presence` | Cross-platform Presence | Diffusion | MANUAL | User input (0-1 slider) |
| 6 | `ecommerce_density` | E-commerce Density | Supply | MANUAL | User input (0-1 slider) |
| 7 | `fnb_collab_saturation` | F&B Collab Saturation | Supply | MANUAL | User input (0-1 slider) |
| 8 | `merch_pressure` | Merch Pressure | Supply | MANUAL | User input (0-1 slider) |
| 9 | `rightsholder_intensity` | Rightsholder Intensity | Gatekeeper | MANUAL | User input (0-1 slider) |
| 10 | `timing_window` | Timing Window | Gatekeeper | LIVE | Events + trend fallback |
| 11 | `adult_fit` | Adult Fit | Fit | MANUAL | User input (0-1 slider) |
| 12 | `giftability` | Giftability | Fit | MANUAL | User input (0-1 slider) |
| 13 | `brand_aesthetic` | Brand Aesthetic | Fit | MANUAL | User input (0-1 slider) |

**Manual indicators:** User inputs are stored as 0-1 floats, multiplied by 100 to produce the 0-100 score. Missing inputs default to 50.0 (neutral).

---

### 2.2 Search Momentum (LIVE)

Computed from the latest `DailyTrend` record for the IP.

```
base = 50.0

WoW contribution (clamped to +/-20):
  wow_contrib = wow_growth * 100 * 0.5
  score += clamp(-20, +20, wow_contrib)

Acceleration bonus:
  if acceleration == true:  score += 15

Breakout contribution (clamped to +/-15):
  bp_contrib = (breakout_percentile - 50) * 0.3
  score += clamp(-15, +15, bp_contrib)

Final: clamp(0, 100, score)
```

**Inputs:**
- `wow_growth` — week-over-week growth rate (decimal, e.g. 0.15 = +15%)
- `acceleration` — boolean, true if growth is accelerating over `signal_acceleration_weeks`
- `breakout_percentile` — percentile rank of current value vs historical (0-100)

**If no daily trend data exists:** returns `MISSING` status with score 50.0.

---

### 2.3 Cross-alias Consistency (LIVE)

Measures what fraction of an IP's aliases are trending upward in the last 14 days.

```
For each enabled alias with sufficient data:
  1. Get trend points from last 14 days
  2. Require minimum 10 data points
  3. Skip aliases with average daily value < 5 (noise filter)
  4. Split at midpoint (7 days ago)
  5. Compare: recent_avg vs prior_avg
  6. If recent_avg > prior_avg -> alias is "rising"

score = (rising_count / total_with_data) * 100
```

**Output range:** 0 (no aliases rising) to 100 (all aliases rising).

**If no aliases qualify:** returns `MISSING` status with score 50.0.

---

### 2.4 Timing Window (LIVE / MANUAL)

Priority order: manual override > event-based > trend-based fallback.

#### Manual Override

If `timing_window_override` is set and != 0.5:
```
score = timing_window_override * 100
```

#### Event-based (primary)

Uses `signal_lead_time_weeks` (default: 12) as the ideal lead time.

**Upcoming events** (event_date >= today):

| Weeks Until Event | Formula | Score Range |
|-------------------|---------|-------------|
| 8-14 weeks (sweet spot) | `95 - (abs(weeks - 11) / 3) * 15` | 80-95 |
| 14-20 weeks | `75 - (weeks - 14) * 2.5` | 60-75 |
| > 20 weeks | `max(40, 60 - (weeks - 20))` | 40-60 |
| 4-8 weeks | `50 + (weeks - 4) * 5` | 50-70 |
| < 4 weeks (too late) | `25 + weeks * 6` | 25-49 |

**Recent past events** (within last 28 days):
```
score = max(20, 60 - days_ago * 1.5)
```

#### Trend-based Fallback

If no events exist but daily trend data has a signal light:

| Signal Light | Score |
|-------------|-------|
| green | 75.0 |
| yellow | 50.0 |
| red | 25.0 |

**If no events and no trend data:** returns `MISSING` status with score 50.0.

---

## 3. Opportunity Score

The opportunity score combines all 13 indicators into a single 0-100 score. This is the shared base computation used across stages.

### 3.1 Dimension Aggregation

Each dimension averages its indicator scores:

```
demand    = mean(search_momentum, social_buzz, video_momentum)
diffusion = mean(cross_alias_consistency, cross_platform_presence)
fit       = mean(adult_fit, giftability, brand_aesthetic)
supply    = mean(ecommerce_density, fnb_collab_saturation, merch_pressure)

Gatekeeper is split:
  rightsholder = rightsholder_intensity score
  timing       = timing_window score
```

Missing dimensions default to 50.0.

### 3.2 Base Score

```
base = opp_weight_demand    * demand      (0.30)
     + opp_weight_diffusion * diffusion   (0.20)
     + opp_weight_fit       * fit         (0.15)
```

### 3.3 Timing Multiplier

Timing acts as a decision accelerator, not a linear additive:

```
timing_mult = opp_timing_low + opp_timing_high * (timing / 100)

With defaults (0.8, 0.4):
  timing = 0   -> mult = 0.80  (dampens)
  timing = 50  -> mult = 1.00  (neutral)
  timing = 100 -> mult = 1.20  (amplifies)
```

### 3.4 Risk Multiplier

Supply and gatekeeper risk dampen the score:

```
risk_mult = 1.0 / (1.0
  + opp_risk_weight_supply     * (supply / 100)       (0.25)
  + opp_risk_weight_gatekeeper * (rightsholder / 100)  (0.10)
)

Range: ~0.74 (max risk) to 1.0 (no risk)
```

### 3.5 Final Score

```
opportunity_score = clamp(0, 100, base * timing_mult * risk_mult * opp_scaling_factor)

opp_scaling_factor default: 1.35
```

### 3.6 Traffic Light

| Score | Light |
|-------|-------|
| >= 70 | green |
| 40-69 | yellow |
| < 40 | red |

### 3.7 Coverage Ratio

```
coverage = count(indicators where status == "LIVE") / total_indicators
```

---

## 4. BD Allocation Score (Stage 1)

The BD score determines whether to allocate a scarce BD slot to an IP.

### 4.1 Fit Gate (Hard Constraint)

```
fit_gate_score = min(adult_fit, giftability, brand_aesthetic)

if fit_gate_score < bd_fit_gate_threshold (30.0):
  -> REJECT (regardless of other scores)
```

### 4.2 Component Scores

#### Timing Urgency (weight: 0.35)

Gatekeeper difficulty increases urgency — harder licensor means you need to start earlier:

```
timing_urgency = clamp(0, 100,
  timing_raw * (1 + bd_gatekeeper_urgency_factor * rightsholder / 100)
)

bd_gatekeeper_urgency_factor default: 0.3
```

Example: timing_raw=60, rightsholder=80 -> `60 * (1 + 0.3 * 0.8)` = 60 * 1.24 = 74.4

#### Demand Trajectory (weight: 0.30)

Demand average plus acceleration bonus:

```
accel_bonus = 10 if search_momentum has acceleration == true, else 0
demand_trajectory = clamp(0, 100, demand_avg + accel_bonus)
```

#### Market Gap (weight: 0.20)

Low supply = high opportunity:

```
market_gap = 100 - supply_risk
```

Where `supply_risk` is the mean of the 3 supply indicators (ecommerce_density, fnb_collab_saturation, merch_pressure).

#### Feasibility (weight: 0.15)

Cross-platform presence + inverse rightsholder intensity:

```
feasibility = clamp(0, 100,
  0.5 * diffusion_score + 0.5 * (100 - rightsholder)
)
```

### 4.3 Raw BD Score

```
raw_score = bd_weight_timing      * timing_urgency     (0.35)
          + bd_weight_demand      * demand_trajectory   (0.30)
          + bd_weight_market_gap  * market_gap          (0.20)
          + bd_weight_feasibility * feasibility          (0.15)
```

### 4.4 Confidence Multiplier

```
conf_mult = confidence_score / 100    (or 0.5 if no confidence data)
bd_score  = clamp(0, 100, raw_score * conf_mult)
```

### 4.5 Decision Thresholds

| BD Score | Decision |
|----------|----------|
| >= 70.0 (`bd_start_threshold`) | **START** — allocate BD slot |
| 40.0-69.9 (`bd_monitor_threshold`) | **MONITOR** — watch and reassess |
| < 40.0 | **REJECT** — do not pursue |
| fit_gate < 30.0 | **REJECT** — hard constraint |

---

## 5. Confidence Score

Confidence reflects how much data the system has to support its scoring. Low confidence discounts the BD score.

### 5.1 Key Indicators

These indicators incur extra penalties when missing:
- `search_momentum`
- `video_momentum`
- `timing_window`

### 5.2 Coverage Metrics

```
indicator_coverage = active_indicators / 13

Active indicators:
  - Each stored manual input counts as 1
  - If daily trend data exists: +2 (search_momentum + cross_alias_consistency)
  - If events exist: +1 (timing_window)
```

```
source_coverage = attempted_ok_ratio * configured_ratio

Where:
  attempted_ok_ratio = active_sources / attempted_sources
  configured_ratio   = attempted_sources / expected_sources
```

Sources with no health record are treated as "not configured" (lower coverage but no penalty).

### 5.3 Base Confidence

```
base = 100 * (
  confidence_indicator_weight * indicator_coverage    (0.6)
  + confidence_source_weight  * source_coverage       (0.4)
)
```

### 5.4 Penalties

**Key source penalties** (only for sources that were attempted):

| Source Status | Penalty |
|--------------|---------|
| down | `confidence_key_source_down_penalty` (20) |
| warn | `confidence_key_source_warn_penalty` (10) |
| ok / not attempted | 0 |

**Key indicator penalties:**
```
key_ind_penalty = count(missing_key_indicators) * confidence_key_indicator_missing_penalty (10)
key_ind_penalty = min(key_ind_penalty, confidence_key_indicator_penalty_cap (30))
```

Total penalty is capped at 80% of the base:
```
penalty_fraction = min(total_penalty / 100, 0.8)
```

### 5.5 Risk Adjustment

Based on source availability levels from the registry:

```
For each registered source:
  factor = {high: 1.0, medium: 0.8, low: 0.5}[availability_level]
  weighted_sum += priority_weight * factor

risk_adjustment = weighted_sum / total_priority_weight
```

### 5.6 Final Confidence

```
confidence_score = clamp(0, 100,
  floor(base * risk_adjustment * (1 - penalty_fraction))
)
```

### 5.7 Confidence Bands

| Score | Band |
|-------|------|
| >= 80 | **high** |
| 60-79 | **medium** |
| 40-59 | **low** |
| < 40 | **insufficient** |

---

## 6. Source Staleness Thresholds

Each data source has per-source freshness thresholds:

| Source | Fresh (hours) | Warn (hours) | Notes |
|--------|--------------|-------------|-------|
| `google_trends` | 72 (3d) | 168 (7d) | |
| `youtube` | 72 (3d) | 168 (7d) | |
| `news_rss` | 24 (1d) | 72 (3d) | Fastest decay |
| `shopee` | 72 (3d) | 168 (7d) | |
| `wiki_mal` | 720 (30d) | 2160 (90d) | Slowest decay (static data) |
| `amazon_jp` | 72 (3d) | 168 (7d) | |

**Status derivation:**
- `<= fresh_h` after last success -> **ok**
- `<= warn_h` after last success -> **warn**
- `> warn_h` or never succeeded -> **down**

---

## 7. Configurable Parameters

All parameters are configurable via environment variables (loaded by pydantic-settings from `.env`).

### Signal Thresholds

| Parameter | Default | Description |
|-----------|---------|-------------|
| `signal_wow_growth_threshold` | 0.30 | WoW growth threshold for breakout detection |
| `signal_acceleration_weeks` | 2 | Number of weeks to assess acceleration |
| `signal_breakout_percentile` | 85 | Percentile threshold for breakout alert |
| `signal_lead_time_weeks` | 12 | Ideal lead time for timing window scoring |

### Opportunity Score Weights

| Parameter | Default | Description |
|-----------|---------|-------------|
| `opp_weight_demand` | 0.30 | Weight of demand dimension in base score |
| `opp_weight_diffusion` | 0.20 | Weight of diffusion dimension in base score |
| `opp_weight_fit` | 0.15 | Weight of fit dimension in base score |
| `opp_risk_weight_supply` | 0.25 | Supply risk dampening factor |
| `opp_risk_weight_gatekeeper` | 0.10 | Gatekeeper risk dampening factor |
| `opp_scaling_factor` | 1.35 | Post-multiplication scaling factor |
| `opp_timing_low` | 0.80 | Timing multiplier floor (timing=0) |
| `opp_timing_high` | 0.40 | Timing multiplier range (added at timing=100) |

### BD Allocation Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `bd_weight_timing` | 0.35 | Weight of timing urgency |
| `bd_weight_demand` | 0.30 | Weight of demand trajectory |
| `bd_weight_market_gap` | 0.20 | Weight of market gap |
| `bd_weight_feasibility` | 0.15 | Weight of feasibility |
| `bd_fit_gate_threshold` | 30.0 | Minimum fit gate score (below = REJECT) |
| `bd_start_threshold` | 70.0 | BD score threshold for START decision |
| `bd_monitor_threshold` | 40.0 | BD score threshold for MONITOR decision |
| `bd_gatekeeper_urgency_factor` | 0.30 | How much rightsholder difficulty amplifies timing urgency |
| `bd_base_lead_weeks` | 12 | Base lead time assumption for BD planning |

### Confidence Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `confidence_indicator_weight` | 0.60 | Weight of indicator coverage in base confidence |
| `confidence_source_weight` | 0.40 | Weight of source coverage in base confidence |
| `confidence_key_source_down_penalty` | 20 | Penalty points for a key source being down |
| `confidence_key_source_warn_penalty` | 10 | Penalty points for a key source being stale |
| `confidence_key_indicator_missing_penalty` | 10 | Penalty per missing key indicator |
| `confidence_key_indicator_penalty_cap` | 30 | Maximum penalty from missing key indicators |
