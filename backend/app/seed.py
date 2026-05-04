"""İlk kurulum / yeniden çalıştırılabilir seed.

Çalıştır:
    docker compose -f docker-compose.dev.yml exec backend python -m app.seed

Yapar:
    1. `permissions` tablosunu `Permission` enum'u ile senkronize eder
       (eksik olanları ekler, var olanların module/action/category/description
       alanlarını günceller, enum dışı kalanları log'lar).
    2. `.env`'deki SUPER_ADMIN_EMAIL/PASSWORD ile Süper Admin kullanıcısını
       oluşturur (varsa dokunmaz). Süper Admin rolü init SQL'den geldiği için
       burada oluşturulmaz, sadece varlığı doğrulanır.
    3. `channel_mapping` referans tablosunu yükler (idempotent —
       `(source, medium)` UNIQUE üzerinden eksikleri ekler, mevcutu
       güncellemez). Veri seti küçük (~16 satır) ve sabit; kodda inline.

Idempotenttir — birden fazla kez çalıştırmak güvenlidir.
"""
from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.permissions import (
    PERMISSION_CATEGORIES,
    PERMISSION_DESCRIPTIONS,
    split_code,
)
from app.core.permissions import (
    Permission as PermissionEnum,
)
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal, get_engine
from app.models import ChannelMapping, Permission, Role, User

logger = logging.getLogger("app.seed")
SUPER_ADMIN_ROLE_ID = 1  # init SQL'de seed edilen sistem rolü


async def sync_permissions(db: AsyncSession) -> tuple[int, int, list[str]]:
    """Returns (added, updated, orphan_codes_in_db_but_not_in_enum)."""
    result = await db.execute(select(Permission))
    db_perms = {p.code: p for p in result.scalars().all()}

    added = updated = 0
    for perm_enum in PermissionEnum:
        code = perm_enum.value
        module, action = split_code(code)
        category = PERMISSION_CATEGORIES[perm_enum]
        description = PERMISSION_DESCRIPTIONS.get(perm_enum)

        existing = db_perms.get(code)
        if existing is None:
            db.add(
                Permission(
                    code=code,
                    module=module,
                    action=action,
                    description=description,
                    category=category,
                )
            )
            added += 1
            continue

        changed = False
        if existing.module != module:
            existing.module = module
            changed = True
        if existing.action != action:
            existing.action = action
            changed = True
        if existing.category != category:
            existing.category = category
            changed = True
        if existing.description != description:
            existing.description = description
            changed = True
        if changed:
            updated += 1

    enum_codes = {p.value for p in PermissionEnum}
    orphans = sorted(set(db_perms) - enum_codes)
    await db.flush()
    return added, updated, orphans


# GA4 Default Channel Grouping mantığını taklit eden sabit referans seti.
# Yeni source/medium kombinasyonları admin UI'dan eklenecek (Sprint 9'da CRUD
# endpoint'i planlı); buradaki liste GA4 Data API ile uyumlu başlangıç durumu.
_CHANNEL_MAPPING_DEFAULTS: tuple[tuple[str, str, str], ...] = (
    ("google", "organic", "Organic Search"),
    ("google", "cpc", "Paid Search"),
    ("bing", "organic", "Organic Search"),
    ("bing", "cpc", "Paid Search"),
    ("facebook", "cpc", "Paid Social"),
    ("facebook", "social", "Organic Social"),
    ("instagram", "cpc", "Paid Social"),
    ("instagram", "social", "Organic Social"),
    ("(direct)", "(none)", "Direct"),
    ("newsletter", "email", "Email"),
    ("blog.sporthink.com.tr", "referral", "Referral"),
    ("trendyol.com", "referral", "Referral"),
    ("youtube.com", "cpc", "Paid Video"),
    ("youtube.com", "organic", "Organic Video"),
    ("twitter.com", "social", "Organic Social"),
    ("whatsapp.com", "referral", "Referral"),
)


async def seed_channel_mapping(db: AsyncSession) -> int:
    """`channel_mapping` tablosunu sabit referans setiyle doldur (idempotent).

    Returns: yeni eklenen satır sayısı.
    """
    result = await db.execute(select(ChannelMapping.source, ChannelMapping.medium))
    existing = {(s, m) for s, m in result.all()}

    added = 0
    for source, medium, channel_group in _CHANNEL_MAPPING_DEFAULTS:
        if (source, medium) in existing:
            continue
        db.add(
            ChannelMapping(
                source=source,
                medium=medium,
                channel_group=channel_group,
                is_auto_assigned=False,
            )
        )
        added += 1
    await db.flush()
    return added


async def ensure_super_admin(db: AsyncSession) -> bool:
    """Returns True if newly created, False if already existed."""
    email = settings.super_admin_email.lower().strip()
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        return False

    role = await db.get(Role, SUPER_ADMIN_ROLE_ID)
    if role is None or not role.is_system:
        raise RuntimeError(
            f"Süper Admin rolü bulunamadı (id={SUPER_ADMIN_ROLE_ID}, is_system=True). "
            "Init SQL düzgün çalışmamış olabilir."
        )

    db.add(
        User(
            email=email,
            password_hash=hash_password(settings.super_admin_password),
            first_name="Süper",
            last_name="Admin",
            role_id=SUPER_ADMIN_ROLE_ID,
            is_active=True,
        )
    )
    await db.flush()
    return True


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    async with AsyncSessionLocal() as db:
        async with db.begin():
            added, updated, orphans = await sync_permissions(db)
            created = await ensure_super_admin(db)
            channel_added = await seed_channel_mapping(db)

    logger.info("permission_sync added=%d updated=%d orphans=%d", added, updated, len(orphans))
    if orphans:
        logger.warning(
            "DB'de enum dışı izin kodları var (manuel temizlik gerek): %s", orphans
        )
    logger.info(
        "super_admin %s email=%s", "created" if created else "exists", settings.super_admin_email
    )
    logger.info("channel_mapping seeded=%d new rows", channel_added)

    await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
