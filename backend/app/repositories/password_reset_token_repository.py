"""Davet ve şifre sıfırlama token repository.

Token plaintext değil hash (sha256 hex) saklanır. Sorgular:
- aktif token bulma (used_at IS NULL AND expires_at > now)
- kullanıcının aynı purpose'taki tüm aktif tokenlarını revoke etme
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PasswordResetToken, TokenPurpose


async def create(
    db: AsyncSession,
    *,
    user_id: int,
    token_hash: str,
    purpose: TokenPurpose,
    expires_at: datetime,
    requested_ip: str | None = None,
) -> PasswordResetToken:
    row = PasswordResetToken(
        user_id=user_id,
        token_hash=token_hash,
        purpose=purpose,
        expires_at=expires_at,
        requested_ip=requested_ip,
    )
    db.add(row)
    await db.flush()
    return row


async def get_active_by_hash(db: AsyncSession, token_hash: str) -> PasswordResetToken | None:
    """Henüz kullanılmamış ve süresi geçmemiş token'ı döner."""
    now = datetime.now(UTC).replace(tzinfo=None)  # MySQL DATETIME naive
    stmt = select(PasswordResetToken).where(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > now,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def mark_used(db: AsyncSession, token_id: int) -> None:
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.id == token_id)
        .values(used_at=datetime.now(UTC).replace(tzinfo=None))
    )


async def revoke_active_for_user(db: AsyncSession, user_id: int, purpose: TokenPurpose) -> None:
    """Kullanıcının verilen purpose'taki tüm aktif tokenlarını revoke eder.

    Yeni bir davet/sıfırlama maili gönderilmeden önce çağrılır ki önceki
    link'ler artık çalışmasın.
    """
    now = datetime.now(UTC).replace(tzinfo=None)
    await db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.purpose == purpose,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
