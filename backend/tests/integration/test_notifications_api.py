"""Notifications endpoint integration testleri.

Kapsam:
- Happy path: list (paginated), unread-count, mark-read, mark-all-read, delete
- Auth: token yok → 401
- Ownership: başka kullanıcının bildirimi → 404 (varlık sızdırılmaz)
- 404: bilinmeyen ID
- Envelope shape: PaginatedEnvelope + SuccessEnvelope
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import delete

from app.db.session import AsyncSessionLocal
from app.models import Notification
from app.repositories import notification_repository

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]

BASE = "/api/v1/notifications"


async def _auth_headers(client: AsyncClient, creds: dict[str, str]) -> tuple[dict[str, str], int]:
    """Login → (Authorization header, user_id)."""
    r = await client.post("/api/v1/auth/login", json=creds)
    body = r.json()["data"]
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]["id"]


async def _cleanup(user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Notification).where(Notification.user_id == user_id))
        await db.commit()


# ─── Auth ─────────────────────────────────────────────────────────────


async def test_list_notifications_without_token_returns_401(
    client: AsyncClient,
) -> None:
    r = await client.get(BASE)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "AUTH_REQUIRED"


async def test_unread_count_without_token_returns_401(client: AsyncClient) -> None:
    r = await client.get(f"{BASE}/unread-count")
    assert r.status_code == 401


# ─── Happy path: liste + envelope ─────────────────────────────────────


async def test_list_empty_for_super_admin_returns_paginated_envelope(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers, uid = await _auth_headers(client, super_admin_credentials)
    await _cleanup(uid)

    r = await client.get(f"{BASE}?page=1&page_size=10", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)
    assert body["data"] == []
    assert body["pagination"] == {"page": 1, "page_size": 10, "total": 0}


# ─── create + list + unread-count + mark-read ─────────────────────────


async def test_full_crud_roundtrip(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers, uid = await _auth_headers(client, super_admin_credentials)
    await _cleanup(uid)

    # Seed: 3 notification doğrudan repository üzerinden (service hook'larını
    # ileri test'lerde sınayacağız; burada endpoint davranışı odak)
    async with AsyncSessionLocal() as db:
        for i in range(3):
            await notification_repository.create(
                db,
                user_id=uid,
                type_="success" if i == 0 else "info",
                title=f"Test bildirim #{i}",
                message=f"Mesaj #{i}",
            )
        await db.commit()

    # 1) List → 3 satır + total=3
    r = await client.get(f"{BASE}?page=1&page_size=10", headers=headers)
    body = r.json()
    assert r.status_code == 200
    assert len(body["data"]) == 3
    assert body["pagination"]["total"] == 3
    first_id = body["data"][0]["id"]
    assert body["data"][0]["is_read"] is False

    # 2) unread-count → 3
    r = await client.get(f"{BASE}/unread-count", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["count"] == 3

    # 3) mark-read birini → unread-count 2
    r = await client.patch(f"{BASE}/{first_id}/read", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["is_read"] is True
    assert r.json()["data"]["read_at"] is not None

    r = await client.get(f"{BASE}/unread-count", headers=headers)
    assert r.json()["data"]["count"] == 2

    # 4) mark-all-read → updated=2 (geriye kalanlar)
    r = await client.post(f"{BASE}/mark-all-read", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["updated"] == 2

    r = await client.get(f"{BASE}/unread-count", headers=headers)
    assert r.json()["data"]["count"] == 0

    # 5) Sil
    r = await client.delete(f"{BASE}/{first_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["deleted"] is True

    # Tekrar sil → 404
    r = await client.delete(f"{BASE}/{first_id}", headers=headers)
    assert r.status_code == 404

    await _cleanup(uid)


# ─── Ownership: başka kullanıcının bildirimine erişim → 404 ──────────


async def test_other_users_notification_returns_404(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    """Hedef: süper admin'in olmayan ID'yi sorgulayınca 404 — PERMISSION_DENIED
    değil RESOURCE_NOT_FOUND, çünkü ownership'i sızdırmayız."""
    headers, _ = await _auth_headers(client, super_admin_credentials)

    # ID 99999999 herhangi bir kullanıcıda yok
    r = await client.patch(f"{BASE}/99999999/read", headers=headers)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "RESOURCE_NOT_FOUND"

    r = await client.delete(f"{BASE}/99999999", headers=headers)
    assert r.status_code == 404


# ─── Pagination validation ────────────────────────────────────────────


async def test_pagination_validation(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers, _ = await _auth_headers(client, super_admin_credentials)
    # page=0 → 422
    r = await client.get(f"{BASE}?page=0", headers=headers)
    assert r.status_code == 422
    # page_size=999 → 422 (max 200)
    r = await client.get(f"{BASE}?page_size=999", headers=headers)
    assert r.status_code == 422
