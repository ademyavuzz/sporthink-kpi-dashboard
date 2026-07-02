"""Tetikleyici hook'larının notification yarattığını doğrular.

5 tetikleyici:
- import.completed (success/warning) + import.failed (error) → import_service
- report.completed (success) + report.failed (error)        → report_service
- password.admin_reset_requested (warning)                  → user_management_service

Burada `notification_service.create_for_user` çağrısının ana akışı
durdurmadığını ve doğru tip + başlık ile DB'ye satır yazdığını
verify ederiz. Üst seviye akışların kendisi (CSV import, PDF generate)
ayrı test gruplarında.
"""

from __future__ import annotations

import pytest
from sqlalchemy import delete, select

from app.db.session import AsyncSessionLocal
from app.models import Notification, NotificationType
from app.services import notification_service

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]


async def _cleanup(user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Notification).where(Notification.user_id == user_id))
        await db.commit()


async def _get_super_admin_id() -> int:
    from app.config import settings
    from app.models import User

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User.id).where(User.email == settings.super_admin_email))
        return int(result.scalar_one())


async def test_create_for_user_writes_success_type() -> None:
    """SUCCESS tipi: import.completed senaryosunu temsil eder."""
    uid = await _get_super_admin_id()
    await _cleanup(uid)

    async with AsyncSessionLocal() as db:
        n = await notification_service.create_for_user(
            db,
            user_id=uid,
            type_=NotificationType.SUCCESS,
            title="İmport tamamlandı: test.csv",
            message="100 satır eklendi",
            link="/import/history",
        )
        await db.commit()
        assert n is not None
        assert n.type == "success"
        assert n.title == "İmport tamamlandı: test.csv"
        assert n.is_read is False
        assert n.read_at is None
        assert n.link == "/import/history"

    await _cleanup(uid)


async def test_create_for_user_writes_error_type() -> None:
    """ERROR tipi: import.failed / report.failed senaryosunu temsil eder."""
    uid = await _get_super_admin_id()
    await _cleanup(uid)

    async with AsyncSessionLocal() as db:
        n = await notification_service.create_for_user(
            db,
            user_id=uid,
            type_=NotificationType.ERROR,
            title="İmport başarısız: test.csv",
            message="Veritabanı hatası (ref: 42)",
            link="/import/history",
        )
        await db.commit()
        assert n is not None
        assert n.type == "error"

    await _cleanup(uid)


async def test_create_for_user_writes_warning_type() -> None:
    """WARNING tipi: password.admin_reset_requested / partial import."""
    uid = await _get_super_admin_id()
    await _cleanup(uid)

    async with AsyncSessionLocal() as db:
        n = await notification_service.create_for_user(
            db,
            user_id=uid,
            type_=NotificationType.WARNING,
            title="Şifreniz sıfırlandı",
            message="Adem Yavuz tarafından şifre sıfırlama maili gönderildi.",
            link="/settings/security",
        )
        await db.commit()
        assert n is not None
        assert n.type == "warning"

    await _cleanup(uid)


async def test_create_for_user_fails_silently_on_invalid_user() -> None:
    """Tetikleyici hatası ana akışı durdurmamalı — None döner, logger.warning."""
    async with AsyncSessionLocal() as db:
        # Olmayan user_id ile — FK constraint patlar ama service yutmalı
        n = await notification_service.create_for_user(
            db,
            user_id=99999999,
            type_=NotificationType.INFO,
            title="should fail silently",
        )
        # Servis Exception'ı yakalayıp None döndürür; assertion: None
        # NOT: flush sırasında IntegrityError patlar; sessizce yutulur
        assert n is None
        await db.rollback()
