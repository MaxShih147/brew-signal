"""add merch_product_count table

Revision ID: 009
Revises: 008
Create Date: 2026-02-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "merch_product_count",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("query_term", sa.String(255), nullable=False),
        sa.Column("product_count", sa.Integer, nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("ip_id", "platform", name="uq_merch_product_count"),
        sa.Index("ix_merch_product_count_ip", "ip_id"),
    )


def downgrade() -> None:
    op.drop_table("merch_product_count")
