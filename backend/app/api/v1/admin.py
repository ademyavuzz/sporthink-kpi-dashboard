"""Admin endpoint'leri: users, audit logs, channel mapping, aggregations rebuild,
saved views, filters, export.

Bu router büyük; pratik için tek dosyada (Sprint 10'da modüler ayrılabilir).
OpenAPI'de okunabilirlik için endpoint'ler işlevlerine göre ayrı tag'lere
bölünmüştür (filters, admin, roles, users, saved-views).
"""

from __future__ import annotations

from datetime import date as date_type
from typing import Literal

from fastapi import APIRouter, Body, Depends, Path, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache_keys
from app.core.permissions import Permission
from app.dependencies import get_db, require_permission
from app.models import Role, User
from app.repositories import user_repository
from app.schemas import PaginatedEnvelope, PaginationMeta, SuccessEnvelope
from app.schemas.admin import (
    AdminPasswordResetResponse,
    AuditLogItem,
    ChannelMappingCreate,
    ChannelMappingItem,
    ChannelMappingUpdate,
    PermissionItem,
    RoleCreate,
    RoleDetail,
    RoleListItem,
    RoleSummaryAdmin,
    RoleUpdate,
    SavedViewCreate,
    SavedViewItem,
    SavedViewUpdate,
    UserCreate,
    UserCreateResponse,
    UserListItem,
    UserUpdate,
)
from app.services import (
    aggregation_service,
    channel_mapping_service,
    export_service,
    filter_service,
    role_service,
    saved_view_service,
    user_management_service,
)
from app.services.cache_service import cache

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


# ---------------------------------------------------------------------- #
# /filters/* (multi-select dropdown sources)
# ---------------------------------------------------------------------- #


@router.get(
    "/filters/channels",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Kanal listesini getir",
    description="Filtrelerde kullanılan benzersiz pazarlama kanallarının listesini döner.",
)
async def get_filter_channels(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[str]]:
    cached = await cache.get_json(cache_keys.filter_channels())
    if cached is not None:
        return SuccessEnvelope(data=cached)
    items = await filter_service.distinct_channels(db)
    await cache.set_json(cache_keys.filter_channels(), items, ttl=cache_keys.TTL_FILTERS)
    return SuccessEnvelope(data=items)


@router.get(
    "/filters/devices",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Cihaz listesini getir",
    description="Filtrelerde kullanılan benzersiz cihaz türlerinin listesini döner.",
)
async def get_filter_devices(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[str]]:
    cached = await cache.get_json(cache_keys.filter_devices())
    if cached is not None:
        return SuccessEnvelope(data=cached)
    items = await filter_service.distinct_devices(db)
    await cache.set_json(cache_keys.filter_devices(), items, ttl=cache_keys.TTL_FILTERS)
    return SuccessEnvelope(data=items)


@router.get(
    "/filters/cities",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Şehir listesini getir",
    description="Filtrelerde kullanılan benzersiz şehirlerin listesini döner (en sık ilk 100).",
)
async def get_filter_cities(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[str]]:
    cached = await cache.get_json(cache_keys.filter_cities())
    if cached is not None:
        return SuccessEnvelope(data=cached)
    items = await filter_service.distinct_cities(db)
    await cache.set_json(cache_keys.filter_cities(), items, ttl=cache_keys.TTL_FILTERS)
    return SuccessEnvelope(data=items)


@router.get(
    "/filters/categories",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Kategori listesini getir",
    description="Filtrelerde kullanılan benzersiz ürün kategorilerinin listesini döner.",
)
async def get_filter_categories(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[str]]:
    cached = await cache.get_json(cache_keys.filter_categories())
    if cached is not None:
        return SuccessEnvelope(data=cached)
    items = await filter_service.distinct_categories(db)
    await cache.set_json(cache_keys.filter_categories(), items, ttl=cache_keys.TTL_FILTERS)
    return SuccessEnvelope(data=items)


