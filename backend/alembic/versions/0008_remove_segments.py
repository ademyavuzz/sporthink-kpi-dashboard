"""Segmentler & RFM özelliğinin tamamen kaldırılması.

`/segments` sayfası, segment CRUD/RFM endpoint'leri, segment servis/model
katmanı ve e-ticaret dashboard'undaki segment filtresi koddan kaldırıldı.
Bu migration bunların DB izlerini temizler:

- `segments.*` izinleri `role_permissions` ve `permissions` tablolarından silinir.
- `segments` tablosu DROP edilir.

DİKKAT — data-destructive: `segments` tablosundaki kayıtlı segment verileri
kalıcı olarak silinir. Downgrade tablo yapısını ve izinleri geri kurar ancak
silinen segment satırlarını GERİ GETİREMEZ.

Revision ID: 0008_remove_segments
Revises: 0007_notifications_table
Create Date: 2026-05-20
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.mysql import BIGINT

from alembic import op

revision = "0008_remove_segments"
down_revision = "0007_notifications_table"
branch_labels = None
depends_on = None


_SEGMENT_PERMISSIONS = [
    # (code, module, action, description, category)
    ("segments.view", "segments", "view", "Segmentleri görme", "data"),
    ("segments.create", "segments", "create", "Yeni segment oluşturma", "data"),
    ("segments.update", "segments", "update", "Segment düzenleme", "data"),
    ("segments.delete", "segments", "delete", "Segment silme", "data"),
]


def upgrade() -> None:
    # Segment izinlerini önce rol atamalarından, sonra permissions'tan kaldır.
    op.execute(
        "DELETE rp FROM role_permissions rp "
        "JOIN permissions p ON rp.permission_id = p.id "
        "WHERE p.code LIKE 'segments.%'"
    )
    op.execute("DELETE FROM permissions WHERE code LIKE 'segments.%'")
    op.drop_table("segments")


def downgrade() -> None:
    op.create_table(
        "segments",
        sa.Column("id", BIGINT(unsigned=True), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            BIGINT(unsigned=True),
            sa.ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("rules", sa.JSON(), nullable=False),
        sa.Column("cached_count", sa.Integer(), nullable=True),
        sa.Column("cached_at", sa.DateTime(), nullable=True),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.current_timestamp(),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            BIGINT(unsigned=True),
            sa.ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.current_timestamp(),
            server_onupdate=sa.func.current_timestamp(),
            nullable=False,
        ),
        sa.Column(
            "updated_by",
            BIGINT(unsigned=True),
            sa.ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
            nullable=True,
        ),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_user", "segments", ["user_id"])
    op.create_index("idx_deleted", "segments", ["deleted_at"])

    # Segment izinlerini geri ekle (rol atamaları geri kurulamaz).
    perms = sa.table(
        "permissions",
        sa.column("code", sa.String),
        sa.column("module", sa.String),
        sa.column("action", sa.String),
        sa.column("description", sa.String),
        sa.column("category", sa.String),
    )
    op.bulk_insert(
        perms,
        [
            {
                "code": code,
                "module": module,
                "action": action,
                "description": description,
                "category": category,
            }
            for code, module, action, description, category in _SEGMENT_PERMISSIONS
        ],
    )
