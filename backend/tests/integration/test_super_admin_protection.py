"""Pattern C — Super Admin invariant koruması (≥1 aktif Super Admin).

Test stratejisi:
- "Peer" senaryolar: geçici Super Admin oluştur, üzerinde işlem yap, hard-delete et.
- "Son admin" senaryolar: tüm diğer aktif Super Admin'leri test boyunca geçici
  olarak pasifleştir, sonunda restore et (try/finally garantili).
- Notification testleri: bildirim satırlarını sayar, sonunda temizler.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select, update
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.exceptions import LastSuperAdminError, SelfDestructiveActionError
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models import Notification, Role, User
from app.services import user_management_service as svc

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


async def _auth_headers(client: AsyncClient, creds: dict[str, str]) -> dict[str, str]:
    r = await client.post("/api/v1/auth/login", json=creds)
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


async def _super_admin_role_id() -> int:
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(Role.id).where(Role.is_system.is_(True)))
        return int(r.scalar_one())


async def _non_system_role_id() -> int:
    """İlk non-system rolün id'si — yoksa tek seferlik oluştur."""
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            select(Role.id).where(Role.is_system.is_(False)).order_by(Role.id).limit(1)
        )
        rid = r.scalar_one_or_none()
        if rid is not None:
            return int(rid)
        role = Role(name="test_viewer", description="test", is_system=False)
        db.add(role)
        await db.commit()
        return role.id


async def _create_user(*, email: str, role_id: int, is_active: bool = True) -> int:
    async with AsyncSessionLocal() as db:
        u = User(
            email=email,
            password_hash=hash_password("Test1234!Strong"),
            first_name="Test",
            last_name="User",
            role_id=role_id,
            is_active=is_active,
        )
        db.add(u)
        await db.commit()
        return u.id


async def _purge_user(user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Notification).where(Notification.user_id == user_id))
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()


async def _get_seed_admin() -> User:
    email = settings.super_admin_email.lower().strip()
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            select(User).options(selectinload(User.role)).where(User.email == email)
        )
        return r.scalar_one()


async def _ids_of_other_active_super_admins(except_id: int) -> list[int]:
    async with AsyncSessionLocal() as db:
        r = await db.execute(
            select(User.id)
            .join(Role, Role.id == User.role_id)
            .where(
                Role.is_system.is_(True),
                User.is_active.is_(True),
                User.deleted_at.is_(None),
                User.id != except_id,
            )
        )
        return [row[0] for row in r.all()]


async def _set_users_active(user_ids: list[int], active: bool) -> None:
    if not user_ids:
        return
    async with AsyncSessionLocal() as db:
        await db.execute(update(User).where(User.id.in_(user_ids)).values(is_active=active))
        await db.commit()


# --------------------------------------------------------------------------- #
# Count endpoint
# --------------------------------------------------------------------------- #


