# Dynamic Event Intelligence System — Upgrade Plan

**Status**: Backlog (Phase 3)
**Related indicators**: `timing_window`, `search_momentum` (demand), `merch_pressure` (supply)
**Related service**: `mal_sync_service.py`, `opportunity_service.py`, `bd_allocation_service.py`

---

## Core Principle

**"Don't write scrapers per IP — write filters per intelligence source."**

Instead of searching for each IP individually, monitor high-value sources generically and let AI route events to the right IPs automatically.

---

## 1. AI Information Router

### Collection Layer (Generic Scrapers)

| Region | Sources | Type |
|--------|---------|------|
| Japan | PR TIMES (Animation category), Oricon News RSS | News/PR |
| Taiwan | Major licensors (Muse, Mighty Media, Kadokawa TW) — official FB pages or press releases | Announcements |

### Processing Layer (AI Parser)

- Feed unstructured article text to Claude API
- **Task prompt**: identify `event_name`, `date`, `location`, `impact_scale`
- **Auto-association**: AI matches events to existing `ip_id` entries by keyword/alias overlap

---

## 2. Score Impact — How Events Feed Into BD Score

### A. Timing Urgency (`timing_window` indicator)

- **Peak Refinement**: calibrate MAL's vague "season" info into exact dates (e.g. anime premiere 1/16 → set peak at 1/16)
- **Lead-time check**: if event is 3 months away but `lead_time` requires 6 months, auto-downgrade timing score and warn "too late for first-wave collab"

### B. Demand Trajectory (`demand_trajectory` in BD score)

- **Leading Indicator**: before search volume spikes, major event announcements (e.g. USJ collab) apply an **Event Multiplier** to the demand component
- This captures demand *before* it shows up in Google Trends

### C. Market Gap (`merch_pressure` indicator)

- **Saturation Warning**: if AI detects an event includes "large-scale limited merchandise sales", auto-increase `merch_pressure` to warn BD about official product competition

---

## 3. Stage 2 UI — Event Overlay on Launch Planner

- Plot detected events on the demand curve in `LaunchPlanner.tsx`
- Color-coded by type: red = exhibition/expo, blue = anime premiere, green = collab announcement
- Visual feedback: decision-makers see at a glance whether the recommended launch window aligns with real-world events

---

## 4. Future Indicator: Impact Factor

AI auto-scores events by type, used as a weight multiplier:

| Event Type | Impact Factor | Example |
|-----------|---------------|---------|
| Cross-national tie-in | 0.9 | Universal Studios Japan collab |
| Local exhibition | 0.7 | Museum/science center exhibit |
| Single pop-up / concert | 0.3 | One-off flash store |

---

## Schema Note

The `ip_event` table already supports this — fields `event_type`, `source`, `source_url` are designed for multi-source ingestion. No schema changes needed for Phase 3 event ingestion.

## Current State

- `wiki_mal` connector is live (Jikan API with title validation + sequel-chain following)
- `ip_event` table stores events with dedup by (ip_id, title, event_date, source)
- `timing_window` indicator already consumes events for scoring
- News RSS, PR TIMES, and AI parser are **not yet implemented**
