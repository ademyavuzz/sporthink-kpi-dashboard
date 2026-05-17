"""roles + channel_mapping: soft-delete uyumlu partial-unique pattern.

MySQL'in `WHERE` filtreli partial index'i yok. Aynı etkiyi **generated column**
ile elde ediyoruz: kolon yalnızca aktif satırlar (`deleted_at IS NULL`) için
gerçek değeri tutar, soft-deleted satırlarda `NULL` döner. UNIQUE index NULL
değerleri eşsiz saymadığı için yalnızca aktif satırlar arasında
benzersizlik garantisi olur — soft-deleted satırlar serbest.

Etki:
- `roles.name`: sildiğin bir rolün ismini tekrar kullanabilirsin.
- `channel_mapping.(source, medium)`: sildiğin bir eşlemeyi yeniden kurabilirsin.

Hata yüzeyi öncesi: aynı isimle/aynı (source, medium) ile insert
`IntegrityError 1062 Duplicate entry` ile 500'e düşüyordu. Artık aktif
duplicate yoksa insert serbest; servis layer'daki explicit duplicate check
(`role_service.create_role`, `channel_mapping_service.create_mapping`)
aktif duplicate için ConflictError döner.

Revision ID: 0006_soft_delete_partial_unique
Revises: 0005_reports_table
Create Date: 2026-05-17
"""

from __future__ import annotations

from alembic import op

revision = "0006_soft_delete_partial_unique"
down_revision = "0005_reports_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── roles ──────────────────────────────────────────────────────────
    op.execute(
        "ALTER TABLE roles "
        "ADD COLUMN name_active VARCHAR(100) "
        "GENERATED ALWAYS AS (IF(deleted_at IS NULL, name, NULL)) VIRTUAL"
    )
    op.execute("ALTER TABLE roles DROP INDEX uk_name")
    op.execute("ALTER TABLE roles ADD UNIQUE KEY uk_name_active (name_active)")

    # ── channel_mapping ────────────────────────────────────────────────
    # source(255) + '|' + medium(100) → max 356; 400 yedek var.
    op.execute(
        "ALTER TABLE channel_mapping "
        "ADD COLUMN source_medium_active VARCHAR(400) "
        "GENERATED ALWAYS AS ("
        "IF(deleted_at IS NULL, CONCAT(source, '|', medium), NULL)"
        ") VIRTUAL"
    )
    op.execute("ALTER TABLE channel_mapping DROP INDEX uk_source_medium")
    op.execute(
        "ALTER TABLE channel_mapping "
        "ADD UNIQUE KEY uk_source_medium_active (source_medium_active)"
    )


def downgrade() -> None:
    # channel_mapping
    op.execute("ALTER TABLE channel_mapping DROP INDEX uk_source_medium_active")
    op.execute("ALTER TABLE channel_mapping DROP COLUMN source_medium_active")
    op.execute(
        "ALTER TABLE channel_mapping ADD UNIQUE KEY uk_source_medium (source, medium)"
    )

    # roles
    op.execute("ALTER TABLE roles DROP INDEX uk_name_active")
    op.execute("ALTER TABLE roles DROP COLUMN name_active")
    op.execute("ALTER TABLE roles ADD UNIQUE KEY uk_name (name)")
