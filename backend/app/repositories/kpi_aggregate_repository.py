"""KPI aggregation tablo erişimi.

Tüm KPI sorguları (`services/kpi_service.py`) bu repository üzerinden gider
— ham tablolara doğrudan erişim KPI hesaplamasında yasak (`backend/CLAUDE.md`
§11). Bu sayede aggregation tabloları index/cache stratejisi tek noktada
yönetilir.

Tablolar:
- `kpi_daily_aggregates`   — date × channel × platform × device
- `kpi_monthly_aggregates` — period_month × channel × platform × device
- `kpi_campaign_aggregates`— campaign_pk_id × period_start × period_end
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    KPICampaignAggregate,
    KPIDailyAggregate,
    KPIMonthlyAggregate,
    KPIPlatform,
)


def _apply_daily_filters(
    stmt: Any,
    *,
    date_from: date,
    date_to: date,
    channels: list[str] | None = None,
    platforms: list[KPIPlatform] | None = None,
    devices: list[str] | None = None,
) -> Any:
    """Daily aggregate sorgularına ortak WHERE kalıbı uygular."""
    conditions = [
        KPIDailyAggregate.date >= date_from,
        KPIDailyAggregate.date <= date_to,
    ]
    if channels:
        conditions.append(KPIDailyAggregate.channel.in_(channels))
    if platforms:
        conditions.append(KPIDailyAggregate.platform.in_([p.value for p in platforms]))
    if devices:
        conditions.append(KPIDailyAggregate.device.in_(devices))
    return stmt.where(and_(*conditions))


async def sum_metric_daily(
    db: AsyncSession,
    metric: str,
    *,
    date_from: date,
    date_to: date,
    channels: list[str] | None = None,
    platforms: list[KPIPlatform] | None = None,
    devices: list[str] | None = None,
) -> Decimal:
    """Tek metric'in [date_from, date_to] aralığındaki SUM'ını döner.

    `metric` → `KPIDailyAggregate` model attribute adı. Geçersizse AttributeError.
    NULL sonuç → Decimal(0).
    """
    column = getattr(KPIDailyAggregate, metric)
    stmt = select(func.coalesce(func.sum(column), 0))
    stmt = _apply_daily_filters(
        stmt,
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        platforms=platforms,
        devices=devices,
    )
    result = await db.execute(stmt)
    value = result.scalar_one()
    return Decimal(str(value or 0))


async def sum_metrics_daily(
    db: AsyncSession,
    metrics: list[str],
    *,
    date_from: date,
    date_to: date,
    channels: list[str] | None = None,
    platforms: list[KPIPlatform] | None = None,
    devices: list[str] | None = None,
) -> dict[str, Decimal]:
    """Tek sorguda birden fazla metric'i SUM'lar — N+1 önler."""
    columns = [func.coalesce(func.sum(getattr(KPIDailyAggregate, m)), 0).label(m) for m in metrics]
    stmt = select(*columns)
    stmt = _apply_daily_filters(
        stmt,
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        platforms=platforms,
        devices=devices,
    )
    result = await db.execute(stmt)
    row = result.one()
    return {m: Decimal(str(getattr(row, m) or 0)) for m in metrics}


async def group_by_dimension_daily(
    db: AsyncSession,
    dimension: str,
    metrics: list[str],
    *,
    date_from: date,
    date_to: date,
    channels: list[str] | None = None,
    platforms: list[KPIPlatform] | None = None,
    devices: list[str] | None = None,
    limit: int | None = None,
    order_by_metric: str | None = None,
    descending: bool = True,
) -> list[dict[str, Any]]:
    """Belirtilen boyutta GROUP BY ile aggregate.

    `dimension` → `date` | `channel` | `platform` | `device` (model attr).
    `metrics`   → SUM'lanacak kolon adları.
    Returns: [{dimension: ..., metric1: D, metric2: D}, ...]
    """
    dim_col = getattr(KPIDailyAggregate, dimension)
    metric_cols = [
        func.coalesce(func.sum(getattr(KPIDailyAggregate, m)), 0).label(m) for m in metrics
    ]
    stmt = select(dim_col.label(dimension), *metric_cols)
    stmt = _apply_daily_filters(
        stmt,
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        platforms=platforms,
        devices=devices,
    )
    stmt = stmt.group_by(dim_col)

    if order_by_metric:
        order_col = func.coalesce(func.sum(getattr(KPIDailyAggregate, order_by_metric)), 0)
        stmt = stmt.order_by(order_col.desc() if descending else order_col.asc())
    if limit is not None:
        stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            dimension: row[0],
            **{m: Decimal(str(getattr(row, m) or 0)) for m in metrics},
        }
        for row in rows
    ]


async def daily_series(
    db: AsyncSession,
    metrics: list[str],
    *,
    date_from: date,
    date_to: date,
    channels: list[str] | None = None,
    platforms: list[KPIPlatform] | None = None,
    devices: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Trend chart için günlük zaman serisi.

    Returns: [{date, metric1, metric2, ...}, ...] — date'e göre artan sıralı.
    Boş günler döndürülmez (frontend interpolation veya 0 ile doldurma yapar).
    """
    metric_cols = [
        func.coalesce(func.sum(getattr(KPIDailyAggregate, m)), 0).label(m) for m in metrics
    ]
    stmt = select(KPIDailyAggregate.date.label("date"), *metric_cols)
    stmt = _apply_daily_filters(
        stmt,
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        platforms=platforms,
        devices=devices,
    )
    stmt = stmt.group_by(KPIDailyAggregate.date).order_by(KPIDailyAggregate.date)
    result = await db.execute(stmt)
    return [
        {
            "date": row[0],
            **{m: Decimal(str(getattr(row, m) or 0)) for m in metrics},
        }
        for row in result.all()
    ]


