"""Notification iş mantığı — backend-driven kullanıcı bazlı bildirim merkezi.

- create_for_user: server event'leri (import.completed/failed, report.*,
  password.reset_by_admin) tetikler. Sessiz fail-safe: notification yazımı
  başarısız olursa logger.warning, ana akış durmaz.
- list_for_user: sayfalı liste (varsayılan 1/50, max 200).
- mark_read / mark_all_read: idempotent.
- delete_for_user: hard delete (soft-delete yok — bildirim audit dışı).

Ownership: her endpoint `actor.id` ile filtreler; başka kullanıcının
bildirimine erişim 404 ResourceNotFoundError (varlığı sızdırma).
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ResourceNotFoundError
from app.models import Notification, NotificationType
from app.repositories import notification_repository

logger = logging.getLogger(__name__)


async def create_for_user(
    db: AsyncSession,
    *,
    user_id: int,
    type_: NotificationType | str,
    title: str,
    message: str | None = None,
    link: str | None = None,
) -> Notification | None:
    """Server event → kullanıcının bildirim listesine satır ekle.

    Hata olursa sessiz fail (logger.warning); tetikleyici akışı (import,
    report) bildirim yazılamadı diye düşmemeli. Caller `await db.commit()`
    yapar — bu fonksiyon flush eder ama commit etmez.
    """
    type_str = type_.value if isinstance(type_, NotificationType) else str(type_)
    try:
        return await notification_repository.create(
            db,
            user_id=user_id,
            type_=type_str,
            title=title,
            message=message,
            link=link,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "notification_create_failed user_id=%s title=%r err=%s",
            user_id,
            title,
            exc,
        )
        return None


async def list_for_user(
    db: AsyncSession, *, user_id: int, page: int = 1, page_size: int = 50
) -> tuple[list[Notification], int]:
    return await notification_repository.list_paginated_for_user(
        db, user_id=user_id, page=page, page_size=page_size
    )


async def count_unread(db: AsyncSession, *, user_id: int) -> int:
    return await notification_repository.count_unread_for_user(db, user_id=user_id)


async def _get_or_404(
    db: AsyncSession, *, notification_id: int, user_id: int
) -> Notification:
    row = await notification_repository.get_for_user(
        db, notification_id=notification_id, user_id=user_id
    )
    if row is None:
        # Ownership ihlali ya da bilinmeyen ID → ikisinde de 404 (sızıntı yok)
        raise ResourceNotFoundError(params={"notification_id": notification_id})
    return row


async def mark_read(
    db: AsyncSession, *, notification_id: int, user_id: int
) -> Notification:
    row = await _get_or_404(db, notification_id=notification_id, user_id=user_id)
    if not row.is_read:
        await notification_repository.mark_read(db, notification_id=notification_id)
        await db.commit()
        await db.refresh(row)
    return row


async def mark_all_read(db: AsyncSession, *, user_id: int) -> int:
    updated = await notification_repository.mark_all_read_for_user(
        db, user_id=user_id
    )
    await db.commit()
    return updated


async def delete(db: AsyncSession, *, notification_id: int, user_id: int) -> None:
    await _get_or_404(db, notification_id=notification_id, user_id=user_id)
    await notification_repository.delete_by_id(db, notification_id=notification_id)
    await db.commit()
