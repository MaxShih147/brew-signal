# Brew Signal — IP Timing Dashboard

## Project Overview
Dashboard for 5min Coffee (https://www.5mincoffee.com) to track Google Trends data for anime/character IPs and time BD/licensing negotiations. 12-week lead time assumption for FamilyMart drip coffee collaborations.

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

## Project Structure
```
backend/
  app/
    main.py              # FastAPI app entry
    config.py            # pydantic-settings from .env
    database.py          # async SQLAlchemy engine
    models.py            # IP, IPAlias, TrendPoint, DailyTrend, CollectorRunLog
    schemas.py           # Pydantic request/response models
    routers/             # ip.py (CRUD+discover), trend.py (data+health+signals), collect.py
    services/            # trend_service, signal_service, health_service, alias_discovery
    collectors/          # pytrends_collector, official_collector (stub), rate_limiter
    seed.py              # Demo data (Chiikawa)
  alembic/               # DB migrations
frontend/
  src/
    pages/               # IpList, IpDetail
    components/          # TrendChart, SignalsPanel, HealthCard, AlertsPanel, IpConfigCard, TrafficLight
    api/client.ts        # Axios API client
    types/index.ts       # TypeScript interfaces
```

## Key Concepts
- **Traffic Light**: GREEN (start BD now) / YELLOW (watch) / RED (declining)
- **Signals**: WoW growth >30%, acceleration (2 rising weeks), breakout >=P85
- **Collectors**: pytrends (default fallback) with rate limiter + circuit breaker
- **Alias Discovery**: Claude API auto-finds aliases across zh/jp/en/ko

## Conventions
- Backend uses async SQLAlchemy throughout
- Pydantic v2 schemas — avoid `from __future__ import annotations` (causes union issues)
- Frontend uses Tailwind with custom `brew-*` color palette
- `.env` holds secrets (gitignored), `.env.example` is the template
