"""Audit raporundaki #4, #5, #6 düzeltmeleri için regresyon testleri.

- #4: campaign-detail olmayan campaign_pk_id → 404 (eskiden 200 + boş)
- #5: LoginRequest.email malformed → 422 (eskiden 401 INVALID_CREDENTIALS)
- #6: Refresh cookie yok → REFRESH_TOKEN_MISSING (eskiden INVALID_CREDENTIALS)
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]


async def _auth_headers(client: AsyncClient, creds: dict[str, str]) -> dict[str, str]:
    r = await client.post("/api/v1/auth/login", json=creds)
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


# ─── #4: campaign-detail 404 ──────────────────────────────────────────────


async def test_campaign_detail_unknown_pk_returns_404(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.get(
        "/api/v1/dashboard/campaign-detail",
        params={
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "campaign_pk_id": 9999999,
        },
        headers=headers,
    )
    assert r.status_code == 404
    body = r.json()
    assert body["success"] is False
    assert body["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert body["error"]["params"]["campaign_pk_id"] == 9999999


async def test_campaign_detail_unknown_name_returns_404(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.get(
        "/api/v1/dashboard/campaign-detail",
        params={
            "date_from": "2024-01-01",
            "date_to": "2024-12-31",
            "campaign_name": "this-campaign-does-not-exist-xyz",
        },
        headers=headers,
    )
    assert r.status_code == 404
    assert r.json()["error"]["params"]["campaign_name"] == "this-campaign-does-not-exist-xyz"


# ─── #5: LoginRequest email format → 422 ──────────────────────────────────


async def test_login_malformed_email_returns_422(client: AsyncClient) -> None:
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "not-an-email", "password": "whatever"},
    )
    # Eskiden 401 INVALID_CREDENTIALS dönüyordu (DB lookup fail eden generic 401).
    # Artık Pydantic katmanında erken yakalıyor → 422 + field=email.
    assert r.status_code == 422
    body = r.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["field"] == "email"


async def test_login_valid_email_format_but_unknown_user_still_returns_401(
    client: AsyncClient,
) -> None:
    """Format OK ama kullanıcı yok → 401 (enumeration koruması, davranış değişmedi)."""
    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody-xyz@example.com", "password": "whatever"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "INVALID_CREDENTIALS"


# ─── #6: Refresh cookie missing → REFRESH_TOKEN_MISSING ───────────────────


async def test_refresh_without_cookie_returns_specific_code(client: AsyncClient) -> None:
    r = await client.post("/api/v1/auth/refresh")
    assert r.status_code == 401
    # Eskiden INVALID_CREDENTIALS — şimdi semantik olarak ayrıştırıldı.
    assert r.json()["error"]["code"] == "REFRESH_TOKEN_MISSING"
