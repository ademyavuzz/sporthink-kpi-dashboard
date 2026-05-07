"""KPI ve dashboard endpoint'leri için API şemaları.

`docs/overview/09-kpi-formulas.md` ile birebir uyumlu — KPIResult, trend
yönü, birim, karşılaştırma yapısı.
"""

from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

KPIUnit = Literal[
    "currency",  # TL — Intl.NumberFormat tr-TR currency
    "percent",  # 0-100 (örn 65.5 = %65.5)
    "count",  # Adet — Intl.NumberFormat tr-TR
    "multiplier",  # ROAS gibi (4.5x)
    "duration_seconds",  # Saniye — UI "2dk 35sn"
]


TrendDirection = Literal["up", "down", "flat"]
ComparisonMode = Literal["sequential", "yoy"]


class KPIResult(BaseModel):
    """Tek KPI'nın tüm metaları + trend.

    `value=None` → "veri yok" (sıfır bölme veya hiç veri olmaması durumu).
    `change_percentage=None` → önceki dönem 0 veya yok (delta hesaplanamaz).
    """

    kpi_id: str
    label_tr: str
    value: Decimal | None
    previous_value: Decimal | None
    change_percentage: Decimal | None
    direction: TrendDirection
    is_positive: bool
    unit: KPIUnit
    trend_direction_positive: Literal["up", "down"]


class DateRange(BaseModel):
    """Mevcut dönem + karşılaştırma dönemi."""

    date_from: date_type
    date_to: date_type
    comparison_from: date_type | None = None
    comparison_to: date_type | None = None
    comparison_mode: ComparisonMode = "sequential"


class KPISummary(BaseModel):
    """`/dashboard/overview` cevabı — KPI card grid için ana özet."""

    date_range: DateRange
    revenue: KPIResult
    orders: KPIResult
    aov: KPIResult
    sessions: KPIResult
    users: KPIResult
    conversion_rate: KPIResult
    bounce_rate: KPIResult
    ad_spend: KPIResult
    roas: KPIResult


class ChannelMetric(BaseModel):
    """Kanal × metric kırılımı (donut/bar chart için)."""

    channel: str | None
    revenue: Decimal
    orders: int
    sessions: int
    conversion_rate: Decimal | None  # %


class CampaignMetric(BaseModel):
    """Kampanya × performance metrics."""

    campaign_id: int
    campaign_name: str | None
    platform: str | None
    objective: str | None = None
    impressions: int
    clicks: int
    spend: Decimal
    conversions: Decimal
    conversions_value: Decimal
    ctr: Decimal | None
    cpc: Decimal | None
    roas: Decimal | None


class DailySeriesPoint(BaseModel):
    """Trend chart için tek nokta (gün)."""

    date: date_type
    revenue: Decimal
    orders: int
    sessions: int
    spend: Decimal


class FunnelStep(BaseModel):
    """E-ticaret funnel adımı."""

    step: Literal["view", "add_to_cart", "checkout", "purchase"]
    label_tr: str
    count: int
    drop_from_previous_pct: Decimal | None  # 0-100, ilk adımda None


class FunnelGroup(BaseModel):
    """Boyuta göre (cihaz/kanal) gruplanmış funnel — mini funnel kartları için."""

    key: str  # mobile / desktop / tablet | organic_search / paid_search / paid_social
    label_tr: str
    steps: list[FunnelStep]


class FunnelDropoffPoint(BaseModel):
    """Drop-off oranlarının zaman içindeki trendi (line chart için tek gün)."""

    date: date_type
    view_to_cart_pct: Decimal | None
    cart_to_checkout_pct: Decimal | None
    checkout_to_purchase_pct: Decimal | None


class CustomerTypeRevenue(BaseModel):
    """Yeni vs geri dönen müşteri kırılımı."""

    customer_type: Literal["new", "returning"]
    revenue: Decimal
    orders: int


class TopProductRow(BaseModel):
    sku: str
    product_name: str | None
    brand: str | None
    units_sold: int
    revenue: Decimal


class TopCustomerRow(BaseModel):
    customer_id: str
    customer_name: str | None
    city: str | None
    gender: str | None
    age_group: str | None
    revenue: Decimal
    order_count: int
