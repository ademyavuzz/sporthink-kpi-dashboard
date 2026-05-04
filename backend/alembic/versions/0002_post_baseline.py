"""Baseline'dan Alembic'e geçiş — schema diff'leri burada toplanır.

Mevcut DB şu an `backend/db/init/01-baseline.sql` ile init oluyor; bu migration
production'a deploy ederken tüm schema'nın hazır olduğunu varsayar (full init
script ile gelmiş bir DB üzerine `alembic stamp head` denerek bu migration
"applied" işaretlenir, sonraki autogenerate diff'leri buradan ileri alınır).

`docs/overview/11` §11.4 — Production'da Alembic akışı:
    1. `docker compose up -d mysql` → init SQL ile schema kurulur
    2. `alembic stamp head` → Alembic versiyonu mevcut head'e set
    3. Sonraki migration'lar `alembic upgrade head` ile uygulanır

Revision identifiers
"""
from __future__ import annotations

# revision identifiers, used by Alembic.
revision = "0002_post_baseline"
down_revision = "0001_auth_rbac_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """No-op — baseline SQL'in zaten uygulanmış olduğu varsayılır."""
    pass


def downgrade() -> None:
    """No-op — baseline'a geri dönüş tek seferlik elle yapılır."""
    pass
