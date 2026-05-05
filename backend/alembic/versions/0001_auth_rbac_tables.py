"""baseline schema

Bu migration "baseline marker"dır — şema oluşturmaz. Tüm tablolar Docker MySQL'in
ilk açılışında `backend/db/init/01-baseline.sql` üzerinden otomatik kurulur
(`docker-entrypoint-initdb.d` mekanizmasıyla).

Schema kaynağı: `docs/overview/04-data-model.md` §4.2 (11 ana + 3 aggregation +
12 sistem = 26 tablo). Seed verisi (40 permission, 1 Süper Admin role, 12 channel
mapping) `01-baseline.sql` dump'ı içinde gelir.

Sonraki migration'lar (0002, 0003, ...) bu baseline üzerinde gerçek schema
değişiklikleri uygular ve standart Alembic akışını kullanır.

Revision ID: 0001
Revises:
Create Date: 2026-05-03
"""

from collections.abc import Sequence

revision: str = "0001_auth_rbac_tables"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Tablolar `docker-entrypoint-initdb.d/01-baseline.sql` ile zaten oluşturulmuştur.
    # Bu migration sadece alembic_version'da baseline'ı işaretler.
    pass


def downgrade() -> None:
    # Baseline geri alınamaz — yeni bir DB kurulumu gerekir.
    raise NotImplementedError(
        "Cannot downgrade past baseline. Drop the database and re-init from scratch."
    )
