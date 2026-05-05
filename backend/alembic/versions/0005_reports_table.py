"""reports tablosu — kullanıcı tarafından üretilen PDF raporları.

Yeni rapor üretim modülü: tarih aralığı + bölüm seçimi → Celery worker
PDF üretimi → uploads/reports/{id}.pdf. Lifecycle status'u ile takip,
soft delete ile silme.

Revision ID: 0005_reports_table
Revises: 0004_user_profile_fields
Create Date: 2026-05-05
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.mysql import BIGINT

revision = "0005_reports_table"
down_revision = "0004_user_profile_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reports",
        sa.Column(
            "id",
            BIGINT(unsigned=True),
            primary_key=True,
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            BIGINT(unsigned=True),
            sa.ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column(
            "language",
            sa.String(length=8),
            nullable=False,
            server_default=sa.text("'tr'"),
        ),
        sa.Column("sections", sa.JSON(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "generating",
                "completed",
                "failed",
                name="report_status",
            ),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("file_path", sa.String(length=1000), nullable=True),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_reports_user_id", "reports", ["user_id"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])
    op.create_index("ix_reports_status", "reports", ["status"])


def downgrade() -> None:
    op.drop_index("ix_reports_status", table_name="reports")
    op.drop_index("ix_reports_created_at", table_name="reports")
    op.drop_index("ix_reports_user_id", table_name="reports")
    op.drop_table("reports")
