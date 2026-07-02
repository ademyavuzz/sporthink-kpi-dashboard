"""Kullanıcı bazlı bildirim merkezi — backend-driven persisted notifications.

Önceki sürümde bildirimler sadece localStorage'da (cihaz bazlı) yaşıyordu:
- Aynı tarayıcıda kullanıcı değişimi → eski bildirimler yeni kullanıcıya sızar
- Multi-device (masaüstü + mobil) senkron yok
- Backend event'leri (import.completed, report.generated) kullanıcıya
  ulaşmazdı — sadece pasif audit_log satırıydı

Bu tablo notifications akışını kullanıcı bazlı + cihazdan bağımsız yapar.
Tetikleyiciler service tarafında: notification_service.create_for_user(...).

Revision ID: 0007_notifications_table
Revises: 0006_soft_delete_partial_unique
Create Date: 2026-05-17
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import BIGINT

from alembic import op

revision = "0007_notifications_table"
down_revision = "0006_soft_delete_partial_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", BIGINT(unsigned=True), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            BIGINT(unsigned=True),
            sa.ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(20), nullable=False, server_default="info"),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.String(500), nullable=True),
        sa.Column("link", sa.String(500), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.current_timestamp(),
            server_onupdate=sa.func.current_timestamp(),
            nullable=False,
        ),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index(
        "idx_notif_user_unread",
        "notifications",
        ["user_id", "is_read", "created_at"],
    )
    op.create_index("idx_notif_user_created", "notifications", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_notif_user_created", table_name="notifications")
    op.drop_index("idx_notif_user_unread", table_name="notifications")
    op.drop_table("notifications")
