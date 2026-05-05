"""Davet ve şifre sıfırlama akışı.

Akış (forgot-password):
1. Kullanıcı email ile `/auth/forgot-password` çağırır.
2. Servis kullanıcıyı bulur (yoksa sessizce no-op — email enum'unu sızdırma).
3. URL-safe random token üretir, sha256 hash'ini DB'ye yazar.
4. Frontend'in reset sayfasına yönlendiren link mail'e gönderilir
   (Celery task ile arka planda).

Davet akışı (`create_invitation`):
- Aynı altyapıyı kullanır ama purpose=INVITE, TTL daha uzun (7 gün default).
- Yeni kullanıcı oluşturulduktan sonra çağrılır.

Token formatı: 32-byte URL-safe (`secrets.token_urlsafe(32)`) — ~43 karakter.
DB'de plaintext değil hash saklanır; verify aşamasında hash karşılaştırılır.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import InvalidOrExpiredTokenError, ValidationError
from app.core.security import hash_password
from app.models import PasswordResetToken, TokenPurpose, User
from app.repositories import (
    audit_log_repository,
    password_reset_token_repository,
    user_repository,
)

logger = logging.getLogger(__name__)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now_naive_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _format_expires_human(purpose: TokenPurpose, lang: str) -> str:
    """Mail içeriğinde 'X içinde geçerli' gibi insan okur ifade."""
    if purpose == TokenPurpose.INVITE:
        days = settings.invite_token_expire_hours // 24
        return f"{days} gün" if lang == "tr" else f"{days} days"
    minutes = settings.reset_token_expire_minutes
    if minutes >= 60 and minutes % 60 == 0:
        hours = minutes // 60
        return f"{hours} saat" if lang == "tr" else f"{hours} hour" + ("s" if hours != 1 else "")
    return f"{minutes} dakika" if lang == "tr" else f"{minutes} minutes"


async def _create_token(
    db: AsyncSession,
    *,
    user: User,
    purpose: TokenPurpose,
    requested_ip: str | None,
) -> str:
    """Yeni token üretir ve önceki aktif aynı-purpose tokenları revoke eder.

    Plaintext token'ı döner — çağıran tarafa mail için; DB'de yalnızca hash.
    """
    await password_reset_token_repository.revoke_active_for_user(db, user.id, purpose)
    plain = secrets.token_urlsafe(32)
    if purpose == TokenPurpose.INVITE:
        ttl = timedelta(hours=settings.invite_token_expire_hours)
    else:
        ttl = timedelta(minutes=settings.reset_token_expire_minutes)
    expires_at = _now_naive_utc() + ttl

    await password_reset_token_repository.create(
        db,
        user_id=user.id,
        token_hash=_hash_token(plain),
        purpose=purpose,
        expires_at=expires_at,
        requested_ip=requested_ip,
    )
    return plain


def build_action_url(token: str, purpose: TokenPurpose) -> str:
    """Frontend'in şifre belirleme sayfasına yönlendiren URL.

    Davet ve sıfırlama aynı sayfayı kullanır; `purpose` query param ile
    UI mesajını değiştirir (örn: "Şifre belirle" vs "Şifre sıfırla").
    """
    base = settings.frontend_origin.rstrip("/")
    return f"{base}/reset-password?token={token}&purpose={purpose.value}"


async def request_password_reset(
    db: AsyncSession,
    *,
    email: str,
    lang: str,
    ip: str | None,
) -> None:
    """Forgot-password akışı.

    Kullanıcı bulunamazsa sessizce no-op (email enum'unu sızdırma). DB'ye
    kaydetme yok, sadece audit log'a "requested" düşer (target user ID
    bulunmuyorsa email'le).
    """
    email_norm = email.strip().lower()
    user = await user_repository.get_by_email(db, email_norm)

    if user is None or not user.is_active:
        await audit_log_repository.add(
            db,
            action="auth.password_reset_requested",
            user_id=user.id if user else None,
            user_email=email_norm,
            ip_address=ip,
            details={"outcome": "user_not_found_or_inactive"},
        )
        await db.commit()
        logger.info("password_reset_requested email=%s outcome=no_user", email_norm)
        return

    token = await _create_token(db, user=user, purpose=TokenPurpose.RESET, requested_ip=ip)
    action_url = build_action_url(token, TokenPurpose.RESET)

    await audit_log_repository.add(
        db,
        action="auth.password_reset_requested",
        user_id=user.id,
        user_email=user.email,
        ip_address=ip,
        details={"outcome": "token_created"},
    )
    await db.commit()

    # Mail dispatch — Celery task'a delegate edilir.
    from app.tasks.email_tasks import send_password_reset_email

    send_password_reset_email.delay(
        user_email=user.email,
        first_name=user.first_name,
        action_url=action_url,
        expires_in=_format_expires_human(TokenPurpose.RESET, lang),
        lang=lang,
    )


async def create_invitation(
    db: AsyncSession,
    *,
    user: User,
    inviter: User,
    role_name: str,
    lang: str,
    ip: str | None,
) -> None:
    """Yeni kullanıcıya davet maili gönderir.

    `user_management_service.create_user` içinden çağrılır. Kullanıcı şifresi
    rastgele bir placeholder ile oluşturulur (login imkânsız) — kullanıcı
    davet linkinden kendi şifresini kurar.
    """
    token = await _create_token(db, user=user, purpose=TokenPurpose.INVITE, requested_ip=ip)
    action_url = build_action_url(token, TokenPurpose.INVITE)

    await db.commit()

    from app.tasks.email_tasks import send_invitation_email

    send_invitation_email.delay(
        user_email=user.email,
        first_name=user.first_name,
        inviter_name=f"{inviter.first_name} {inviter.last_name}".strip() or inviter.email,
        role_name=role_name,
        action_url=action_url,
        expires_in=_format_expires_human(TokenPurpose.INVITE, lang),
        lang=lang,
    )


async def verify_token(db: AsyncSession, token: str) -> tuple[PasswordResetToken, User]:
    """Token geçerli mi? Geçerliyse (token, user) döner.

    Geçersizse `ValidationError("INVALID_OR_EXPIRED_TOKEN")` raise eder.
    """
    token_hash = _hash_token(token)
    row = await password_reset_token_repository.get_active_by_hash(db, token_hash)
    if row is None:
        raise InvalidOrExpiredTokenError()
    user = await user_repository.get_by_id(db, row.user_id)
    if user is None or not user.is_active:
        raise InvalidOrExpiredTokenError("User account is inactive")
    return row, user


async def consume_token_and_set_password(
    db: AsyncSession,
    *,
    token: str,
    new_password: str,
    ip: str | None,
) -> User:
    """Token'ı kullan, kullanıcının şifresini ayarla, tüm refresh'leri revoke et.

    Davet ve sıfırlama aynı path'i kullanır — kullanıcı yeni şifre belirler,
    tüm aktif oturumları (refresh tokens) revoke edilir, kullanıcı tekrar
    login olmak zorundadır.
    """
    from sqlalchemy import delete as sa_delete

    from app.models import RefreshToken

    if len(new_password) < 10:
        raise ValidationError(
            "Password must be at least 10 characters",
            field="new_password",
            params={"min": 10},
        )

    row, user = await verify_token(db, token)

    user.password_hash = hash_password(new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    await password_reset_token_repository.mark_used(db, row.id)
    await db.execute(sa_delete(RefreshToken).where(RefreshToken.user_id == user.id))

    action = (
        "auth.invitation_completed"
        if row.purpose == TokenPurpose.INVITE
        else "auth.password_reset_completed"
    )
    await audit_log_repository.add(
        db,
        action=action,
        user_id=user.id,
        user_email=user.email,
        ip_address=ip,
        details={"purpose": row.purpose.value},
    )
    await db.commit()
    return user
