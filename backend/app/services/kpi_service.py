"""KPI hesaplama servisi — `docs/overview/09-kpi-formulas.md` tek doğru kaynak.

31 standart KPI dört kategoride:
- **Trafik** (8): sessions, users, new_users, bounce_rate, pages_per_session,
  avg_session_duration, conversion_rate, traffic_growth
- **Reklam** (10): ad_spend, impressions, clicks, ctr, cpc, cpm,
  ad_conversions, cost_per_conversion, roas, frequency
- **Satış** (8): revenue, orders, items_sold, aov, revenue_per_user,
  repeat_purchase_rate, refund_rate, revenue_growth
- **Pazarlama** (5): revenue_by_channel, conversion_rate_by_channel,
  revenue_by_campaign, new_vs_returning, daily_change

Hesaplama prensipleri (`backend/CLAUDE.md` §11):
- Tüm KPI'lar `kpi_*_aggregates` tabloları üzerinden hesaplanır (raw değil)
- Pure fonksiyon: aynı input → aynı output, side effect yok
- NULL semantik: 0/0 → None ("veri yok"), 0'a düşürülmez
- Trend yönü her KPI için tanımlı (revenue↑ iyi, bounce_rate↓ iyi)

Karşılaştırma dönemi (§9.2.2): default sequential (önceki N gün), opsiyonel
YoY (geçen yılın aynı dönemi). Frontend toggle ile seçer.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Customer,
    GA4ItemEngagement,
    KPIPlatform,
    Order,
    OrderItem,
    Product,
)
from app.repositories import kpi_aggregate_repository as agg_repo
from app.schemas.kpi import (
    CampaignMetric,
    ChannelMetric,
    CustomerTypeRevenue,
    DailySeriesPoint,
    DateRange,
    FunnelStep,
    KPIResult,
    KPISummary,
    KPIUnit,
    TopCustomerRow,
    TopProductRow,
    TrendDirection,
)

logger = logging.getLogger(__name__)


# Düşük olduğunda iyi olan KPI'lar (artış kötü).
_INVERSE_KPIS: frozenset[str] = frozenset(
    {"bounce_rate", "cpc", "cpm", "cost_per_conversion", "refund_rate", "frequency"}
)


@dataclass(frozen=True)
class _KPIMeta:
    label_tr: str
    unit: KPIUnit
    trend_dir: Literal["up", "down"]


_KPI_META: dict[str, _KPIMeta] = {
    # Trafik
    "sessions": _KPIMeta("Toplam Oturum", "count", "up"),
    "users": _KPIMeta("Tekil Kullanıcı", "count", "up"),
    "new_users": _KPIMeta("Yeni Kullanıcı", "count", "up"),
    "bounce_rate": _KPIMeta("Hemen Çıkma Oranı", "percent", "down"),
    "pages_per_session": _KPIMeta("Oturum Başına Sayfa", "count", "up"),
    "avg_session_duration": _KPIMeta("Ort. Oturum Süresi", "duration_seconds", "up"),
    "conversion_rate": _KPIMeta("Dönüşüm Oranı", "percent", "up"),
    # Reklam
    "ad_spend": _KPIMeta("Reklam Harcaması", "currency", "up"),
    "impressions": _KPIMeta("Gösterim", "count", "up"),
    "clicks": _KPIMeta("Tıklama", "count", "up"),
    "ctr": _KPIMeta("CTR", "percent", "up"),
    "cpc": _KPIMeta("CPC", "currency", "down"),
    "cpm": _KPIMeta("CPM", "currency", "down"),
    "ad_conversions": _KPIMeta("Reklam Dönüşümü", "count", "up"),
    "cost_per_conversion": _KPIMeta("Dönüşüm Başına Maliyet", "currency", "down"),
    "roas": _KPIMeta("ROAS", "multiplier", "up"),
    "frequency": _KPIMeta("Reklam Frekansı", "multiplier", "down"),
    # Satış
    "revenue": _KPIMeta("Toplam Ciro", "currency", "up"),
    "orders": _KPIMeta("Sipariş Sayısı", "count", "up"),
    "items_sold": _KPIMeta("Satılan Ürün", "count", "up"),
    "aov": _KPIMeta("Ortalama Sepet (AOV)", "currency", "up"),
    "revenue_per_user": _KPIMeta("Kullanıcı Başına Gelir", "currency", "up"),
    "repeat_purchase_rate": _KPIMeta("Tekrar Satın Alma", "percent", "up"),
    "refund_rate": _KPIMeta("İade Oranı", "percent", "down"),
}


# ---------------------------------------------------------------------- #
# Helpers
# ---------------------------------------------------------------------- #


def compute_comparison_period(
    date_from: date,
    date_to: date,
    mode: Literal["sequential", "yoy"] = "sequential",
) -> tuple[date, date]:
    """Mevcut [from..to] aralığına göre karşılaştırma dönemini hesaplar.

    - `sequential`: aynı uzunlukta hemen öncesi
      (örn: Son 30 gün → önceki 30 gün)
    - `yoy`: bir önceki yılın aynı dönemi
    """
    if mode == "yoy":
        return (
            date_from.replace(year=date_from.year - 1),
            date_to.replace(year=date_to.year - 1),
        )
    span = (date_to - date_from).days
    prev_to = date_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=span)
    return prev_from, prev_to


def _quantize(value: Decimal | None, places: str = "0.01") -> Decimal | None:
    if value is None:
        return None
    return value.quantize(Decimal(places))


def _trend(
    current: Decimal | None,
    previous: Decimal | None,
    kpi_id: str,
) -> tuple[Decimal | None, TrendDirection, bool]:
    """`docs/09` §9.2.3 — change_percentage, direction, is_positive üçlüsü."""
    if current is None or previous is None or previous == 0:
        change_pct: Decimal | None = None
    else:
        change_pct = ((current - previous) / previous * 100).quantize(Decimal("0.01"))

    if current is None or previous is None:
        direction: TrendDirection = "flat"
    elif current > previous:
        direction = "up"
    elif current < previous:
        direction = "down"
    else:
        direction = "flat"

    is_inverse = kpi_id in _INVERSE_KPIS
    if direction == "flat":
        is_positive = True  # değişim yoksa "kötü" değil
    else:
        is_positive = (direction == "up") if not is_inverse else (direction == "down")
    return change_pct, direction, is_positive


def _build_result(
    kpi_id: str,
    current: Decimal | None,
    previous: Decimal | None,
) -> KPIResult:
    meta = _KPI_META[kpi_id]
    change_pct, direction, is_positive = _trend(current, previous, kpi_id)
    return KPIResult(
        kpi_id=kpi_id,
        label_tr=meta.label_tr,
        value=current,
        previous_value=previous,
        change_percentage=change_pct,
        direction=direction,
        is_positive=is_positive,
        unit=meta.unit,
        trend_direction_positive=meta.trend_dir,
    )


def _safe_div(num: Decimal, den: Decimal) -> Decimal | None:
    """0/0 → None ("veri yok") — KPI semantik kuralı."""
    if den == 0:
        return None
    return num / den


# ---------------------------------------------------------------------- #
# 9.3 Trafik KPI'ları (8)
# ---------------------------------------------------------------------- #


async def kpi_sessions(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Toplam Oturum — `SUM(sessions)` (`docs/09` §9.3.1)."""
    cur = await agg_repo.sum_metric_daily(
        db, "sessions", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.GA4],
    )
    p = await agg_repo.sum_metric_daily(
        db, "sessions", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.GA4],
    )
    return _build_result("sessions", cur, p)


