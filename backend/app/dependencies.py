"""Global FastAPI dependencies.

- `get_db`: AsyncSession yield (request scope)
- `get_redis`: Redis async client (cache db 0)
- `get_current_user`: JWT'den User çek (role joined)
- `require_permission(perm)`: izin kontrolü + Redis cache (5dk) + Süper Admin bypass
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from functools import lru_cache

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from redis import asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core import cache_keys
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.permissions import Permission as PermissionEnum
from app.core.security import decode_token
from app.db.session import AsyncSessionLocal
from app.models import Permission, RolePermission, User

# auto_error=False — eksik token kendi exception class'ımızla raise edilir
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


@lru_cache
def _redis_client() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_cache_url, decode_responses=True)


async def get_redis() -> aioredis.Redis:
    return _redis_client()


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise AuthenticationError()

    payload = decode_token(token, expected_type="access")
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError, TypeError) as exc:
        raise AuthenticationError("Invalid token subject") from exc

    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user is None or user.deleted_at is not None or not user.is_active:
        raise AuthenticationError("User inactive or deleted")
    return user


async def _load_user_permissions(db: AsyncSession, user: User) -> list[str]:
    if user.role_id is None:
        return []
    result = await db.execute(
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == user.role_id)
    )
    return [row[0] for row in result.all()]


def require_permission(permission: PermissionEnum | str):
    """FastAPI dependency factory. Süper Admin tüm kontrolleri bypass eder."""
    code = permission.value if isinstance(permission, PermissionEnum) else permission

    async def checker(
        current_user: User = Depends(get_current_user),
        cache: aioredis.Redis = Depends(get_redis),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if current_user.is_super_admin:
            return current_user

        cache_key = cache_keys.user_perms(current_user.id)
        raw = await cache.get(cache_key)
        if raw:
            perms = json.loads(raw)
        else:
            perms = await _load_user_permissions(db, current_user)
            await cache.setex(cache_key, 300, json.dumps(perms))

        if code not in perms:
            raise PermissionDeniedError(params={"required": code})
        return current_user

    return checker
