# Brew Signal — IP Licensing Decision System

## Problem Statement

This system is **not** an "IP virality predictor".
It is a **decision system** for IP licensing under high friction:

- Upfront minimum guarantee (MG) USD 20k-40k
- 3-5 parallel BD slots (scarce capacity)
- 6-12 months licensing friction (approval delays + strict asset review)
- 12+3 month license period
- Launch success depends on market state at **launch time**, not "now"

The system is split into **two stages**:

| Stage | Question | Nature |
|-------|----------|--------|
| **Stage 1 — BD Slot Allocation** | "Should we start negotiation now? Is this IP worth a BD slot + MG?" | Portfolio allocation (pick) |
| **Stage 2 — Launch Timing** | "We secured the license. When should we launch within the window?" | Timeline optimization (schedule) |

---

## Tech Stack
- **Backend**: Python 3.12, FastAPI, SQLAlchemy (async), Alembic, pytrends
- **Frontend**: React 18, TypeScript, Vite, Recharts, Tailwind CSS
- **Database**: PostgreSQL 16
- **Infra**: Docker Compose
- **AI**: Anthropic Claude API for alias auto-discovery

## Running
```bash
cp .env.example .env  # then add your ANTHROPIC_API_KEY
docker compose up --build
```
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

---

## Architecture: Two-Stage Decision Model

### 0) System Layers

Both stages share:
- Data connectors (sources)
- Indicator engine (13 indicators across 5 dimensions)
- Data Health (observability)
- Confidence (coverage & reliability)

They differ in: objective function, required inputs, outputs, UX flows.

### 0.1 Data Layer (shared)

**Connectors (sources)**
- wiki_mal: identity + lifecycle + upcoming events
- news_rss: collab/event signals (coverage, density)
- youtube: video momentum
- google_trends: search momentum
- shopee: supply density (best-effort; unstable)
- (optional later) reddit/ptt/dcard, amazon_jp/animate, official announcements

**DataOps / Observability**
- source_run: per run logs (started/finished/status/counts/error_sample/meta)
- ip_source_health: per IP x source health (attempt/success timestamps, status, staleness, last_error)
- source_registry: availability/risk_type/weights/thresholds/fallback strategies

### 0.2 Feature / Indicator Layer (shared)

13 indicators across 5 dimensions, each with:
- value (0-100), coverage (0-1), staleness (hours), sources_used, notes

| Dimension | Indicators | Type |
|-----------|-----------|------|
| Demand | search_momentum, social_buzz, video_momentum | LIVE, MANUAL, MANUAL |
| Diffusion | cross_alias_consistency, cross_platform_presence | LIVE, MANUAL |
| Supply/Competition | ecommerce_density, fnb_collab_saturation, merch_pressure | MANUAL x3 |
| Gatekeeper | rightsholder_intensity, timing_window | MANUAL, LIVE |
| Fit | adult_fit, giftability, brand_aesthetic | MANUAL x3 |

Missingness is explicit and reflected in confidence.

---

### 1) Stage 1 — BD Slot Allocation Engine

#### 1.1 Objective
Decide whether to commit scarce resources **now**:
- consume 1 of 3-5 BD slots
- pay MG (USD 20k-40k)
- enter a 6-12 month approval pipeline

**"If we start negotiation now, is the expected value at launch time worth occupying a BD slot?"**

#### 1.2 Key Concepts

**A) Fit as Gate (hard constraint)**
If an IP fails key fit constraints, it is not eligible regardless of demand:
- `fit_gate = min(adult_fit, giftability, brand_aesthetic)`
- If `fit_gate < threshold` -> REJECT (do not allocate slot)

**B) Gatekeeper as Lead-Time Shifter (not just risk)**
Rightsholder difficulty increases expected approval duration:
- `adjusted_lead_time = base_lead_weeks + gatekeeper_extra_weeks`
- Harder licensor = need to start EARLIER = potentially more urgent

