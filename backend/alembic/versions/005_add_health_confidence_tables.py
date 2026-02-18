"""add source_registry, source_run, ip_source_health, ip_confidence tables

Revision ID: 005
Revises: 004
Create Date: 2026-02-18 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Source Registry
    op.create_table(
        "source_registry",
        sa.Column("source_key", sa.String(30), primary_key=True),
        sa.Column("availability_level", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("risk_type", sa.String(30), nullable=False, server_default="unknown"),
        sa.Column("primary_endpoint", sa.String(255), nullable=True),
        sa.Column("fallback_endpoint", sa.String(255), nullable=True),
        sa.Column("is_key_source", sa.Boolean, server_default="false"),
        sa.Column("priority_weight", sa.Float, server_default="1.0"),
        sa.Column("notes", sa.Text, nullable=True),
    )

    # Seed initial source registry
    op.execute("""
        INSERT INTO source_registry (source_key, availability_level, risk_type, is_key_source, priority_weight, notes) VALUES
        ('google_trends', 'high',   'quota',         true,  1.0, 'Primary search demand signal. pytrends fallback available.'),
        ('youtube',       'high',   'quota',         true,  0.9, 'Video momentum signal. API quota limited.'),
        ('shopee',        'medium', 'anti_scraping',  false, 0.7, 'E-commerce density. Scraping unstable.'),
        ('news_rss',      'high',   'low',            true,  0.8, 'Collab/news signal via RSS feeds.'),
        ('wiki_mal',      'medium', 'scattered',      false, 0.6, 'Event calendar and metadata. Scattered structure.'),
        ('amazon_jp',     'medium', 'anti_scraping',  false, 0.6, 'Merch pressure signal. Anti-scraping risk.')
    """)

    # Source Run
    op.create_table(
        "source_run",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source_key", sa.String(30), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="ok"),
        sa.Column("duration_ms", sa.Integer, nullable=True),
        sa.Column("items_processed", sa.Integer, server_default="0"),
        sa.Column("items_succeeded", sa.Integer, server_default="0"),
        sa.Column("items_failed", sa.Integer, server_default="0"),
        sa.Column("error_sample", sa.Text, nullable=True),
    )
    op.create_index("ix_source_run_key_started", "source_run", ["source_key", "started_at"])

    # IP Source Health
    op.create_table(
        "ip_source_health",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_key", sa.String(30), nullable=False),
        sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="down"),
        sa.Column("staleness_hours", sa.Integer, nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("updated_items", sa.Integer, nullable=True),
        sa.UniqueConstraint("ip_id", "source_key", name="uq_ip_source_health"),
    )
    op.create_index("ix_ip_source_health_ip", "ip_source_health", ["ip_id"])

    # IP Confidence
    op.create_table(
        "ip_confidence",
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("confidence_score", sa.Integer, server_default="0"),
        sa.Column("confidence_band", sa.String(15), server_default="insufficient"),
        sa.Column("active_indicators", sa.Integer, server_default="0"),
        sa.Column("total_indicators", sa.Integer, server_default="0"),
        sa.Column("active_sources", sa.Integer, server_default="0"),
        sa.Column("expected_sources", sa.Integer, server_default="0"),
        sa.Column("missing_sources_json", sa.Text, nullable=True),
        sa.Column("missing_indicators_json", sa.Text, nullable=True),
        sa.Column("last_calculated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("ip_confidence")
    op.drop_table("ip_source_health")
    op.drop_index("ix_source_run_key_started")
    op.drop_table("source_run")
    op.drop_table("source_registry")
