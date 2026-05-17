"""Notifications router — `/api/v1/notifications/*`.

5 endpoint, hepsi sadece auth gerektirir (kullanıcı kendi bildirimleri
için izin gerekmez; her oturum açan kullanıcının kendi merkezi).

Bkz: docs/overview/05-rbac-security.md "Kişisel Sayfalar" — kullanıcı
kendi profilini, bildirim merkezini izin matrisi dışında görür.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import (
    MarkAllReadResponse,
    NotificationItem,
    PaginatedEnvelope,
    PaginationMeta,
    SuccessEnvelope,
    UnreadCountResponse,
)
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get(
    "",
    response_model=PaginatedEnvelope[NotificationItem],
    summary="Kullanıcının bildirimleri — sayfalı (en yeni → eski)",
)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEnvelope[NotificationItem]:
    rows, total = await notification_service.list_for_user(
        db, user_id=current.id, page=page, page_size=page_size
    )
    return PaginatedEnvelope(
        data=[NotificationItem.model_validate(r) for r in rows],
        pagination=PaginationMeta(page=page, page_size=page_size, total=total),
    )


@router.get(
    "/unread-count",
    response_model=SuccessEnvelope[UnreadCountResponse],
    summary="Okunmamış bildirim sayısı — TopBar rozeti için",
)
async def get_unread_count(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[UnreadCountResponse]:
    count = await notification_service.count_unread(db, user_id=current.id)
    return SuccessEnvelope(data=UnreadCountResponse(count=count))


@router.patch(
    "/{notification_id}/read",
    response_model=SuccessEnvelope[NotificationItem],
    summary="Tek bildirimi okundu işaretle",
)
async def mark_notification_read(
    notification_id: int = Path(..., ge=1),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[NotificationItem]:
    row = await notification_service.mark_read(
        db, notification_id=notification_id, user_id=current.id
    )
    return SuccessEnvelope(data=NotificationItem.model_validate(row))


@router.post(
    "/mark-all-read",
    response_model=SuccessEnvelope[MarkAllReadResponse],
    summary="Tüm bildirimleri okundu işaretle",
)
async def mark_all_notifications_read(
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[MarkAllReadResponse]:
    updated = await notification_service.mark_all_read(db, user_id=current.id)
    return SuccessEnvelope(data=MarkAllReadResponse(updated=updated))


@router.delete(
    "/{notification_id}",
    response_model=SuccessEnvelope[dict],
    summary="Bildirimi sil",
)
async def delete_notification(
    notification_id: int = Path(..., ge=1),
    current: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[dict]:
    await notification_service.delete(
        db, notification_id=notification_id, user_id=current.id
    )
    return SuccessEnvelope(data={"deleted": True, "id": notification_id})