**C) Timing as Primary Axis (urgency)**
Window alignment between expected launch window and required lead time:
- `window_alignment = target_launch_date - now - adjusted_lead_time`
- High score = "start now or miss window"

**D) Demand as Trajectory (not current level)**
Acceleration + catalysts, not absolute level:
- `demand_trajectory = f(search_slope, video_growth, news_accel, upcoming_event_support)`

**E) Market Risk as Forward Saturation (inverted)**
Not "how saturated now", but "how saturated at launch":
- `market_gap = 100 - projected_supply_at_launch`

#### 1.3 Scoring Formula (MVP)
```
After fit gate passes:

bd_score = 0.35 * timing_urgency
         + 0.30 * demand_trajectory
         + 0.20 * market_gap
         + 0.15 * feasibility

bd_score *= (confidence / 100)

Decision:
  START   >= 70
  MONITOR 40-69
  REJECT  < 40 or fit_gate < threshold
```

Note: This is a transitional approximation to an "expected value vs wait" model.
Later: incorporate explicit slot opportunity cost + MG lock cost.

#### 1.4 Outputs
- Decision: START / MONITOR / REJECT
- BD Score (0-100)
- Explanations (why start now / why monitor / why reject)
- Portfolio recommendation: top N IPs for available slots (3-5), with diversification hints (stable evergreen vs event-driven, different fandom segments)

---

### 2) Stage 2 — Launch Timing Engine

#### 2.1 Objective
After the IP is selected and license secured, decide **when to launch** within constraints:
- license window (e.g., 12+3 months)
- channel calendar (FamilyMart seasonal campaigns, limited promo slots)
- production & logistics (manufacturing lead time, packaging, distribution)
- marketing ramp time

**"Given we can launch within a window, which launch week/month maximizes expected performance?"**

#### 2.2 Inputs
- Confirmed/estimated: earliest launch date, latest viable launch date
- Event calendar: anime/movie/game releases, anniversaries, official campaigns
- Demand curve signals: trends & video momentum over time (rolling)
- Competitive saturation over time: predicted collab density, supply signals
- Seasonality / channel fit: coffee consumption seasonality, convenience store promo cycles

#### 2.3 Algorithm (MVP)
```
Time grid (weekly) between T_min (earliest) and T_max (latest):

For each candidate time t:
  launch_value(t) = alpha * predicted_demand(t)
                  + beta  * event_boost(t)
                  - gamma * predicted_saturation(t)
                  - delta * operational_risk(t)

Recommend: t* = argmax launch_value(t)
Also return: top-3 candidate windows and their tradeoffs
```

#### 2.4 Outputs
- Recommended launch window (best month, backup month)
- Rationale: event alignment, demand acceleration, competitive avoidance, operational feasibility
- Timeline plan: negotiation start date, artwork submission deadlines, sample review buffer, production start, launch

---

### 3) Shared: Confidence + Data Health

This system drives high-cost irreversible decisions. If sources are missing/stale, the system must say so loudly.

**IP Confidence (0-100)**: computed from indicator coverage, source coverage, staleness penalties, source risk registry.
- Stage 1: confidence multiplier on BD score (low confidence = downgrade decision)
- Stage 2: wider uncertainty bands on recommended windows

**Admin Data Health Dashboard**: Source Risk Registry, Source Health (OK/WARN/DOWN), Coverage Matrix (IP x source), Recent Runs.

---

