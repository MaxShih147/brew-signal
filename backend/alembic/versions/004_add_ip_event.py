"""add ip_event table

Revision ID: 004
Revises: 003
Create Date: 2026-02-18 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ip_event",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("source", sa.String(30), nullable=True),
        sa.Column("source_url", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_ip_event_ip_date", "ip_event", ["ip_id", "event_date"])


def downgrade() -> None:
    op.drop_index("ix_ip_event_ip_date")
    op.drop_table("ip_event")
