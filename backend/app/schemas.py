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
    date: Optional[date] = None


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
