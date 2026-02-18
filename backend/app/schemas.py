import uuid
from datetime import datetime, date
from typing import Optional, Union

from pydantic import BaseModel


# --- Alias (defined first for forward reference) ---
class AliasCreate(BaseModel):
    alias: str
    locale: str = "en"
    weight: float = 1.0
    enabled: bool = True


class AliasUpdate(BaseModel):
    alias: Optional[str] = None
    locale: Optional[str] = None
    weight: Optional[float] = None
    enabled: Optional[bool] = None


class AliasOut(BaseModel):
    id: uuid.UUID
    alias: str
    locale: str
    weight: float
    original_weight: Optional[float] = None
    enabled: bool
    model_config = {"from_attributes": True}


# --- IP ---
class IPCreate(BaseModel):
    name: str
    aliases: list[AliasCreate] = []


class IPOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    aliases: list[AliasOut] = []
    model_config = {"from_attributes": True}


class IPUpdate(BaseModel):
    name: Optional[str] = None


class IPListItem(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    last_updated: Optional[datetime] = None
    signal_light: Optional[str] = None
    aliases: list[AliasOut] = []
    bd_score: Optional[float] = None
    bd_decision: Optional[str] = None
    pipeline_stage: Optional[str] = None
    confidence_score: Optional[int] = None
    model_config = {"from_attributes": True}


# --- Trend ---
class TrendPointOut(BaseModel):
    date: date
    value: int
    alias: Optional[str] = None
    source: str
    model_config = {"from_attributes": True}


class DailyTrendOut(BaseModel):
    date: date
    composite_value: float
    ma7: Optional[float] = None
    ma28: Optional[float] = None
    wow_growth: Optional[float] = None
    acceleration: Optional[bool] = None
    breakout_percentile: Optional[float] = None
    signal_light: Optional[str] = None
    model_config = {"from_attributes": True}


class TrendResponse(BaseModel):
    ip_id: uuid.UUID
    geo: str
    timeframe: str
    mode: str
    points: Union[list[TrendPointOut], list[DailyTrendOut]]


# --- Health ---
class HealthResponse(BaseModel):
    ip_id: uuid.UUID
    geo: str
    timeframe: str
    source: str
    last_success_time: Optional[datetime] = None
    last_run_status: Optional[str] = None
    success_rate_14d: Optional[float] = None
    total_runs_14d: int = 0
    error_breakdown: dict[str, int] = {}
    anomaly_flags: list[str] = []


# --- Alerts ---
class AlertOut(BaseModel):
    type: str
    message: str
    alert_date: Optional[str] = None


# --- Signals ---
class SignalsResponse(BaseModel):
    ip_id: uuid.UUID
    geo: str
    timeframe: str
    wow_growth: Optional[float] = None
    acceleration: Optional[bool] = None
    breakout_percentile: Optional[float] = None
    signal_light: Optional[str] = None
    alerts: list[AlertOut] = []


# --- Collector ---
class CollectRunRequest(BaseModel):
    ip_id: uuid.UUID
    geo: str = "TW"
    timeframe: str = "12m"


class CollectRunResponse(BaseModel):
    status: str
    message: str
    duration_ms: Optional[int] = None


class MALSyncResult(BaseModel):
    ip_id: uuid.UUID
    ip_name: str
    mal_id: Optional[int] = None
    matched: bool
    events_added: int
    events_skipped: int
    errors: list[str] = []


# --- Alias Discovery ---
class DiscoverAliasesRequest(BaseModel):
    ip_name: Optional[str] = None  # override name to search; defaults to IP.name


class DiscoveredAlias(BaseModel):
    alias: str
    locale: str
    weight: float
    note: str = ""


class DiscoverAliasesResponse(BaseModel):
    ip_id: uuid.UUID
    discovered: list[DiscoveredAlias]
    applied: int = 0  # how many were auto-added


# --- IP Events ---
EVENT_TYPES = {"anime_air", "movie_release", "game_release", "anniversary", "other"}


class IPEventCreate(BaseModel):
    event_type: str
    title: str
    event_date: date
    source: Optional[str] = "manual"
    source_url: Optional[str] = None


class IPEventOut(BaseModel):
    id: uuid.UUID
    ip_id: uuid.UUID
    event_type: str
    title: str
    event_date: date
    source: Optional[str] = None
    source_url: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Opportunity Scoring ---
class IndicatorResult(BaseModel):
    key: str
    label: str
    dimension: str
    status: str  # LIVE | MANUAL | MISSING
    score_0_100: float
    raw: Optional[dict] = None
    debug: list[str] = []


class OpportunityResponse(BaseModel):
    ip_id: uuid.UUID
    geo: str
    timeframe: str
    opportunity_score: float
    opportunity_light: str  # green | yellow | red
    base_score: float
    risk_multiplier: float
    timing_multiplier: float
    demand_score: float
    diffusion_score: float
    fit_score: float
    supply_risk: float
    gatekeeper_risk: float
    timing_score: float
    coverage_ratio: float
    explanations: list[str]
    indicators: list[IndicatorResult]
    confidence: Optional["ConfidenceOut"] = None


class OpportunityInputUpdate(BaseModel):
    inputs: dict[str, float]


class OpportunityInputOut(BaseModel):
    indicator_key: str
    value: float
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# --- Data Health & Confidence ---
class SourceRegistryOut(BaseModel):
    source_key: str
    availability_level: str
    risk_type: str
    primary_endpoint: Optional[str] = None
    fallback_endpoint: Optional[str] = None
    is_key_source: bool
    priority_weight: float
    notes: Optional[str] = None
    model_config = {"from_attributes": True}


class SourceHealthOut(BaseModel):
    source_key: str
    status: str  # ok|warn|down
    availability_level: str
    risk_type: str
    is_key_source: bool
    last_success_at: Optional[datetime] = None
    success_rate_24h: Optional[float] = None
    success_rate_7d: Optional[float] = None
    coverage: int = 0  # IPs with data in freshness window
    total_ips: int = 0
    last_error: Optional[str] = None


class SourceRunOut(BaseModel):
    id: uuid.UUID
    source_key: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: str
    duration_ms: Optional[int] = None
    items_processed: int
    items_succeeded: int
    items_failed: int
    error_sample: Optional[str] = None
    model_config = {"from_attributes": True}


class IPSourceHealthCell(BaseModel):
    source_key: str
    status: str  # ok|warn|down
    last_success_at: Optional[datetime] = None
    staleness_hours: Optional[int] = None
    last_error: Optional[str] = None


class CoverageMatrixRow(BaseModel):
    ip_id: uuid.UUID
    ip_name: str
    sources: list[IPSourceHealthCell]


class ConfidenceOut(BaseModel):
    confidence_score: int
    confidence_band: str  # high|medium|low|insufficient
    active_indicators: int
    total_indicators: int
    active_sources: int
    expected_sources: int
    missing_sources: list[str] = []
    missing_indicators: list[str] = []
    last_calculated_at: Optional[datetime] = None


# --- IPPipeline ---
class IPPipelineCreate(BaseModel):
    stage: str = "candidate"
    target_launch_date: Optional[date] = None
    mg_amount_usd: Optional[int] = None
    notes: Optional[str] = None


class IPPipelineUpdate(BaseModel):
    stage: Optional[str] = None
    target_launch_date: Optional[date] = None
    bd_start_date: Optional[date] = None
    license_start_date: Optional[date] = None
    license_end_date: Optional[date] = None
    mg_amount_usd: Optional[int] = None
    notes: Optional[str] = None


class IPPipelineOut(BaseModel):
    ip_id: uuid.UUID
    stage: str
    target_launch_date: Optional[date] = None
    bd_start_date: Optional[date] = None
    license_start_date: Optional[date] = None
    license_end_date: Optional[date] = None
    mg_amount_usd: Optional[int] = None
    notes: Optional[str] = None
    bd_score: Optional[float] = None
    bd_decision: Optional[str] = None
    updated_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


# --- BD Allocation ---
class BDScoreResponse(BaseModel):
    ip_id: uuid.UUID
    ip_name: str
    geo: str
    timeframe: str
    bd_score: float
    bd_decision: str  # START|MONITOR|REJECT
    fit_gate_score: float
    fit_gate_passed: bool
    timing_urgency: float
    demand_trajectory: float
    market_gap: float
    feasibility: float
    raw_score: float
    confidence_multiplier: float
    explanations: list[str]
    pipeline_stage: Optional[str] = None
    indicators: list[IndicatorResult]
    confidence: Optional[ConfidenceOut] = None
