"""User SQL erişimi.

Repository layer'da iş kuralı yoktur (backend/CLAUDE.md §3). Sadece
SQLAlchemy sorguları + temel mutasyonlar.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Permission, RolePermission, User


async def get_by_email(db: AsyncSession, email: str) -> User | None:
    """Email lookup; soft-deleted hariç. Email lowercase normalize edilir."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.email == email.lower().strip(), User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def list_permission_codes(db: AsyncSession, role_id: int | None) -> list[str]:
    """Role'e bağlı izin kod'larını döner. Süper admin için çağrılmaz
    (servis tarafında tüm enum döndürülür)."""
    if role_id is None:
        return []
    result = await db.execute(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role_id)
    )
    return [row[0] for row in result.all()]


async def increment_failed_logins(
    db: AsyncSession,
    user_id: int,
    *,
    lock_threshold: int,
    lock_minutes: int,
) -> None:
    """Başarısız giriş sayacını arttırır; eşiği geçerse `locked_until` set eder."""
    new_count_subq = User.failed_login_attempts + 1
    locked_until = datetime.now(UTC) + timedelta(minutes=lock_minutes)
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(
            failed_login_attempts=new_count_subq,
            locked_until=func.if_(
                new_count_subq >= lock_threshold,
                locked_until,
                User.locked_until,
            ),
        )
    )


async def mark_successful_login(
    db: AsyncSession,
    user_id: int,
    *,
    ip: str | None,
) -> None:
    """Sayacı sıfırla, lock'u temizle, last_login_at/ip yaz."""
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(
            failed_login_attempts=0,
            locked_until=None,
            last_login_at=datetime.now(UTC),
            last_login_ip=ip,
        )
    )
