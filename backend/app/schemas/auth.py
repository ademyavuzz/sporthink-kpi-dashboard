"""Auth endpoint'leri için request/response şemaları.

Bkz: docs/overview/05-rbac-security.md §5.4 token mimarisi
     docs/overview/06-api-spec.md auth endpoint kontratları
"""

from __future__ import annotations

from datetime import date as _date_type

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """Login isteği.

    `email` `EmailStr` — Pydantic katmanında format doğrulanır, malformed
    payload backend'de DB lookup'a düşmeden 422 ile reddedilir. Davranış
    güvenli (yetkisiz erişim zaten 401'di) ama frontend için "format hatası"
    daha açıklayıcı.
    """

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=1, max_length=128)
    # `False` ise refresh cookie session-only (browser kapanınca silinir);
    # `True` ise `refresh_token_expire_days` kadar persist eder.
    remember_me: bool = True


class TokenResponse(BaseModel):
    """Login + refresh response gövdesi.

    Refresh token cookie ile döner; body'de yer almaz (XSS yüzeyini azaltır).
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # access token TTL (saniye)
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    """`POST /auth/forgot-password` isteği.

    Kullanıcı email enum'unu sızdırmamak için response her zaman aynı —
    `{"sent": true}`. Bu istek başarılı/başarısız ayırt edilemez.
    """

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    lang: str = Field(default="tr", pattern="^(tr|en)$")


class ForgotPasswordResponse(BaseModel):
    sent: bool = True


class VerifyResetTokenResponse(BaseModel):
    """`GET /auth/verify-reset-token?token=...` cevabı.

    Token geçerliyse `valid=True` ve maskelenmiş email döner; geçersizse
    422 + `INVALID_OR_EXPIRED_TOKEN` exception (handler'a düşer).
    """

    valid: bool
    purpose: str  # "invite" | "reset"
    user_email: str  # maskelenmiş: "ad***@domain.com"
    first_name: str


class ResetPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=10, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class ResetPasswordResponse(BaseModel):
    success: bool = True
    email: str


class MeUpdateRequest(BaseModel):
    """Kullanıcının kendi profil alanlarını güncellemek için.

    Email değişmiyor (kimliği etkiler — admin gerekir). Tüm alanlar opsiyonel,
    sadece gönderilen alanlar güncellenir. Boş string ("") "alanı temizle"
    anlamına gelir (örn. linkedin_url'i silmek için "").
    """

    model_config = ConfigDict(extra="forbid")

    # Kişisel
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=20)
    department: str | None = Field(None, max_length=100)
    job_title: str | None = Field(None, max_length=100)
    # Genişletilmiş profil
    bio: str | None = Field(None, max_length=500)
    birth_date: _date_type | None = None
    location: str | None = Field(None, max_length=100)
    website_url: str | None = Field(None, max_length=255)
    linkedin_url: str | None = Field(None, max_length=255)
    twitter_url: str | None = Field(None, max_length=255)
    github_url: str | None = Field(None, max_length=255)
    instagram_url: str | None = Field(None, max_length=255)


class ChangePasswordRequest(BaseModel):
    """Kullanıcının kendi şifresini değiştirmek için.

    Mevcut şifre doğrulanmadan yeni şifre kabul edilmez. Başarılı olunca
    tüm aktif refresh token'lar revoke edilir; kullanıcı yeniden login olur.
    """

    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class ChangePasswordResponse(BaseModel):
    success: bool = True


class AvatarResponse(BaseModel):
    avatar_url: str | None