async def kpi_users(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Tekil Kullanıcı — `SUM(users)` (§9.3.2)."""
    cur = await agg_repo.sum_metric_daily(
        db, "users", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.GA4],
    )
    p = await agg_repo.sum_metric_daily(
        db, "users", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.GA4],
    )
    return _build_result("users", cur, p)


async def kpi_new_users(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Yeni Kullanıcı — `SUM(new_users)` (§9.3.3)."""
    cur = await agg_repo.sum_metric_daily(
        db, "new_users", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.GA4],
    )
    p = await agg_repo.sum_metric_daily(
        db, "new_users", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.GA4],
    )
    return _build_result("new_users", cur, p)


async def kpi_bounce_rate(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Hemen Çıkma Oranı — `SUM(bounce_sessions)/SUM(sessions) × 100` (§9.3.4).

    Trend yönü: aşağı iyidir (düşük bounce rate = kaliteli trafik).
    """
    metrics = await agg_repo.sum_metrics_daily(
        db, ["bounce_sessions", "sessions"],
        date_from=date_from, date_to=date_to, platforms=[KPIPlatform.GA4],
    )
    cur = _safe_div(metrics["bounce_sessions"], metrics["sessions"])
    cur_pct = _quantize(cur * 100) if cur is not None else None

    pmetrics = await agg_repo.sum_metrics_daily(
        db, ["bounce_sessions", "sessions"],
        date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.GA4],
    )
    p = _safe_div(pmetrics["bounce_sessions"], pmetrics["sessions"])
    p_pct = _quantize(p * 100) if p is not None else None
    return _build_result("bounce_rate", cur_pct, p_pct)


async def kpi_pages_per_session(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Oturum Başına Sayfa — `SUM(total_page_views)/SUM(sessions)` (§9.3.5)."""
    m = await agg_repo.sum_metrics_daily(
        db, ["total_page_views", "sessions"],
        date_from=date_from, date_to=date_to, platforms=[KPIPlatform.GA4],
    )
    cur = _quantize(_safe_div(m["total_page_views"], m["sessions"]))
    pm = await agg_repo.sum_metrics_daily(
        db, ["total_page_views", "sessions"],
        date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.GA4],
    )
    p = _quantize(_safe_div(pm["total_page_views"], pm["sessions"]))
    return _build_result("pages_per_session", cur, p)


async def kpi_avg_session_duration(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Ortalama Oturum Süresi — saniye (§9.3.6)."""
    m = await agg_repo.sum_metrics_daily(
        db, ["total_session_duration", "sessions"],
        date_from=date_from, date_to=date_to, platforms=[KPIPlatform.GA4],
    )
    cur = _quantize(_safe_div(m["total_session_duration"], m["sessions"]))
    pm = await agg_repo.sum_metrics_daily(
        db, ["total_session_duration", "sessions"],
        date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.GA4],
    )
    p = _quantize(_safe_div(pm["total_session_duration"], pm["sessions"]))
    return _build_result("avg_session_duration", cur, p)


async def kpi_conversion_rate(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Dönüşüm Oranı — `SUM(orders)/SUM(sessions) × 100` (§9.3.7).

    `orders` ecommerce platformundan, `sessions` ga4'ten gelir; total'ler
    SUM içinde otomatik birleşir (NULL'a duyarlı değil).
    """
    sessions = await agg_repo.sum_metric_daily(
        db, "sessions", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.GA4],
    )
    orders = await agg_repo.sum_metric_daily(
        db, "orders", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.ECOMMERCE],
    )
    cur = _safe_div(orders, sessions)
    cur_pct = _quantize(cur * 100) if cur is not None else None

    p_sessions = await agg_repo.sum_metric_daily(
        db, "sessions", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.GA4],
    )
    p_orders = await agg_repo.sum_metric_daily(
        db, "orders", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.ECOMMERCE],
    )
    p = _safe_div(p_orders, p_sessions)
    p_pct = _quantize(p * 100) if p is not None else None
    return _build_result("conversion_rate", cur_pct, p_pct)


# 9.3.8 traffic_growth = sessions KPI'sının `change_percentage`'i — ayrı kart
# olarak gösterilmiyor (`docs/09` notu).


# ---------------------------------------------------------------------- #
# 9.4 Reklam KPI'ları (10)
# ---------------------------------------------------------------------- #


_AD_PLATFORMS = [KPIPlatform.META, KPIPlatform.GOOGLE]


