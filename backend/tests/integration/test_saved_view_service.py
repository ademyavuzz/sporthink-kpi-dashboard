"""Integration testleri — `saved_view_service` HTTP üzerinden.

SavedView kayıtları kullanıcıya özeldir: bir kullanıcı kendisine ait olmayan
view'a erişemez (varlığını sızdırmamak için 404 — 403 değil).

Tek bir test session'ında süper admin login kullanılıyor; başka kullanıcı
fixture'ı şu an yok, bu yüzden "diğer kullanıcı view'ı 404" senaryosu
manuel id manipülasyonuyla simüle ediliyor (gerçekte mevcut olmayan id).
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import delete

from app.db.session import AsyncSessionLocal
from app.models import SavedView

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]

BASE = "/api/v1/saved-views"


async def _auth_headers(client: AsyncClient, creds: dict[str, str]) -> dict[str, str]:
    r = await client.post("/api/v1/auth/login", json=creds)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


async def _cleanup(ids: list[int]) -> None:
    if not ids:
        return
    async with AsyncSessionLocal() as db:
        await db.execute(delete(SavedView).where(SavedView.id.in_(ids)))
        await db.commit()


# ─── Happy path: full CRUD ─────────────────────────────────────────────────


async def test_saved_view_full_crud_roundtrip(
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
                "page": "overview",
                "name": "Test view (integration)",
                "description": "yaratıldı",
                "filters": {"date_from": "2024-01-01", "date_to": "2024-12-31"},
                "is_default": False,
            },
        )
        assert create_r.status_code == 200
        sv = create_r.json()["data"]
        assert sv["page"] == "overview"
        assert sv["name"] == "Test view (integration)"
        assert sv["filters"]["date_from"] == "2024-01-01"
        created_ids.append(sv["id"])

        # LIST (page filter) — sadece overview page görünmeli
        list_r = await client.get(f"{BASE}?page=overview", headers=headers)
        assert list_r.status_code == 200
        assert any(v["id"] == sv["id"] for v in list_r.json()["data"])

        # LIST (başka page) — bizim view burada olmamalı
        other_r = await client.get(f"{BASE}?page=traffic", headers=headers)
        assert other_r.status_code == 200
        assert all(v["id"] != sv["id"] for v in other_r.json()["data"])

        # UPDATE — name + is_default değişir
        update_r = await client.patch(
            f"{BASE}/{sv['id']}",
            headers=headers,
            json={"name": "Renamed view", "is_default": True},
        )
        assert update_r.status_code == 200
        updated = update_r.json()["data"]
        assert updated["name"] == "Renamed view"
        assert updated["is_default"] is True
        # Filters değişmediği için olduğu gibi kalmalı
        assert updated["filters"]["date_from"] == "2024-01-01"

        # DELETE
        del_r = await client.delete(f"{BASE}/{sv['id']}", headers=headers)
        assert del_r.status_code == 200

        # Tekrar GET ile listede olmamalı
        list_after = await client.get(f"{BASE}?page=overview", headers=headers)
        assert all(v["id"] != sv["id"] for v in list_after.json()["data"])
    finally:
        await _cleanup(created_ids)


# ─── Ownership: başkasının view'ı 404 döner (sızdırma yok) ─────────────────


async def test_saved_view_update_nonexistent_returns_404(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    """Olmayan view ID için update → 404, varlık sızıntısı yok."""
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.patch(
        f"{BASE}/999999999",
        headers=headers,
        json={"name": "Won't work"},
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert r.json()["error"]["params"]["view_id"] == 999999999


async def test_saved_view_delete_nonexistent_returns_404(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.delete(f"{BASE}/999999999", headers=headers)
    assert r.status_code == 404


# ─── Auth ──────────────────────────────────────────────────────────────────


async def test_saved_view_list_requires_auth(client: AsyncClient) -> None:
    r = await client.get(BASE)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "AUTH_REQUIRED"


# ─── Validation ────────────────────────────────────────────────────────────


async def test_saved_view_create_missing_required_field_returns_422(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    # `page` ve `filters` zorunlu — eksik
    r = await client.post(
        BASE,
        headers=headers,
        json={"name": "Only name"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
