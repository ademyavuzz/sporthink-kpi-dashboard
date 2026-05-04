"""Auth endpoint'leri için request/response şemaları.

Bkz: docs/overview/05-rbac-security.md §5.4 token mimarisi
     docs/overview/06-api-spec.md auth endpoint kontratları
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """Login isteği.

    `email` burada `str` — kayıtlı kullanıcı string'iyle eşleşmesi yeter.
    RFC katı doğrulaması user-creation şemalarında yapılır.
    """

    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    """Login + refresh response gövdesi.

    Refresh token cookie ile döner; body'de yer almaz (XSS yüzeyini azaltır).
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # access token TTL (saniye)
    user: UserResponse
