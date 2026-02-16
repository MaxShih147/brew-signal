"""initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ip",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "ip_alias",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alias", sa.String(255), nullable=False),
        sa.Column("locale", sa.String(10), nullable=False, server_default="en"),
        sa.Column("weight", sa.Float, server_default="1.0"),
        sa.Column("enabled", sa.Boolean, server_default="true"),
    )

    op.create_table(
        "trend_points",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alias_id", UUID(as_uuid=True), sa.ForeignKey("ip_alias.id", ondelete="SET NULL"), nullable=True),
        sa.Column("geo", sa.String(10), nullable=False, server_default="TW"),
        sa.Column("timeframe", sa.String(10), nullable=False, server_default="12m"),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("value", sa.Integer, nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="pytrends"),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("ip_id", "alias_id", "geo", "timeframe", "date", name="uq_trend_point"),
    )

    op.create_table(
        "daily_trend",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("geo", sa.String(10), nullable=False),
        sa.Column("timeframe", sa.String(10), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("composite_value", sa.Float, nullable=False),
        sa.Column("ma7", sa.Float, nullable=True),
        sa.Column("ma28", sa.Float, nullable=True),
        sa.Column("wow_growth", sa.Float, nullable=True),
        sa.Column("acceleration", sa.Boolean, nullable=True),
        sa.Column("breakout_percentile", sa.Float, nullable=True),
        sa.Column("signal_light", sa.String(10), nullable=True),
        sa.UniqueConstraint("ip_id", "geo", "timeframe", "date", name="uq_daily_trend"),
    )

    op.create_table(
        "collector_run_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("geo", sa.String(10), nullable=False),
        sa.Column("timeframe", sa.String(10), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("http_code", sa.Integer, nullable=True),
        sa.Column("error_code", sa.String(30), nullable=True),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("duration_ms", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("collector_run_log")
    op.drop_table("daily_trend")
    op.drop_table("trend_points")
    op.drop_table("ip_alias")
    op.drop_table("ip")
