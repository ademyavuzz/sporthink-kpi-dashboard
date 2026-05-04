"""password_reset_tokens.purpose kolonu ekle (davet/sıfırlama ayrımı).

Davet (`invite`) ve şifre sıfırlama (`reset`) akışları aynı tabloyu paylaşır
ama TTL ve mail şablonları farklıdır. `purpose` kolonu bu ayrımı yapar.

Mevcut kayıtlar için default `reset` atanır (geriye dönük güvenli — eski
kullanıcı şifre sıfırlama isteklerinin amacı budur).

Revision ID: 0003_password_reset_purpose
Revises: 0002_post_baseline
Create Date: 2026-05-04
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_password_reset_purpose"
down_revision = "0002_post_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "password_reset_tokens",
        sa.Column(
            "purpose",
            sa.String(length=20),
            nullable=False,
            server_default="reset",
        ),
    )
    op.create_index(
        "idx_user_purpose",
        "password_reset_tokens",
        ["user_id", "purpose"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_user_purpose", table_name="password_reset_tokens")
    op.drop_column("password_reset_tokens", "purpose")
