"""Kullanıcı kendi profil bilgilerini ve şifresini yönetir.

Adminin başkasını yönettiği `user_management_service`'ten ayrı; bu modül
sadece kullanıcının kendi kayıtları için. Email ve role admin yetkisi
gerektirir, burada güncellenmez.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidCredentialsError
from app.core.security import hash_password, verify_password
from app.models import RefreshToken, User
from app.repositories import audit_log_repository
from app.services import avatar_service

logger = logging.getLogger(__name__)


async def update_me(
    db: AsyncSession,
    user: User,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    phone: str | None = None,
    department: str | None = None,
    job_title: str | None = None,
    bio: str | None = None,
    birth_date: object | None = None,
    location: str | None = None,
    website_url: str | None = None,
    linkedin_url: str | None = None,
    twitter_url: str | None = None,
    github_url: str | None = None,
    instagram_url: str | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    """Kullanıcının kendi profil alanlarını günceller.

    `None` olarak gelen alan değişmez (PATCH semantiği). Boş string `""`
    "alanı temizle" anlamına gelir (örn. job_title silmek için "" gönderilir).
    """
    changed: dict[str, Any] = {}

    def _set(field: str, new_value: str | None, *, allow_empty: bool = True) -> None:
        if new_value is None:
            return
        cleaned = new_value.strip()
        if not allow_empty and not cleaned:
            return
        if getattr(user, field) != (cleaned or None):
            setattr(user, field, cleaned or None)
            changed[field] = cleaned or None

    def _set_date(field: str, new_value: object | None) -> None:
        if new_value is None:
            return
        if getattr(user, field) != new_value:
            setattr(user, field, new_value)
            changed[field] = str(new_value)

    _set("first_name", first_name, allow_empty=False)
    _set("last_name", last_name, allow_empty=False)
    _set("phone", phone)
    _set("department", department)
    _set("job_title", job_title)
    _set("bio", bio)
    _set_date("birth_date", birth_date)
    _set("location", location)
    _set("website_url", website_url)
    _set("linkedin_url", linkedin_url)
    _set("twitter_url", twitter_url)
    _set("github_url", github_url)
    _set("instagram_url", instagram_url)

    if changed:
        await audit_log_repository.add(
            db,
            action="profile.updated",
            user_id=user.id,
            user_email=user.email,
            resource_type="user",
            resource_id=str(user.id),
            ip_address=ip,
            user_agent=user_agent,
            details={"fields": list(changed.keys())},
        )
    await db.refresh(user, attribute_names=["created_at", "updated_at"])
    await db.commit()
    return user


async def upload_avatar(
    db: AsyncSession,
    user: User,
    *,
    content: bytes,
    content_type: str | None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    url = avatar_service.save_avatar(user.id, content=content, content_type=content_type)
    user.avatar_url = url
    await audit_log_repository.add(
        db,
        action="profile.avatar_updated",
        user_id=user.id,
        user_email=user.email,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        user_agent=user_agent,
    )
    await db.refresh(user, attribute_names=["created_at", "updated_at"])
    await db.commit()
    return user


async def remove_avatar(
    db: AsyncSession,
    user: User,
    *,
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    avatar_service.delete_avatar(user.id)
    user.avatar_url = None
    await audit_log_repository.add(
        db,
        action="profile.avatar_removed",
        user_id=user.id,
        user_email=user.email,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        user_agent=user_agent,
    )
    await db.refresh(user, attribute_names=["created_at", "updated_at"])
    await db.commit()
    return user


async def change_password(
    db: AsyncSession,
    user: User,
    *,
    current_password: str,
    new_password: str,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    """Mevcut şifre doğrulanır, yeni şifre kaydedilir, tüm refresh tokenlar
    revoke edilir. Kullanıcı yeniden login olmalıdır."""
    if not verify_password(current_password, user.password_hash):
        await audit_log_repository.add(
            db,
            action="auth.password_change_failed",
            user_id=user.id,
            user_email=user.email,
            ip_address=ip,
            user_agent=user_agent,
            details={"reason": "wrong_current_password"},
        )
        await db.commit()
        raise InvalidCredentialsError("Current password is incorrect")

    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.execute(sa_delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await audit_log_repository.add(
        db,
        action="auth.password_changed",
        user_id=user.id,
        user_email=user.email,
        ip_address=ip,
        user_agent=user_agent,
    )
    # Davet/sıfırlama tokenlarını da revoke et
    from app.models import TokenPurpose
    from app.repositories import password_reset_token_repository

    await password_reset_token_repository.revoke_active_for_user(db, user.id, TokenPurpose.RESET)
    await password_reset_token_repository.revoke_active_for_user(db, user.id, TokenPurpose.INVITE)

    await db.commit()