async def test_super_admin_count_endpoint_happy(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    headers = await _auth_headers(client, super_admin_credentials)
    r = await client.get("/api/v1/users/super-admins/count", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert isinstance(body["data"]["count"], int)
    assert body["data"]["count"] >= 1  # seed SA en az


async def test_super_admin_count_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/v1/users/super-admins/count")
    assert r.status_code == 401


# --------------------------------------------------------------------------- #
# Delete — peer & last
# --------------------------------------------------------------------------- #


async def test_can_delete_peer_super_admin(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    sa_role = await _super_admin_role_id()
    tmp_id = await _create_user(
        email=f"tmp_sa_peer_{uuid.uuid4().hex[:8]}@test.local", role_id=sa_role
    )
    try:
        headers = await _auth_headers(client, super_admin_credentials)
        r = await client.delete(f"/api/v1/users/{tmp_id}", headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["data"]["deleted"] is True
    finally:
        await _purge_user(tmp_id)


async def test_cannot_delete_last_super_admin() -> None:
    """Bir non-SA peer actor (yetki sahibi varsay), son aktif SA'yı silmek istesin."""
    seed = await _get_seed_admin()
    viewer_role = await _non_system_role_id()
    actor_id = await _create_user(
        email=f"actor_del_{uuid.uuid4().hex[:8]}@test.local", role_id=viewer_role
    )
    other_ids = await _ids_of_other_active_super_admins(except_id=seed.id)
    await _set_users_active(other_ids, False)
    try:
        async with AsyncSessionLocal() as db:
            actor = await db.get(User, actor_id)
            with pytest.raises(LastSuperAdminError) as excinfo:
                await svc.soft_delete_user(db, seed.id, actor=actor)
        assert excinfo.value.code == "LAST_SUPER_ADMIN"
        assert excinfo.value.status_code == 422
    finally:
        await _set_users_active(other_ids, True)
        await _purge_user(actor_id)


# --------------------------------------------------------------------------- #
# Demote (role change) — peer & last
# --------------------------------------------------------------------------- #


async def test_can_demote_peer_super_admin(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    sa_role = await _super_admin_role_id()
    viewer_role = await _non_system_role_id()
    tmp_id = await _create_user(
        email=f"tmp_sa_demote_{uuid.uuid4().hex[:8]}@test.local", role_id=sa_role
    )
    try:
        headers = await _auth_headers(client, super_admin_credentials)
        r = await client.patch(
            f"/api/v1/users/{tmp_id}",
            headers=headers,
            json={"role_id": viewer_role},
        )
        assert r.status_code == 200, r.text
        assert r.json()["data"]["role_id"] == viewer_role
    finally:
        await _purge_user(tmp_id)


async def test_cannot_demote_last_super_admin() -> None:
    seed = await _get_seed_admin()
    viewer_role = await _non_system_role_id()
    actor_id = await _create_user(
        email=f"actor_dem_{uuid.uuid4().hex[:8]}@test.local", role_id=viewer_role
    )
    other_ids = await _ids_of_other_active_super_admins(except_id=seed.id)
    await _set_users_active(other_ids, False)
    try:
        async with AsyncSessionLocal() as db:
            actor = await db.get(User, actor_id)
            with pytest.raises(LastSuperAdminError):
                await svc.update_user(db, seed.id, role_id=viewer_role, actor=actor)
    finally:
        await _set_users_active(other_ids, True)
        await _purge_user(actor_id)


async def test_cannot_deactivate_last_super_admin() -> None:
    seed = await _get_seed_admin()
    viewer_role = await _non_system_role_id()
    actor_id = await _create_user(
        email=f"actor_act_{uuid.uuid4().hex[:8]}@test.local", role_id=viewer_role
    )
    other_ids = await _ids_of_other_active_super_admins(except_id=seed.id)
    await _set_users_active(other_ids, False)
    try:
        async with AsyncSessionLocal() as db:
            actor = await db.get(User, actor_id)
            with pytest.raises(LastSuperAdminError):
                await svc.update_user(db, seed.id, is_active=False, actor=actor)
    finally:
        await _set_users_active(other_ids, True)
        await _purge_user(actor_id)


# --------------------------------------------------------------------------- #
# Peer model — self-action forbidden (Pattern A)
# --------------------------------------------------------------------------- #


async def test_cannot_self_delete() -> None:
    """Kullanıcı kendi hesabını admin panelinden silemez (peer model)."""
    seed = await _get_seed_admin()
    async with AsyncSessionLocal() as db:
        with pytest.raises(SelfDestructiveActionError) as excinfo:
            await svc.soft_delete_user(db, seed.id, actor=seed)
    assert excinfo.value.code == "SELF_DESTRUCTIVE_ACTION_FORBIDDEN"
    assert excinfo.value.status_code == 422


async def test_cannot_self_demote() -> None:
    seed = await _get_seed_admin()
    viewer_role = await _non_system_role_id()
    async with AsyncSessionLocal() as db:
        with pytest.raises(SelfDestructiveActionError):
            await svc.update_user(db, seed.id, role_id=viewer_role, actor=seed)


async def test_cannot_self_deactivate() -> None:
    seed = await _get_seed_admin()
    async with AsyncSessionLocal() as db:
        with pytest.raises(SelfDestructiveActionError):
            await svc.update_user(db, seed.id, is_active=False, actor=seed)


async def test_can_self_update_name() -> None:
    """Self-action yasağı sadece destructive eylemler için — isim değiştirme serbest."""
    seed = await _get_seed_admin()
    async with AsyncSessionLocal() as db:
        new_first = f"Test{uuid.uuid4().hex[:4]}"
        try:
            updated = await svc.update_user(db, seed.id, first_name=new_first, actor=seed)
            assert updated.first_name == new_first
        finally:
            # Restore
            await svc.update_user(db, seed.id, first_name=seed.first_name, actor=seed)


async def test_can_delete_peer_with_non_sa_actor(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    """Sanity: peer silme (actor != target) hâlâ çalışıyor — regression koruması."""
    sa_role = await _super_admin_role_id()
    tmp_id = await _create_user(
        email=f"tmp_peer_actor_{uuid.uuid4().hex[:8]}@test.local", role_id=sa_role
    )
    try:
        headers = await _auth_headers(client, super_admin_credentials)
        r = await client.delete(f"/api/v1/users/{tmp_id}", headers=headers)
        assert r.status_code == 200, r.text
    finally:
        await _purge_user(tmp_id)


# --------------------------------------------------------------------------- #
# Notifications
# --------------------------------------------------------------------------- #


async def test_other_super_admins_get_notification_on_delete(
    client: AsyncClient, super_admin_credentials: dict[str, str]
) -> None:
    """Bir Super Admin silindiğinde, diğer Super Admin'ler bildirim alır."""
    sa_role = await _super_admin_role_id()

    # İki tane temp SA: biri silinecek, biri bildirimi alacak
    target_id = await _create_user(
        email=f"tmp_sa_target_{uuid.uuid4().hex[:8]}@test.local", role_id=sa_role
    )
    recipient_id = await _create_user(
        email=f"tmp_sa_recv_{uuid.uuid4().hex[:8]}@test.local", role_id=sa_role
    )

    # Bildirimleri baseline
    async with AsyncSessionLocal() as db:
        before = (
            (await db.execute(select(Notification).where(Notification.user_id == recipient_id)))
            .scalars()
            .all()
        )
        before_ids = {n.id for n in before}

    try:
        headers = await _auth_headers(client, super_admin_credentials)
        r = await client.delete(f"/api/v1/users/{target_id}", headers=headers)
        assert r.status_code == 200, r.text

        async with AsyncSessionLocal() as db:
            after = (
                (await db.execute(select(Notification).where(Notification.user_id == recipient_id)))
                .scalars()
                .all()
            )
        new_notifs = [n for n in after if n.id not in before_ids]
        assert len(new_notifs) >= 1, "Recipient SA should receive notification"
        assert any("Süper Admin" in n.title for n in new_notifs)
    finally:
        await _purge_user(target_id)
        await _purge_user(recipient_id)
