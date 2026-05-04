"""Rol CRUD + permission attach/detach + cascade davranışları.

`docs/overview/05` §5.5.3 (Per-User Custom Role) + §5.5.8 (Rol Silme Cascade).

Süper Admin (`is_system=True`) silinmez, düzenlenmez. `role_permissions`
tablosunda **yer almaz**; require_permission tarafında bypass'lanır.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache_keys
from app.core.exceptions import (
    ConflictError,
    ResourceNotFoundError,
    ValidationError,
)
from app.models import Permission as PermissionModel
from app.models import Role, RolePermission, User
from app.repositories import audit_log_repository

logger = logging.getLogger(__name__)


async def list_roles(
    db: AsyncSession, *, include_deleted: bool = False
) -> list[dict[str, Any]]:
    """Rol listesi + her rolün kullanıcı sayısı + izin sayısı."""
    stmt = select(Role)
    if not include_deleted:
        stmt = stmt.where(Role.deleted_at.is_(None))
    stmt = stmt.order_by(Role.is_system.desc(), Role.id)
    roles = list((await db.execute(stmt)).scalars().all())

    # Toplu user_count + permission_count tek sorguda
    user_count_stmt = (
        select(User.role_id, func.count(User.id))
        .where(User.deleted_at.is_(None))
        .group_by(User.role_id)
    )
    user_counts = {r[0]: int(r[1]) for r in (await db.execute(user_count_stmt)).all()}

    perm_count_stmt = (
        select(RolePermission.role_id, func.count(RolePermission.permission_id))
        .group_by(RolePermission.role_id)
    )
    perm_counts = {r[0]: int(r[1]) for r in (await db.execute(perm_count_stmt)).all()}

    out: list[dict[str, Any]] = []
    for r in roles:
        # Süper Admin → "tüm izinler" (40)
        from app.core.permissions import Permission

        perm_count = (
            len(Permission) if r.is_system else perm_counts.get(r.id, 0)
        )
        out.append(
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "color": r.color,
                "icon": r.icon,
                "is_system": r.is_system,
                "user_count": user_counts.get(r.id, 0),
                "permission_count": perm_count,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
        )
    return out


async def get_role_with_permissions(
    db: AsyncSession, role_id: int
) -> dict[str, Any]:
    role = await db.get(Role, role_id)
    if role is None or role.deleted_at is not None:
        raise ResourceNotFoundError(params={"role_id": role_id})

    # Süper Admin için permissions = tüm izinler
    if role.is_system:
        from app.core.permissions import Permission

        all_codes = [p.value for p in Permission]
    else:
        stmt = (
            select(PermissionModel.code)
            .join(
                RolePermission,
                RolePermission.permission_id == PermissionModel.id,
            )
            .where(RolePermission.role_id == role_id)
        )
        all_codes = [r[0] for r in (await db.execute(stmt)).all()]

    user_count_stmt = (
        select(func.count(User.id))
        .where(and_(User.role_id == role_id, User.deleted_at.is_(None)))
    )
    user_count = int((await db.execute(user_count_stmt)).scalar_one())

    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "color": role.color,
        "icon": role.icon,
        "is_system": role.is_system,
        "permissions": sorted(all_codes),
        "user_count": user_count,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
    }


async def create_role(
    db: AsyncSession,
    *,
    name: str,
    description: str | None,
    color: str | None,
    icon: str | None,
    permission_codes: list[str],
    actor: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    """Yeni rol + atanmış izinler. Audit log."""
    name = name.strip()
    if not name:
        raise ValidationError("Rol adı boş olamaz", field="name")

    existing = await db.execute(
        select(Role).where(and_(Role.name == name, Role.deleted_at.is_(None)))
    )
    if existing.scalar_one_or_none() is not None:
        raise ConflictError(
            "ROLE_NAME_EXISTS", params={"name": name}
        )

    role = Role(
        name=name,
        description=description,
        color=color,
        icon=icon,
        is_system=False,
        created_by=actor.id,
        updated_by=actor.id,
    )
    db.add(role)
    await db.flush()

    # Permission attach (whitelist — sadece DB'de var olanlar)
    if permission_codes:
        valid_perms = (
            await db.execute(
                select(PermissionModel.id, PermissionModel.code).where(
                    PermissionModel.code.in_(permission_codes)
                )
            )
        ).all()
        for perm_id, _ in valid_perms:
            db.add(
                RolePermission(
                    role_id=role.id,
                    permission_id=perm_id,
                    granted_by=actor.id,
                )
            )

    await audit_log_repository.add(
        db,
        action="role.created",
        user_id=actor.id,
        user_email=actor.email,
        resource_type="role",
        resource_id=str(role.id),
        ip_address=ip,
        user_agent=user_agent,
        details={"name": name, "permissions": permission_codes},
    )
    # Server defaults'ları yükle — MySQL flush sonrası otomatik fetch etmez.
    await db.refresh(role, attribute_names=["created_at", "updated_at"])
    await db.commit()

    # commit sonrası lazy-load tehlikesi var — dict'i şimdi hazırla
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "color": role.color,
        "icon": role.icon,
        "is_system": role.is_system,
        "permissions": sorted(permission_codes),
        "user_count": 0,  # yeni rol — henüz kullanıcı yok
        "created_at": role.created_at,
        "updated_at": role.updated_at,
    }


async def update_role(
    db: AsyncSession,
    role_id: int,
    *,
    name: str | None = None,
    description: str | None = None,
    color: str | None = None,
    icon: str | None = None,
    permission_codes: list[str] | None = None,
    actor: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any]:
    role = await db.get(Role, role_id)
    if role is None or role.deleted_at is not None:
        raise ResourceNotFoundError(params={"role_id": role_id})
    if role.is_system:
        raise ValidationError(
            "Sistem rolü düzenlenemez (Süper Admin)", field="role_id"
        )

    changed: dict[str, Any] = {}
    if name is not None and role.name != name:
        # Duplicate kontrolü
        dup = await db.execute(
            select(Role).where(
                and_(
                    Role.name == name,
                    Role.id != role_id,
                    Role.deleted_at.is_(None),
                )
            )
        )
        if dup.scalar_one_or_none():
            raise ConflictError("ROLE_NAME_EXISTS", params={"name": name})
        role.name = name
        changed["name"] = name
    if description is not None and role.description != description:
        role.description = description
        changed["description"] = description
    if color is not None:
        role.color = color
        changed["color"] = color
    if icon is not None:
        role.icon = icon
        changed["icon"] = icon

    if permission_codes is not None:
        # Mevcut izinleri silip yeniden ekle (atomik replacement)
        await db.execute(
            delete(RolePermission).where(RolePermission.role_id == role_id)
        )
        if permission_codes:
            valid_perms = (
                await db.execute(
                    select(PermissionModel.id).where(
                        PermissionModel.code.in_(permission_codes)
                    )
                )
            ).all()
            for (perm_id,) in valid_perms:
                db.add(
                    RolePermission(
                        role_id=role_id,
                        permission_id=perm_id,
                        granted_by=actor.id,
                    )
                )
        changed["permissions"] = permission_codes

    role.updated_by = actor.id

    if changed:
        await audit_log_repository.add(
            db,
            action="role.updated",
            user_id=actor.id,
            user_email=actor.email,
            resource_type="role",
            resource_id=str(role.id),
            ip_address=ip,
            user_agent=user_agent,
            details=changed,
        )

        # Bu role atanmış kullanıcıların permission cache'ini invalidate et
        from app.services.cache_service import cache

        users_stmt = select(User.id).where(User.role_id == role_id)
        for (uid,) in (await db.execute(users_stmt)).all():
            await cache.delete(cache_keys.user_perms(uid))

    # Final permissions list (eğer changed'da varsa onu kullan, yoksa mevcut DB'den)
    if permission_codes is not None:
        final_perms = sorted(permission_codes)
    else:
        perm_stmt = (
            select(PermissionModel.code)
            .join(RolePermission, RolePermission.permission_id == PermissionModel.id)
            .where(RolePermission.role_id == role_id)
        )
        final_perms = sorted(r[0] for r in (await db.execute(perm_stmt)).all())

    user_count = int(
        (
            await db.execute(
                select(func.count(User.id)).where(
                    and_(User.role_id == role_id, User.deleted_at.is_(None))
                )
            )
        ).scalar_one()
    )

    await db.refresh(role, attribute_names=["created_at", "updated_at"])
    await db.commit()

    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "color": role.color,
        "icon": role.icon,
        "is_system": role.is_system,
        "permissions": final_perms,
        "user_count": user_count,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
    }


async def delete_role(
    db: AsyncSession,
    role_id: int,
    *,
    actor: User,
    ip: str | None = None,
    user_agent: str | None = None,
) -> int:
    """Rol silme + cascade pasifleştirme (`docs/05` §5.5.8).

    Returns: pasifleştirilen kullanıcı sayısı.
    """
    role = await db.get(Role, role_id)
    if role is None or role.deleted_at is not None:
        raise ResourceNotFoundError(params={"role_id": role_id})
    if role.is_system:
        raise ValidationError(
            "Sistem rolü silinemez (Süper Admin)", field="role_id"
        )

    # 1. Bu role atanmış aktif kullanıcıları bul
    users_stmt = select(User).where(
        and_(User.role_id == role_id, User.deleted_at.is_(None))
    )
    users = list((await db.execute(users_stmt)).scalars().all())

    # 2. Hepsini pasifleştir, role_id null'a set et
    deactivated = 0
    for u in users:
        u.is_active = False
        u.role_id = None  # type: ignore[assignment]
        deactivated += 1

    # 3. Aktif refresh token'ları revoke
    if users:
        from app.models import RefreshToken

        await db.execute(
            delete(RefreshToken).where(RefreshToken.user_id.in_([u.id for u in users]))
        )

    # 4. Permission cache temizle
    from app.services.cache_service import cache

    for u in users:
        await cache.delete(cache_keys.user_perms(u.id))

    # 5. Rolü soft-delete (role_permissions CASCADE ile silinir)
    role.deleted_at = datetime.now(timezone.utc)
    role.updated_by = actor.id

    await audit_log_repository.add(
        db,
        action="role.deleted",
        user_id=actor.id,
        user_email=actor.email,
        resource_type="role",
        resource_id=str(role.id),
        ip_address=ip,
        user_agent=user_agent,
        details={
            "name": role.name,
            "deactivated_users": deactivated,
        },
    )
    await db.commit()
    logger.info(
        "role_deleted role_id=%d deactivated_users=%d", role.id, deactivated
    )
    return deactivated


async def list_permissions_grouped(
    db: AsyncSession,
) -> dict[str, list[dict[str, Any]]]:
    """37+ izni 4 kategori altında gruplu döner. UI'daki rol oluşturma
    formundaki checkbox grid için.
    """
    rows = (await db.execute(select(PermissionModel).order_by(PermissionModel.id))).scalars().all()

    grouped: dict[str, list[dict[str, Any]]] = {}
    category_labels = {
        "view": "Veri Görüntüleme",
        "data": "Veri İşlemleri",
        "users": "Kullanıcı ve Rol Yönetimi",
        "system": "Sistem ve Loglar",
    }
    for r in rows:
        key = r.category
        grouped.setdefault(key, []).append(
            {
                "code": r.code,
                "module": r.module,
                "action": r.action,
                "description": r.description,
                "category": r.category,
                "category_label": category_labels.get(r.category, r.category),
            }
        )
    return grouped
