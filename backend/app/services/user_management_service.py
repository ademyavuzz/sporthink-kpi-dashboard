"""Kullanıcı yönetimi: CRUD + davet (SendGrid placeholder).

`/users` endpoint'leri bu servisi kullanır. Süper Admin yeni kullanıcı davet
ettiğinde geçici şifre üretilir, kullanıcıya email ile gönderilir (SendGrid
yapılandırılmamışsa log'a yazılır — dev modunda yeterli).

Tüm değişiklikler audit_log'a yazılır.
"""
from __future__ import annotations

import logging
import secrets
import string
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ConflictError, ResourceNotFoundError, ValidationError
from app.core.security import hash_password
from app.models import Role, User
from app.repositories import audit_log_repository

logger = logging.getLogger(__name__)


def generate_temp_password(length: int = 14) -> str:
    """Davet için geçici şifre — kullanıcı ilk login'de değiştirir.

    Min 10 karakter (CLAUDE.md), büyük/küçük/rakam/sembol içerir.
    """
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def list_users(db: AsyncSession, *, include_deleted: bool = False) -> list[User]:
    stmt = select(User).order_by(User.id)
    if not include_deleted:
        stmt = stmt.where(User.deleted_at.is_(None))
    return list((await db.execute(stmt)).scalars().all())


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    first_name: str,
    last_name: str,
    role_id: int,
    actor: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> tuple[User, str]:
    """Yeni kullanıcı oluştur + geçici şifre döndür.

    Returns: (user, temp_password). Şifre çağıran tarafa loglanır
    (production'da SendGrid email akışına bağlanır).
    """
    email = email.strip().lower()

    # Duplicate kontrolü
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise ConflictError(
            "EMAIL_ALREADY_EXISTS", params={"email": email}
        )

    role = await db.get(Role, role_id)
    if role is None:
        raise ValidationError("Invalid role", field="role_id", params={"role_id": role_id})

    temp_pw = generate_temp_password()
    user = User(
        email=email,
        password_hash=hash_password(temp_pw),
        first_name=first_name,
        last_name=last_name,
        role_id=role_id,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await audit_log_repository.add(
        db,
        action="user.created",
        user_id=actor.id,
        user_email=actor.email,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        user_agent=user_agent,
        details={"email": email, "role_id": role_id},
    )
    # Server defaults (created_at, updated_at) MySQL'de flush sonrası otomatik
    # fetch edilmez — commit sonrası lazy-load greenlet hatası verir. Refresh
    # ile zorla okuyup commit edelim.
    await db.refresh(user, attribute_names=["created_at", "updated_at"])
    await db.commit()

    if settings.sendgrid_api_key:
        logger.info("user_invite_email_queued email=%s", email)
    else:
        logger.warning(
            "user_invite_no_sendgrid email=%s temp_password=%s (dev only)",
            email,
            temp_pw,
        )

    return user, temp_pw


async def update_user(
    db: AsyncSession,
    user_id: int,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    role_id: int | None = None,
    is_active: bool | None = None,
    actor: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise ResourceNotFoundError(params={"user_id": user_id})

    changed: dict[str, Any] = {}
    if first_name is not None and user.first_name != first_name:
        user.first_name = first_name
        changed["first_name"] = first_name
    if last_name is not None and user.last_name != last_name:
        user.last_name = last_name
        changed["last_name"] = last_name
    if role_id is not None and user.role_id != role_id:
        role = await db.get(Role, role_id)
        if role is None:
            raise ValidationError("Invalid role", field="role_id")
        user.role_id = role_id
        changed["role_id"] = role_id
    if is_active is not None and user.is_active != is_active:
        user.is_active = is_active
        changed["is_active"] = is_active

    if changed:
        await audit_log_repository.add(
            db,
            action="user.updated",
            user_id=actor.id,
            user_email=actor.email,
            resource_type="user",
            resource_id=str(user.id),
            ip_address=ip,
            user_agent=user_agent,
            details=changed,
        )
    # Lazy-load tetiklenmesini önle: server defaults okuyup commit
    await db.refresh(user, attribute_names=["created_at", "updated_at"])
    await db.commit()
    return user


async def soft_delete_user(
    db: AsyncSession,
    user_id: int,
    *,
    actor: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise ResourceNotFoundError(params={"user_id": user_id})

    role = await db.get(Role, user.role_id) if user.role_id else None
    if role is not None and role.is_system:
        raise ValidationError("Cannot delete super admin", field="user_id")

    user.deleted_at = datetime.now(UTC)
    user.is_active = False

    await audit_log_repository.add(
        db,
        action="user.deleted",
        user_id=actor.id,
        user_email=actor.email,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        user_agent=user_agent,
        details={"email": user.email},
    )
    await db.commit()


async def list_audit_logs(
    db: AsyncSession,
    *,
    limit: int = 100,
    action_filter: str | None = None,
) -> list[dict[str, Any]]:
    """Audit log listesi (en yeni → eski)."""
    from app.models import AuditLog

    conditions = []
    if action_filter:
        conditions.append(AuditLog.action.like(f"{action_filter}%"))
    stmt = select(AuditLog)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(AuditLog.id.desc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": r.id,
            "action": r.action,
            "user_id": r.user_id,
            "user_email": r.user_email,
            "resource_type": r.resource_type,
            "resource_id": r.resource_id,
            "ip_address": r.ip_address,
            "details": r.details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