## Project Structure
```
backend/
  app/
    main.py              # FastAPI app entry
    config.py            # pydantic-settings from .env (scoring weights, thresholds)
    database.py          # async SQLAlchemy engine
    models.py            # IP, IPAlias, TrendPoint, DailyTrend, IPEvent, OpportunityInput,
                         #   IPPipeline, SourceRegistry, SourceRun, IPSourceHealth,
                         #   IPConfidence, CollectorRunLog
    schemas.py           # Pydantic request/response models
    routers/
      ip.py              # IP CRUD + aliases + events + discover
      trend.py           # Trend data + health + signals
      collect.py         # Manual collection trigger
      bd_allocation.py   # Stage 1: BD score + decisions
      launch_timing.py   # Stage 2: Launch window planning
      admin.py           # Data Health dashboard APIs
    services/
      trend_service.py       # Collection orchestrator + daily aggregation
      signal_service.py      # Traffic light + alerts
      health_service.py      # Collector health stats
      opportunity_service.py # Shared indicator computation (13 indicators)
      bd_allocation_service.py   # Stage 1 scoring engine
      launch_timing_service.py   # Stage 2 time grid optimization
      confidence_service.py      # Data confidence + source health
      alias_discovery.py         # Claude API alias finder
    connectors/          # Stub connectors (shopee, amazon, youtube, etc.)
    collectors/          # pytrends_collector, official_collector (stub), rate_limiter
    seed.py              # Demo data
  alembic/               # DB migrations (001-006+)
frontend/
  src/
    pages/
      IpList.tsx         # Stage 1: Candidate Pool + BD Score ranking
      IpDetail.tsx       # Stage 1 view (candidate) or Stage 2 view (secured)
      LaunchPlannerPage.tsx  # Stage 2: Timeline + recommended windows
      DataHealthPage.tsx     # Admin: source health + coverage matrix
    components/
      BDScoreCard.tsx        # Stage 1: START/MONITOR/REJECT + urgency reasons
      OpportunityMetricGrid.tsx  # Shared: 13 indicators with sliders
      LaunchPlanner.tsx      # Stage 2: timeline band + event overlay
      TrendChart.tsx         # Recharts trend visualization
      IpConfigCard.tsx       # Alias management + geo/timeframe selectors
      HealthCard.tsx         # Collector health stats
      EventsCard.tsx         # Event calendar CRUD
      AlertsPanel.tsx        # Breakout / peak turn / spike alerts
      TrafficLight.tsx       # Green/yellow/red indicator
      ConfidenceBadge.tsx    # Clickable confidence popover
    api/client.ts        # Axios API client
    types/index.ts       # TypeScript interfaces
```

## UX Flows

### Stage 1 UI: Candidate Pool
- IP list with BD Score, Confidence badge, Fit gate status
- Decision badges: START (green) / MONITOR (amber) / REJECT (red)
- Urgency/catalyst/risk explanations per IP
- Shortlist management: allocate 3-5 BD slots
- Drill into IP detail for indicator breakdown

### Stage 2 UI: Launch Planner
- For each secured IP: timeline band from earliest to latest launch
- Event calendar overlay
- Recommended launch month(s) highlighted
- Operational milestones: art review, sample review, production, launch
- Demand/saturation projection curves

---

## Implementation Roadmap

### Phase 0 (MVP plumbing)
- IPPipeline model + migration
- Pipeline CRUD endpoints
- Make wiki_mal source run end-to-end

### Phase 1 (Stage 1 MVP)
- bd_allocation_service.py: fit gate + timing urgency + demand trajectory + market gap + feasibility
- BDScoreCard.tsx + IpList candidate pool view
- Portfolio ranking with slot allocation

### Phase 2 (Stage 2 MVP)
- launch_timing_service.py: launch_value(t) grid search with event overlay
- LaunchPlanner.tsx + LaunchPlannerPage.tsx
- Recommended launch window + timeline plan

### Phase 3 (upgrade)
- Replace heuristic scoring with explicit EV vs Wait model
- Add slot opportunity cost & MG lock cost
- Better forecasting for demand/saturation curves
- Live connectors (YouTube API, news RSS, Shopee)

---

## Conventions
- Backend uses async SQLAlchemy throughout
- Pydantic v2 schemas — avoid `from __future__ import annotations` (causes union issues)
- Frontend uses Tailwind with custom `brew-*` color palette
- `.env` holds secrets (gitignored), `.env.example` is the template

## Workflow
- When the user says "pass", "lgtm", "ship it", or similar approval phrases — commit and push to origin without asking for review
