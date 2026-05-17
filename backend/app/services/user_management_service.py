"""Kullanıcı yönetimi: CRUD + davet (Gmail SMTP üzerinden mail).

Süper Admin yeni kullanıcı davet ettiğinde, kullanıcı **kendi şifresini**
davet linkinden belirler — geçici şifre artık üretilmez. Backend'de
güvenli bir placeholder hash atanır (login imkânsız), ardından
`password_reset_service.create_invitation` ile davet maili tetiklenir.

Tüm değişiklikler audit_log'a yazılır.
"""

from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    LastSuperAdminError,
    ResourceNotFoundError,
    SelfDestructiveActionError,
    ValidationError,
)
from app.core.security import hash_password
from app.models import NotificationType, Role, User
from app.repositories import audit_log_repository
from app.repositories import user_repository as user_repo
from app.services import notification_service, password_reset_service

logger = logging.getLogger(__name__)


def _generate_placeholder_password() -> str:
    """Davet edilen kullanıcı için login'i imkânsız kılan rastgele hash kaynağı.

    Kullanıcı asla bu şifreyi öğrenmez ve davet linkinden kendi şifresini
    kurana kadar login edemez. ~256-bit entropi.
    """
    return secrets.token_urlsafe(32)


async def list_users(
    db: AsyncSession,
    *,
    include_deleted: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[User], int]:
    """Returns: (page_rows, total_count).

    Pagination zorunlu (default page=1, page_size=50, max 200).
    Frontend büyük listeleri sayfalı çeker; tek seferde tüm tablo dönmemeli.
    """
    base_where = []
    if not include_deleted:
        base_where.append(User.deleted_at.is_(None))

    count_stmt = select(func.count()).select_from(User)
    if base_where:
        count_stmt = count_stmt.where(*base_where)
    total = int((await db.execute(count_stmt)).scalar_one())

    stmt = select(User).order_by(User.id)
    if base_where:
        stmt = stmt.where(*base_where)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    rows = list((await db.execute(stmt)).scalars().all())
    return rows, total


async def load_roles_for_users(db: AsyncSession, users: list[User]) -> dict[int, Role]:
    """`users` listesinde geçen tüm role_id'leri tek sorguda çek — N+1 önler."""
    role_ids = {u.role_id for u in users if u.role_id}
    if not role_ids:
        return {}
    rows = (await db.execute(select(Role).where(Role.id.in_(role_ids)))).scalars().all()
    return {r.id: r for r in rows}


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def get_user_or_404(db: AsyncSession, user_id: int) -> User:
    """Soft-deleted dahil herhangi bir kullanıcı kaydını getir, yoksa 404.

    `get_user` opsiyonel döner (mevcut iç çağrılar için bozulmasın); router
    GET handler'ı doğrudan bu helper'ı kullanır.
    """
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise ResourceNotFoundError(params={"user_id": user_id})
    return user


async def _assert_super_admin_invariant_holds(
    db: AsyncSession,
    user: User,
    *,
    new_role_id: int | None = None,
    new_is_active: bool | None = None,
    being_deleted: bool = False,
) -> None:
    """Pattern C invariant guard: sistemde her zaman ≥1 aktif Super Admin kalmalı.

    Kullanıcı şu an aktif Super Admin ise ve önerilen değişiklik onu bu
    statüden çıkaracaksa (silme, pasifleştirme, rolünü düşürme), başka
    aktif Super Admin yoksa `LastSuperAdminError` raise edilir.
    """
    current_role = user.role
    if current_role is None and user.role_id:
        current_role = await db.get(Role, user.role_id)

    currently_super = (
        current_role is not None
        and current_role.is_system
        and user.is_active
        and user.deleted_at is None
    )
    if not currently_super:
        return

    if being_deleted:
        will_remain_super = False
    else:
        if new_role_id is not None and new_role_id != user.role_id:
            new_role = await db.get(Role, new_role_id)
            future_is_system = bool(new_role and new_role.is_system)
        else:
            future_is_system = True  # role unchanged, was system
        future_is_active = new_is_active if new_is_active is not None else user.is_active
        will_remain_super = future_is_system and future_is_active

    if will_remain_super:
        return

    remaining = await user_repo.count_active_super_admins(db, exclude_user_id=user.id)
    if remaining == 0:
        raise LastSuperAdminError(field="user_id", params={"user_id": user.id})


