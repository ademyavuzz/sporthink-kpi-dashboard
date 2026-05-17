"""Admin endpoint'leri: users, audit logs, channel mapping, aggregations rebuild,
segments, saved views, RFM, filters, export.

Bu router büyük; pratik için tek dosyada — Sprint 10'da modüler ayrılabilir.
"""

from __future__ import annotations

from datetime import date as date_type
from typing import Literal

from fastapi import APIRouter, Body, Depends, Path, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache_keys
from app.core.exceptions import ResourceNotFoundError
from app.core.permissions import Permission
from app.dependencies import get_db, require_permission
from app.models import Role, User
from app.schemas import PaginatedEnvelope, PaginationMeta, SuccessEnvelope
from app.schemas.admin import (
    AdminPasswordResetResponse,
    AuditLogItem,
    ChannelMappingCreate,
    ChannelMappingItem,
    ChannelMappingUpdate,
    PermissionItem,
    RFMResponse,
    RFMRow,
    RoleCreate,
    RoleDetail,
    RoleListItem,
    RoleSummaryAdmin,
    RoleUpdate,
    SavedViewCreate,
    SavedViewItem,
    SavedViewUpdate,
    SegmentCreate,
    SegmentItem,
    SegmentPreviewResponse,
    SegmentUpdate,
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
    segment_service,
    user_management_service,
)
from app.services.cache_service import cache