@router.get(
    "/filters/brands",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Marka listesini getir",
    description="Filtrelerde kullanılan benzersiz markaların listesini döner.",
)
async def get_filter_brands(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[str]]:
    cached = await cache.get_json(cache_keys.filter_brands())
    if cached is not None:
        return SuccessEnvelope(data=cached)
    items = await filter_service.distinct_brands(db)
    await cache.set_json(cache_keys.filter_brands(), items, ttl=cache_keys.TTL_FILTERS)
    return SuccessEnvelope(data=items)


@router.get(
    "/filters/payment-methods",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Ödeme yöntemi listesini getir",
    description="Filtrelerde kullanılan sipariş ödeme yöntemlerinin listesini döner.",
)
async def get_filter_payment_methods(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
) -> SuccessEnvelope[list[str]]:
    return SuccessEnvelope(data=filter_service.order_payment_methods())


@router.get(
    "/filters/order-statuses",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Sipariş durumu listesini getir",
    description="Filtrelerde kullanılan sipariş durumlarının listesini döner.",
)
async def get_filter_order_statuses(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
) -> SuccessEnvelope[list[str]]:
    return SuccessEnvelope(data=filter_service.order_statuses())


@router.get(
    "/filters/genders",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Müşteri cinsiyet listesini getir",
    description="Müşteri segment filtrelerinde kullanılan cinsiyet seçeneklerini döner.",
)
async def get_filter_genders(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
) -> SuccessEnvelope[list[str]]:
    return SuccessEnvelope(data=filter_service.customer_genders())


@router.get(
    "/filters/age-groups",
    response_model=SuccessEnvelope[list[str]],
    tags=["filters"],
    summary="Müşteri yaş grubu listesini getir",
    description="Müşteri segment filtrelerinde kullanılan yaş grubu seçeneklerini döner.",
)
async def get_filter_age_groups(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
) -> SuccessEnvelope[list[str]]:
    return SuccessEnvelope(data=filter_service.customer_age_groups())


# ---------------------------------------------------------------------- #
# /admin/aggregations/rebuild
# ---------------------------------------------------------------------- #


