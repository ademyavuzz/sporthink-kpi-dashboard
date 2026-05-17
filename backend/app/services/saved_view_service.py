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


async def list_views(db: AsyncSession, *, user_id: int, page: str | None = None) -> list[SavedView]:
    stmt = select(SavedView).where(SavedView.deleted_at.is_(None), SavedView.user_id == user_id)
    if page:
        stmt = stmt.where(SavedView.page == page)
    stmt = stmt.order_by(SavedView.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _get_owned(db: AsyncSession, view_id: int, user_id: int) -> SavedView:
    sv = await db.get(SavedView, view_id)
    if sv is None or sv.deleted_at is not None or sv.user_id != user_id:
        # Sahibi olmayan view için de 404 — varlığı sızdırmamak için 403 değil.
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
    sv = await _get_owned(db, view_id, user_id)
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
    sv = await _get_owned(db, view_id, user_id)
    sv.deleted_at = datetime.now(UTC)
    await db.commit()
