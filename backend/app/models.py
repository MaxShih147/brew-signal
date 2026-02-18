import uuid
from datetime import datetime, date

from sqlalchemy import (
    String, Float, Boolean, Date, DateTime, Integer, Text, ForeignKey, Enum as SAEnum,
    UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class IP(Base):
    __tablename__ = "ip"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    aliases: Mapped[list["IPAlias"]] = relationship(back_populates="ip", cascade="all, delete-orphan")


class IPAlias(Base):
    __tablename__ = "ip_alias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ip.id", ondelete="CASCADE"), nullable=False)
    alias: Mapped[str] = mapped_column(String(255), nullable=False)
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="en")  # zh/jp/en/other
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    original_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    ip: Mapped["IP"] = relationship(back_populates="aliases")


class TrendPoint(Base):
    __tablename__ = "trend_points"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ip.id", ondelete="CASCADE"), nullable=False)
    alias_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("ip_alias.id", ondelete="SET NULL"), nullable=True)
    geo: Mapped[str] = mapped_column(String(10), nullable=False, default="TW")
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False, default="12m")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="pytrends")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("ip_id", "alias_id", "geo", "timeframe", "date", name="uq_trend_point"),
    )


class DailyTrend(Base):
    __tablename__ = "daily_trend"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ip.id", ondelete="CASCADE"), nullable=False)
    geo: Mapped[str] = mapped_column(String(10), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    composite_value: Mapped[float] = mapped_column(Float, nullable=False)
    ma7: Mapped[float | None] = mapped_column(Float, nullable=True)
    ma28: Mapped[float | None] = mapped_column(Float, nullable=True)
    wow_growth: Mapped[float | None] = mapped_column(Float, nullable=True)
    acceleration: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    breakout_percentile: Mapped[float | None] = mapped_column(Float, nullable=True)
    signal_light: Mapped[str | None] = mapped_column(String(10), nullable=True)  # green|yellow|red

    __table_args__ = (
        UniqueConstraint("ip_id", "geo", "timeframe", "date", name="uq_daily_trend"),
    )


class IPEvent(Base):
    __tablename__ = "ip_event"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ip.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)  # anime_air|movie_release|game_release|anniversary|other
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str | None] = mapped_column(String(30), nullable=True)  # MAL|ANN|Twitter|Wiki|manual
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class OpportunityInput(Base):
    __tablename__ = "opportunity_input"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ip.id", ondelete="CASCADE"), nullable=False)
    indicator_key: Mapped[str] = mapped_column(String(30), nullable=False)
    value: Mapped[float] = mapped_column(Float, default=0.5)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("ip_id", "indicator_key", name="uq_opportunity_input"),
    )


class SourceRegistry(Base):
    __tablename__ = "source_registry"

    source_key: Mapped[str] = mapped_column(String(30), primary_key=True)
    availability_level: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")  # high|medium|low
    risk_type: Mapped[str] = mapped_column(String(30), nullable=False, default="unknown")  # quota|anti_scraping|unstable|blackbox|low
    primary_endpoint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fallback_endpoint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_key_source: Mapped[bool] = mapped_column(Boolean, default=False)
    priority_weight: Mapped[float] = mapped_column(Float, default=1.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class SourceRun(Base):
    __tablename__ = "source_run"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_key: Mapped[str] = mapped_column(String(30), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="ok")  # ok|warn|down
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    items_processed: Mapped[int] = mapped_column(Integer, default=0)
    items_succeeded: Mapped[int] = mapped_column(Integer, default=0)
    items_failed: Mapped[int] = mapped_column(Integer, default=0)
    error_sample: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_source_run_key_started", "source_key", "started_at"),
    )


class IPSourceHealth(Base):
    __tablename__ = "ip_source_health"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ip.id", ondelete="CASCADE"), nullable=False)
    source_key: Mapped[str] = mapped_column(String(30), nullable=False)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="down")  # ok|warn|down
    staleness_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_items: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("ip_id", "source_key", name="uq_ip_source_health"),
        Index("ix_ip_source_health_ip", "ip_id"),
    )


class IPConfidence(Base):
    __tablename__ = "ip_confidence"

    ip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ip.id", ondelete="CASCADE"), primary_key=True)
    confidence_score: Mapped[int] = mapped_column(Integer, default=0)
    confidence_band: Mapped[str] = mapped_column(String(15), default="insufficient")  # high|medium|low|insufficient
    active_indicators: Mapped[int] = mapped_column(Integer, default=0)
    total_indicators: Mapped[int] = mapped_column(Integer, default=0)
    active_sources: Mapped[int] = mapped_column(Integer, default=0)
    expected_sources: Mapped[int] = mapped_column(Integer, default=0)
    missing_sources_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    missing_indicators_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    last_calculated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CollectorRunLog(Base):
    __tablename__ = "collector_run_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    ip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ip.id", ondelete="CASCADE"), nullable=False)
    geo: Mapped[str] = mapped_column(String(10), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False)  # success|fail
    http_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
