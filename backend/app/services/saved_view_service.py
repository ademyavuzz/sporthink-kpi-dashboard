"""SavedView CRUD — kullanıcının dashboard filtre kombinasyonlarını saklar.

Her kullanıcı kendi view'larını görür/yönetir; cross-user erişim yok (router'da
`user_id` eşleşmiyorsa 404 — varlığı sızdırmamak için).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ResourceNotFoundError
from app.models import SavedView


async def list_views(
    db: AsyncSession,
    *,
    user_id: int,
    page_filter: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[SavedView], int]:
    """Kullanıcının kayıtlı görünümleri. Returns: (page_rows, total).

    `page_filter` = sayfa adı (örn: "overview", "traffic") — eski
    `page` parametresinin yeni adı; pagination `page` ile karışmasın diye.
    """
    from sqlalchemy import func

    base_where = [
        SavedView.deleted_at.is_(None),
        SavedView.user_id == user_id,
    ]
    if page_filter:
        base_where.append(SavedView.page == page_filter)

    total = int(
        (
            await db.execute(
                select(func.count()).select_from(SavedView).where(*base_where)
            )
        ).scalar_one()
    )

    stmt = (
        select(SavedView)
        .where(*base_where)
        .order_by(SavedView.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def get_view(db: AsyncSession, view_id: int, *, user_id: int) -> SavedView:
    """View'ı sahibine göre getir. Sahibi olmayan kullanıcı için de 404
    (varlığı sızdırmamak — 403 demek "var ama göremezsin" anlamına gelir)."""
    sv = await db.get(SavedView, view_id)
    if sv is None or sv.deleted_at is not None or sv.user_id != user_id:
        raise ResourceNotFoundError(params={"view_id": view_id})
    return sv


async def create_view(
    db: AsyncSession,
    *,
    user_id: int,
    page: str,
    name: str,
    description: str | None,
    filters: dict[str, Any],
    is_default: bool,
) -> SavedView:
    sv = SavedView(
        user_id=user_id,
        page=page,
        name=name,
        description=description,
        filters=filters,
        is_default=is_default,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(sv)
    await db.commit()
    await db.refresh(sv)
    return sv


async def update_view(
    db: AsyncSession,
    view_id: int,
    *,
    user_id: int,
    name: str | None,
    description: str | None,
    filters: dict[str, Any] | None,
    is_default: bool | None,
) -> SavedView:
    sv = await get_view(db, view_id, user_id=user_id)
    if name is not None:
        sv.name = name
    if description is not None:
        sv.description = description
    if filters is not None:
        sv.filters = filters
    if is_default is not None:
        sv.is_default = is_default
    sv.updated_by = user_id
    await db.commit()
    await db.refresh(sv)
    return sv


async def soft_delete_view(db: AsyncSession, view_id: int, *, user_id: int) -> None:
    sv = await get_view(db, view_id, user_id=user_id)
    sv.deleted_at = datetime.now(UTC)
    await db.commit()
