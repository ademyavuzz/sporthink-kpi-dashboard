"""Kanal Analizi sayfası — `/dashboard/channel-analysis` için aggregation'lar.

Mevcut `kpi_daily_aggregates` tablosu (channel × platform × device kırılımı)
üzerinden çalışır. Tüm metrikler tek tablodan geldiği için sorgular hızlı.

Kanal başına raporlanan metrikler:
- revenue, orders, items_sold (e-ticaret)
- sessions, users (GA4)
- impressions, clicks, spend, ad_revenue (reklam)
- conversion_rate = orders / sessions × 100
- ROAS = ad_revenue / spend
- AOV = revenue / orders
- distinct customer count (orders tablosundan)

`docs/overview/09-kpi-formulas.md` §9.6.2 Kanal bazlı dönüşüm + §9.6.1 ciro.
"""

from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import KPIDailyAggregate, Order
from app.schemas.dashboard import (
    ChannelDailyPoint,
    ChannelPerformanceRow,
    DimensionBreakdown,
)
from app.schemas.kpi import KPIResult

# ---------------------------------------------------------------------- #
# KPIResult helper (kpi_service'tekiyle özdeş davranış — küçük + bağımsız)
# ---------------------------------------------------------------------- #


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

    return KPIResult(
        kpi_id=kpi_id,
        label_tr=label_tr,
        value=Decimal(str(value)) if value is not None else None,
        previous_value=Decimal(str(previous_value)) if previous_value is not None else None,
        change_percentage=change_pct,
        direction=direction,  # type: ignore[arg-type]
        is_positive=is_positive,
        unit=unit,  # type: ignore[arg-type]
        trend_direction_positive=direction_positive,  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------- #
# Kanal × tüm metrikler (tek sorgu)
# ---------------------------------------------------------------------- #


async def channel_performance_table(
    db: AsyncSession,
    *,
    date_from: date_type,
    date_to: date_type,
    channels: list[str] | None = None,
    devices: list[str] | None = None,
) -> list[ChannelPerformanceRow]:
    """Tüm kanalların seçili periyotta tek satır halinde özeti.

    Müşteri sayısı için ayrı sorgu (orders tablosundan distinct customer_pk_id).
    `channels` / `devices` boş değilse pre-aggregation filtre uygulanır.
    """
    # Ana metrikler
    base_filters = [
        KPIDailyAggregate.date >= date_from,
        KPIDailyAggregate.date <= date_to,
        KPIDailyAggregate.channel.is_not(None),
    ]
    if channels:
        base_filters.append(KPIDailyAggregate.channel.in_(channels))
    if devices:
        base_filters.append(KPIDailyAggregate.device.in_(devices))

    base_stmt = (
        select(
            KPIDailyAggregate.channel,
            func.coalesce(func.sum(KPIDailyAggregate.revenue), 0).label("revenue"),
            func.coalesce(func.sum(KPIDailyAggregate.orders), 0).label("orders"),
            func.coalesce(func.sum(KPIDailyAggregate.sessions), 0).label("sessions"),
            func.coalesce(func.sum(KPIDailyAggregate.spend), 0).label("ad_spend"),
            func.coalesce(func.sum(KPIDailyAggregate.ad_revenue), 0).label("ad_revenue"),
        )
        .where(and_(*base_filters))
        .group_by(KPIDailyAggregate.channel)
        .order_by(func.sum(KPIDailyAggregate.revenue).desc())
    )
    rows = (await db.execute(base_stmt)).all()

    # Müşteri sayıları (orders tablosundan, parallel sorgu).
    # Aggregate ile aynı statü kümesi: gerçekleşmiş satışlar
    # (completed/shipped/refunded). pending+cancelled sayılmaz.
    cust_filters = [
        Order.order_date >= date_from,
        Order.order_date <= date_to,
        Order.order_status.in_(("completed", "shipped", "refunded")),
    ]
    if channels:
        cust_filters.append(Order.channel.in_(channels))
    if devices:
        cust_filters.append(Order.device.in_(devices))

    cust_stmt = (
        select(
            Order.channel,
            func.count(func.distinct(Order.customer_pk_id)).label("customers"),
        )
        .where(and_(*cust_filters))
        .group_by(Order.channel)
    )
    cust_rows = (await db.execute(cust_stmt)).all()
    customers_map = {c: int(n) for c, n in cust_rows}

    out: list[ChannelPerformanceRow] = []
    for r in rows:
        revenue = Decimal(r.revenue or 0)
        orders = int(r.orders or 0)
        sessions = int(r.sessions or 0)
        ad_spend = Decimal(r.ad_spend or 0)
        ad_rev = Decimal(r.ad_revenue or 0)
        conv_rate = (
            (Decimal(orders) / Decimal(sessions) * 100).quantize(Decimal("0.01"))
            if sessions > 0
            else None
        )
        roas = (ad_rev / ad_spend).quantize(Decimal("0.01")) if ad_spend > 0 else None
        aov = (revenue / Decimal(orders)).quantize(Decimal("0.01")) if orders > 0 else None
        out.append(
            ChannelPerformanceRow(
                channel=r.channel or "Unknown",
                revenue=revenue.quantize(Decimal("0.01")),
                orders=orders,
                sessions=sessions,
                conversion_rate=conv_rate,
                ad_spend=ad_spend.quantize(Decimal("0.01")),
                ad_revenue=ad_rev.quantize(Decimal("0.01")),
                roas=roas,
                customers=customers_map.get(r.channel, 0),
                aov=aov,
            )
        )
    return out


async def daily_revenue_by_top_channels(
    db: AsyncSession,
    *,
    date_from: date_type,
    date_to: date_type,
    top_n: int = 5,
    only_channels: list[str] | None = None,
) -> list[ChannelDailyPoint]:
    """Top N kanalın günlük cirosu — multi-series line chart için.

    `only_channels` verilirse sadece bu kanallar gösterilir (filter etkin
    olduğunda kullanılır).
    """
    if only_channels:
        top_channels = only_channels[:top_n]
    else:
        # Top kanalları bul
        top_stmt = (
            select(
                KPIDailyAggregate.channel,
                func.sum(KPIDailyAggregate.revenue).label("rev"),
            )
            .where(
                and_(
                    KPIDailyAggregate.date >= date_from,
                    KPIDailyAggregate.date <= date_to,
                    KPIDailyAggregate.channel.is_not(None),
                )
            )
            .group_by(KPIDailyAggregate.channel)
            .order_by(func.sum(KPIDailyAggregate.revenue).desc())
            .limit(top_n)
        )
        top_channels = [r.channel for r in (await db.execute(top_stmt)).all() if r.channel]
    if not top_channels:
        return []

    daily_stmt = (
        select(
            KPIDailyAggregate.date,
            KPIDailyAggregate.channel,
            func.coalesce(func.sum(KPIDailyAggregate.revenue), 0).label("rev"),
        )
        .where(
            and_(
                KPIDailyAggregate.date >= date_from,
                KPIDailyAggregate.date <= date_to,
                KPIDailyAggregate.channel.in_(top_channels),
            )
        )
        .group_by(KPIDailyAggregate.date, KPIDailyAggregate.channel)
        .order_by(KPIDailyAggregate.date, KPIDailyAggregate.channel)
    )
    rows = (await db.execute(daily_stmt)).all()
    return [
        ChannelDailyPoint(
            date=r.date,
            channel=r.channel,
            revenue=Decimal(r.rev or 0).quantize(Decimal("0.01")),
        )
        for r in rows
    ]


# ---------------------------------------------------------------------- #
# Endpoint için tek noktada full payload
# ---------------------------------------------------------------------- #


async def calculate_channel_overview(
    db: AsyncSession,
    *,
    date_from: date_type,
    date_to: date_type,
    channels: list[str] | None = None,
    devices: list[str] | None = None,
    revenue_min: Decimal | None = None,
    revenue_max: Decimal | None = None,
    orders_min: int | None = None,
    orders_max: int | None = None,
    roas_min: Decimal | None = None,
    roas_max: Decimal | None = None,
    conversion_min: Decimal | None = None,
    conversion_max: Decimal | None = None,
) -> dict[str, Any]:
    """Kanal sayfası için full payload + filtreler.

    Multi-select filtreler (channels/devices) source data'ya pre-aggregation
    uygulanır; range filtreler aggregation sonrası satırları filtreler.
    """
    table = await channel_performance_table(
        db,
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        devices=devices,
    )

    # Range filtreleri uygula (post-aggregation)
    def _within(value: Decimal | int | None, lo, hi) -> bool:
        if value is None:
            return lo is None and hi is None
        v = Decimal(str(value))
        if lo is not None and v < Decimal(str(lo)):
            return False
        return not (hi is not None and v > Decimal(str(hi)))

    table = [
        c
        for c in table
        if _within(c.revenue, revenue_min, revenue_max)
        and _within(c.orders, orders_min, orders_max)
        and (_within(c.roas, roas_min, roas_max) or (roas_min is None and roas_max is None))
        and (
            _within(c.conversion_rate, conversion_min, conversion_max)
            or (conversion_min is None and conversion_max is None)
        )
    ]

    # Daily trend için aktif kanal listesi (eğer filtre varsa, sadece o
    # kanalların trendi gösterilir)
    daily_channels = (
        [c.channel for c in table]
        if (
            channels
            or revenue_min
            or revenue_max
            or orders_min
            or orders_max
            or roas_min
            or roas_max
            or conversion_min
            or conversion_max
        )
        else None
    )
    daily = await daily_revenue_by_top_channels(
        db,
        date_from=date_from,
        date_to=date_to,
        top_n=5,
        only_channels=daily_channels,
    )

    # KPI'lar
    active = len([c for c in table if c.revenue > 0])
    sum((c.revenue for c in table), Decimal(0))
    total_ad_spend = sum((c.ad_spend for c in table), Decimal(0))
    total_ad_revenue = sum((c.ad_revenue for c in table), Decimal(0))
    total_sessions = sum((c.sessions for c in table), 0)
    total_orders = sum((c.orders for c in table), 0)

    top_rev = table[0].revenue if table else Decimal(0)

    avg_roas = (
        (total_ad_revenue / total_ad_spend).quantize(Decimal("0.01"))
        if total_ad_spend > 0
        else None
    )
    avg_conv = (
        (Decimal(total_orders) / Decimal(total_sessions) * 100).quantize(Decimal("0.01"))
        if total_sessions > 0
        else None
    )

    # Chart kırılımları
    revenue_distribution = [
        DimensionBreakdown(label=c.channel, value=c.revenue) for c in table[:10]
    ]
    roas_data = sorted(
        [c for c in table if c.roas is not None],
        key=lambda c: c.roas or Decimal(0),
        reverse=True,
    )[:10]
    roas_by_channel = [
        DimensionBreakdown(label=c.channel, value=c.roas or Decimal(0)) for c in roas_data
    ]
    conv_data = sorted(
        [c for c in table if c.conversion_rate is not None],
        key=lambda c: c.conversion_rate or Decimal(0),
        reverse=True,
    )[:10]
    conversion_by_channel = [
        DimensionBreakdown(label=c.channel, value=c.conversion_rate or Decimal(0))
        for c in conv_data
    ]

    return {
        "active_channels": _kpi(
            kpi_id="active_channels",
            label_tr="Aktif Kanal",
            value=active,
            unit="count",
        ),
        "top_channel_revenue": _kpi(
            kpi_id="top_channel_revenue",
            label_tr="En Yüksek Kanal Cirosu",
            value=top_rev,
            unit="currency",
        ),
        "avg_roas": _kpi(
            kpi_id="avg_roas",
            label_tr="Ortalama ROAS",
            value=avg_roas,
            unit="multiplier",
        ),
        "avg_conversion_rate": _kpi(
            kpi_id="avg_conversion_rate",
            label_tr="Ortalama Dönüşüm",
            value=avg_conv,
            unit="percent",
        ),
        "channels": table,
        "revenue_distribution": revenue_distribution,
        "roas_by_channel": roas_by_channel,
        "conversion_by_channel": conversion_by_channel,
        "daily_revenue_trend": daily,
    }
