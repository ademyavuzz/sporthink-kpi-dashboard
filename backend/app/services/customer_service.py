"""Müşteri analizi — `/dashboard/customers` için aggregation'lar.

Ana kaynaklar:
- `customers` tablosu: 5000 satır, gender/age/city/total_orders/total_revenue
  alanları doğrudan kullanılır
- `orders` tablosu: yeni müşteri tarihi serisi için (ilk siparişi seçili
  aralıkta olanlar)

Tüm değerler aktif (`deleted_at IS NULL`) müşterilere göredir. KPI'ların
karşılaştırma değeri (önceki periyot) "yeni müşteri" için hesaplanır;
diğer KPI'lar zaman bazlı olmadığı için karşılaştırma yok (None döner).

`docs/overview/09-kpi-formulas.md`'de müşteri-spesifik formüller olmadığı için
bu dosya kendi formüllerini tanımlar; bu sayfa overview niteliğindedir.
"""

from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Customer
from app.schemas.dashboard import (
    CustomerDailyPoint,
    CustomerFreqBucket,
    CustomerOverviewRow,
    DimensionBreakdown,
    NewsletterCompare,
)
from app.schemas.kpi import KPIResult


def _kpi(
    *,
    kpi_id: str,
    label_tr: str,
    value: Decimal | int | None,
    unit: str,
    previous_value: Decimal | int | None = None,
    direction_positive: str = "up",
) -> KPIResult:
    """KPIResult helper — değişim yüzdesi ve trend yönünü hesaplar."""
    if previous_value is None or value is None or Decimal(str(previous_value)) == 0:
        change_pct: Decimal | None = None
        is_positive = True
        direction: str = "flat"
    else:
        prev = Decimal(str(previous_value))
        cur = Decimal(str(value))
        change_pct = ((cur - prev) / prev * 100).quantize(Decimal("0.01"))
        if change_pct == 0:
            direction = "flat"
            is_positive = True
        elif change_pct > 0:
            direction = "up"
            is_positive = direction_positive == "up"
        else:
            direction = "down"
            is_positive = direction_positive == "down"
    decimal_value = Decimal(str(value)) if value is not None else None
    decimal_prev = Decimal(str(previous_value)) if previous_value is not None else None
    return KPIResult(
        kpi_id=kpi_id,
        label_tr=label_tr,
        value=decimal_value,
        previous_value=decimal_prev,
        change_percentage=change_pct,
        direction=direction,  # type: ignore[arg-type]
        is_positive=is_positive,
        unit=unit,  # type: ignore[arg-type]
        trend_direction_positive=direction_positive,  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------- #
# Segment filtreleri (additive)
# ---------------------------------------------------------------------- #


def _segment_clauses(
    *,
    genders: list[str] | None = None,
    age_groups: list[str] | None = None,
    cities: list[str] | None = None,
) -> list[Any]:
    """Opsiyonel müşteri segment filtreleri için WHERE parçaları.

    Hiçbiri verilmediğinde boş liste döner; bu sayede filtresiz çağrılar
    (genders/age_groups/cities = None) değişiklikten öncekiyle birebir aynı
    SQL'i üretir. Verildiğinde ilgili kolona `IN (...)` daraltması eklenir.
    """
    clauses: list[Any] = []
    if genders:
        clauses.append(Customer.gender.in_(genders))
    if age_groups:
        clauses.append(Customer.age_group.in_(age_groups))
    if cities:
        clauses.append(Customer.city.in_(cities))
    return clauses


# ---------------------------------------------------------------------- #
# Top-level KPI'lar
# ---------------------------------------------------------------------- #


async def total_customers(db: AsyncSession, *, segment: list[Any] | None = None) -> int:
    stmt = select(func.count(Customer.id)).where(Customer.deleted_at.is_(None), *(segment or []))
    return int((await db.execute(stmt)).scalar() or 0)


async def new_customers_in_range(
    db: AsyncSession,
    *,
    date_from: date_type,
    date_to: date_type,
    segment: list[Any] | None = None,
) -> int:
    stmt = select(func.count(Customer.id)).where(
        Customer.deleted_at.is_(None),
        Customer.first_order_date >= date_from,
        Customer.first_order_date <= date_to,
        *(segment or []),
    )
    return int((await db.execute(stmt)).scalar() or 0)


async def repeat_rate(db: AsyncSession, *, segment: list[Any] | None = None) -> Decimal | None:
    """%(orders >= 2) / total. Aktif müşteri yoksa None."""
    stmt = select(
        func.sum(case((Customer.total_orders >= 2, 1), else_=0)),
        func.count(Customer.id),
    ).where(Customer.deleted_at.is_(None), *(segment or []))
    row = (await db.execute(stmt)).one()
    repeat, total = int(row[0] or 0), int(row[1] or 0)
    if total == 0:
        return None
    return (Decimal(repeat) / Decimal(total) * 100).quantize(Decimal("0.01"))


async def avg_customer_value(
    db: AsyncSession, *, segment: list[Any] | None = None
) -> Decimal | None:
    stmt = select(func.avg(Customer.total_revenue)).where(
        Customer.deleted_at.is_(None), *(segment or [])
    )
    val = (await db.execute(stmt)).scalar()
    return Decimal(val).quantize(Decimal("0.01")) if val is not None else None


async def avg_orders_per_customer(
    db: AsyncSession, *, segment: list[Any] | None = None
) -> Decimal | None:
    stmt = select(func.avg(Customer.total_orders)).where(
        Customer.deleted_at.is_(None), *(segment or [])
    )
    val = (await db.execute(stmt)).scalar()
    return Decimal(val).quantize(Decimal("0.01")) if val is not None else None


async def newsletter_subscription_rate(
    db: AsyncSession, *, segment: list[Any] | None = None
) -> Decimal | None:
    stmt = select(
        func.sum(case((Customer.is_newsletter_subscriber.is_(True), 1), else_=0)),
        func.count(Customer.id),
    ).where(Customer.deleted_at.is_(None), *(segment or []))
    row = (await db.execute(stmt)).one()
    sub, total = int(row[0] or 0), int(row[1] or 0)
    if total == 0:
        return None
    return (Decimal(sub) / Decimal(total) * 100).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------- #
# Breakdown'lar
# ---------------------------------------------------------------------- #


async def by_gender(
    db: AsyncSession, *, segment: list[Any] | None = None
) -> list[DimensionBreakdown]:
    """Cinsiyet dağılımı (male/female/null = 'Bilinmiyor')."""
    stmt = (
        select(Customer.gender, func.count(Customer.id))
        .where(Customer.deleted_at.is_(None), *(segment or []))
        .group_by(Customer.gender)
    )
    rows = (await db.execute(stmt)).all()
    return [
        DimensionBreakdown(
            label=g.value if g is not None else "unknown",
            value=Decimal(c),
        )
        for g, c in rows
    ]


async def by_age_group(
    db: AsyncSession, *, segment: list[Any] | None = None
) -> list[DimensionBreakdown]:
    """Yaş grubu dağılımı (boş enum = 'unknown')."""
    stmt = (
        select(Customer.age_group, func.count(Customer.id))
        .where(Customer.deleted_at.is_(None), *(segment or []))
        .group_by(Customer.age_group)
    )
    rows = (await db.execute(stmt)).all()
    # Sıralama enum'a uygun olsun
    order = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
    items = {(g.value if g is not None else "unknown"): Decimal(c) for g, c in rows}
    out: list[DimensionBreakdown] = []
    for key in order:
        if key in items:
            out.append(DimensionBreakdown(label=key, value=items[key]))
    if "unknown" in items:
        out.append(DimensionBreakdown(label="unknown", value=items["unknown"]))
    return out


async def by_city(
    db: AsyncSession, limit: int = 10, *, segment: list[Any] | None = None
) -> list[DimensionBreakdown]:
    stmt = (
        select(Customer.city, func.count(Customer.id).label("c"))
        .where(Customer.deleted_at.is_(None), Customer.city.is_not(None), *(segment or []))
        .group_by(Customer.city)
        .order_by(func.count(Customer.id).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [DimensionBreakdown(label=city or "unknown", value=Decimal(c)) for city, c in rows]


async def order_frequency_buckets(
    db: AsyncSession, *, segment: list[Any] | None = None
) -> list[CustomerFreqBucket]:
    """1, 2, 3, 4, 5-9, 10+ kovaları."""
    bucket_expr = case(
        (Customer.total_orders == 1, "1"),
        (Customer.total_orders == 2, "2"),
        (Customer.total_orders == 3, "3"),
        (Customer.total_orders == 4, "4"),
        (Customer.total_orders.between(5, 9), "5-9"),
        (Customer.total_orders >= 10, "10+"),
        else_="0",
    )
    stmt = (
        select(bucket_expr.label("bucket"), func.count(Customer.id))
        .where(Customer.deleted_at.is_(None), *(segment or []))
        .group_by(bucket_expr)
    )
    rows = (await db.execute(stmt)).all()
    order = ["0", "1", "2", "3", "4", "5-9", "10+"]
    items = {b: int(c) for b, c in rows}
    return [CustomerFreqBucket(bucket=b, customer_count=items[b]) for b in order if b in items]


async def newsletter_comparison(
    db: AsyncSession, *, segment: list[Any] | None = None
) -> list[NewsletterCompare]:
    stmt = (
        select(
            Customer.is_newsletter_subscriber,
            func.count(Customer.id),
            func.avg(Customer.total_orders),
            func.avg(Customer.total_revenue),
        )
        .where(Customer.deleted_at.is_(None), *(segment or []))
        .group_by(Customer.is_newsletter_subscriber)
    )
    rows = (await db.execute(stmt)).all()
    return [
        NewsletterCompare(
            is_subscriber=bool(sub),
            customer_count=int(cnt or 0),
            avg_orders=Decimal(avg_o or 0).quantize(Decimal("0.01")),
            avg_revenue=Decimal(avg_r or 0).quantize(Decimal("0.01")),
        )
        for sub, cnt, avg_o, avg_r in rows
    ]


async def daily_new_customers(
    db: AsyncSession,
    *,
    date_from: date_type,
    date_to: date_type,
    segment: list[Any] | None = None,
) -> list[CustomerDailyPoint]:
    """Seçili aralıkta her gün için ilk-siparişi-bugün olan müşteri sayısı."""
    stmt = (
        select(Customer.first_order_date, func.count(Customer.id))
        .where(
            Customer.deleted_at.is_(None),
            Customer.first_order_date >= date_from,
            Customer.first_order_date <= date_to,
            *(segment or []),
        )
        .group_by(Customer.first_order_date)
        .order_by(Customer.first_order_date)
    )
    rows = (await db.execute(stmt)).all()
    return [CustomerDailyPoint(date=d, new_customers=int(c)) for d, c in rows]


async def top_customers(
    db: AsyncSession, *, limit: int = 20, segment: list[Any] | None = None
) -> list[CustomerOverviewRow]:
    stmt = (
        select(Customer)
        .where(Customer.deleted_at.is_(None), *(segment or []))
        .order_by(Customer.total_revenue.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [
        CustomerOverviewRow(
            customer_id=c.customer_id,
            customer_name=c.customer_name,
            city=c.city,
            gender=c.gender.value if c.gender else None,
            age_group=c.age_group.value if c.age_group else None,
            total_orders=c.total_orders,
            total_revenue=c.total_revenue,
            last_order_date=c.last_order_date,
        )
        for c in rows
    ]


# ---------------------------------------------------------------------- #
# Tek noktada full payload
# ---------------------------------------------------------------------- #


async def calculate_customer_overview(
    db: AsyncSession,
    *,
    date_from: date_type,
    date_to: date_type,
    prev_from: date_type,
    prev_to: date_type,
    genders: list[str] | None = None,
    age_groups: list[str] | None = None,
    cities: list[str] | None = None,
) -> dict:
    """Endpoint için tek-noktada bütün payload.

    Sıralı sorgular — tek session, bcrypt-yoğun bir iş yok, latency düşük.
    Önemli sayıdaysa gelecekte `asyncio.gather` ile paralelleştirilebilir.

    `genders`/`age_groups`/`cities` opsiyonel additive segment filtreleridir.
    Hiçbiri verilmediğinde (None) `segment` boş listedir ve tüm KPI/dağılım
    sorguları yalnızca `deleted_at IS NULL` ile çalışır — yani sonuçlar
    değişiklikten öncekiyle birebir aynıdır. Verildiğinde aynı `IN (...)`
    daraltması hem KPI'lara hem dağılım/liste bloklarına tutarlı uygulanır.
    """
    segment = _segment_clauses(genders=genders, age_groups=age_groups, cities=cities)

    total = await total_customers(db, segment=segment)
    new_now = await new_customers_in_range(
        db, date_from=date_from, date_to=date_to, segment=segment
    )
    new_prev = await new_customers_in_range(
        db, date_from=prev_from, date_to=prev_to, segment=segment
    )
    repeat = await repeat_rate(db, segment=segment)
    acv = await avg_customer_value(db, segment=segment)
    aopc = await avg_orders_per_customer(db, segment=segment)
    nlr = await newsletter_subscription_rate(db, segment=segment)

    gender = await by_gender(db, segment=segment)
    age = await by_age_group(db, segment=segment)
    cities_breakdown = await by_city(db, limit=10, segment=segment)
    freq = await order_frequency_buckets(db, segment=segment)
    nl_compare = await newsletter_comparison(db, segment=segment)
    daily = await daily_new_customers(db, date_from=date_from, date_to=date_to, segment=segment)
    top = await top_customers(db, limit=20, segment=segment)

    return {
        "total_customers": _kpi(
            kpi_id="total_customers",
            label_tr="Toplam Müşteri",
            value=total,
            unit="count",
        ),
        "new_customers": _kpi(
            kpi_id="new_customers",
            label_tr="Yeni Müşteri",
            value=new_now,
            previous_value=new_prev,
            unit="count",
        ),
        "repeat_rate": _kpi(
            kpi_id="repeat_rate",
            label_tr="Tekrar Eden Oranı",
            value=repeat,
            unit="percent",
        ),
        "avg_customer_value": _kpi(
            kpi_id="avg_customer_value",
            label_tr="Ort. Müşteri Değeri",
            value=acv,
            unit="currency",
        ),
        "avg_orders_per_customer": _kpi(
            kpi_id="avg_orders_per_customer",
            label_tr="Kişi Başı Sipariş",
            value=aopc,
            unit="count",
        ),
        "newsletter_subscription_rate": _kpi(
            kpi_id="newsletter_subscription_rate",
            label_tr="Newsletter Abonelik",
            value=nlr,
            unit="percent",
        ),
        "by_gender": gender,
        "by_age_group": age,
        "by_city": cities_breakdown,
        "order_frequency": freq,
        "newsletter_comparison": nl_compare,
        "daily_new_customers": daily,
        "top_customers": top,
    }
