"""Refresh token DB erişimi.

DB'de plain JWT veya jti tutulmaz; `sha256(jti)` saklanır. Servis layer
hash'lemeden sorumlu.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RefreshToken


async def create(
    db: AsyncSession,
    *,
    user_id: int,
    token_hash: str,
    expires_at: datetime,
    ip_address: str | None,
    device_info: str | None,
) -> RefreshToken:
    row = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
        ip_address=ip_address,
        device_info=device_info,
    )
    db.add(row)
    await db.flush()
    return row


async def get_active_by_hash(db: AsyncSession, token_hash: str) -> RefreshToken | None:
    """Hash ile aktif token'ı getir (revoke edilmemiş + süresi geçmemiş)."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
    return result.scalar_one_or_none()


async def revoke(db: AsyncSession, token_id: int) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.id == token_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def revoke_by_hash(db: AsyncSession, token_hash: str) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