# ---------- monthly ----------


async def sum_metrics_monthly(
    db: AsyncSession,
    metrics: list[str],
    *,
    period_from: date,  # ayın ilk günü
    period_to: date,
    channels: list[str] | None = None,
    platforms: list[KPIPlatform] | None = None,
) -> dict[str, Decimal]:
    columns = [
        func.coalesce(func.sum(getattr(KPIMonthlyAggregate, m)), 0).label(m) for m in metrics
    ]
    conditions = [
        KPIMonthlyAggregate.period_month >= period_from,
        KPIMonthlyAggregate.period_month <= period_to,
    ]
    if channels:
        conditions.append(KPIMonthlyAggregate.channel.in_(channels))
    if platforms:
        conditions.append(KPIMonthlyAggregate.platform.in_([p.value for p in platforms]))
    stmt = select(*columns).where(and_(*conditions))
    result = await db.execute(stmt)
    row = result.one()
    return {m: Decimal(str(getattr(row, m) or 0)) for m in metrics}


# ---------- campaign ----------


async def list_campaign_aggregates(
    db: AsyncSession,
    *,
    period_start: date,
    period_end: date,
    platform: KPIPlatform | None = None,
    limit: int | None = None,
    order_by: str = "spend",
    descending: bool = True,
) -> list[KPICampaignAggregate]:
    """Kampanya analizi sayfası için ROAS/CTR/CPA tablosu.

    `period_start`/`period_end` aralığı ile birebir eşleşen aggregation
    kayıtlarını döner; rebuild task aynı dönem için tek satır üretir.
    """
    conditions = [
        KPICampaignAggregate.period_start == period_start,
        KPICampaignAggregate.period_end == period_end,
    ]
    if platform is not None:
        conditions.append(KPICampaignAggregate.platform == platform.value)
    stmt = select(KPICampaignAggregate).where(and_(*conditions))
    order_col = getattr(KPICampaignAggregate, order_by, KPICampaignAggregate.spend)
    stmt = stmt.order_by(order_col.desc() if descending else order_col.asc())
    if limit is not None:
        stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())
