"""Multi-select filter dropdown'ları için distinct değer servisleri."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GA4Traffic, KPIDailyAggregate, Order


async def distinct_channels(db: AsyncSession) -> list[str]:
    """Aggregate'lerden tüm distinct kanalları (alfabetik)."""
    stmt = (
        select(KPIDailyAggregate.channel)
        .where(KPIDailyAggregate.channel.isnot(None))
        .distinct()
        .order_by(KPIDailyAggregate.channel)
    )
    result = await db.execute(stmt)
    return [r[0] for r in result.all() if r[0]]


async def distinct_devices(db: AsyncSession) -> list[str]:
    """Aggregate'lerden tüm distinct cihazları."""
    stmt = (
        select(KPIDailyAggregate.device)
        .where(KPIDailyAggregate.device.isnot(None))
        .distinct()
        .order_by(KPIDailyAggregate.device)
    )
    result = await db.execute(stmt)
    return [r[0] for r in result.all() if r[0]]


async def distinct_cities(db: AsyncSession, *, limit: int = 100) -> list[str]:
    """GA4 ham tablodan + orders'tan birleşik şehir listesi (top N)."""
    ga4_stmt = select(GA4Traffic.city).where(GA4Traffic.city.isnot(None)).distinct().limit(limit)
    order_stmt = select(Order.city).where(Order.city.isnot(None)).distinct().limit(limit)
    cities: set[str] = set()
    for stmt in (ga4_stmt, order_stmt):
        for r in (await db.execute(stmt)).all():
            if r[0]:
                cities.add(r[0])
    return sorted(cities)
