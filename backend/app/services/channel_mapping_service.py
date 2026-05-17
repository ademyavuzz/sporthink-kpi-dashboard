"""ChannelMapping CRUD — `(source, medium) → channel_group` referans tablosu.

GA4 trafik satırlarında `derived_channel` post-processing bu tablodan çözülür.
Liste cache 30dk TTL ile `cache_keys.channel_mapping_list()`'te tutulur;
mutasyon sonrası invalide edilir.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache_keys
from app.core.exceptions import ConflictError, ResourceNotFoundError
from app.models import ChannelMapping
from app.services.cache_service import cache


async def list_mappings(db: AsyncSession) -> list[ChannelMapping]:
    """Geriye uyumlu basit liste (cache, export gibi non-paginated kullanım)."""
    result = await db.execute(
        select(ChannelMapping)
        .where(ChannelMapping.deleted_at.is_(None))
        .order_by(ChannelMapping.id)
    )
    return list(result.scalars().all())


async def list_mappings_paginated(
    db: AsyncSession, *, page: int, page_size: int
) -> tuple[list[ChannelMapping], int]:
    """Returns: (page_rows, total)."""
    from sqlalchemy import func

    total = int(
        (
            await db.execute(
                select(func.count())
                .select_from(ChannelMapping)
                .where(ChannelMapping.deleted_at.is_(None))
            )
        ).scalar_one()
    )
    result = await db.execute(
        select(ChannelMapping)
        .where(ChannelMapping.deleted_at.is_(None))
        .order_by(ChannelMapping.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all()), total


async def get_mapping(db: AsyncSession, mapping_id: int) -> ChannelMapping:
    row = await db.get(ChannelMapping, mapping_id)
    if row is None or row.deleted_at is not None:
        raise ResourceNotFoundError(params={"mapping_id": mapping_id})
    return row


async def create_mapping(
    db: AsyncSession,
    *,
    source: str,
    medium: str,
    channel_group: str,
    notes: str | None,
    actor_id: int,
) -> ChannelMapping:
    # Aktif (source, medium) zaten varsa explicit ConflictError. DB-level
    # `uk_source_medium_active` generated column üzerinde aynısını engelliyor
    # (son güvenlik ağı), ama bu check temiz 409 + i18n key üretir.
    existing = await db.execute(
        select(ChannelMapping).where(
            ChannelMapping.source == source,
            ChannelMapping.medium == medium,
            ChannelMapping.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ConflictError(
            "Channel mapping with this (source, medium) already exists",
            field="source_medium",
            params={"source": source, "medium": medium},
        )

    row = ChannelMapping(
        source=source,
        medium=medium,
        channel_group=channel_group,
        notes=notes,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    await cache.delete(cache_keys.channel_mapping_list())
    return row


async def update_mapping(
    db: AsyncSession,
    mapping_id: int,
    *,
    channel_group: str | None,
    notes: str | None,
    actor_id: int,
) -> ChannelMapping:
    row = await get_mapping(db, mapping_id)
    if channel_group is not None:
        row.channel_group = channel_group
    if notes is not None:
        row.notes = notes
    row.updated_by = actor_id
    await db.commit()
    await db.refresh(row)
    await cache.delete(cache_keys.channel_mapping_list())
    return row


async def soft_delete_mapping(db: AsyncSession, mapping_id: int) -> None:
    row = await get_mapping(db, mapping_id)
    row.deleted_at = datetime.now(UTC)
    await db.commit()
    await cache.delete(cache_keys.channel_mapping_list())