async def create_user(
    db: AsyncSession,
    *,
    email: str,
    first_name: str,
    last_name: str,
    role_id: int,
    actor: User,
    lang: str = "tr",
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    """Yeni kullanıcı + davet maili.

    Akış: placeholder şifre ile user yaratılır → audit log → davet token + mail.
    Frontend'e dönen response'ta şifre yok; sadece `invitation_sent: true`.
    """
    email = email.strip().lower()

    # Duplicate kontrolü
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise ConflictError("EMAIL_ALREADY_EXISTS", params={"email": email})

    role = await db.get(Role, role_id)
    if role is None:
        raise ValidationError("Invalid role", field="role_id", params={"role_id": role_id})

    user = User(
        email=email,
        password_hash=hash_password(_generate_placeholder_password()),
        first_name=first_name,
        last_name=last_name,
        role_id=role_id,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await audit_log_repository.add(
        db,
        action="user.created",
        user_id=actor.id,
        user_email=actor.email,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        user_agent=user_agent,
        details={"email": email, "role_id": role_id},
    )
    # Server defaults (created_at, updated_at) MySQL'de flush sonrası otomatik
    # fetch edilmez — commit sonrası lazy-load greenlet hatası verir. Refresh
    # ile zorla okuyup commit edelim.
    await db.refresh(user, attribute_names=["created_at", "updated_at"])

    # Davet token + mail (Celery task'a delegate edilir, db.commit içeride).
    await password_reset_service.create_invitation(
        db,
        user=user,
        inviter=actor,
        role_name=role.name,
        lang=lang,
        ip=ip,
    )
    return user


async def update_user(
    db: AsyncSession,
    user_id: int,
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    role_id: int | None = None,
    is_active: bool | None = None,
    actor: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise ResourceNotFoundError(params={"user_id": user_id})

    # Peer model: kullanıcı kendi role'unü veya is_active'ini admin panelinden
    # değiştiremez — bu işlemler başka bir admin tarafından yapılmalı.
    if actor.id == user.id:
        will_change_role = role_id is not None and role_id != user.role_id
        will_change_active = is_active is not None and is_active != user.is_active
        if will_change_role or will_change_active:
            raise SelfDestructiveActionError(field="user_id", params={"user_id": user.id})

    # Pattern C: rol düşürme veya pasifleştirme ile son Super Admin'in
    # statüsünü kaldırma girişimini engelle (mutasyon uygulanmadan ÖNCE check).
    if role_id is not None or is_active is not None:
        await _assert_super_admin_invariant_holds(
            db,
            user,
            new_role_id=role_id,
            new_is_active=is_active,
        )

    # Bildirim için "öncesi" snapshot — değişiklikler uygulanmadan önce.
    was_super_admin = bool(user.role and user.role.is_system) and user.is_active

    changed: dict[str, Any] = {}
    if first_name is not None and user.first_name != first_name:
        user.first_name = first_name
        changed["first_name"] = first_name
    if last_name is not None and user.last_name != last_name:
        user.last_name = last_name
        changed["last_name"] = last_name
    if role_id is not None and user.role_id != role_id:
        role = await db.get(Role, role_id)
        if role is None:
            raise ValidationError("Invalid role", field="role_id")
        user.role_id = role_id
        changed["role_id"] = role_id
    if is_active is not None and user.is_active != is_active:
        user.is_active = is_active
        changed["is_active"] = is_active

    if changed:
        await audit_log_repository.add(
            db,
            action="user.updated",
            user_id=actor.id,
            user_email=actor.email,
            resource_type="user",
            resource_id=str(user.id),
            ip_address=ip,
            user_agent=user_agent,
            details=changed,
        )

    # Pattern C: Super Admin statüsünü etkileyen değişiklik varsa diğer
    # Super Admin'lere bildirim (sessiz ele geçirilmesin diye görünürlük).
    if changed and ("role_id" in changed or "is_active" in changed):
        # Yeni rolünü öğren (değiştiyse)
        new_role_obj = await db.get(Role, user.role_id) if user.role_id else None
        is_super_admin_now = bool(new_role_obj and new_role_obj.is_system) and user.is_active
        if was_super_admin or is_super_admin_now:
            if was_super_admin and not is_super_admin_now:
                event = "Süper Admin yetkisi kaldırıldı"
            elif is_super_admin_now and not was_super_admin:
                event = "Yeni Süper Admin atandı"
            else:
                event = "Süper Admin hesabı güncellendi"
            await notification_service.notify_other_super_admins(
                db,
                actor_id=actor.id,
                target_id=user.id,
                title=event,
                message=(
                    f"{actor.full_name} tarafından {user.full_name} ({user.email}) "
                    "hesabında Süper Admin etkili değişiklik yapıldı."
                ),
                link="/users",
            )

    # Lazy-load tetiklenmesini önle: server defaults okuyup commit
    await db.refresh(user, attribute_names=["created_at", "updated_at"])
    await db.commit()
    return user


async def soft_delete_user(
    db: AsyncSession,
    user_id: int,
    *,
    actor: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise ResourceNotFoundError(params={"user_id": user_id})

    # Peer model: kullanıcı kendi hesabını admin panelinden silemez. Bu
    # yanlışlıkla kendini kilitleme senaryosunu önler — başka bir admin'in
    # yapması gerekir.
    if actor.id == user.id:
        raise SelfDestructiveActionError(field="user_id", params={"user_id": user.id})

    # Pattern C: Super Admin silinebilir, ama sistemde ≥1 aktif Super Admin kalmalı.
    await _assert_super_admin_invariant_holds(db, user, being_deleted=True)

    was_super_admin = bool(user.role and user.role.is_system) and user.is_active

    user.deleted_at = datetime.now(UTC)
    user.is_active = False

    await audit_log_repository.add(
        db,
        action="user.deleted",
        user_id=actor.id,
        user_email=actor.email,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        user_agent=user_agent,
        details={"email": user.email, "was_super_admin": was_super_admin},
    )

    if was_super_admin:
        await notification_service.notify_other_super_admins(
            db,
            actor_id=actor.id,
            target_id=user.id,
            title="Süper Admin silindi",
            message=(
                f"{actor.full_name} tarafından Süper Admin {user.full_name} "
                f"({user.email}) sistemden kaldırıldı."
            ),
            link="/users",
        )

    await db.commit()


async def admin_send_password_reset(
    db: AsyncSession,
    user_id: int,
    *,
    actor: User,
    lang: str = "tr",
    ip: str | None = None,
    user_agent: str | None = None,
) -> User:
    """Süper Admin kullanıcının şifresini sıfırlamak için reset linki gönderir.

    Aktif refresh token'lar `consume_token_and_set_password` içinde, yani
    kullanıcı yeni şifreyi belirleyince revoke edilir — burada erken revoke
    yapmıyoruz ki kullanıcı reset link'e tıklayana kadar mevcut oturumu
    kesilmesin (Süper Admin yanlışlıkla butona basmış olabilir).
    """
    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise ResourceNotFoundError(params={"user_id": user_id})

    await audit_log_repository.add(
        db,
        action="password.admin_reset_requested",
        user_id=actor.id,
        user_email=actor.email,
        resource_type="user",
        resource_id=str(user.id),
        ip_address=ip,
        user_agent=user_agent,
        details={"target_email": user.email},
    )

    # `request_password_reset` token üretir, önceki aktifleri revoke eder
    # ve Celery üzerinden mail tetikler. Kullanıcı yeni şifreyi belirleyince
    # tüm refresh tokenları o aşamada revoke olur.
    await password_reset_service.request_password_reset(
        db,
        email=user.email,
        lang=lang,
        ip=ip,
    )

    # Hedef kullanıcının bildirim merkezine güvenlik uyarısı düşür
    # (logout olmadıysa, sıradaki oturumunda görür).
    await notification_service.create_for_user(
        db,
        user_id=user.id,
        type_=NotificationType.WARNING,
        title="Şifreniz sıfırlandı",
        message=(
            f"{actor.full_name} tarafından şifre sıfırlama maili e-posta adresinize gönderildi. "
            "İsteğiniz dışı ise sistem yöneticisiyle iletişime geçin."
        ),
        link="/settings/security",
    )
    await db.commit()
    return user


async def list_audit_logs(
    db: AsyncSession,
    *,
    page: int = 1,
    page_size: int = 50,
    action_filter: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Audit log listesi (en yeni → eski). Returns: (page_rows, total).

    Pagination zorunlu — audit_logs hızla büyür (her mutating endpoint
    için bir satır), tek seferde tüm tablo dönmemeli.
    """
    from app.models import AuditLog

    conditions = []
    if action_filter:
        conditions.append(AuditLog.action.like(f"{action_filter}%"))

    count_stmt = select(func.count()).select_from(AuditLog)
    if conditions:
        count_stmt = count_stmt.where(and_(*conditions))
    total = int((await db.execute(count_stmt)).scalar_one())

    stmt = select(AuditLog)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).scalars().all()
    items = [
        {
            "id": r.id,
            "action": r.action,
            "user_id": r.user_id,
            "user_email": r.user_email,
            "resource_type": r.resource_type,
            "resource_id": r.resource_id,
            "ip_address": r.ip_address,
            "details": r.details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return items, total
