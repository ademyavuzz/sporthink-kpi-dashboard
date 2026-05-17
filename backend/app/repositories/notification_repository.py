"""Notifications SQL erişim katmanı — sadece ORM sorguları, iş kuralı yok.

İş mantığı (ownership, transaction, audit) `services/notification_service.py`.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification


async def create(
    db: AsyncSession,
    *,
    user_id: int,
    type_: str,
    title: str,
    message: str | None = None,
    link: str | None = None,
) -> Notification:
    row = Notification(
        user_id=user_id,
        type=type_,
        title=title,
        message=message,
        link=link,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


async def list_paginated_for_user(
    db: AsyncSession, *, user_id: int, page: int, page_size: int
) -> tuple[list[Notification], int]:
    """Returns: (page_rows, total). En yeni → eski."""
    total = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Notification)
                .where(Notification.user_id == user_id)
            )
        ).scalar_one()
    )
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(desc(Notification.created_at), desc(Notification.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all()), total


async def get_for_user(
    db: AsyncSession, *, notification_id: int, user_id: int
) -> Notification | None:
    """Yalnız sahibi alır — başkasının ID'sini sorgularsa None döner.

    Ownership check service tarafında ResourceNotFoundError'a çevrilir.
    """
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def count_unread_for_user(db: AsyncSession, *, user_id: int) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
    )
    return int(result.scalar_one())


async def mark_read(db: AsyncSession, *, notification_id: int) -> None:
    """`is_read=True` + `read_at=now()`. Idempotent — zaten okunmuşsa noop etki."""
    await db.execute(
        update(Notification)
        .where(Notification.id == notification_id)
        .values(is_read=True, read_at=datetime.now(UTC))
    )


async def mark_all_read_for_user(db: AsyncSession, *, user_id: int) -> int:
    """Returns: kaç satır güncellendi."""
    now = datetime.now(UTC)
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True, read_at=now)
    )
    return result.rowcount or 0


async def delete_by_id(db: AsyncSession, *, notification_id: int) -> None:
    """Hard delete — bildirimler küçük ve audit dışı; soft-delete gereksiz."""
    from sqlalchemy import delete as sa_delete

    await db.execute(sa_delete(Notification).where(Notification.id == notification_id))