@router.post(
    "/admin/aggregations/rebuild",
    response_model=SuccessEnvelope[dict],
    tags=["admin"],
    summary="Aggregation tablolarını yeniden hesapla",
    description=(
        "Verilen tarih aralığı için KPI aggregation (özet) tablolarını yeniden "
        "hesaplar. İşlem sonrası ilgili KPI önbellekleri temizlenir. Veri "
        "tutarsızlığı şüphesinde manuel olarak çalıştırılır."
    ),
)
async def rebuild_aggregations(
    date_from: date_type = Body(..., embed=True),
    date_to: date_type = Body(..., embed=True),
    _user: User = Depends(require_permission(Permission.SETTINGS_UPDATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    result = await aggregation_service.rebuild_all(db, date_from=date_from, date_to=date_to)
    # KPI cache'lerini invalidate et
    await cache.delete_pattern(cache_keys.kpi_invalidation_pattern())
    return SuccessEnvelope(data=result)  # type: ignore[arg-type]


# ---------------------------------------------------------------------- #
# /admin/audit-logs
# ---------------------------------------------------------------------- #


@router.get(
    "/admin/audit-logs",
    response_model=PaginatedEnvelope[AuditLogItem],
    tags=["admin"],
    summary="Denetim kayıtlarını listele",
    description=(
        "Sistemdeki denetim (audit) kayıtlarını en yeniden eskiye doğru sayfalı "
        "olarak döner. İsteğe bağlı eylem (action) ön eki ile filtrelenebilir."
    ),
)
async def list_audit_logs(
    page: int = Query(1, ge=1, description="Sayfa numarası (1-bazlı)"),
    page_size: int = Query(50, ge=1, le=200, description="Sayfa boyutu (max 200)"),
    action: str | None = Query(None, description="Action prefix filtresi"),
    _user: User = Depends(require_permission(Permission.LOGS_VIEW_AUDIT)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEnvelope[AuditLogItem]:
    items, total = await user_management_service.list_audit_logs(
        db, page=page, page_size=page_size, action_filter=action
    )
    return PaginatedEnvelope(
        data=[AuditLogItem(**i) for i in items],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


# ---------------------------------------------------------------------- #
# /admin/channel-mappings (CRUD)
# ---------------------------------------------------------------------- #


@router.get(
    "/admin/channel-mappings",
    response_model=PaginatedEnvelope[ChannelMappingItem],
    tags=["admin"],
    summary="Kanal eşleştirmelerini listele",
    description=(
        "Kaynak/medium değerlerini standart kanal gruplarına bağlayan kanal "
        "eşleştirme kayıtlarını sayfalı olarak döner."
    ),
)
async def list_channel_mappings(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _user: User = Depends(require_permission(Permission.MAPPINGS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEnvelope[ChannelMappingItem]:
    rows, total = await channel_mapping_service.list_mappings_paginated(
        db, page=page, page_size=page_size
    )
    return PaginatedEnvelope(
        data=[ChannelMappingItem.model_validate(r) for r in rows],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get(
    "/admin/channel-mappings/{mapping_id}",
    response_model=SuccessEnvelope[ChannelMappingItem],
    tags=["admin"],
    summary="Kanal eşleştirmesi detayını getir",
    description="Tek bir kanal eşleştirme kaydının detayını döner.",
)
async def get_channel_mapping(
    mapping_id: int = Path(..., ge=1),
    _user: User = Depends(require_permission(Permission.MAPPINGS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ChannelMappingItem]:
    row = await channel_mapping_service.get_mapping(db, mapping_id)
    return SuccessEnvelope(data=ChannelMappingItem.model_validate(row))


@router.post(
    "/admin/channel-mappings",
    response_model=SuccessEnvelope[ChannelMappingItem],
    tags=["admin"],
    summary="Yeni kanal eşleştirmesi ekle",
    description=(
        "Bir kaynak/medium kombinasyonunu belirli bir kanal grubuna bağlayan "
        "yeni eşleştirme kaydı oluşturur."
    ),
)
async def create_channel_mapping(
    payload: ChannelMappingCreate,
    current: User = Depends(require_permission(Permission.MAPPINGS_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ChannelMappingItem]:
    row = await channel_mapping_service.create_mapping(
        db,
        source=payload.source,
        medium=payload.medium,
        channel_group=payload.channel_group,
        notes=payload.notes,
        actor_id=current.id,
    )
    return SuccessEnvelope(data=ChannelMappingItem.model_validate(row))


@router.patch(
    "/admin/channel-mappings/{mapping_id}",
    response_model=SuccessEnvelope[ChannelMappingItem],
    tags=["admin"],
    summary="Kanal eşleştirmesini güncelle",
    description="Bir kanal eşleştirme kaydının kanal grubunu ve notunu günceller.",
)
async def update_channel_mapping(
    payload: ChannelMappingUpdate,
    mapping_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.MAPPINGS_UPDATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ChannelMappingItem]:
    row = await channel_mapping_service.update_mapping(
        db,
        mapping_id,
        channel_group=payload.channel_group,
        notes=payload.notes,
        actor_id=current.id,
    )
    return SuccessEnvelope(data=ChannelMappingItem.model_validate(row))


@router.delete(
    "/admin/channel-mappings/{mapping_id}",
    response_model=SuccessEnvelope[dict],
    tags=["admin"],
    summary="Kanal eşleştirmesini sil",
    description="Bir kanal eşleştirme kaydını yumuşak siler (soft delete).",
)
async def delete_channel_mapping(
    mapping_id: int = Path(..., ge=1),
    _user: User = Depends(require_permission(Permission.MAPPINGS_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await channel_mapping_service.soft_delete_mapping(db, mapping_id)
    return SuccessEnvelope(data={"deleted": True, "id": mapping_id})


# ---------------------------------------------------------------------- #
# /roles + /permissions (RBAC yönetimi)
# ---------------------------------------------------------------------- #


@router.get(
    "/roles",
    response_model=PaginatedEnvelope[RoleListItem],
    tags=["roles"],
    summary="Rolleri listele",
    description=(
        "Tanımlı rolleri sayfalı olarak döner. Her kayıt rolün kullanıcı ve "
        "izin sayısını da içerir."
    ),
)
async def list_roles_endpoint(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _user: User = Depends(require_permission(Permission.ROLES_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEnvelope[RoleListItem]:
    items, total = await role_service.list_roles(db, page=page, page_size=page_size)
    return PaginatedEnvelope(
        data=[RoleListItem(**i) for i in items],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get(
    "/roles/{role_id}",
    response_model=SuccessEnvelope[RoleDetail],
    tags=["roles"],
    summary="Rol detayını getir",
    description="Tek bir rolün detayını ve atanmış izin kodlarını döner.",
)
async def get_role_endpoint(
    role_id: int = Path(..., ge=1),
    _user: User = Depends(require_permission(Permission.ROLES_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[RoleDetail]:
    item = await role_service.get_role_with_permissions(db, role_id)
    return SuccessEnvelope(data=RoleDetail(**item))


@router.post(
    "/roles",
    response_model=SuccessEnvelope[RoleDetail],
    tags=["roles"],
    summary="Yeni rol oluştur",
    description="Yeni bir rol oluşturur ve belirtilen izin kodlarını ona atar.",
)
async def create_role_endpoint(
    payload: RoleCreate,
    request: Request,
    current: User = Depends(require_permission(Permission.ROLES_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[RoleDetail]:
    item = await role_service.create_role(
        db,
        name=payload.name,
        description=payload.description,
        color=payload.color,
        icon=payload.icon,
        permission_codes=payload.permissions,
        actor=current,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(data=RoleDetail(**item))


@router.patch(
    "/roles/{role_id}",
    response_model=SuccessEnvelope[RoleDetail],
    tags=["roles"],
    summary="Rolü güncelle",
    description=(
        "Rolün adını, açıklamasını, görünüm özelliklerini (renk, ikon) ve "
        "atanmış izinlerini günceller."
    ),
)
async def update_role_endpoint(
    payload: RoleUpdate,
    request: Request,
    role_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.ROLES_UPDATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[RoleDetail]:
    item = await role_service.update_role(
        db,
        role_id,
        name=payload.name,
        description=payload.description,
        color=payload.color,
        icon=payload.icon,
        permission_codes=payload.permissions,
        actor=current,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(data=RoleDetail(**item))


@router.delete(
    "/roles/{role_id}",
    response_model=SuccessEnvelope[dict],
    tags=["roles"],
    summary="Rolü sil",
    description=(
        "Rolü siler. Bu role bağlı kullanıcılar pasifleştirilir ve aktif "
        "refresh token'ları iptal edilir (cascade). Pasifleştirilen kullanıcı "
        "sayısı yanıtta döner. Sistem rolleri silinemez."
    ),
)
async def delete_role_endpoint(
    request: Request,
    role_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.ROLES_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    deactivated = await role_service.delete_role(
        db,
        role_id,
        actor=current,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(
        data={"deleted": True, "role_id": role_id, "deactivated_users": deactivated}
    )


@router.get(
    "/permissions",
    response_model=SuccessEnvelope[dict[str, list[PermissionItem]]],
    tags=["roles"],
    summary="İzinleri listele",
    description=(
        "Sistemdeki 43 izni 4 kategori altında gruplanmış olarak döner. Rol "
        "oluşturma ve düzenleme ekranındaki izin seçimi bu listeyi kullanır."
    ),
)
async def list_permissions_endpoint(
    _user: User = Depends(require_permission(Permission.ROLES_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict[str, list[PermissionItem]]]:
    grouped = await role_service.list_permissions_grouped(db)
    return SuccessEnvelope(data={k: [PermissionItem(**p) for p in v] for k, v in grouped.items()})


# ---------------------------------------------------------------------- #
# /users (CRUD + invite + admin password reset)
# ---------------------------------------------------------------------- #


def _user_to_item(u: User, role: Role | None = None) -> UserListItem:
    return UserListItem(
        id=u.id,
        email=u.email,
        first_name=u.first_name,
        last_name=u.last_name,
        role_id=u.role_id,
        role=RoleSummaryAdmin.model_validate(role) if role is not None else None,
        is_active=u.is_active,
        avatar_url=u.avatar_url,
        last_login_at=u.last_login_at,
        created_at=u.created_at,
        deleted_at=u.deleted_at,
    )


@router.get(
    "/users",
    response_model=PaginatedEnvelope[UserListItem],
    tags=["users"],
    summary="Kullanıcıları listele",
    description=(
        "Kullanıcıları sayfalı olarak döner. `include_deleted` ile silinmiş "
        "kullanıcılar da listeye dahil edilebilir."
    ),
)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    include_deleted: bool = Query(False),
    _user: User = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEnvelope[UserListItem]:
    users, total = await user_management_service.list_users(
        db, include_deleted=include_deleted, page=page, page_size=page_size
    )
    roles_map = await user_management_service.load_roles_for_users(db, users)
    return PaginatedEnvelope(
        data=[_user_to_item(u, roles_map.get(u.role_id)) for u in users],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get(
    "/users/super-admins/count",
    response_model=SuccessEnvelope[dict],
    tags=["users"],
    summary="Aktif Süper Admin sayısını getir",
    description=(
        "Aktif Süper Admin sayısını döner. Frontend, sayı 1 iken son Süper "
        "Admin'in silinmesini veya rolünün düşürülmesini engellemek için "
        "kullanır."
    ),
)
async def get_super_admin_count(
    _user: User = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    """Pattern C invariant kontrolü için kullanılır: frontend, sayı=1 iken
    Süper Admin silme/düşürme butonlarını disable eder ve tooltip gösterir.
    """
    count = await user_repository.count_active_super_admins(db)
    return SuccessEnvelope(data={"count": count})


@router.get(
    "/users/{user_id}",
    response_model=SuccessEnvelope[UserListItem],
    tags=["users"],
    summary="Kullanıcı detayını getir",
    description="Tek bir kullanıcının detayını ve atanmış rolünü döner.",
)
async def get_user_endpoint(
    user_id: int = Path(..., ge=1),
    _user: User = Depends(require_permission(Permission.USERS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[UserListItem]:
    user = await user_management_service.get_user_or_404(db, user_id)
    role = await db.get(Role, user.role_id) if user.role_id else None
    return SuccessEnvelope(data=_user_to_item(user, role))


@router.post(
    "/users",
    response_model=SuccessEnvelope[UserCreateResponse],
    tags=["users"],
    summary="Yeni kullanıcı davet et",
    description=(
        "Yeni bir kullanıcı oluşturur ve e-posta ile davet bağlantısı gönderir. "
        "Geçici şifre üretilmez; kullanıcı maildeki link ile kendi şifresini "
        "belirler. Davet bağlantısının geçerlilik süresi yapılandırmaya bağlıdır "
        "(varsayılan 7 gün)."
    ),
)
async def create_user(
    payload: UserCreate,
    request: Request,
    current: User = Depends(require_permission(Permission.USERS_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[UserCreateResponse]:
    """Yeni kullanıcı oluşturur ve davet linkini email ile gönderir.

    Geçici şifre üretilmez; kullanıcı maildeki link ile kendi şifresini kurar.
    Davet TTL: `settings.invite_token_expire_hours` (default 7 gün).
    """
    accept_lang = (request.headers.get("accept-language") or "tr").lower()
    lang = "en" if accept_lang.startswith("en") else "tr"

    user = await user_management_service.create_user(
        db,
        email=payload.email,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role_id=payload.role_id,
        actor=current,
        lang=lang,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    role = await db.get(Role, user.role_id) if user.role_id else None
    item = _user_to_item(user, role)
    return SuccessEnvelope(data=UserCreateResponse(**item.model_dump(), invitation_sent=True))


@router.patch(
    "/users/{user_id}",
    response_model=SuccessEnvelope[UserListItem],
    tags=["users"],
    summary="Kullanıcıyı güncelle",
    description=(
        "Kullanıcının adını, soyadını, rolünü ve aktiflik durumunu günceller. "
        "Son aktif Süper Admin'in rolü düşürülemez veya pasifleştirilemez."
    ),
)
async def update_user(
    payload: UserUpdate,
    request: Request,
    user_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.USERS_UPDATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[UserListItem]:
    user = await user_management_service.update_user(
        db,
        user_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role_id=payload.role_id,
        is_active=payload.is_active,
        actor=current,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    role = await db.get(Role, user.role_id) if user.role_id else None
    return SuccessEnvelope(data=_user_to_item(user, role))


@router.delete(
    "/users/{user_id}",
    response_model=SuccessEnvelope[dict],
    tags=["users"],
    summary="Kullanıcıyı sil",
    description="Kullanıcıyı yumuşak siler (soft delete). Son aktif Süper Admin silinemez.",
)
async def delete_user(
    request: Request,
    user_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.USERS_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await user_management_service.soft_delete_user(
        db,
        user_id,
        actor=current,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(data={"deleted": True, "user_id": user_id})


@router.post(
    "/users/{user_id}/reset-password",
    response_model=SuccessEnvelope[AdminPasswordResetResponse],
    tags=["users"],
    summary="Kullanıcıya şifre sıfırlama linki gönder",
    description=(
        "Yönetici, hedef kullanıcının e-posta adresine şifre sıfırlama "
        "bağlantısı gönderir. Geçici şifre üretilmez. Kullanıcı yeni şifresini "
        "belirleyince aktif refresh token'ları iptal edilir."
    ),
)
async def admin_reset_password(
    request: Request,
    user_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.USERS_RESET_PASSWORD)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[AdminPasswordResetResponse]:
    """Süper Admin başkasının şifresini sıfırlar; kullanıcının emailine
    reset linki gider. Geçici şifre üretilmez. Yeni şifre belirleyince
    aktif refresh tokenları revoke edilir.
    """
    accept_lang = (request.headers.get("accept-language") or "tr").lower()
    lang = "en" if accept_lang.startswith("en") else "tr"

    user = await user_management_service.admin_send_password_reset(
        db,
        user_id,
        actor=current,
        lang=lang,
        ip=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return SuccessEnvelope(
        data=AdminPasswordResetResponse(user_id=user.id, email=user.email, reset_email_sent=True)
    )


# ---------------------------------------------------------------------- #
# /saved-views (CRUD)
# ---------------------------------------------------------------------- #


@router.get(
    "/saved-views",
    response_model=PaginatedEnvelope[SavedViewItem],
    tags=["saved-views"],
    summary="Kayıtlı görünümleri listele",
    description=(
        "Oturum açan kullanıcının kayıtlı görünümlerini sayfalı olarak döner. "
        "`page_name` ile belirli bir dashboard sayfasına göre filtrelenebilir."
    ),
)
async def list_saved_views(
    page_filter: str | None = Query(
        None,
        alias="page_name",
        description="Sayfa adı filtresi (örn: overview, traffic). "
        "Eskiden `page` adında idi; pagination `page` ile karışmasın diye yeniden adlandı.",
    ),
    page: int = Query(1, ge=1, description="Sayfa numarası"),
    page_size: int = Query(50, ge=1, le=200),
    current: User = Depends(require_permission(Permission.VIEWS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEnvelope[SavedViewItem]:
    rows, total = await saved_view_service.list_views(
        db,
        user_id=current.id,
        page_filter=page_filter,
        page=page,
        page_size=page_size,
    )
    return PaginatedEnvelope(
        data=[SavedViewItem.model_validate(r) for r in rows],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get(
    "/saved-views/{view_id}",
    response_model=SuccessEnvelope[SavedViewItem],
    tags=["saved-views"],
    summary="Kayıtlı görünüm detayını getir",
    description=(
        "Tek bir kayıtlı görünümün detayını döner. Yalnızca kullanıcının kendi "
        "görünümüne erişilebilir."
    ),
)
async def get_saved_view(
    view_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.VIEWS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[SavedViewItem]:
    sv = await saved_view_service.get_view(db, view_id, user_id=current.id)
    return SuccessEnvelope(data=SavedViewItem.model_validate(sv))


@router.post(
    "/saved-views",
    response_model=SuccessEnvelope[SavedViewItem],
    tags=["saved-views"],
    summary="Kayıtlı görünüm oluştur",
    description=(
        "Bir dashboard sayfasının filtre ve segment kombinasyonunu kullanıcıya "
        "özel kayıtlı görünüm olarak saklar. Varsayılan görünüm olarak "
        "işaretlenebilir."
    ),
)
async def create_saved_view(
    payload: SavedViewCreate,
    current: User = Depends(require_permission(Permission.VIEWS_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[SavedViewItem]:
    sv = await saved_view_service.create_view(
        db,
        user_id=current.id,
        page=payload.page,
        name=payload.name,
        description=payload.description,
        filters=payload.filters,
        is_default=payload.is_default,
    )
    return SuccessEnvelope(data=SavedViewItem.model_validate(sv))


@router.patch(
    "/saved-views/{view_id}",
    response_model=SuccessEnvelope[SavedViewItem],
    tags=["saved-views"],
    summary="Kayıtlı görünümü güncelle",
    description=(
        "Bir kayıtlı görünümün adını, açıklamasını, filtrelerini ve varsayılan "
        "durumunu günceller. Yalnızca kullanıcının kendi görünümü güncellenir."
    ),
)
async def update_saved_view(
    payload: SavedViewUpdate,
    view_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.VIEWS_UPDATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[SavedViewItem]:
    sv = await saved_view_service.update_view(
        db,
        view_id,
        user_id=current.id,
        name=payload.name,
        description=payload.description,
        filters=payload.filters,
        is_default=payload.is_default,
    )
    return SuccessEnvelope(data=SavedViewItem.model_validate(sv))


@router.delete(
    "/saved-views/{view_id}",
    response_model=SuccessEnvelope[dict],
    tags=["saved-views"],
    summary="Kayıtlı görünümü sil",
    description=(
        "Bir kayıtlı görünümü yumuşak siler (soft delete). Yalnızca kullanıcının "
        "kendi görünümü silinebilir."
    ),
)
async def delete_saved_view(
    view_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.VIEWS_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await saved_view_service.soft_delete_view(db, view_id, user_id=current.id)
    return SuccessEnvelope(data={"deleted": True, "id": view_id})


# ---------------------------------------------------------------------- #
# /export/{table} (CSV/JSON/XLSX)
# ---------------------------------------------------------------------- #


@router.get(
    "/export/{kind}",
    tags=["admin"],
    summary="Veriyi dışa aktar",
    description=(
        "Seçilen veri kümesini (ürünler, müşteriler, siparişler, kampanyalar, "
        "denetim kayıtları veya kanal eşleştirmeleri) CSV, JSON veya XLSX "
        "biçiminde indirir. Satır sayısı `limit` ile sınırlandırılır."
    ),
)
async def export_data(
    kind: Literal[
        "products",
        "customers",
        "orders",
        "campaigns",
        "audit_logs",
        "channel_mappings",
    ],
    fmt: Literal["csv", "json", "xlsx"] = Query("csv"),
    limit: int = Query(10000, ge=1, le=50000),
    _user: User = Depends(require_permission(Permission.EXPORT_CSV)),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    # `audit_logs` özel; kaynak ve permission semantiği farklı (LOGS_VIEW_AUDIT
    # de istense daha doğru olurdu; mevcut tasarımda EXPORT_CSV kapısı yeter
    # ama yine de listelemeyi user_management_service'ten alıyoruz).
    if kind == "audit_logs":
        # Export tüm audit log'ları ister (filtre yok). Pagination'a uymak
        # için page_size=200 max sayıdaki kadar çekiyoruz; export'un kendisi
        # ileride streaming/chunked'a dönüşürse pagination kapısı kalır.
        rows, _total = await user_management_service.list_audit_logs(
            db, page=1, page_size=min(max(limit, 1), 200)
        )
    else:
        rows = await export_service.get_rows(db, kind, limit=limit)

    blob, content_type = export_service.encode(rows, fmt)
    filename = f"{kind}.{fmt}"
    return StreamingResponse(
        iter([blob]),
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
