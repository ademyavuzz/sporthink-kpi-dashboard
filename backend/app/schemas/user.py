"""Kullanıcı API contract'ı.

Bkz: backend/CLAUDE.md §4 (Model vs Schema Disiplini).
ORM model'i (`app.models.User`) doğrudan response'a dönülmez; bu modüldeki
`UserResponse` üzerinden serialize edilir (parola hash'i sızmaz).
"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class RoleSummary(BaseModel):
    """Response'larda nested gösterilen küçük rol özeti."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str | None = None
    is_system: bool


class UserResponse(BaseModel):
    """Genel kullanım: liste, detay, /me."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: str | None = None
    department: str | None = None
    job_title: str | None = None
    avatar_url: str | None = None

    # Genişletilmiş profil alanları
    bio: str | None = None
    birth_date: date | None = None
    location: str | None = None
    website_url: str | None = None
    linkedin_url: str | None = None
    twitter_url: str | None = None
    github_url: str | None = None
    instagram_url: str | None = None

    is_active: bool
    last_login_at: datetime | None = None

    role: RoleSummary | None = None


class MeResponse(BaseModel):
    """`GET /api/v1/auth/me` — user + permission listesi.

    Permission listesi süper admin için tüm izinleri içerir (frontend UX
    kontrolü için). Asıl güvenlik backend'de `require_permission` ile yapılır.
    """

    user: UserResponse
    permissions: list[str]
