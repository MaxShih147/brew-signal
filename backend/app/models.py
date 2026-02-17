import uuid
from datetime import datetime, date

from sqlalchemy import (
    String, Float, Boolean, Date, DateTime, Integer, Text, ForeignKey, Enum as SAEnum,
    UniqueConstraint,
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
