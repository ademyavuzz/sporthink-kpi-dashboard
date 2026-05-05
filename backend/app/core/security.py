"""JWT encode/decode + bcrypt password hash utilities.

Bkz: `docs/overview/05-rbac-security.md` §5.4 token mimarisi.
"""

from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import uuid4

import jwt
from passlib.context import CryptContext

from app.config import settings
from app.core.exceptions import InvalidCredentialsError, TokenExpiredError

TokenType = Literal["access", "refresh"]


_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def _now_utc() -> datetime:
    return datetime.now(UTC)


def create_access_token(
    *,
    user_id: int,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    now = _now_utc()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
        "jti": uuid4().hex,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(*, user_id: int) -> tuple[str, datetime, str]:
    """Returns (token, expires_at_utc, jti)."""
    now = _now_utc()
    expires_at = now + timedelta(days=settings.refresh_token_expire_days)
    jti = uuid4().hex
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": jti,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_at, jti


def decode_token(token: str, *, expected_type: TokenType | None = None) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError() from exc
    except jwt.InvalidTokenError as exc:
        raise InvalidCredentialsError("Invalid token") from exc

    if expected_type and payload.get("type") != expected_type:
        raise InvalidCredentialsError("Invalid token type")
    return payload
