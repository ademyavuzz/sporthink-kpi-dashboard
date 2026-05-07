"""E-Ticaret sayfası için filtreli sorgular.

`/dashboard/ecom` endpoint'i kategori, marka, sipariş durumu, ödeme yöntemi
ve müşteri segmenti filtreleriyle çalışır. KPI'lar `kpi_*_aggregates`
tablolarında bu kırılımları taşımadığı için filtreli sorgular doğrudan
`orders` ve `order_items` tabloları üzerinden hesaplanır.

Filtre semantiği (`docs/09` §9.5, §9.6.4):
- `categories`/`brands`: bir sipariş, eşleşen ürün **içeriyorsa** dahil olur
  (EXISTS). KPI'lar sipariş bazında (tüm net_revenue) hesaplanır.
- `statuses`: belirtilmezse `completed/shipped/refunded` (gerçekleşen).
- `payment_methods`: orders.payment_method üzerinde IN.
- `segment_id`: segment kuralları → eşleşen müşteriler → orders.customer_pk_id IN.

Tüm para hesaplamaları `Decimal` ile yapılır; UI tarafına `_quantize` ile
2 ondalık yuvarlanmış olarak gönderilir.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import Select, and_, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ResourceNotFoundError
from app.models import Customer, Order, OrderItem, Product, Segment
from app.schemas.dashboard import (
    DimensionBreakdown,
    OrderDetailCustomer,
    OrderDetailResponse,
    OrderLineItem,
    OrderListRow,
)
from app.schemas.kpi import (
    ChannelMetric,
    CustomerTypeRevenue,
    DailySeriesPoint,
    KPIResult,
    TopCustomerRow,
    TopProductRow,
)
from app.services import segment_service
from app.services.kpi_service import _build_result, _quantize, _safe_div

logger = logging.getLogger(__name__)

_REALIZED_STATUSES: tuple[str, ...] = ("completed", "shipped", "refunded")


@dataclass(frozen=True)
class EcomFilters:
    """E-ticaret sayfası filtre seti."""

    date_from: date
    date_to: date
    categories: tuple[str, ...] = field(default_factory=tuple)
    brands: tuple[str, ...] = field(default_factory=tuple)
    statuses: tuple[str, ...] = field(default_factory=tuple)
    payment_methods: tuple[str, ...] = field(default_factory=tuple)
    customer_pk_ids: tuple[int, ...] | None = None  # segment'ten gelen liste

    def with_period(self, date_from: date, date_to: date) -> EcomFilters:
        """Karşılaştırma periyodu için aynı filtrelerle yeni instance döner."""
        return EcomFilters(
            date_from=date_from,
            date_to=date_to,
            categories=self.categories,
            brands=self.brands,
            statuses=self.statuses,
            payment_methods=self.payment_methods,
            customer_pk_ids=self.customer_pk_ids,
        )

    def is_unfiltered(self) -> bool:
        """Sadece tarih aralığı set edilmişse True. GA4 trafiği sipariş-level
        filtrelere (kategori/marka/segment) join edilemez; bu yüzden filtre
        varken `sessions` 0 döndürülür ("veri uygulanamadı"). Filtre yokken
        ise GA4 toplamları olduğu gibi doldurulur."""
        return (
            not self.categories
            and not self.brands
            and not self.statuses
            and not self.payment_methods
            and self.customer_pk_ids is None
        )


async def resolve_segment_customers(db: AsyncSession, segment_id: int) -> tuple[int, ...]:
    """Segment kurallarını eval edip customer pk id listesini döner.

    Boş segment (eşleşme yok) `()` döner — `customer_pk_ids IN ()` MySQL'de
    her zaman `False` üretir, dolayısıyla tüm KPI'lar 0/None çıkar.
    """
    seg = await db.get(Segment, segment_id)
    if seg is None or seg.deleted_at is not None:
        raise ResourceNotFoundError(f"Segment {segment_id} not found")
    customers = await segment_service.list_customers(db, seg.rules, limit=100_000)
    return tuple(c.id for c in customers)


def _orders_filter(filters: EcomFilters, *, default_realized: bool = True) -> Any:
    """Order tablosu için WHERE clause inşası.

    - Tarih aralığı (`order_date`)
    - Sipariş durumu (verilmediyse default gerçekleşen statüler)
    - Ödeme yöntemi
    - Segment müşteri whitelist'i
    - Kategori/Marka → EXISTS subquery (order_items × products)
    """
    clauses: list[Any] = [
        func.date(Order.order_date) >= filters.date_from,
        func.date(Order.order_date) <= filters.date_to,
    ]
    if filters.statuses:
        clauses.append(Order.order_status.in_(filters.statuses))
    elif default_realized:
        clauses.append(Order.order_status.in_(_REALIZED_STATUSES))

    if filters.payment_methods:
        clauses.append(Order.payment_method.in_(filters.payment_methods))

    if filters.customer_pk_ids is not None:
        if not filters.customer_pk_ids:
            # Boş segment → kimse eşleşmesin
            clauses.append(Order.id.is_(None))
        else:
            clauses.append(Order.customer_pk_id.in_(filters.customer_pk_ids))

    if filters.categories or filters.brands:
        sub = (
            select(OrderItem.id)
            .join(Product, Product.id == OrderItem.product_pk_id)
            .where(OrderItem.order_pk_id == Order.id)
        )
        if filters.categories:
            sub = sub.where(Product.category.in_(filters.categories))
        if filters.brands:
            sub = sub.where(Product.brand.in_(filters.brands))
        clauses.append(exists(sub))

    return and_(*clauses)


def _filtered_orders_select(filters: EcomFilters) -> Select[Any]:
    """Belirtilen filtrelerle Order satırlarını seçen base select."""
    return select(Order).where(_orders_filter(filters))


# ---------------------------------------------------------------------- #
# KPI'lar (filtreli)
# ---------------------------------------------------------------------- #


async def _sum_revenue(db: AsyncSession, filters: EcomFilters) -> Decimal:
    """Filtrelenmiş siparişlerin toplam net cirosu."""
    stmt = select(func.coalesce(func.sum(Order.net_revenue), 0)).where(_orders_filter(filters))
    return Decimal(str((await db.execute(stmt)).scalar_one() or 0))


async def _count_orders(db: AsyncSession, filters: EcomFilters) -> int:
    """Filtrelenmiş sipariş sayısı."""
    stmt = select(func.count(Order.id)).where(_orders_filter(filters))
    return int((await db.execute(stmt)).scalar_one() or 0)


async def _sum_items(db: AsyncSession, filters: EcomFilters) -> int:
    """Filtrelenmiş siparişlerdeki toplam satılan ürün adedi."""
    stmt = (
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, Order.id == OrderItem.order_pk_id)
        .where(_orders_filter(filters))
    )
    return int((await db.execute(stmt)).scalar_one() or 0)


async def _sum_refunds_revenue(db: AsyncSession, filters: EcomFilters) -> tuple[Decimal, Decimal]:
    """(Toplam iade, toplam order_revenue) — refund_rate için.

    Burada brüt `order_revenue` kullanırız (refund'tan önceki tutar) ki oran
    `docs/09` §9.5.7'deki `refund_total/revenue` ile uyumlu olsun.
    """
    stmt = select(
        func.coalesce(func.sum(Order.refund_amount), 0),
        func.coalesce(func.sum(Order.order_revenue), 0),
    ).where(_orders_filter(filters, default_realized=False))
    row = (await db.execute(stmt)).one()
    return Decimal(str(row[0] or 0)), Decimal(str(row[1] or 0))


async def _repeat_purchase_rate(db: AsyncSession, filters: EcomFilters) -> Decimal | None:
    """Tekrar satın alma oranı (§9.5.6) — filtre kapsamındaki müşterilerle.

    Filtreli orders'dan distinct customer'lar; bunların `total_orders >= 2`
    olanların oranı. Segment seçiliyse zaten o havuzda hesaplanır.
    """
    customer_subq = (
        select(Order.customer_pk_id).where(_orders_filter(filters)).distinct().subquery()
    )
    total_stmt = select(func.count()).select_from(customer_subq)
    total = int((await db.execute(total_stmt)).scalar_one() or 0)
    if total == 0:
        return None
    repeat_stmt = (
        select(func.count(Customer.id))
        .where(Customer.id.in_(select(customer_subq.c.customer_pk_id)))
        .where(Customer.total_orders >= 2)
    )
    repeat = int((await db.execute(repeat_stmt)).scalar_one() or 0)
    ratio = _safe_div(Decimal(repeat), Decimal(total))
    return _quantize(ratio * 100) if ratio is not None else None


async def kpi_revenue(db: AsyncSession, filters: EcomFilters, prev: EcomFilters) -> KPIResult:
    cur = _quantize(await _sum_revenue(db, filters))
    p = _quantize(await _sum_revenue(db, prev))
    return _build_result("revenue", cur, p)


async def kpi_orders(db: AsyncSession, filters: EcomFilters, prev: EcomFilters) -> KPIResult:
    cur = Decimal(await _count_orders(db, filters))
    p = Decimal(await _count_orders(db, prev))
    return _build_result("orders", cur, p)


async def kpi_items_sold(db: AsyncSession, filters: EcomFilters, prev: EcomFilters) -> KPIResult:
    cur = Decimal(await _sum_items(db, filters))
    p = Decimal(await _sum_items(db, prev))
    return _build_result("items_sold", cur, p)


async def kpi_aov(db: AsyncSession, filters: EcomFilters, prev: EcomFilters) -> KPIResult:
    rev_cur = await _sum_revenue(db, filters)
    ord_cur = Decimal(await _count_orders(db, filters))
    cur = _quantize(_safe_div(rev_cur, ord_cur))

    rev_p = await _sum_revenue(db, prev)
    ord_p = Decimal(await _count_orders(db, prev))
    p = _quantize(_safe_div(rev_p, ord_p))
    return _build_result("aov", cur, p)


async def kpi_refund_rate(db: AsyncSession, filters: EcomFilters, prev: EcomFilters) -> KPIResult:
    refunds, gross = await _sum_refunds_revenue(db, filters)
    cur = _safe_div(refunds, gross)
    cur_pct = _quantize(cur * 100) if cur is not None else None

    p_refunds, p_gross = await _sum_refunds_revenue(db, prev)
    p = _safe_div(p_refunds, p_gross)
    p_pct = _quantize(p * 100) if p is not None else None
    return _build_result("refund_rate", cur_pct, p_pct)


async def kpi_repeat_purchase_rate(
    db: AsyncSession, filters: EcomFilters, prev: EcomFilters
) -> KPIResult:
    cur = await _repeat_purchase_rate(db, filters)
    p = await _repeat_purchase_rate(db, prev)
    return _build_result("repeat_purchase_rate", cur, p)


async def kpi_revenue_per_user(
    db: AsyncSession, filters: EcomFilters, prev: EcomFilters
) -> KPIResult:
    """Filtre kapsamındaki distinct müşteri başına ortalama ciro.

    `kpi_service.kpi_revenue_per_user` GA4 user'larına böler — burada filtre
    GA4 verisinde olmadığı için orders distinct customer'a bölüyoruz.
    """

    async def _calc(f: EcomFilters) -> Decimal | None:
        rev = await _sum_revenue(db, f)
        cust_stmt = select(func.count(func.distinct(Order.customer_pk_id))).where(_orders_filter(f))
        customers = Decimal((await db.execute(cust_stmt)).scalar_one() or 0)
        return _quantize(_safe_div(rev, customers))

    return _build_result("revenue_per_user", await _calc(filters), await _calc(prev))


# ---------------------------------------------------------------------- #
# Trend ve breakdown'lar
# ---------------------------------------------------------------------- #


async def daily_series(db: AsyncSession, filters: EcomFilters) -> list[DailySeriesPoint]:
    """Filtrelenmiş günlük revenue + orders serisi.

    `sessions`: filtre yoksa GA4 günlük toplamlarından doldurulur. Filtre
    varken (kategori/marka/segment vb.) GA4 sipariş-level filtrelere join
    edilemediği için 0 döner; bu durum frontend'de bilinçli kabuldür.

    `spend`: bu serinin scope'unda değil; her zaman 0 döner.
    """
    from app.models import GA4Traffic

    stmt = (
        select(
            func.date(Order.order_date).label("d"),
            func.coalesce(func.sum(Order.net_revenue), 0).label("rev"),
            func.count(Order.id).label("ord"),
        )
        .where(_orders_filter(filters))
        .group_by(func.date(Order.order_date))
        .order_by(func.date(Order.order_date))
    )
    rows = (await db.execute(stmt)).all()

    sessions_by_date: dict[date, int] = {}
    if filters.is_unfiltered():
        ga_stmt = (
            select(
                GA4Traffic.date,
                func.coalesce(func.sum(GA4Traffic.sessions), 0),
            )
            .where(
                and_(
                    GA4Traffic.date >= filters.date_from,
                    GA4Traffic.date <= filters.date_to,
                )
            )
            .group_by(GA4Traffic.date)
        )
        sessions_by_date = {r[0]: int(r[1]) for r in (await db.execute(ga_stmt)).all()}

    return [
        DailySeriesPoint(
            date=r.d,
            revenue=_quantize(Decimal(str(r.rev))) or Decimal(0),
            orders=int(r.ord),
            sessions=sessions_by_date.get(r.d, 0),
            spend=Decimal(0),
        )
        for r in rows
    ]


async def by_channel(
    db: AsyncSession, filters: EcomFilters, *, limit: int = 15
) -> list[ChannelMetric]:
    """Kanal × revenue/orders kırılımı (filtreli).

    `sessions` ve `conversion_rate`: filtre yoksa GA4 kanal toplamlarından
    doldurulur (kanal eşlemesi `_channel_expr()` ile — default_channel_group
    önce, derived_channel fallback). Filtre varken GA4 sipariş-level filtrelere
    join edilemediği için 0/None döner.
    """
    from app.models import GA4Traffic
    from app.services.kpi_service import _channel_expr

    stmt = (
        select(
            Order.channel.label("channel"),
            func.coalesce(func.sum(Order.net_revenue), 0).label("rev"),
            func.count(Order.id).label("ord"),
        )
        .where(_orders_filter(filters))
        .group_by(Order.channel)
        .order_by(func.sum(Order.net_revenue).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    sessions_by_channel: dict[str, int] = {}
    if filters.is_unfiltered():
        channel_col = _channel_expr()
        ga_stmt = (
            select(
                channel_col.label("ch"),
                func.coalesce(func.sum(GA4Traffic.sessions), 0),
            )
            .where(
                and_(
                    GA4Traffic.date >= filters.date_from,
                    GA4Traffic.date <= filters.date_to,
                )
            )
            .group_by(channel_col)
        )
        sessions_by_channel = {
            str(r[0] or ""): int(r[1]) for r in (await db.execute(ga_stmt)).all()
        }

    out: list[ChannelMetric] = []
    for r in rows:
        sessions = sessions_by_channel.get(r.channel or "", 0)
        conv_rate: Decimal | None = None
        if sessions > 0:
            conv_rate = _quantize(Decimal(int(r.ord)) / Decimal(sessions) * 100)
        out.append(
            ChannelMetric(
                channel=r.channel,
                revenue=_quantize(Decimal(str(r.rev))) or Decimal(0),
                orders=int(r.ord),
                sessions=sessions,
                conversion_rate=conv_rate,
            )
        )
    return out


async def by_category(
    db: AsyncSession, filters: EcomFilters, *, limit: int = 20
) -> list[DimensionBreakdown]:
    """Kategori × ciro (line_total bazında).

    Filtre `categories` içeriyorsa sadece o kategoriler döner; içermiyorsa
    tüm kategoriler. `brands` ve diğer order-level filtreler geçerlidir.
    """
    stmt = (
        select(
            Product.category.label("label"),
            func.coalesce(func.sum(OrderItem.line_total), 0).label("value"),
        )
        .join(OrderItem, OrderItem.product_pk_id == Product.id)
        .join(Order, Order.id == OrderItem.order_pk_id)
        .where(_orders_filter(filters))
        .group_by(Product.category)
        .order_by(func.sum(OrderItem.line_total).desc())
        .limit(limit)
    )
    if filters.categories:
        stmt = stmt.where(Product.category.in_(filters.categories))
    rows = (await db.execute(stmt)).all()
    return [
        DimensionBreakdown(label=r.label, value=_quantize(Decimal(str(r.value))) or Decimal(0))
        for r in rows
    ]


async def by_device(db: AsyncSession, filters: EcomFilters) -> list[DimensionBreakdown]:
    """Cihaz × ciro (donut). 3 sabit değer (mobile/desktop/tablet)."""
    stmt = (
        select(
            Order.device.label("label"),
            func.coalesce(func.sum(Order.net_revenue), 0).label("value"),
        )
        .where(_orders_filter(filters))
        .group_by(Order.device)
        .order_by(func.sum(Order.net_revenue).desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        DimensionBreakdown(
            label=r.label.value if hasattr(r.label, "value") else r.label,
            value=_quantize(Decimal(str(r.value))) or Decimal(0),
        )
        for r in rows
    ]


async def by_city(
    db: AsyncSession, filters: EcomFilters, *, limit: int = 15
) -> list[DimensionBreakdown]:
    """Şehir × ciro top N (horizontal bar)."""
    stmt = (
        select(
            Order.city.label("label"),
            func.coalesce(func.sum(Order.net_revenue), 0).label("value"),
        )
        .where(_orders_filter(filters))
        .group_by(Order.city)
        .order_by(func.sum(Order.net_revenue).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        DimensionBreakdown(label=r.label, value=_quantize(Decimal(str(r.value))) or Decimal(0))
        for r in rows
    ]


async def by_payment_method(db: AsyncSession, filters: EcomFilters) -> list[DimensionBreakdown]:
    """Ödeme yöntemi × ciro (donut)."""
    stmt = (
        select(
            Order.payment_method.label("label"),
            func.coalesce(func.sum(Order.net_revenue), 0).label("value"),
        )
        .where(_orders_filter(filters))
        .group_by(Order.payment_method)
        .order_by(func.sum(Order.net_revenue).desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        DimensionBreakdown(
            label=r.label.value if hasattr(r.label, "value") else r.label,
            value=_quantize(Decimal(str(r.value))) or Decimal(0),
        )
        for r in rows
    ]


async def new_vs_returning(db: AsyncSession, filters: EcomFilters) -> list[CustomerTypeRevenue]:
    """Yeni vs geri dönen müşteri ciro+sipariş kırılımı (§9.6.4).

    `Customer.first_order_date >= filters.date_from` → 'new'.
    """
    new_stmt = (
        select(
            func.coalesce(func.sum(Order.net_revenue), 0),
            func.count(Order.id),
        )
        .join(Customer, Order.customer_pk_id == Customer.id)
        .where(_orders_filter(filters))
        .where(Customer.first_order_date >= filters.date_from)
    )
    ret_stmt = (
        select(
            func.coalesce(func.sum(Order.net_revenue), 0),
            func.count(Order.id),
        )
        .join(Customer, Order.customer_pk_id == Customer.id)
        .where(_orders_filter(filters))
        .where(Customer.first_order_date < filters.date_from)
    )
    new_row = (await db.execute(new_stmt)).one()
    ret_row = (await db.execute(ret_stmt)).one()
    return [
        CustomerTypeRevenue(
            customer_type="new",
            revenue=_quantize(Decimal(str(new_row[0]))) or Decimal(0),
            orders=int(new_row[1] or 0),
        ),
        CustomerTypeRevenue(
            customer_type="returning",
            revenue=_quantize(Decimal(str(ret_row[0]))) or Decimal(0),
            orders=int(ret_row[1] or 0),
        ),
    ]


# ---------------------------------------------------------------------- #
# Tablolar
# ---------------------------------------------------------------------- #


async def top_products(
    db: AsyncSession, filters: EcomFilters, *, limit: int = 20
) -> list[TopProductRow]:
    """En çok satan ürünler (filtreli) — sku/name/brand × adet+ciro."""
    stmt = (
        select(
            Product.sku,
            Product.product_name,
            Product.brand,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("units"),
            func.coalesce(func.sum(OrderItem.line_total), 0).label("revenue"),
        )
        .join(OrderItem, OrderItem.product_pk_id == Product.id)
        .join(Order, Order.id == OrderItem.order_pk_id)
        .where(_orders_filter(filters))
        .group_by(Product.id, Product.sku, Product.product_name, Product.brand)
        .order_by(func.sum(OrderItem.line_total).desc())
        .limit(limit)
    )
    if filters.categories:
        stmt = stmt.where(Product.category.in_(filters.categories))
    if filters.brands:
        stmt = stmt.where(Product.brand.in_(filters.brands))
    rows = (await db.execute(stmt)).all()
    return [
        TopProductRow(
            sku=r[0],
            product_name=r[1],
            brand=r[2],
            units_sold=int(r[3]),
            revenue=_quantize(Decimal(str(r[4]))) or Decimal(0),
        )
        for r in rows
    ]


async def top_customers(
    db: AsyncSession, filters: EcomFilters, *, limit: int = 20
) -> list[TopCustomerRow]:
    """En çok harcayan müşteriler (filtreli)."""
    stmt = (
        select(
            Customer.customer_id,
            Customer.customer_name,
            Customer.city,
            Customer.gender,
            Customer.age_group,
            func.coalesce(func.sum(Order.net_revenue), 0).label("revenue"),
            func.count(Order.id).label("order_count"),
        )
        .join(Order, Order.customer_pk_id == Customer.id)
        .where(_orders_filter(filters))
        .group_by(
            Customer.id,
            Customer.customer_id,
            Customer.customer_name,
            Customer.city,
            Customer.gender,
            Customer.age_group,
        )
        .order_by(func.sum(Order.net_revenue).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        TopCustomerRow(
            customer_id=r[0],
            customer_name=r[1],
            city=r[2],
            gender=r[3].value if hasattr(r[3], "value") else r[3],
            age_group=r[4].value if hasattr(r[4], "value") else r[4],
            revenue=_quantize(Decimal(str(r[5]))) or Decimal(0),
            order_count=int(r[6]),
        )
        for r in rows
    ]


async def list_orders(
    db: AsyncSession, filters: EcomFilters, *, limit: int = 50
) -> tuple[list[OrderListRow], int]:
    """Sipariş listesi tablosu (en yeni → eski) + toplam sayım.

    Tek sayfada `limit` kayıt; üstte toplam sayım gösterilir. Daha gelişmiş
    pagination için sonraki iterasyonda offset/cursor eklenir.
    """
    total_stmt = select(func.count(Order.id)).where(_orders_filter(filters, default_realized=False))
    total = int((await db.execute(total_stmt)).scalar_one() or 0)

    stmt = (
        select(
            Order.id,
            Order.order_id,
            Order.order_date,
            Customer.customer_id,
            Customer.customer_name,
            Order.net_revenue,
            Order.order_status,
            Order.payment_method,
        )
        .join(Customer, Customer.id == Order.customer_pk_id)
        .where(_orders_filter(filters, default_realized=False))
        .order_by(Order.order_date.desc(), Order.id.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    items = [
        OrderListRow(
            order_pk_id=int(r[0]),
            order_id=r[1],
            order_date=r[2].date() if hasattr(r[2], "date") else r[2],
            customer_id=r[3],
            customer_name=r[4],
            net_revenue=_quantize(Decimal(str(r[5] or 0))) or Decimal(0),
            order_status=r[6].value if hasattr(r[6], "value") else r[6],
            payment_method=r[7].value if hasattr(r[7], "value") else r[7],
        )
        for r in rows
    ]
    return items, total


async def order_detail(db: AsyncSession, *, order_pk_id: int) -> OrderDetailResponse:
    """Tek siparişin tam detayı: order header + line items + müşteri özeti."""
    order_stmt = (
        select(
            Order,
            Customer,
        )
        .join(Customer, Customer.id == Order.customer_pk_id)
        .where(Order.id == order_pk_id)
    )
    row = (await db.execute(order_stmt)).first()
    if row is None:
        raise ResourceNotFoundError(f"Order {order_pk_id} not found")
    order: Order = row[0]
    customer: Customer = row[1]

    items_stmt = (
        select(
            Product.sku,
            Product.product_name,
            Product.brand,
            Product.category,
            OrderItem.quantity,
            OrderItem.unit_price,
            OrderItem.line_total,
            OrderItem.item_id,
            OrderItem.item_name,
            OrderItem.item_brand,
            OrderItem.item_category,
        )
        .select_from(OrderItem)
        .outerjoin(Product, Product.id == OrderItem.product_pk_id)
        .where(OrderItem.order_pk_id == order_pk_id)
        .order_by(OrderItem.line_id)
    )
    items_rows = (await db.execute(items_stmt)).all()
    line_items = [
        OrderLineItem(
            sku=r[0] or r[7],
            product_name=r[1] or r[8],
            brand=r[2] or r[9],
            category=r[3] or r[10],
            quantity=int(r[4]),
            unit_price=_quantize(Decimal(str(r[5] or 0))) or Decimal(0),
            line_total=_quantize(Decimal(str(r[6] or 0))) or Decimal(0),
        )
        for r in items_rows
    ]

    return OrderDetailResponse(
        order_pk_id=order.id,
        order_id=order.order_id,
        order_date=order.order_date.date(),
        city=order.city,
        device=order.device.value,
        channel=order.channel,
        source=order.source,
        medium=order.medium,
        campaign_name=order.campaign_name,
        coupon_code=order.coupon_code,
        order_status=order.order_status.value,
        payment_method=order.payment_method.value,
        order_revenue=_quantize(order.order_revenue) or Decimal(0),
        shipping_cost=_quantize(order.shipping_cost) or Decimal(0),
        discount_amount=_quantize(order.discount_amount) or Decimal(0),
        refund_amount=_quantize(order.refund_amount) or Decimal(0),
        net_revenue=_quantize(order.net_revenue) or Decimal(0),
        line_items=line_items,
        customer=OrderDetailCustomer(
            customer_id=customer.customer_id,
            customer_name=customer.customer_name,
            city=customer.city,
            gender=customer.gender.value if customer.gender else None,
            age_group=customer.age_group.value if customer.age_group else None,
            is_newsletter_subscriber=customer.is_newsletter_subscriber,
            total_orders=customer.total_orders,
            total_revenue=_quantize(customer.total_revenue) or Decimal(0),
        ),
    )
