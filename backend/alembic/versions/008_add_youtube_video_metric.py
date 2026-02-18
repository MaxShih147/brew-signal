"""add youtube_video_metric table

Revision ID: 008
Revises: 007
Create Date: 2026-02-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "youtube_video_metric",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ip_id", UUID(as_uuid=True), sa.ForeignKey("ip.id", ondelete="CASCADE"), nullable=False),
        sa.Column("video_id", sa.String(11), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("channel_title", sa.String(255), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("view_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("like_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("comment_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("ip_id", "video_id", name="uq_youtube_video_metric"),
        sa.Index("ix_youtube_video_metric_ip", "ip_id"),
    )


def downgrade() -> None:
    op.drop_table("youtube_video_metric")
