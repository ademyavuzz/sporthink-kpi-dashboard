"""Multi-select filter dropdown'ları için distinct değer servisleri."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GA4Traffic, KPIDailyAggregate, Order, Product
from app.models.customer import CustomerAgeGroup, CustomerGender
from app.models.order import OrderPaymentMethod, OrderStatus


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


async def distinct_categories(db: AsyncSession) -> list[str]:
    """Aktif ürünlerin distinct kategorileri (alfabetik)."""
    stmt = (
        select(Product.category)
        .where(Product.deleted_at.is_(None))
        .distinct()
        .order_by(Product.category)
    )
    return [r[0] for r in (await db.execute(stmt)).all() if r[0]]


async def distinct_brands(db: AsyncSession) -> list[str]:
    """Aktif ürünlerin distinct markaları (alfabetik)."""
    stmt = (
        select(Product.brand).where(Product.deleted_at.is_(None)).distinct().order_by(Product.brand)
    )
    return [r[0] for r in (await db.execute(stmt)).all() if r[0]]


def order_payment_methods() -> list[str]:
    """Sabit enum — DB'ye sormaya gerek yok."""
    return [m.value for m in OrderPaymentMethod]


def order_statuses() -> list[str]:
    """Sabit enum — DB'ye sormaya gerek yok."""
    return [s.value for s in OrderStatus]


def customer_genders() -> list[str]:
    """Sabit enum — müşteri cinsiyet seçenekleri."""
    return [g.value for g in CustomerGender]


def customer_age_groups() -> list[str]:
    """Sabit enum — müşteri yaş grubu seçenekleri (artan)."""
    return [a.value for a in CustomerAgeGroup]