router = APIRouter(tags=["admin"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


# ---------------------------------------------------------------------- #
# /filters/* — multi-select dropdown sources
# ---------------------------------------------------------------------- #


@router.get(
    "/filters/channels",
    response_model=SuccessEnvelope[list[str]],
    summary="Distinct kanal listesi",
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
    summary="Distinct cihaz listesi",
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
    summary="Distinct şehir listesi (top 100)",
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
    summary="Distinct ürün kategorisi listesi",
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
    summary="Distinct marka listesi",
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
    summary="Sipariş ödeme yöntemi enum listesi",
)
async def get_filter_payment_methods(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
) -> SuccessEnvelope[list[str]]:
    return SuccessEnvelope(data=filter_service.order_payment_methods())


@router.get(
    "/filters/order-statuses",
    response_model=SuccessEnvelope[list[str]],
    summary="Sipariş durumu enum listesi",
)
async def get_filter_order_statuses(
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
) -> SuccessEnvelope[list[str]]:
    return SuccessEnvelope(data=filter_service.order_statuses())


# ---------------------------------------------------------------------- #
# /admin/aggregations/rebuild
# ---------------------------------------------------------------------- #


@router.post(
    "/admin/aggregations/rebuild",
    response_model=SuccessEnvelope[dict],
    summary="Aggregation tablolarını manuel yeniden hesapla",
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
    summary="Audit log listesi — sayfalı (en yeni → eski)",
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
# /admin/channel-mappings — CRUD
# ---------------------------------------------------------------------- #


@router.get(
    "/admin/channel-mappings",
    response_model=SuccessEnvelope[list[ChannelMappingItem]],
    summary="Tüm channel mapping kayıtları",
)
async def list_channel_mappings(
    _user: User = Depends(require_permission(Permission.MAPPINGS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[ChannelMappingItem]]:
    rows = await channel_mapping_service.list_mappings(db)
    return SuccessEnvelope(data=[ChannelMappingItem.model_validate(r) for r in rows])


@router.get(
    "/admin/channel-mappings/{mapping_id}",
    response_model=SuccessEnvelope[ChannelMappingItem],
    summary="Tek channel mapping detayı",
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
    summary="Yeni channel mapping ekle",
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
)
async def delete_channel_mapping(
    mapping_id: int = Path(..., ge=1),
    _user: User = Depends(require_permission(Permission.MAPPINGS_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await channel_mapping_service.soft_delete_mapping(db, mapping_id)
    return SuccessEnvelope(data={"deleted": True, "id": mapping_id})


# ---------------------------------------------------------------------- #
# /roles + /permissions — RBAC yönetimi
# ---------------------------------------------------------------------- #


@router.get(
    "/roles",
    response_model=SuccessEnvelope[list[RoleListItem]],
    summary="Tüm rolleri listele (kullanıcı + izin sayısı ile)",
)
async def list_roles_endpoint(
    _user: User = Depends(require_permission(Permission.ROLES_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[RoleListItem]]:
    items = await role_service.list_roles(db)
    return SuccessEnvelope(data=[RoleListItem(**i) for i in items])


@router.get(
    "/roles/{role_id}",
    response_model=SuccessEnvelope[RoleDetail],
    summary="Rol detayı + atanmış izin kodları",
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
    summary="Yeni rol oluştur + izinleri ata",
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
    summary="Rol güncelle (ad, açıklama, izinler)",
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
    summary="Rol sil (cascade: kullanıcılar pasifleşir, refresh tokens revoke)",
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
    summary="43 izni 4 kategori altında listele (rol oluşturma UI'ı için)",
)
async def list_permissions_endpoint(
    _user: User = Depends(require_permission(Permission.ROLES_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict[str, list[PermissionItem]]]:
    grouped = await role_service.list_permissions_grouped(db)
    return SuccessEnvelope(data={k: [PermissionItem(**p) for p in v] for k, v in grouped.items()})


# ---------------------------------------------------------------------- #
# /users — CRUD + invite + admin password reset
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
    summary="Kullanıcı listesi — sayfalı",
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
    "/users/{user_id}",
    response_model=SuccessEnvelope[UserListItem],
    summary="Tek kullanıcı detayı",
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
    summary="Yeni kullanıcı davet et — kullanıcı kendi şifresini belirler",
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
    summary="Admin: kullanıcının emailine şifre sıfırlama linki gönderir",
)
async def admin_reset_password(
    request: Request,
    user_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.USERS_RESET_PASSWORD)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[AdminPasswordResetResponse]:
    """Süper Admin başkasının şifresini sıfırlar — kullanıcının emailine
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
# /segments — CRUD + RFM
# ---------------------------------------------------------------------- #


@router.get(
    "/segments",
    response_model=SuccessEnvelope[list[SegmentItem]],
)
async def list_segments(
    current: User = Depends(require_permission(Permission.SEGMENTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[SegmentItem]]:
    rows = await segment_service.list_for_user(db, user_id=current.id)
    return SuccessEnvelope(data=[SegmentItem.model_validate(r) for r in rows])


@router.post(
    "/segments",
    response_model=SuccessEnvelope[SegmentItem],
)
async def create_segment(
    payload: SegmentCreate,
    current: User = Depends(require_permission(Permission.SEGMENTS_CREATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[SegmentItem]:
    seg = await segment_service.create_segment(
        db,
        user_id=current.id,
        name=payload.name,
        description=payload.description,
        rules=payload.rules,
        is_shared=payload.is_shared,
    )
    return SuccessEnvelope(data=SegmentItem.model_validate(seg))


@router.post(
    "/segments/preview",
    response_model=SuccessEnvelope[SegmentPreviewResponse],
    summary="Segment kuralını uygulamadan önce sayım + örnek müşteriler",
)
async def preview_segment(
    payload: SegmentCreate,
    _user: User = Depends(require_permission(Permission.SEGMENTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[SegmentPreviewResponse]:
    count = await segment_service.evaluate_count(db, payload.rules)
    sample_customers = await segment_service.list_customers(db, payload.rules, limit=10)
    sample = [
        {
            "customer_id": c.customer_id,
            "customer_name": c.customer_name,
            "city": c.city,
            "total_orders": c.total_orders,
            "total_revenue": str(c.total_revenue),
        }
        for c in sample_customers
    ]
    return SuccessEnvelope(data=SegmentPreviewResponse(count=count, sample=sample))


@router.patch(
    "/segments/{segment_id}",
    response_model=SuccessEnvelope[SegmentItem],
)
async def update_segment(
    payload: SegmentUpdate,
    segment_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.SEGMENTS_UPDATE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[SegmentItem]:
    seg = await segment_service.update_segment(
        db,
        segment_id,
        actor=current,
        name=payload.name,
        description=payload.description,
        rules=payload.rules,
        is_shared=payload.is_shared,
    )
    return SuccessEnvelope(data=SegmentItem.model_validate(seg))


@router.delete(
    "/segments/{segment_id}",
    response_model=SuccessEnvelope[dict],
)
async def delete_segment(
    segment_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.SEGMENTS_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await segment_service.soft_delete_segment(db, segment_id, actor=current)
    return SuccessEnvelope(data={"deleted": True, "id": segment_id})


@router.get(
    "/segments/rfm",
    response_model=SuccessEnvelope[RFMResponse],
    summary="RFM tablo + segment dağılımı",
)
async def get_rfm(
    reference_date: date_type | None = Query(None),
    _user: User = Depends(require_permission(Permission.SEGMENTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[RFMResponse]:
    ref = reference_date or date_type.today()
    rows = await segment_service.rfm_table(db, reference_date=ref)
    distribution = await segment_service.rfm_distribution(db, reference_date=ref)
    return SuccessEnvelope(
        data=RFMResponse(
            reference_date=ref,
            rows=[RFMRow(**r) for r in rows],
            distribution=distribution,
        )
    )


# `/segments/{segment_id}` (GET) burada — `/segments/rfm`'den SONRA tanımlandı
# çünkü FastAPI route'ları sırayla eşler; aksi halde "rfm" int parse'a düşer
# ve 422 alırız. PATCH/DELETE `{segment_id}` farklı method olduğu için yukarıda
# tanımlı olsa da çakışma yapmaz.
@router.get(
    "/segments/{segment_id}",
    response_model=SuccessEnvelope[SegmentItem],
    summary="Tek segment detayı (sahibi olmasa bile shared ise görür)",
)
async def get_segment_endpoint(
    segment_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.SEGMENTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[SegmentItem]:
    seg = await segment_service.get_segment(db, segment_id)
    # Görünürlük kuralı list_for_user ile aynı: kendi segmenti VEYA paylaşılmış.
    if seg.user_id != current.id and not seg.is_shared:
        raise ResourceNotFoundError(params={"segment_id": segment_id})
    return SuccessEnvelope(data=SegmentItem.model_validate(seg))


# ---------------------------------------------------------------------- #
# /saved-views — CRUD
# ---------------------------------------------------------------------- #


@router.get(
    "/saved-views",
    response_model=SuccessEnvelope[list[SavedViewItem]],
)
async def list_saved_views(
    page: str | None = Query(None),
    current: User = Depends(require_permission(Permission.VIEWS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[list[SavedViewItem]]:
    rows = await saved_view_service.list_views(db, user_id=current.id, page=page)
    return SuccessEnvelope(data=[SavedViewItem.model_validate(r) for r in rows])


@router.get(
    "/saved-views/{view_id}",
    response_model=SuccessEnvelope[SavedViewItem],
    summary="Tek saved view detayı (sadece kendi view'ı)",
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
)
async def delete_saved_view(
    view_id: int = Path(..., ge=1),
    current: User = Depends(require_permission(Permission.VIEWS_DELETE)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await saved_view_service.soft_delete_view(db, view_id, user_id=current.id)
    return SuccessEnvelope(data={"deleted": True, "id": view_id})


# ---------------------------------------------------------------------- #
# /export/{table} — CSV/JSON/XLSX
# ---------------------------------------------------------------------- #


@router.get(
    "/export/{kind}",
    summary="Veriyi CSV/JSON/XLSX olarak indir",
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
    # `audit_logs` özel — kaynak ve permission semantiği farklı (LOGS_VIEW_AUDIT
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
