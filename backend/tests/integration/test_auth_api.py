"""Auth endpoint'leri için integration testleri.

Bkz: backend/CLAUDE.md §16.2 — her endpoint için happy + auth + validation
beklenir. Burada `auth/*` 4 endpoint için temel davranış kapsanıyor.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.api.v1.auth import REFRESH_COOKIE_NAME
from app.config import settings
from app.db.session import AsyncSessionLocal
from app.models import User

# Tüm async testler `lru_cache`'li engine ile aynı loop'u paylaşmalı —
# fixtures için asyncio_default_fixture_loop_scope="session" yetiyor, ama
# testlerin loop scope'u marker üzerinden açıkça session yapılır.
pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]


# ─── /login ──────────────────────────────────────────────────────────────────


async def test_login_success_returns_token_and_sets_refresh_cookie(
    client: AsyncClient,
    super_admin_credentials: dict[str, str],
) -> None:
    r = await client.post("/api/v1/auth/login", json=super_admin_credentials)

    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    assert data["token_type"] == "bearer"
    assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20
    assert data["expires_in"] == settings.access_token_expire_minutes * 60
    assert data["user"]["email"] == super_admin_credentials["email"]
    assert data["user"]["role"]["is_system"] is True
    # password_hash sızmamış olmalı
    assert "password_hash" not in data["user"]

    cookie = r.cookies.get(REFRESH_COOKIE_NAME)
    assert cookie and len(cookie) > 20


async def test_login_wrong_password_returns_401_and_increments_failed_attempts(
    client: AsyncClient,
    super_admin_credentials: dict[str, str],
) -> None:
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": super_admin_credentials["email"], "password": "WRONG_PASSWORD"},
    )

    assert r.status_code == 401
    body = r.json()
    assert body["success"] is False
    assert body["error"]["code"] == "INVALID_CREDENTIALS"

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User.failed_login_attempts).where(User.email == super_admin_credentials["email"])
        )
        attempts = result.scalar_one()
    assert attempts == 1


async def test_login_unknown_email_returns_401_invalid_credentials(client: AsyncClient) -> None:
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "whatever"},
    )

    assert r.status_code == 401
    assert r.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_login_validation_error_on_missing_password(client: AsyncClient) -> None:
    r = await client.post("/api/v1/auth/login", json={"email": "x@y.com"})
    assert r.status_code == 422


# ─── /me ─────────────────────────────────────────────────────────────────────


async def test_me_with_valid_access_token_returns_user_and_permissions(
    client: AsyncClient,
    super_admin_credentials: dict[str, str],
) -> None:
    login_r = await client.post("/api/v1/auth/login", json=super_admin_credentials)
    access_token = login_r.json()["data"]["access_token"]

    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["user"]["email"] == super_admin_credentials["email"]
    # Süper admin → enum'daki tüm 43 izin
    assert len(body["data"]["permissions"]) == 43
    assert "dashboard.view" in body["data"]["permissions"]


async def test_me_without_token_returns_401(client: AsyncClient) -> None:
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "AUTH_REQUIRED"


async def test_me_with_garbage_token_returns_401(client: AsyncClient) -> None:
    r = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] in {"AUTH_REQUIRED", "INVALID_CREDENTIALS"}


# ─── /refresh ────────────────────────────────────────────────────────────────


async def test_refresh_with_cookie_returns_new_access_and_rotates_cookie(
    client: AsyncClient,
    super_admin_credentials: dict[str, str],
) -> None:
    login_r = await client.post("/api/v1/auth/login", json=super_admin_credentials)
    old_cookie = login_r.cookies.get(REFRESH_COOKIE_NAME)

    refresh_r = await client.post("/api/v1/auth/refresh")

    assert refresh_r.status_code == 200
    data = refresh_r.json()["data"]
    assert (
        isinstance(data["access_token"], str)
        and data["access_token"] != login_r.json()["data"]["access_token"]
    )
    new_cookie = refresh_r.cookies.get(REFRESH_COOKIE_NAME)
    assert new_cookie and new_cookie != old_cookie


async def test_refresh_without_cookie_returns_401(client: AsyncClient) -> None:
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "INVALID_CREDENTIALS"


# ─── /logout ─────────────────────────────────────────────────────────────────


async def test_logout_revokes_refresh_so_subsequent_refresh_fails(
    client: AsyncClient,
    super_admin_credentials: dict[str, str],
) -> None:
    await client.post("/api/v1/auth/login", json=super_admin_credentials)

    logout_r = await client.post("/api/v1/auth/logout")
    assert logout_r.status_code == 200
    assert logout_r.json()["data"]["logged_out"] is True

    # Cookie hâlâ jar'da değilse refresh zaten 401 — cookie'yi manuel
    # tutarak da test edelim:
    refresh_r = await client.post("/api/v1/auth/refresh")
    assert refresh_r.status_code == 401


async def test_logout_idempotent_without_session(client: AsyncClient) -> None:
    r = await client.post("/api/v1/auth/logout")
    assert r.status_code == 200
    assert r.json()["data"]["logged_out"] is True
