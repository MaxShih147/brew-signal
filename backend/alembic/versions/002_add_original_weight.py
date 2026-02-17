"""add original_weight to ip_alias

Revision ID: 002
Revises: 001
Create Date: 2026-02-17 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ip_alias", sa.Column("original_weight", sa.Float, nullable=True))


def downgrade() -> None:
    op.drop_column("ip_alias", "original_weight")
