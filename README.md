# Brew Signal — IP Timing Dashboard

**By [5min Coffee](https://www.5mincoffee.com)**

## What is this?

Brew Signal is a feasibility dashboard that tracks Google Trends data for character/anime IPs to help 5min Coffee time their BD (business development) and licensing negotiations.

### Business Context

5min Coffee is a consumer coffee brand selling drip coffee bags through FamilyMart (全家). We collaborate with anime/character IPs for limited-edition products, but those IPs are usually already "guaranteed to be popular."

**The real question is not "will it go viral", but:**
- **When** should we start BD/licensing negotiation, given licensing review takes ~12 weeks (one season)?
- We want to avoid the most crowded merch peak where our coffee collaboration gets diluted by competitors.

### What This Dashboard Does

1. Collects Google Trends time-series for a specified IP + aliases (zh/jp/en)
2. Shows data-source health (can we fetch reliably?) and trend signals
3. Outputs a rule-based **"BD Start Now?"** traffic light assuming 12-week lead time
4. **No prediction model** — purely rule-based signal detection

### Traffic Light Logic

| Signal | Condition |
|--------|-----------|
| **GREEN** | WoW growth > +30% AND acceleration (2 consecutive rising weeks) AND breakout >= P85 of 6-month range |
| **YELLOW** | 1–2 conditions met, or high volatility |
| **RED** | MA7 below MA28 and WoW negative (trend declining) |

## Quick Start

### Prerequisites
- Docker + Docker Compose

### Run

```bash
# Clone and enter directory
cd brew-signal

# Copy env (edit if needed)
cp .env.example .env

# Start everything
docker compose up --build
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### First Run

1. The seed script auto-creates a demo IP (Chiikawa) with 3 aliases (EN/JP/ZH)
2. Go to the IP detail page and click **"Run Collection"** to fetch Google Trends data via pytrends
3. The dashboard will compute signals and display the traffic light

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   React UI  │────▶│  FastAPI      │────▶│ Postgres │
│   (Vite)    │     │  Backend      │     │          │
└─────────────┘     └──────┬───────┘     └──────────┘
                           │
                    ┌──────┴───────┐
                    │  Collectors   │
                    │  - pytrends  │
                    │  - official  │
                    └──────────────┘
```

### Data Source Strategy
- **Primary**: Google Trends official API (alpha) — enabled when `GOOGLE_TRENDS_API_KEY` is set
- **Fallback**: pytrends (unofficial) — used by default for feasibility testing
- Rate limiting + exponential backoff + circuit breaker built in

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ip` | Create IP |
| GET | `/api/ip` | List all IPs |
| GET | `/api/ip/{id}` | Get IP detail |
| PUT | `/api/ip/{id}` | Update IP |
| POST | `/api/ip/{id}/aliases` | Add alias |
| PUT | `/api/ip/alias/{id}` | Update alias |
| GET | `/api/ip/{id}/health` | Data source health |
| GET | `/api/ip/{id}/trend` | Trend data (composite or by-alias) |
| GET | `/api/ip/{id}/signals` | Current signals + alerts |
| POST | `/api/collect/run` | Manual collection run |

## Configuration

All thresholds are configurable via `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `COLLECTOR_SOURCE` | pytrends | `official` or `pytrends` |
| `SIGNAL_WOW_GROWTH_THRESHOLD` | 0.30 | WoW growth threshold for green signal |
| `SIGNAL_BREAKOUT_PERCENTILE` | 85 | Percentile threshold for breakout |
| `PYTRENDS_REQUEST_INTERVAL_SEC` | 5 | Min seconds between pytrends requests |
| `PYTRENDS_CIRCUIT_BREAKER_THRESHOLD` | 5 | Consecutive failures before circuit opens |

## TODO

- [ ] Validate alias weights against actual Google Trends data after discovery (currently weights are Claude's best guess, not backed by real search volume)

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy (async), Alembic, pytrends
- **Frontend**: React, TypeScript, Vite, Recharts, Tailwind CSS
- **Database**: PostgreSQL 16
- **Infra**: Docker Compose