def _ads(p: list[KPIPlatform] | None) -> list[KPIPlatform]:
    """Default ad platforms = Meta + Google. None → ikisi birden."""
    return list(p) if p is not None else _AD_PLATFORMS


async def kpi_ad_spend(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """Toplam Harcama (§9.4.1)."""
    plats = _ads(platforms)
    cur = await agg_repo.sum_metric_daily(
        db, "spend", date_from=date_from, date_to=date_to, platforms=plats,
    )
    p = await agg_repo.sum_metric_daily(
        db, "spend", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=plats,
    )
    return _build_result("ad_spend", _quantize(cur), _quantize(p))


async def kpi_impressions(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """Gösterim (§9.4.2)."""
    plats = _ads(platforms)
    cur = await agg_repo.sum_metric_daily(
        db, "impressions", date_from=date_from, date_to=date_to, platforms=plats,
    )
    p = await agg_repo.sum_metric_daily(
        db, "impressions", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=plats,
    )
    return _build_result("impressions", cur, p)


async def kpi_clicks(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """Tıklama (§9.4.3)."""
    plats = _ads(platforms)
    cur = await agg_repo.sum_metric_daily(
        db, "clicks", date_from=date_from, date_to=date_to, platforms=plats,
    )
    p = await agg_repo.sum_metric_daily(
        db, "clicks", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=plats,
    )
    return _build_result("clicks", cur, p)


async def kpi_ctr(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """CTR — `clicks/impressions × 100` (§9.4.4)."""
    plats = _ads(platforms)
    m = await agg_repo.sum_metrics_daily(
        db, ["clicks", "impressions"], date_from=date_from, date_to=date_to,
        platforms=plats,
    )
    cur = _safe_div(m["clicks"], m["impressions"])
    cur_pct = _quantize(cur * 100, "0.0001") if cur is not None else None

    pm = await agg_repo.sum_metrics_daily(
        db, ["clicks", "impressions"],
        date_from=prev["prev_from"], date_to=prev["prev_to"], platforms=plats,
    )
    p = _safe_div(pm["clicks"], pm["impressions"])
    p_pct = _quantize(p * 100, "0.0001") if p is not None else None
    return _build_result("ctr", cur_pct, p_pct)


async def kpi_cpc(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """CPC — `spend/clicks` (§9.4.5)."""
    plats = _ads(platforms)
    m = await agg_repo.sum_metrics_daily(
        db, ["spend", "clicks"], date_from=date_from, date_to=date_to, platforms=plats,
    )
    cur = _quantize(_safe_div(m["spend"], m["clicks"]), "0.0001")
    pm = await agg_repo.sum_metrics_daily(
        db, ["spend", "clicks"], date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=plats,
    )
    p = _quantize(_safe_div(pm["spend"], pm["clicks"]), "0.0001")
    return _build_result("cpc", cur, p)


async def kpi_cpm(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """CPM — `spend/impressions × 1000` (§9.4.6)."""
    plats = _ads(platforms)
    m = await agg_repo.sum_metrics_daily(
        db, ["spend", "impressions"], date_from=date_from, date_to=date_to,
        platforms=plats,
    )
    cur = _safe_div(m["spend"], m["impressions"])
    cur_v = _quantize(cur * 1000, "0.0001") if cur is not None else None
    pm = await agg_repo.sum_metrics_daily(
        db, ["spend", "impressions"],
        date_from=prev["prev_from"], date_to=prev["prev_to"], platforms=plats,
    )
    p = _safe_div(pm["spend"], pm["impressions"])
    p_v = _quantize(p * 1000, "0.0001") if p is not None else None
    return _build_result("cpm", cur_v, p_v)


async def kpi_ad_conversions(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """Reklam Dönüşümü (§9.4.7)."""
    plats = _ads(platforms)
    cur = await agg_repo.sum_metric_daily(
        db, "ad_conversions", date_from=date_from, date_to=date_to, platforms=plats,
    )
    p = await agg_repo.sum_metric_daily(
        db, "ad_conversions", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=plats,
    )
    return _build_result("ad_conversions", _quantize(cur), _quantize(p))


async def kpi_cost_per_conversion(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """Dönüşüm Başına Maliyet — `spend/ad_conversions` (§9.4.8). Trend ↓ iyi."""
    plats = _ads(platforms)
    m = await agg_repo.sum_metrics_daily(
        db, ["spend", "ad_conversions"],
        date_from=date_from, date_to=date_to, platforms=plats,
    )
    cur = _quantize(_safe_div(m["spend"], m["ad_conversions"]))
    pm = await agg_repo.sum_metrics_daily(
        db, ["spend", "ad_conversions"],
        date_from=prev["prev_from"], date_to=prev["prev_to"], platforms=plats,
    )
    p = _quantize(_safe_div(pm["spend"], pm["ad_conversions"]))
    return _build_result("cost_per_conversion", cur, p)


async def kpi_roas(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    platforms: list[KPIPlatform] | None = None,
    **prev: date,
) -> KPIResult:
    """ROAS — `ad_revenue/spend` (§9.4.9)."""
    plats = _ads(platforms)
    m = await agg_repo.sum_metrics_daily(
        db, ["ad_revenue", "spend"],
        date_from=date_from, date_to=date_to, platforms=plats,
    )
    cur = _quantize(_safe_div(m["ad_revenue"], m["spend"]), "0.0001")
    pm = await agg_repo.sum_metrics_daily(
        db, ["ad_revenue", "spend"],
        date_from=prev["prev_from"], date_to=prev["prev_to"], platforms=plats,
    )
    p = _quantize(_safe_div(pm["ad_revenue"], pm["spend"]), "0.0001")
    return _build_result("roas", cur, p)


async def kpi_frequency(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Reklam Frekansı — Meta'da `impressions/reach` (§9.4.10).

    Sadece Meta için anlamlı; aggregation'da `reach` tutmadığımız için doğrudan
    `meta_ads` ham tablosundan alıyoruz (istisnai durum, formül net).
    """
    from app.models import MetaAds

    cur_stmt = select(
        func.coalesce(func.sum(MetaAds.impressions), 0),
        func.coalesce(func.sum(MetaAds.reach), 0),
    ).where(
        and_(MetaAds.date_start >= date_from, MetaAds.date_start <= date_to)
    )
    cr = (await db.execute(cur_stmt)).one()
    cur = _quantize(_safe_div(Decimal(cr[0]), Decimal(cr[1])), "0.0001")

    p_stmt = select(
        func.coalesce(func.sum(MetaAds.impressions), 0),
        func.coalesce(func.sum(MetaAds.reach), 0),
    ).where(
        and_(
            MetaAds.date_start >= prev["prev_from"],
            MetaAds.date_start <= prev["prev_to"],
        )
    )
    pr = (await db.execute(p_stmt)).one()
    p = _quantize(_safe_div(Decimal(pr[0]), Decimal(pr[1])), "0.0001")
    return _build_result("frequency", cur, p)


# ---------------------------------------------------------------------- #
# 9.5 Satış KPI'ları (8)
# ---------------------------------------------------------------------- #


async def kpi_revenue(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Toplam Ciro (§9.5.1)."""
    cur = await agg_repo.sum_metric_daily(
        db, "revenue", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.ECOMMERCE],
    )
    p = await agg_repo.sum_metric_daily(
        db, "revenue", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.ECOMMERCE],
    )
    return _build_result("revenue", _quantize(cur), _quantize(p))


async def kpi_orders(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Sipariş Sayısı (§9.5.2)."""
    cur = await agg_repo.sum_metric_daily(
        db, "orders", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.ECOMMERCE],
    )
    p = await agg_repo.sum_metric_daily(
        db, "orders", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.ECOMMERCE],
    )
    return _build_result("orders", cur, p)


async def kpi_items_sold(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Satılan Ürün Adedi (§9.5.3)."""
    cur = await agg_repo.sum_metric_daily(
        db, "items_sold", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.ECOMMERCE],
    )
    p = await agg_repo.sum_metric_daily(
        db, "items_sold", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.ECOMMERCE],
    )
    return _build_result("items_sold", cur, p)


async def kpi_aov(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """AOV — `revenue/orders` (§9.5.4)."""
    m = await agg_repo.sum_metrics_daily(
        db, ["revenue", "orders"],
        date_from=date_from, date_to=date_to, platforms=[KPIPlatform.ECOMMERCE],
    )
    cur = _quantize(_safe_div(m["revenue"], m["orders"]))
    pm = await agg_repo.sum_metrics_daily(
        db, ["revenue", "orders"],
        date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.ECOMMERCE],
    )
    p = _quantize(_safe_div(pm["revenue"], pm["orders"]))
    return _build_result("aov", cur, p)


async def kpi_revenue_per_user(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Kullanıcı Başına Gelir — `revenue/users` (§9.5.5)."""
    revenue = await agg_repo.sum_metric_daily(
        db, "revenue", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.ECOMMERCE],
    )
    users = await agg_repo.sum_metric_daily(
        db, "users", date_from=date_from, date_to=date_to,
        platforms=[KPIPlatform.GA4],
    )
    cur = _quantize(_safe_div(revenue, users))
    p_revenue = await agg_repo.sum_metric_daily(
        db, "revenue", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.ECOMMERCE],
    )
    p_users = await agg_repo.sum_metric_daily(
        db, "users", date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.GA4],
    )
    p = _quantize(_safe_div(p_revenue, p_users))
    return _build_result("revenue_per_user", cur, p)


async def kpi_repeat_purchase_rate(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """Tekrar Satın Alma Oranı — `customers.total_orders >= 2` / toplam (§9.5.6).

    `first_order_date` aralık filtresi ile mevcut dönemde **ilk siparişini
    veren** müşterileri inceleriz.
    """

    async def _calc(d_from: date, d_to: date) -> Decimal | None:
        repeat_stmt = select(func.count(Customer.id)).where(
            and_(
                Customer.first_order_date >= d_from,
                Customer.first_order_date <= d_to,
                Customer.total_orders >= 2,
            )
        )
        total_stmt = select(func.count(Customer.id)).where(
            and_(
                Customer.first_order_date >= d_from,
                Customer.first_order_date <= d_to,
            )
        )
        repeat = (await db.execute(repeat_stmt)).scalar_one()
        total = (await db.execute(total_stmt)).scalar_one()
        ratio = _safe_div(Decimal(repeat), Decimal(total))
        return _quantize(ratio * 100) if ratio is not None else None

    cur = await _calc(date_from, date_to)
    p = await _calc(prev["prev_from"], prev["prev_to"])
    return _build_result("repeat_purchase_rate", cur, p)


async def kpi_refund_rate(
    db: AsyncSession, *, date_from: date, date_to: date, **prev: date
) -> KPIResult:
    """İade Oranı — `refund_total/revenue × 100` (§9.5.7). Trend ↓ iyi."""
    m = await agg_repo.sum_metrics_daily(
        db, ["refund_total", "revenue"],
        date_from=date_from, date_to=date_to, platforms=[KPIPlatform.ECOMMERCE],
    )
    cur = _safe_div(m["refund_total"], m["revenue"])
    cur_pct = _quantize(cur * 100) if cur is not None else None
    pm = await agg_repo.sum_metrics_daily(
        db, ["refund_total", "revenue"],
        date_from=prev["prev_from"], date_to=prev["prev_to"],
        platforms=[KPIPlatform.ECOMMERCE],
    )
    p = _safe_div(pm["refund_total"], pm["revenue"])
    p_pct = _quantize(p * 100) if p is not None else None
    return _build_result("refund_rate", cur_pct, p_pct)


# 9.5.8 revenue_growth = revenue KPI'sının `change_percentage`'i; ayrı kart
# olarak gösterilmiyor.


# ---------------------------------------------------------------------- #
# Summary — `/dashboard/overview` için tek seferlik 9 KPI
# ---------------------------------------------------------------------- #


async def calculate_summary(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    comparison_mode: Literal["sequential", "yoy"] = "sequential",
) -> KPISummary:
    """Overview sayfası için en kritik 9 KPI'yı tek API çağrısında hesaplar.

    Performance: ~10 SUM sorgusu (per KPI ~1-2 sorgu, çoğu paralel-batch).
    Cache'lenir (5 dk TTL) — `services/cache_service.py` üzerinden.
    """
    prev_from, prev_to = compute_comparison_period(date_from, date_to, comparison_mode)
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    return KPISummary(
        date_range=DateRange(
            date_from=date_from,
            date_to=date_to,
            comparison_from=prev_from,
            comparison_to=prev_to,
            comparison_mode=comparison_mode,
        ),
        revenue=await kpi_revenue(db, date_from=date_from, date_to=date_to, **kw),
        orders=await kpi_orders(db, date_from=date_from, date_to=date_to, **kw),
        aov=await kpi_aov(db, date_from=date_from, date_to=date_to, **kw),
        sessions=await kpi_sessions(db, date_from=date_from, date_to=date_to, **kw),
        users=await kpi_users(db, date_from=date_from, date_to=date_to, **kw),
        conversion_rate=await kpi_conversion_rate(
            db, date_from=date_from, date_to=date_to, **kw
        ),
        bounce_rate=await kpi_bounce_rate(
            db, date_from=date_from, date_to=date_to, **kw
        ),
        ad_spend=await kpi_ad_spend(db, date_from=date_from, date_to=date_to, **kw),
        roas=await kpi_roas(db, date_from=date_from, date_to=date_to, **kw),
    )


# ---------------------------------------------------------------------- #
# 9.6 Pazarlama Performans (5 — chart-friendly)
# ---------------------------------------------------------------------- #


async def revenue_by_channel(
    db: AsyncSession, *, date_from: date, date_to: date, limit: int = 20
) -> list[ChannelMetric]:
    """Kanal × revenue/orders/sessions/conversion_rate (§9.6.1, §9.6.2).

    `revenue` ecommerce satırlarından, `sessions` ga4 satırlarından gelir;
    GROUP BY channel ile birleşir.
    """
    rows = await agg_repo.group_by_dimension_daily(
        db,
        "channel",
        ["revenue", "orders", "sessions"],
        date_from=date_from,
        date_to=date_to,
        order_by_metric="revenue",
        limit=limit,
    )
    return [
        ChannelMetric(
            channel=r["channel"],
            revenue=_quantize(r["revenue"]) or Decimal(0),
            orders=int(r["orders"]),
            sessions=int(r["sessions"]),
            conversion_rate=(
                _quantize(_safe_div(r["orders"], r["sessions"]) * 100)
                if r["sessions"] > 0
                else None
            ),
        )
        for r in rows
    ]


async def campaign_detail(
    db: AsyncSession,
    *,
    campaign_pk_id: int | None = None,
    campaign_name: str | None = None,
    date_from: date,
    date_to: date,
    top_n: int = 10,
) -> dict[str, Any]:
    """Bir kampanyanın detayı — ad metrikleri + e-ticaret attribution.

    `campaign_pk_id` veya `campaign_name` ile çağrılır. Returns:
    - summary: ad metrikleri (kpi_campaign_aggregates) + e-ticaret toplamı
    - top_products: bu kampanya kaynaklı en çok satılan ürünler
    - daily_series: günlük spend + e-ticaret revenue
    """
    from app.models import Campaign, OrderItem, Product as ProductModel

    if campaign_pk_id is None and campaign_name is None:
        raise ValueError("campaign_pk_id veya campaign_name verilmeli")

    # Kampanya kaydını bul (master tablodan ad alma + adı normalize)
    if campaign_pk_id is not None:
        campaign = await db.get(Campaign, campaign_pk_id)
        resolved_name = campaign.campaign_name if campaign else None
        resolved_pk_id = campaign_pk_id
    else:
        stmt = (
            select(Campaign)
            .where(
                and_(
                    Campaign.deleted_at.is_(None),
                    Campaign.campaign_name == campaign_name,
                )
            )
            .limit(1)
        )
        campaign = (await db.execute(stmt)).scalar_one_or_none()
        resolved_name = campaign_name
        resolved_pk_id = campaign.id if campaign else None

    # 1) Ad performance — kpi_campaign_aggregates (period match)
    ad_metrics = {
        "impressions": Decimal(0),
        "clicks": Decimal(0),
        "spend": Decimal(0),
        "conversions": Decimal(0),
        "conversions_value": Decimal(0),
    }
    if resolved_pk_id is not None:
        # Aggregation kaydı period_start/period_end ile UNIQUE; rebuild aynı
        # dönem için tek satır üretir. Kampanya bu dönem için aggregate
        # edilmemişse raw tablolardan (meta_ads/google_ads) hesapla.
        from app.models import GoogleAds, KPICampaignAggregate, MetaAds

        agg_stmt = select(KPICampaignAggregate).where(
            KPICampaignAggregate.campaign_pk_id == resolved_pk_id
        )
        agg_row = (await db.execute(agg_stmt)).scalars().first()
        if agg_row is not None:
            ad_metrics = {
                "impressions": Decimal(agg_row.impressions),
                "clicks": Decimal(agg_row.clicks),
                "spend": agg_row.spend,
                "conversions": agg_row.conversions,
                "conversions_value": agg_row.conversions_value,
            }
        else:
            # Aggregate yoksa raw'dan canlı hesapla (meta + google union)
            meta_stmt = select(
                func.coalesce(func.sum(MetaAds.impressions), 0),
                func.coalesce(func.sum(MetaAds.clicks), 0),
                func.coalesce(func.sum(MetaAds.spend), 0),
                func.coalesce(func.sum(MetaAds.actions_purchase), 0),
                func.coalesce(func.sum(MetaAds.action_values_purchase), 0),
            ).where(
                and_(
                    MetaAds.campaign_pk_id == resolved_pk_id,
                    MetaAds.date_start >= date_from,
                    MetaAds.date_start <= date_to,
                )
            )
            google_stmt = select(
                func.coalesce(func.sum(GoogleAds.impressions), 0),
                func.coalesce(func.sum(GoogleAds.clicks), 0),
                func.coalesce(func.sum(GoogleAds.cost), 0),
                func.coalesce(func.sum(GoogleAds.conversions), 0),
                func.coalesce(func.sum(GoogleAds.conversions_value), 0),
            ).where(
                and_(
                    GoogleAds.campaign_pk_id == resolved_pk_id,
                    GoogleAds.date >= date_from,
                    GoogleAds.date <= date_to,
                )
            )
            m = (await db.execute(meta_stmt)).one()
            g = (await db.execute(google_stmt)).one()
            ad_metrics = {
                "impressions": Decimal(int(m[0]) + int(g[0])),
                "clicks": Decimal(int(m[1]) + int(g[1])),
                "spend": _quantize(Decimal(str(m[2])) + Decimal(str(g[2]))) or Decimal(0),
                "conversions": _quantize(Decimal(str(m[3])) + Decimal(str(g[3]))) or Decimal(0),
                "conversions_value": _quantize(Decimal(str(m[4])) + Decimal(str(g[4]))) or Decimal(0),
            }

    # 2) E-ticaret attribution — orders.campaign_name = resolved_name
    ecom_summary = {
        "orders": 0,
        "revenue": Decimal(0),
        "items_sold": 0,
        "aov": None,
    }
    if resolved_name:
        stmt = select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.net_revenue), 0),
            func.coalesce(func.sum(Order.product_count), 0),
        ).where(
            and_(
                Order.campaign_name == resolved_name,
                func.date(Order.order_date) >= date_from,
                func.date(Order.order_date) <= date_to,
                Order.order_status.in_(("completed", "shipped", "refunded")),
            )
        )
        row = (await db.execute(stmt)).one()
        order_count = int(row[0] or 0)
        revenue = Decimal(str(row[1] or 0))
        items = int(row[2] or 0)
        ecom_summary = {
            "orders": order_count,
            "revenue": _quantize(revenue) or Decimal(0),
            "items_sold": items,
            "aov": _quantize(_safe_div(revenue, Decimal(order_count))),
        }

    # 3) Top products — order_items × products JOIN (campaign attribution ile)
    top_products: list[dict[str, Any]] = []
    if resolved_name:
        stmt = (
            select(
                ProductModel.sku,
                ProductModel.product_name,
                ProductModel.brand,
                ProductModel.category,
                func.coalesce(func.sum(OrderItem.quantity), 0).label("units"),
                func.coalesce(func.sum(OrderItem.line_total), 0).label("revenue"),
                func.count(func.distinct(Order.id)).label("orders"),
            )
            .join(OrderItem, OrderItem.product_pk_id == ProductModel.id)
            .join(Order, Order.id == OrderItem.order_pk_id)
            .where(
                and_(
                    Order.campaign_name == resolved_name,
                    func.date(Order.order_date) >= date_from,
                    func.date(Order.order_date) <= date_to,
                    Order.order_status.in_(("completed", "shipped", "refunded")),
                )
            )
            .group_by(
                ProductModel.id,
                ProductModel.sku,
                ProductModel.product_name,
                ProductModel.brand,
                ProductModel.category,
            )
            .order_by(func.sum(OrderItem.line_total).desc())
            .limit(top_n)
        )
        rows = (await db.execute(stmt)).all()
        top_products = [
            {
                "sku": r[0],
                "product_name": r[1],
                "brand": r[2],
                "category": r[3],
                "units_sold": int(r[4]),
                "revenue": str(_quantize(Decimal(str(r[5]))) or Decimal(0)),
                "orders": int(r[6]),
            }
            for r in rows
        ]

    # 4) Daily series — bu kampanyanın günlük revenue (e-ticaret) ve spend (ad)
    daily_series: list[dict[str, Any]] = []
    if resolved_name:
        # E-ticaret revenue per gün
        ecom_stmt = (
            select(
                func.date(Order.order_date).label("d"),
                func.coalesce(func.sum(Order.net_revenue), 0),
                func.count(Order.id),
            )
            .where(
                and_(
                    Order.campaign_name == resolved_name,
                    func.date(Order.order_date) >= date_from,
                    func.date(Order.order_date) <= date_to,
                    Order.order_status.in_(("completed", "shipped", "refunded")),
                )
            )
            .group_by(func.date(Order.order_date))
            .order_by(func.date(Order.order_date))
        )
        ecom_rows = {r[0]: (Decimal(str(r[1] or 0)), int(r[2] or 0)) for r in (await db.execute(ecom_stmt)).all()}

        # Spend per gün — meta_ads + google_ads (campaign_pk_id match)
        spend_by_date: dict[date, Decimal] = {}
        if resolved_pk_id is not None:
            from app.models import GoogleAds, MetaAds

            for raw_model, date_col in [(MetaAds, MetaAds.date_start), (GoogleAds, GoogleAds.date)]:
                stmt = (
                    select(
                        date_col.label("d"),
                        func.coalesce(
                            func.sum(
                                raw_model.spend  # type: ignore[union-attr]
                                if hasattr(raw_model, "spend")
                                else raw_model.cost  # type: ignore[union-attr]
                            ),
                            0,
                        ),
                    )
                    .where(
                        and_(
                            raw_model.campaign_pk_id == resolved_pk_id,  # type: ignore[union-attr]
                            date_col >= date_from,
                            date_col <= date_to,
                        )
                    )
                    .group_by(date_col)
                )
                for r in (await db.execute(stmt)).all():
                    spend_by_date[r[0]] = spend_by_date.get(r[0], Decimal(0)) + Decimal(str(r[1] or 0))

        # Birleştir
        all_dates = sorted(set(ecom_rows.keys()) | set(spend_by_date.keys()))
        for d in all_dates:
            rev, ord_count = ecom_rows.get(d, (Decimal(0), 0))
            sp = spend_by_date.get(d, Decimal(0))
            daily_series.append(
                {
                    "date": d,
                    "revenue": str(_quantize(rev) or Decimal(0)),
                    "orders": ord_count,
                    "spend": str(_quantize(sp) or Decimal(0)),
                }
            )

    return {
        "campaign_pk_id": resolved_pk_id,
        "campaign_name": resolved_name,
        "platform": campaign.platform.value if campaign and campaign.platform else None,
        "date_from": date_from,
        "date_to": date_to,
        "ad_metrics": {k: str(v) for k, v in ad_metrics.items()},
        "ecom_summary": {
            "orders": ecom_summary["orders"],
            "revenue": str(ecom_summary["revenue"]),
            "items_sold": ecom_summary["items_sold"],
            "aov": str(ecom_summary["aov"]) if ecom_summary["aov"] is not None else None,
        },
        "top_products": top_products,
        "daily_series": daily_series,
    }


async def campaign_performance(
    db: AsyncSession,
    *,
    period_start: date,
    period_end: date,
    platform: KPIPlatform | None = None,
    limit: int = 50,
    order_by: str = "spend",
) -> list[CampaignMetric]:
    """Kampanya × performance metrics (§9.6.3) — `kpi_campaign_aggregates`."""
    items = await agg_repo.list_campaign_aggregates(
        db,
        period_start=period_start,
        period_end=period_end,
        platform=platform,
        limit=limit,
        order_by=order_by,
    )
    return [
        CampaignMetric(
            campaign_id=it.campaign_pk_id,
            campaign_name=it.campaign_name,
            platform=it.platform.value if it.platform else None,
            impressions=int(it.impressions),
            clicks=int(it.clicks),
            spend=it.spend,
            conversions=it.conversions,
            conversions_value=it.conversions_value,
            ctr=it.ctr,
            cpc=it.cpc,
            roas=it.roas,
        )
        for it in items
    ]


async def new_vs_returning_revenue(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> list[CustomerTypeRevenue]:
    """§9.6.4 — `customers.first_order_date >= date_from` ise 'new'."""
    realized = Order.order_status.in_(("completed", "shipped", "refunded"))
    new_stmt = (
        select(
            func.coalesce(func.sum(Order.net_revenue), 0).label("revenue"),
            func.count(Order.id).label("orders"),
        )
        .join(Customer, Order.customer_pk_id == Customer.id)
        .where(
            and_(
                func.date(Order.order_date) >= date_from,
                func.date(Order.order_date) <= date_to,
                Customer.first_order_date >= date_from,
                realized,
            )
        )
    )
    returning_stmt = (
        select(
            func.coalesce(func.sum(Order.net_revenue), 0),
            func.count(Order.id),
        )
        .join(Customer, Order.customer_pk_id == Customer.id)
        .where(
            and_(
                func.date(Order.order_date) >= date_from,
                func.date(Order.order_date) <= date_to,
                Customer.first_order_date < date_from,
                realized,
            )
        )
    )
    new_row = (await db.execute(new_stmt)).one()
    ret_row = (await db.execute(returning_stmt)).one()

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


async def daily_revenue_series(
    db: AsyncSession, *, date_from: date, date_to: date
) -> list[DailySeriesPoint]:
    """§9.6.5 — gün gün revenue/orders/sessions/spend (trend chart için).

    Tek query'de 4 metric çekilir; frontend chart wrapper bunları multi-series
    olarak çizer.
    """
    rows = await agg_repo.daily_series(
        db,
        ["revenue", "orders", "sessions", "spend"],
        date_from=date_from,
        date_to=date_to,
    )
    return [
        DailySeriesPoint(
            date=r["date"],
            revenue=_quantize(r["revenue"]) or Decimal(0),
            orders=int(r["orders"]),
            sessions=int(r["sessions"]),
            spend=_quantize(r["spend"]) or Decimal(0),
        )
        for r in rows
    ]


# ---------------------------------------------------------------------- #
# 9.7 İleri Analitikler (Funnel / Top lists)
# ---------------------------------------------------------------------- #


async def funnel_steps(
    db: AsyncSession, *, date_from: date, date_to: date
) -> list[FunnelStep]:
    """E-ticaret funnel: View → Cart → Checkout → Purchase (§9.7.1)."""
    stmt = select(
        func.coalesce(func.sum(GA4ItemEngagement.items_viewed), 0),
        func.coalesce(func.sum(GA4ItemEngagement.items_added_to_cart), 0),
        func.coalesce(func.sum(GA4ItemEngagement.items_checked_out), 0),
        func.coalesce(func.sum(GA4ItemEngagement.items_purchased), 0),
    ).where(
        and_(
            GA4ItemEngagement.date >= date_from,
            GA4ItemEngagement.date <= date_to,
        )
    )
    row = (await db.execute(stmt)).one()
    view, cart, checkout, purchase = (int(x) for x in row)

    def drop_pct(prev_count: int, curr_count: int) -> Decimal | None:
        if prev_count == 0:
            return None
        return _quantize(
            Decimal(prev_count - curr_count) / Decimal(prev_count) * 100
        )

    return [
        FunnelStep(step="view", label_tr="Görüntüleme", count=view, drop_from_previous_pct=None),
        FunnelStep(
            step="add_to_cart",
            label_tr="Sepete Ekleme",
            count=cart,
            drop_from_previous_pct=drop_pct(view, cart),
        ),
        FunnelStep(
            step="checkout",
            label_tr="Ödeme Başlatma",
            count=checkout,
            drop_from_previous_pct=drop_pct(cart, checkout),
        ),
        FunnelStep(
            step="purchase",
            label_tr="Satın Alma",
            count=purchase,
            drop_from_previous_pct=drop_pct(checkout, purchase),
        ),
    ]


async def top_products(
    db: AsyncSession, *, date_from: date, date_to: date, limit: int = 20
) -> list[TopProductRow]:
    """En çok satan ürünler (§9.7.5) — order_items × products JOIN."""
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
        .where(
            and_(
                func.date(Order.order_date) >= date_from,
                func.date(Order.order_date) <= date_to,
                Order.order_status.in_(("completed", "shipped", "refunded")),
            )
        )
        .group_by(Product.id, Product.sku, Product.product_name, Product.brand)
        .order_by(func.sum(OrderItem.line_total).desc())
        .limit(limit)
    )
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


async def by_dimension_revenue(
    db: AsyncSession,
    dimension: str,
    *,
    date_from: date,
    date_to: date,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Kanal/cihaz/şehir gibi boyutlarda revenue + sessions + orders kırılımı."""
    return await agg_repo.group_by_dimension_daily(
        db,
        dimension,
        ["revenue", "sessions", "orders"],
        date_from=date_from,
        date_to=date_to,
        order_by_metric="revenue",
        limit=limit,
    )


async def ga4_traffic_by_city(
    db: AsyncSession, *, date_from: date, date_to: date, limit: int = 20
) -> list[dict[str, Any]]:
    """GA4 ham tablosundan şehir bazında session toplam (top N)."""
    from app.models import GA4Traffic

    stmt = (
        select(
            GA4Traffic.city.label("city"),
            func.coalesce(func.sum(GA4Traffic.sessions), 0).label("sessions"),
        )
        .where(
            and_(
                GA4Traffic.date >= date_from,
                GA4Traffic.date <= date_to,
                GA4Traffic.city.isnot(None),
            )
        )
        .group_by(GA4Traffic.city)
        .order_by(func.sum(GA4Traffic.sessions).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [{"city": r[0], "sessions": Decimal(str(r[1] or 0))} for r in rows]


async def top_categories_brands(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
    by: Literal["category", "brand"] = "category",
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Ürün kategorisi/markası bazında satış miktarı."""
    col = Product.category if by == "category" else Product.brand
    stmt = (
        select(
            col.label(by),
            func.coalesce(func.sum(OrderItem.line_total), 0).label("revenue"),
        )
        .join(OrderItem, OrderItem.product_pk_id == Product.id)
        .join(Order, Order.id == OrderItem.order_pk_id)
        .where(
            and_(
                func.date(Order.order_date) >= date_from,
                func.date(Order.order_date) <= date_to,
            )
        )
        .group_by(col)
        .order_by(func.sum(OrderItem.line_total).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [{by: r[0], "revenue": Decimal(str(r[1] or 0))} for r in rows]


async def cohort_retention(
    db: AsyncSession, *, date_from: date, date_to: date
) -> list[dict[str, Any]]:
    """`docs/09` §9.7.2 — kayıt ayı × ay-N retention.

    Cohort boyutu = `first_order_date` o ayın içinde olan müşteri sayısı
    (cohort_users CTE satır sayısı). Retention = (M_n aktif müşteri) / size.

    NOT: M0 her zaman 100%'e eşit DEĞİLDİR. Bazı müşterilerin
    `first_order_date`'i ile `orders.order_date`'i farklı satırlarda
    olabilir (registration tarihinin sipariş tarihinden farklı tutulması
    gibi); bu durumda M0 < cohort_size çıkar ve %100 altında bir M0
    retention'ı bilgilendiricidir.
    """
    from sqlalchemy import text as sa_text

    # 1) Cohort boyutları — tabanı first_order_date'ten al, NOT offset=0.
    size_stmt = sa_text(
        """
        SELECT
            DATE(DATE_FORMAT(first_order_date, '%Y-%m-01')) AS cohort_month,
            COUNT(*) AS size
        FROM customers
        WHERE first_order_date BETWEEN :from AND :to
        GROUP BY cohort_month
        """
    )
    size_rows = (
        await db.execute(size_stmt, {"from": date_from, "to": date_to})
    ).all()
    base: dict[date, int] = {cm: int(n) for cm, n in size_rows}

    # 2) Her (cohort, month_offset) için aktif müşteri sayısı
    stmt = sa_text(
        """
        WITH cohort_users AS (
            SELECT
                DATE(DATE_FORMAT(first_order_date, '%Y-%m-01')) AS cohort_month,
                id AS customer_pk_id
            FROM customers
            WHERE first_order_date BETWEEN :from AND :to
        ),
        user_orders AS (
            SELECT
                cu.cohort_month,
                cu.customer_pk_id,
                TIMESTAMPDIFF(MONTH, cu.cohort_month, DATE(o.order_date)) AS month_offset
            FROM cohort_users cu
            JOIN orders o ON cu.customer_pk_id = o.customer_pk_id
                AND o.order_status IN ('completed', 'shipped', 'refunded')
        )
        SELECT cohort_month, month_offset, COUNT(DISTINCT customer_pk_id) AS cnt
        FROM user_orders
        WHERE month_offset BETWEEN 0 AND 12
        GROUP BY cohort_month, month_offset
        ORDER BY cohort_month, month_offset
        """
    )
    rows = (await db.execute(stmt, {"from": date_from, "to": date_to})).all()
    out: list[dict[str, Any]] = []
    for cohort_month, offset, cnt in rows:
        size = base.get(cohort_month, 0)
        retention = (
            _quantize(Decimal(int(cnt)) / Decimal(size) * 100)
            if size > 0
            else None
        )
        out.append(
            {
                "cohort_month": cohort_month,
                "month_offset": int(offset),
                "customer_count": int(cnt),
                "retention_pct": retention,
            }
        )
    return out


async def top_customers(
    db: AsyncSession, *, date_from: date, date_to: date, limit: int = 50
) -> list[TopCustomerRow]:
    """En çok harcayan müşteriler (§9.7.5)."""
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
        .where(
            and_(
                func.date(Order.order_date) >= date_from,
                func.date(Order.order_date) <= date_to,
                Order.order_status.in_(("completed", "shipped", "refunded")),
            )
        )
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
