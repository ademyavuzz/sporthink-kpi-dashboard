"""Auth iş mantığı: login, refresh, logout, /me.

Bkz: docs/overview/05-rbac-security.md §5.4 token & §5.6 lock policy
     backend/CLAUDE.md §3 (router → service → repository disiplini)

Refresh token DB'de plaintext saklanmaz; `sha256(jti)` saklanır.
JWT cookie'de döner (httpOnly), DB satırı revocation ve rotation için.

Transaction stratejisi: failure path'lerde de bookkeeping (failed_login,
audit log) PERSIST edilmeli — bu nedenle her dal `db.commit()` ile bitiyor,
sonra raise ediyor. `async with db.begin()` bloğu kullanmıyoruz çünkü
exception block'tan çıkışta rollback'e yol açıyor.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, InvalidCredentialsError
from app.core.permissions import Permission as PermissionEnum
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models import User
from app.repositories import audit_log_repository, refresh_token_repository, user_repository

logger = logging.getLogger(__name__)

# Lock policy — şimdilik sabit; ileride settings'e taşınabilir.
LOCK_THRESHOLD = 5
LOCK_MINUTES = 15


class AccountLockedError(AuthenticationError):
    code = "ACCOUNT_LOCKED"
    message = "Account is temporarily locked due to repeated failed login attempts"


def _hash_jti(jti: str) -> str:
    return hashlib.sha256(jti.encode("utf-8")).hexdigest()


def _is_locked(user: User) -> bool:
    if user.locked_until is None:
        return False
    locked_until = user.locked_until
    if locked_until.tzinfo is None:
        # MySQL TIMESTAMP naive döner; UTC olarak yorumla
        locked_until = locked_until.replace(tzinfo=UTC)
    return locked_until > datetime.now(UTC)


async def login(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    ip: str | None,
    user_agent: str | None,
) -> tuple[User, str, str, datetime]:
    """Kullanıcıyı doğrular ve token çifti üretir.

    Returns: (user, access_token, refresh_token_jwt, refresh_expires_at)
    """
    user = await user_repository.get_by_email(db, email)

    # Kullanıcı yoksa veya pasif → INVALID_CREDENTIALS (timing benzeri davranış,
    # ama email enum'u açık etmiyoruz).
    if user is None or not user.is_active:
        await audit_log_repository.add(
            db,
            action="auth.login.failed",
            user_id=user.id if user else None,
            user_email=email.lower().strip(),
            ip_address=ip,
            user_agent=user_agent,
            details={"reason": "user_not_found_or_inactive"},
        )
        await db.commit()
        raise InvalidCredentialsError()

    if _is_locked(user):
        await audit_log_repository.add(
            db,
            action="auth.login.failed",
            user_id=user.id,
            user_email=user.email,
            ip_address=ip,
            user_agent=user_agent,
            details={"reason": "locked"},
        )
        await db.commit()
        raise AccountLockedError()

    if not verify_password(password, user.password_hash):
        await user_repository.increment_failed_logins(
            db,
            user.id,
            lock_threshold=LOCK_THRESHOLD,
            lock_minutes=LOCK_MINUTES,
        )
        await audit_log_repository.add(
            db,
            action="auth.login.failed",
            user_id=user.id,
            user_email=user.email,
            ip_address=ip,
            user_agent=user_agent,
            details={"reason": "wrong_password"},
        )
        await db.commit()
        raise InvalidCredentialsError()

    # Başarılı giriş
    await user_repository.mark_successful_login(db, user.id, ip=ip)

    access_token = create_access_token(
        user_id=user.id,
        extra_claims={"role_id": user.role_id} if user.role_id else None,
    )
    refresh_jwt, refresh_exp, jti = create_refresh_token(user_id=user.id)
    await refresh_token_repository.create(
        db,
        user_id=user.id,
        token_hash=_hash_jti(jti),
        expires_at=refresh_exp,
        ip_address=ip,
        device_info=user_agent[:500] if user_agent else None,
    )
    await audit_log_repository.add(
        db,
        action="auth.login",
        user_id=user.id,
        user_email=user.email,
        ip_address=ip,
        user_agent=user_agent,
    )
    await db.commit()

    return user, access_token, refresh_jwt, refresh_exp


async def refresh(
    db: AsyncSession,
    *,
    refresh_jwt: str,
    ip: str | None,
    user_agent: str | None,
) -> tuple[User, str, str, datetime]:
    """Refresh JWT ile yeni access + rotated refresh üretir.

    Eski refresh revoke edilir; ardışık kullanım girişimi tüm aktif token'ları
    revoke eden bir replay-detection genişletmesine ileride dönüşebilir.
    """
    payload = decode_token(refresh_jwt, expected_type="refresh")
    try:
        user_id = int(payload["sub"])
        jti = payload["jti"]
    except (KeyError, ValueError, TypeError) as exc:
        raise InvalidCredentialsError("Invalid refresh token") from exc

    token_hash = _hash_jti(jti)
    existing = await refresh_token_repository.get_active_by_hash(db, token_hash)
    if existing is None or existing.user_id != user_id:
        raise InvalidCredentialsError("Refresh token not recognized")

    user = await user_repository.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("User inactive or deleted")

    # Rotate: eski revoke, yeni issue
    await refresh_token_repository.revoke(db, existing.id)

    access_token = create_access_token(
        user_id=user.id,
        extra_claims={"role_id": user.role_id} if user.role_id else None,
    )
    new_refresh_jwt, new_exp, new_jti = create_refresh_token(user_id=user.id)
    await refresh_token_repository.create(
        db,
        user_id=user.id,
        token_hash=_hash_jti(new_jti),
        expires_at=new_exp,
        ip_address=ip,
        device_info=user_agent[:500] if user_agent else None,
    )
    await audit_log_repository.add(
        db,
        action="auth.token.refreshed",
        user_id=user.id,
        user_email=user.email,
        ip_address=ip,
        user_agent=user_agent,
    )
    await db.commit()

    return user, access_token, new_refresh_jwt, new_exp


async def logout(
    db: AsyncSession,
    *,
    refresh_jwt: str | None,
    user: User | None,
    ip: str | None,
    user_agent: str | None,
) -> None:
    """Refresh token'ı revoke et + audit log. Idempotent."""
    if refresh_jwt:
        try:
            payload = decode_token(refresh_jwt, expected_type="refresh")
            jti = payload.get("jti")
            if jti:
                await refresh_token_repository.revoke_by_hash(db, _hash_jti(jti))
        except Exception:  # noqa: BLE001
            # Logout idempotent — geçersiz token'da bile sessiz devam.
            logger.info("logout_invalid_refresh", extra={"user_id": user.id if user else None})

    if user:
        await audit_log_repository.add(
            db,
            action="auth.logout",
            user_id=user.id,
            user_email=user.email,
            ip_address=ip,
            user_agent=user_agent,
        )
    await db.commit()


async def get_permission_codes(db: AsyncSession, user: User) -> list[str]:
    """Süper admin tüm enum'u alır; diğerleri DB'den join."""
    if user.is_super_admin:
        return [p.value for p in PermissionEnum]
    return await user_repository.list_permission_codes(db, user.role_id)
