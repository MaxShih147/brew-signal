# Brew Signal — IP Licensing Decision System

**By [5min Coffee](https://www.5mincoffee.com)**

## What is this?

Brew Signal is a **two-stage decision system** for IP licensing that helps 5min Coffee decide:
1. **Which IPs** to negotiate (BD Slot Allocation — Stage 1)
2. **When to launch** within a license window (Launch Timing — Stage 2)

### Business Context

5min Coffee is a consumer coffee brand selling drip coffee bags through FamilyMart (全家). We collaborate with anime/character IPs for limited-edition products. Licensing involves:
- Upfront minimum guarantee (MG) of USD 20k-40k
- Only 3-5 parallel BD slots (scarce capacity)
- 6-12 months licensing friction (approval delays + strict asset review)
- 12+3 month license period

**The real questions are:**
- **Stage 1**: "Should we start BD now? Is this IP worth a BD slot + MG?"
- **Stage 2**: "We secured the license. When should we launch within the window?"

### System Capabilities

- Collects data from Google Trends, YouTube API, MAL (anime events), TW e-commerce (Shopee/Ruten)
- Computes 13 indicators across 5 dimensions (Demand, Diffusion, Supply, Gatekeeper, Fit)
- **Stage 1 — BD Score**: Fit gate → weighted scoring (timing urgency, demand trajectory, market gap, feasibility) → START/MONITOR/REJECT decision
- **Stage 2 — Launch Planner**: Weekly time grid with demand extrapolation, event boost (Gaussian), saturation, operational risk → recommended launch week + milestones
- Data health observability: source status, coverage matrix, confidence scoring
- AI-powered alias discovery (Claude API)

## Quick Start

### Prerequisites
- Docker + Docker Compose

### Run

```bash
cd brew-signal
cp .env.example .env  # then add your ANTHROPIC_API_KEY, YOUTUBE_API_KEY
docker compose up --build
```

- **Frontend**: http://localhost:5176
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

### First Run

1. The seed script auto-creates a demo IP with aliases
2. Click into the IP detail page
3. **Sync data**: click "Sync MAL" (events), "Sync YouTube" (video momentum), "Sync Merch" (market saturation), "Run Collection" (Google Trends)
4. The BD Score card computes Stage 1 decision; the Launch Planner card computes Stage 2 recommendation

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   React UI  │────▶│  FastAPI      │────▶│ Postgres │
│   (Vite)    │     │  Backend      │     │          │
└─────────────┘     └──────┬───────┘     └──────────┘
                           │
                    ┌──────┴───────┐
                    │  Connectors   │
                    │  - pytrends   │
                    │  - YouTube v3 │
                    │  - MAL        │
                    │  - Shopee     │
                    │  - Ruten      │
                    └──────────────┘
```

### Data Sources
| Source | Data | Status |
|--------|------|--------|
| Google Trends (pytrends) | Search momentum | LIVE |
| YouTube Data API v3 | Video momentum | LIVE |
| MyAnimeList (MAL) | Events, sequel chains | LIVE |
| Shopee / Ruten | Merch product counts | LIVE |
| News RSS | Collab/event signals | Planned |
| Reddit/PTT/Dcard | Social buzz | Planned |

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ip` | List all IPs with BD scores |
| GET | `/api/ip/{id}` | IP detail |
| GET | `/api/ip/{id}/bd-score` | Stage 1: BD allocation score |
| GET | `/api/ip/{id}/launch-plan` | Stage 2: Launch timing plan |
| GET | `/api/ip/bd-ranking` | Portfolio ranking (all IPs) |
| PUT | `/api/ip/{id}/pipeline` | Update pipeline stage/dates |
| POST | `/api/collect/run` | Collect Google Trends |
| POST | `/api/collect/mal-sync/{id}` | Sync MAL events |
| POST | `/api/collect/youtube-sync/{id}` | Sync YouTube data |
| POST | `/api/collect/merch-sync/{id}` | Sync TW e-commerce |

## Stage 1 — BD Slot Allocation

Answers: "Should we start negotiation now?"

```
Fit gate: min(adult_fit, giftability, brand_aesthetic) >= 30 → PASS/FAIL

bd_score = 0.35 * timing_urgency
         + 0.30 * demand_trajectory
         + 0.20 * market_gap
         + 0.15 * feasibility
bd_score *= (confidence / 100)

Decision: START >= 70 | MONITOR 40-69 | REJECT < 40 or fit_gate fail
```

## Stage 2 — Launch Timing

Answers: "When should we launch within the license window?"

```
For each week t in [license_start .. license_end]:
  launch_value(t) = 0.35 * predicted_demand(t)      # ma28 slope extrapolation
                  + 0.30 * event_boost(t)             # Gaussian peak 3w before events
                  - 0.20 * predicted_saturation(t)    # merch product count
                  - 0.15 * operational_risk(t)         # sigmoid buffer curve

Recommend: argmax launch_value(t), plus 2 backup weeks
```

Generates 5 milestones backwards from launch: Design Start (-20w) → Artwork (-16w) → Sample Review (-12w) → Production (-8w) → Launch

## Configuration

All weights and thresholds configurable via `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Claude API for alias discovery |
| `YOUTUBE_API_KEY` | — | YouTube Data API v3 |
| `BD_WEIGHT_TIMING` | 0.35 | Stage 1: timing urgency weight |
| `BD_WEIGHT_DEMAND` | 0.30 | Stage 1: demand trajectory weight |
| `LAUNCH_WEIGHT_DEMAND` | 0.35 | Stage 2: demand weight |
| `LAUNCH_WEIGHT_EVENT` | 0.30 | Stage 2: event boost weight |
| `LAUNCH_WEIGHT_SATURATION` | 0.20 | Stage 2: saturation weight |
| `LAUNCH_WEIGHT_OPS_RISK` | 0.15 | Stage 2: operational risk weight |
| `LAUNCH_LEAD_PRODUCTION` | 8 | Weeks before launch for production |
| `LAUNCH_EVENT_SIGMA_WEEKS` | 3.0 | Event boost Gaussian width |

## Implementation Status

- [x] Phase 0: IPPipeline model, pipeline CRUD, wiki_mal connector
- [x] Phase 1: BD Slot Allocation engine + BDScoreCard UI
- [x] Phase 2: Launch Timing engine + LaunchPlanner UI
- [ ] Phase 3: EV vs Wait model, slot opportunity cost, better forecasting, more live connectors

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy (async), Alembic, pytrends
- **Frontend**: React 18, TypeScript, Vite, Recharts, Tailwind CSS
- **Database**: PostgreSQL 16
- **Infra**: Docker Compose
- **AI**: Anthropic Claude API (alias discovery)
