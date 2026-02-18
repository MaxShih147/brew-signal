"""add ip_pipeline table

Revision ID: 006
Revises: 005
Create Date: 2026-02-18 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ip_pipeline",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("stage", sa.String(20), nullable=False, server_default="candidate"),
        sa.Column("target_launch_date", sa.Date, nullable=True),
        sa.Column("bd_start_date", sa.Date, nullable=True),
        sa.Column("license_start_date", sa.Date, nullable=True),
        sa.Column("license_end_date", sa.Date, nullable=True),
        sa.Column("mg_amount_usd", sa.Integer, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("bd_score", sa.Float, nullable=True),
        sa.Column("bd_decision", sa.String(10), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ip_pipeline")
