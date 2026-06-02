"""Re-invite akışı: soft-deleted bir kullanıcı aynı email ile tekrar davet edilince
EMAIL_ALREADY_EXISTS (409) yerine kayıt reaktive edilmeli (idempotent).

Aktif bir kullanıcıda email gerçekten varsa 409 EMAIL_ALREADY_EXISTS doğru kalır.

Celery email task'ı broker bağımlılığı yaratmamak için patch'lenir.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import delete, select

from app.core.exceptions import EmailAlreadyExistsError
from app.db.session import AsyncSessionLocal
from app.models import Notification, PasswordResetToken, Role, User
from app.services import user_management_service as svc

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio(loop_scope="session"),
]


@pytest.fixture(autouse=True)
def _no_broker(monkeypatch: pytest.MonkeyPatch) -> None:
    """Davet maili Celery task'ını no-op'a indir — testler broker'sız çalışır."""
    from app.tasks import email_tasks

    monkeypatch.setattr(email_tasks.send_invitation_email, "delay", lambda **_: None)


async def _non_system_role_id() -> int:
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


async def _make_actor(role_id: int) -> int:
    async with AsyncSessionLocal() as db:
        actor = User(
            email=f"actor_reinv_{uuid.uuid4().hex[:8]}@test.local",
            password_hash="x" * 60,
            first_name="Actor",
            last_name="Admin",
            role_id=role_id,
            is_active=True,
        )
        db.add(actor)
        await db.commit()
        return actor.id


async def _purge_user(user_id: int) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Notification).where(Notification.user_id == user_id))
        await db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id))
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()


async def test_reinvite_reactivates_soft_deleted_user() -> None:
    """Soft-deleted kullanıcı aynı email ile davet edilince reaktive edilmeli."""
    role_id = await _non_system_role_id()
    actor_id = await _make_actor(role_id)
    email = f"reinvite_{uuid.uuid4().hex[:8]}@test.local"
    created_id: int | None = None
    try:
        async with AsyncSessionLocal() as db:
            actor = await db.get(User, actor_id)
            assert actor is not None

            # 1) İlk davet
            user = await svc.create_user(
                db,
                email=email,
                first_name="First",
                last_name="Invite",
                role_id=role_id,
                actor=actor,
            )
            created_id = user.id

            # 2) Soft-delete
            await svc.soft_delete_user(db, created_id, actor=actor)

        async with AsyncSessionLocal() as db:
            deleted = await db.get(User, created_id)
            assert deleted is not None
            assert deleted.deleted_at is not None
            assert deleted.is_active is False

            # 3) Aynı email ile tekrar davet → reaktivasyon (yeni satır değil)
            actor = await db.get(User, actor_id)
            assert actor is not None
            reactivated = await svc.create_user(
                db,
                email=email,
                first_name="Second",
                last_name="Invite",
                role_id=role_id,
                actor=actor,
            )

        assert reactivated.id == created_id, "Aynı satır reaktive edilmeli, yeni satır değil"
        assert reactivated.deleted_at is None
        assert reactivated.is_active is True
        assert reactivated.first_name == "Second"
        assert reactivated.last_name == "Invite"

        # Email'e karşılık DB'de tek satır kalmalı
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(select(User).where(User.email == email))).scalars().all()
            assert len(rows) == 1
    finally:
        if created_id is not None:
            await _purge_user(created_id)
        await _purge_user(actor_id)


async def test_invite_active_email_conflicts() -> None:
    """Aktif kullanıcıda email zaten varsa EMAIL_ALREADY_EXISTS (409) raise edilir."""
    role_id = await _non_system_role_id()
    actor_id = await _make_actor(role_id)
    email = f"active_dup_{uuid.uuid4().hex[:8]}@test.local"
    created_id: int | None = None
    try:
        async with AsyncSessionLocal() as db:
            actor = await db.get(User, actor_id)
            assert actor is not None
            user = await svc.create_user(
                db,
                email=email,
                first_name="Active",
                last_name="User",
                role_id=role_id,
                actor=actor,
            )
            created_id = user.id

        async with AsyncSessionLocal() as db:
            actor = await db.get(User, actor_id)
            assert actor is not None
            with pytest.raises(EmailAlreadyExistsError) as excinfo:
                await svc.create_user(
                    db,
                    email=email,
                    first_name="Dup",
                    last_name="User",
                    role_id=role_id,
                    actor=actor,
                )
        assert excinfo.value.code == "EMAIL_ALREADY_EXISTS"
        assert excinfo.value.status_code == 409
    finally:
        if created_id is not None:
            await _purge_user(created_id)
        await _purge_user(actor_id)
