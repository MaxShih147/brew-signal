"""add opportunity_input table

Revision ID: 003
Revises: 002
Create Date: 2026-02-17 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "opportunity_input",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("indicator_key", sa.String(30), nullable=False),
        sa.Column("value", sa.Float, server_default="0.5"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("ip_id", "indicator_key", name="uq_opportunity_input"),
    )


def downgrade() -> None:
    op.drop_table("opportunity_input")
