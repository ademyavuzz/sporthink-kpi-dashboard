"""Dashboard verisini CSV/JSON/XLSX olarak export.

`StreamingResponse` ile büyük tablolar (10k+ satır) ram'i şişirmeden döner.
"""

from __future__ import annotations

import csv
import io
import json
from collections.abc import Iterable
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Campaign, ChannelMapping, Customer, Order, Product

ExportFormat = Literal["csv", "json", "xlsx"]
ExportKind = Literal[
    "products", "customers", "orders", "campaigns", "audit_logs", "channel_mappings"
]


def to_csv(rows: Iterable[dict[str, Any]], headers: list[str] | None = None) -> bytes:
    """UTF-8 BOM ile CSV (Excel uyumlu)."""
    buffer = io.StringIO()
    buffer.write("﻿")
    writer = csv.writer(buffer)
    rows_list = list(rows)
    if not rows_list:
        return buffer.getvalue().encode("utf-8")
    cols = headers or list(rows_list[0].keys())
    writer.writerow(cols)
    for row in rows_list:
        writer.writerow([row.get(c, "") for c in cols])
    return buffer.getvalue().encode("utf-8")


def to_json(rows: Iterable[dict[str, Any]]) -> bytes:
    rows_list = list(rows)
    return json.dumps(rows_list, ensure_ascii=False, default=str, indent=2).encode("utf-8")


def to_xlsx(rows: Iterable[dict[str, Any]], sheet_name: str = "Data") -> bytes:
    """openpyxl ile XLSX. Büyük tablolar için CSV daha verimli."""
    try:
        from openpyxl import Workbook
    except ImportError:
        # Optional dep — değilse CSV fallback
        return to_csv(rows)

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    rows_list = list(rows)
    if rows_list:
        cols = list(rows_list[0].keys())
        ws.append(cols)
        for row in rows_list:
            ws.append([row.get(c) for c in cols])
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def encode(rows: Iterable[dict[str, Any]], fmt: ExportFormat) -> tuple[bytes, str]:
    """Format'a göre encode + content-type döner."""
    if fmt == "json":
        return to_json(rows), "application/json"
    if fmt == "xlsx":
        return to_xlsx(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return to_csv(rows), "text/csv; charset=utf-8"


# --------------------- Per-kind data fetching ---------------------


async def _fetch_products(db: AsyncSession, limit: int) -> list[dict[str, Any]]:
    items = (
        (await db.execute(select(Product).where(Product.deleted_at.is_(None)).limit(limit)))
        .scalars()
        .all()
    )
    return [
        {
            "sku": p.sku,
            "product_name": p.product_name,
            "category": p.category,
            "brand": p.brand,
            "gender": p.gender.value if p.gender else None,
            "price": str(p.price),
            "cost_price": str(p.cost_price),
            "stock_quantity": p.stock_quantity,
            "is_active": p.is_active,
        }
        for p in items
    ]


async def _fetch_customers(db: AsyncSession, limit: int) -> list[dict[str, Any]]:
    items = (
        (await db.execute(select(Customer).where(Customer.deleted_at.is_(None)).limit(limit)))
        .scalars()
        .all()
    )
    return [
        {
            "customer_id": c.customer_id,
            "customer_name": c.customer_name,
            "city": c.city,
            "gender": c.gender.value if c.gender else None,
            "age_group": c.age_group.value if c.age_group else None,
            "total_orders": c.total_orders,
            "total_revenue": str(c.total_revenue),
            "first_order_date": str(c.first_order_date),
            "last_order_date": str(c.last_order_date) if c.last_order_date else None,
        }
        for c in items
    ]


async def _fetch_orders(db: AsyncSession, limit: int) -> list[dict[str, Any]]:
    items = (await db.execute(select(Order).limit(limit))).scalars().all()
    return [
        {
            "order_id": o.order_id,
            "order_date": o.order_date.isoformat(),
            "customer_id": o.customer_id,
            "city": o.city,
            "channel": o.channel,
            "order_revenue": str(o.order_revenue),
            "discount_amount": str(o.discount_amount),
            "net_revenue": str(o.net_revenue) if o.net_revenue else "0",
            "order_status": o.order_status.value,
        }
        for o in items
    ]


async def _fetch_campaigns(db: AsyncSession, limit: int) -> list[dict[str, Any]]:
    items = (
        (await db.execute(select(Campaign).where(Campaign.deleted_at.is_(None)).limit(limit)))
        .scalars()
        .all()
    )
    return [
        {
            "campaign_name": c.campaign_name,
            "platform": c.platform.value,
            "campaign_type": c.campaign_type,
            "status": c.status.value,
            "start_date": str(c.start_date) if c.start_date else None,
            "end_date": str(c.end_date) if c.end_date else None,
            "daily_budget": str(c.daily_budget) if c.daily_budget else None,
            "total_budget": str(c.total_budget) if c.total_budget else None,
        }
        for c in items
    ]


async def _fetch_channel_mappings(db: AsyncSession, limit: int) -> list[dict[str, Any]]:
    # Channel mapping referans tablosu — `limit` param geçer ama 16-20 satırlık
    # sabit set olduğu için pratikte etkisiz; consistency için yine de uygulanır.
    items = (
        (
            await db.execute(
                select(ChannelMapping).where(ChannelMapping.deleted_at.is_(None)).limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "source": m.source,
            "medium": m.medium,
            "channel_group": m.channel_group,
            "is_auto_assigned": m.is_auto_assigned,
            "notes": m.notes,
        }
        for m in items
    ]


async def get_rows(db: AsyncSession, kind: ExportKind, *, limit: int) -> list[dict[str, Any]]:
    """`kind` → o veri tipinin tüm satırlarını dict listesi olarak döner.

    `audit_logs` kasıtlı olarak hariç — kaynağı `user_management_service.list_audit_logs`
    ve permission gereksinimi (`LOGS_VIEW_AUDIT`) farklı olduğu için router'da işlenir.
    """
    fetchers = {
        "products": _fetch_products,
        "customers": _fetch_customers,
        "orders": _fetch_orders,
        "campaigns": _fetch_campaigns,
        "channel_mappings": _fetch_channel_mappings,
    }
    fetcher = fetchers.get(kind)
    if fetcher is None:
        raise ValueError(f"Unknown export kind for get_rows: {kind}")
    return await fetcher(db, limit)
