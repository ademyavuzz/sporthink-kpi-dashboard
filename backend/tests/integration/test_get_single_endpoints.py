"""Yeni `GET /{resource}/{id}` endpoint'leri için regresyon koruması.

Audit raporundaki Bulgu #3: bu 4 endpoint eskiden yoktu (405 dönüyordu).
Eklenen endpoint'ler:
- GET /admin/channel-mappings/{mapping_id}
- GET /segments/{segment_id}
- GET /saved-views/{view_id}
- GET /users/{user_id}

Her biri için: happy path + 404 + auth gate.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import delete

from app.db.session import AsyncSessionLocal
from app.models import ChannelMapping, SavedView, Segment

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]


async def _auth_headers(client: AsyncClient, creds: dict[str, str]) -> dict[str, str]:
    r = await client.post("/api/v1/auth/login", json=creds)
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


# ─── /admin/channel-mappings/{id} ──────────────────────────────────────────


async def test_get_channel_mapping_happy(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    # Create one to fetch
    create_r = await client.post(
        "/api/v1/admin/channel-mappings",
        headers=headers,
        json={"source": "get_test", "medium": "m", "channel_group": "G"},
    )
    cm_id = create_r.json()["data"]["id"]
    try:
        r = await client.get(f"/api/v1/admin/channel-mappings/{cm_id}", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["data"]["id"] == cm_id
        assert body["data"]["source"] == "get_test"
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(ChannelMapping).where(ChannelMapping.id == cm_id))
            await db.commit()


async def test_get_channel_mapping_404(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.get("/api/v1/admin/channel-mappings/9999999", headers=headers)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert r.json()["error"]["params"]["mapping_id"] == 9999999


# ─── /segments/{id} ────────────────────────────────────────────────────────


async def test_get_segment_happy(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    create_r = await client.post(
        "/api/v1/segments",
        headers=headers,
        json={
            "name": "get-test-seg",
            "rules": {"op": "AND", "rules": [{"field": "total_orders", "op": ">=", "value": 1}]},
            "is_shared": False,
        },
    )
    seg_id = create_r.json()["data"]["id"]
    try:
        r = await client.get(f"/api/v1/segments/{seg_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["id"] == seg_id
        assert r.json()["data"]["name"] == "get-test-seg"
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Segment).where(Segment.id == seg_id))
            await db.commit()


async def test_get_segment_404(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.get("/api/v1/segments/9999999", headers=headers)
    assert r.status_code == 404
    assert r.json()["error"]["params"]["segment_id"] == 9999999


# ─── /saved-views/{id} ─────────────────────────────────────────────────────


async def test_get_saved_view_happy(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    create_r = await client.post(
        "/api/v1/saved-views",
        headers=headers,
        json={"page": "overview", "name": "get-view", "filters": {"a": 1}, "is_default": False},
    )
    view_id = create_r.json()["data"]["id"]
    try:
        r = await client.get(f"/api/v1/saved-views/{view_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "get-view"
        assert r.json()["data"]["filters"] == {"a": 1}
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(SavedView).where(SavedView.id == view_id))
            await db.commit()


async def test_get_saved_view_404_for_nonexistent_or_other_user(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.get("/api/v1/saved-views/9999999", headers=headers)
    assert r.status_code == 404
    assert r.json()["error"]["params"]["view_id"] == 9999999


# ─── /users/{id} ───────────────────────────────────────────────────────────


async def test_get_user_happy(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    # Süper admin ID 1 — kendi kaydını çekiyoruz
    r = await client.get("/api/v1/users/1", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["id"] == 1
    assert body["data"]["email"] == super_admin_credentials["email"]
    assert body["data"]["role"]["is_system"] is True


async def test_get_user_404(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.get("/api/v1/users/9999999", headers=headers)
    assert r.status_code == 404
    assert r.json()["error"]["params"]["user_id"] == 9999999


# ─── Auth gate ─────────────────────────────────────────────────────────────


async def test_all_single_get_endpoints_require_auth(client: AsyncClient) -> None:
    for url in (
        "/api/v1/admin/channel-mappings/1",
        "/api/v1/segments/1",
        "/api/v1/saved-views/1",
        "/api/v1/users/1",
    ):
        r = await client.get(url)
        assert r.status_code == 401, f"{url} did not return 401"
        assert r.json()["error"]["code"] == "AUTH_REQUIRED"
