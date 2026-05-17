"""Integration testleri — `channel_mapping_service` HTTP üzerinden.

Service'in CRUD davranışını `/api/v1/admin/channel-mappings` endpoint'leri
üzerinden doğrular. Test sonunda kendi yarattığı kaydı temizler (envelope
+ cache invalidation kontrolü dahil).

CLAUDE.md §16.2 — happy + auth + validation + not_found minimum şart.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import delete

from app.db.session import AsyncSessionLocal
from app.models import ChannelMapping

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]

BASE = "/api/v1/admin/channel-mappings"


async def _login(client: AsyncClient, creds: dict[str, str]) -> str:
    """Süper admin ile login olup access token döner."""
    r = await client.post("/api/v1/auth/login", json=creds)
    assert r.status_code == 200
    return r.json()["data"]["access_token"]


async def _auth_headers(client: AsyncClient, creds: dict[str, str]) -> dict[str, str]:
    token = await _login(client, creds)
    return {"Authorization": f"Bearer {token}"}


async def _cleanup_created(rows_ids: list[int]) -> None:
    """Test kayıtlarını DB'den hard-delete eder (soft delete'i bypass).
    Idempotent; test başarısız olursa bile sonraki run temiz olsun."""
    if not rows_ids:
        return
    async with AsyncSessionLocal() as db:
        await db.execute(delete(ChannelMapping).where(ChannelMapping.id.in_(rows_ids)))
        await db.commit()


# ─── Happy path: full CRUD round-trip ──────────────────────────────────────


async def test_channel_mapping_full_crud_roundtrip(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    created_ids: list[int] = []
    try:
        # CREATE
        create_r = await client.post(
            BASE,
            headers=headers,
            json={
                "source": "test_source_unit",
                "medium": "test_medium",
                "channel_group": "Test Channel",
                "notes": "created by integration test",
            },
        )
        assert create_r.status_code == 200
        body = create_r.json()
        assert body["success"] is True
        created = body["data"]
        assert created["source"] == "test_source_unit"
        assert created["channel_group"] == "Test Channel"
        assert created["notes"] == "created by integration test"
        created_ids.append(created["id"])

        # LIST içinde görünmeli
        list_r = await client.get(BASE, headers=headers)
        assert list_r.status_code == 200
        ids_in_list = {m["id"] for m in list_r.json()["data"]}
        assert created["id"] in ids_in_list

        # UPDATE — sadece channel_group + notes değişir, source/medium aynı kalır
        update_r = await client.patch(
            f"{BASE}/{created['id']}",
            headers=headers,
            json={"channel_group": "Renamed Channel", "notes": "updated"},
        )
        assert update_r.status_code == 200
        updated = update_r.json()["data"]
        assert updated["channel_group"] == "Renamed Channel"
        assert updated["notes"] == "updated"
        assert updated["source"] == "test_source_unit"  # değişmemeli

        # DELETE
        del_r = await client.delete(f"{BASE}/{created['id']}", headers=headers)
        assert del_r.status_code == 200
        assert del_r.json()["data"]["deleted"] is True

        # Tekrar DELETE → 404 (soft-deleted artık erişilemez)
        del_again_r = await client.delete(f"{BASE}/{created['id']}", headers=headers)
        assert del_again_r.status_code == 404
        assert del_again_r.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
    finally:
        await _cleanup_created(created_ids)


# ─── Not found ─────────────────────────────────────────────────────────────


async def test_channel_mapping_update_404_returns_envelope(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.patch(
        f"{BASE}/999999999",
        headers=headers,
        json={"channel_group": "Nope"},
    )
    assert r.status_code == 404
    body = r.json()
    assert body["success"] is False
    assert body["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert body["error"]["params"]["mapping_id"] == 999999999


async def test_channel_mapping_delete_404_returns_envelope(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.delete(f"{BASE}/999999999", headers=headers)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "RESOURCE_NOT_FOUND"


# ─── Auth ──────────────────────────────────────────────────────────────────


async def test_channel_mapping_list_requires_auth(client: AsyncClient) -> None:
    r = await client.get(BASE)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "AUTH_REQUIRED"


# ─── Validation ────────────────────────────────────────────────────────────


async def test_channel_mapping_create_missing_field_returns_422(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    # `channel_group` zorunlu — payload'dan eksik
    r = await client.post(
        BASE,
        headers=headers,
        json={"source": "x", "medium": "y"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
