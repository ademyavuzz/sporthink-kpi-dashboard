"""Kullanıcı yönetimi: CRUD + davet (Gmail SMTP üzerinden mail).

Süper Admin yeni kullanıcı davet ettiğinde, kullanıcı **kendi şifresini**
davet linkinden belirler — geçici şifre artık üretilmez. Backend'de
güvenli bir placeholder hash atanır (login imkânsız), ardından
`password_reset_service.create_invitation` ile davet maili tetiklenir.

Tüm değişiklikler audit_log'a yazılır.
"""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ResourceNotFoundError, ValidationError
from app.core.security import hash_password
from app.models import Role, User
from app.repositories import audit_log_repository
from app.services import password_reset_service

logger = logging.getLogger(__name__)


def _generate_placeholder_password() -> str:
    """Davet edilen kullanıcı için login'i imkânsız kılan rastgele hash kaynağı.

    Kullanıcı asla bu şifreyi öğrenmez ve davet linkinden kendi şifresini
    kurana kadar login edemez. ~256-bit entropi.
    """
    return secrets.token_urlsafe(32)


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
    lang: str = "tr",
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    """Yeni kullanıcı + davet maili.

    Akış: placeholder şifre ile user yaratılır → audit log → davet token + mail.
    Frontend'e dönen response'ta şifre yok; sadece `invitation_sent: true`.
    """
    email = email.strip().lower()

    # Duplicate kontrolü
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise ConflictError("EMAIL_ALREADY_EXISTS", params={"email": email})

    role = await db.get(Role, role_id)
    if role is None:
        raise ValidationError("Invalid role", field="role_id", params={"role_id": role_id})

    user = User(
        email=email,
        password_hash=hash_password(_generate_placeholder_password()),
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

    # Davet token + mail (Celery task'a delegate edilir, db.commit içeride).
    await password_reset_service.create_invitation(
        db,
        user=user,
        inviter=actor,
        role_name=role.name,
        lang=lang,
        ip=ip,
    )
    return user


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


async def admin_send_password_reset(
    db: AsyncSession,
    user_id: int,
    *,
    actor: User,
    lang: str = "tr",
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    """Süper Admin kullanıcının şifresini sıfırlamak için reset linki gönderir.

    Aktif refresh token'lar `consume_token_and_set_password` içinde, yani
    kullanıcı yeni şifreyi belirleyince revoke edilir — burada erken revoke
    yapmıyoruz ki kullanıcı reset link'e tıklayana kadar mevcut oturumu
    kesilmesin (Süper Admin yanlışlıkla butona basmış olabilir).
    """
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise ResourceNotFoundError(params={"user_id": user_id})

    await audit_log_repository.add(
        db,
        action="password.admin_reset_requested",
        user_id=actor.id,
        user_email=actor.email,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        user_agent=user_agent,
        details={"target_email": user.email},
    )

    # `request_password_reset` token üretir, önceki aktifleri revoke eder
    # ve Celery üzerinden mail tetikler. Kullanıcı yeni şifreyi belirleyince
    # tüm refresh tokenları o aşamada revoke olur.
    await password_reset_service.request_password_reset(
        db,
        email=user.email,
        lang=lang,
        ip=ip,
    )
    return user


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
