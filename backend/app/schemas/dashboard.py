"""Dashboard sayfa endpoint'leri için response şemaları.

Her sayfa kendi ihtiyacına göre KPI + chart + tablo combo'su döner. Frontend
sayfa load'ında tek API çağrısıyla tüm veriyi alır (su altındaki paralel
DB sorguları backend'de).
"""
from __future__ import annotations

from datetime import date as date_type
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.kpi import (
    CampaignMetric,
    ChannelMetric,
    CustomerTypeRevenue,
    DailySeriesPoint,
    DateRange,
    FunnelStep,
    KPIResult,
    KPISummary,
    TopCustomerRow,
    TopProductRow,
)


class OverviewResponse(BaseModel):
    """`/dashboard/overview` — ana sayfa: 9 KPI + 4 chart bloğu."""

    summary: KPISummary
    channels: list[ChannelMetric]
    daily_series: list[DailySeriesPoint]
    new_vs_returning: list[CustomerTypeRevenue]
    funnel: list[FunnelStep]
    top_products: list[TopProductRow]


class DimensionBreakdown(BaseModel):
    """Generic boyut × metric kırılımı (channel, device, city için)."""

    label: str | None
    value: Decimal


class TrafficResponse(BaseModel):
    """`/dashboard/traffic` — GA4 trafik sayfası."""

    date_range: DateRange
    sessions: KPIResult
    users: KPIResult
    new_users: KPIResult
    bounce_rate: KPIResult
    pages_per_session: KPIResult
    avg_session_duration: KPIResult
    conversion_rate: KPIResult
    daily_series: list[DailySeriesPoint]
    by_channel: list[DimensionBreakdown]
    by_device: list[DimensionBreakdown]
    by_city: list[DimensionBreakdown]


class MetaAdsResponse(BaseModel):
    """`/dashboard/meta` — Meta Ads sayfası."""

    date_range: DateRange
    ad_spend: KPIResult
    impressions: KPIResult
    clicks: KPIResult
    ctr: KPIResult
    cpc: KPIResult
    ad_conversions: KPIResult
    roas: KPIResult
    frequency: KPIResult
    campaigns: list[CampaignMetric]
    daily_series: list[DailySeriesPoint]


class GoogleAdsResponse(BaseModel):
    """`/dashboard/google` — Google Ads sayfası."""

    date_range: DateRange
    ad_spend: KPIResult
    impressions: KPIResult
    clicks: KPIResult
    ctr: KPIResult
    cpc: KPIResult
    ad_conversions: KPIResult
    cost_per_conversion: KPIResult
    roas: KPIResult
    campaigns: list[CampaignMetric]
    daily_series: list[DailySeriesPoint]


class EcommerceResponse(BaseModel):
    """`/dashboard/ecom` — E-Ticaret sayfası."""

    date_range: DateRange
    revenue: KPIResult
    orders: KPIResult
    aov: KPIResult
    items_sold: KPIResult
    refund_rate: KPIResult
    repeat_purchase_rate: KPIResult
    revenue_per_user: KPIResult
    daily_series: list[DailySeriesPoint]
    by_channel: list[ChannelMetric]
    new_vs_returning: list[CustomerTypeRevenue]
    top_customers: list[TopCustomerRow]


class CampaignAnalysisResponse(BaseModel):
    """`/dashboard/campaign` — Kampanya analizi."""

    date_range: DateRange
    total_spend: KPIResult
    total_revenue: KPIResult
    overall_roas: KPIResult
    campaigns: list[CampaignMetric]


class FunnelResponse(BaseModel):
    """`/dashboard/funnel` — E-ticaret funnel."""

    date_range: DateRange
    steps: list[FunnelStep]


class CohortCell(BaseModel):
    """Cohort heatmap tek hücre."""

    cohort_month: date_type
    month_offset: int
    customer_count: int
    retention_pct: Decimal | None  # 0-100


class CohortResponse(BaseModel):
    """`/dashboard/cohort` — Cohort heatmap."""

    date_range: DateRange
    cells: list[CohortCell]


class ProductsResponse(BaseModel):
    """`/dashboard/products` — Ürün performans sayfası."""

    date_range: DateRange
    items_sold: KPIResult
    top_products: list[TopProductRow]
    by_category: list[DimensionBreakdown]
    by_brand: list[DimensionBreakdown]


class CustomerOverviewRow(BaseModel):
    """Top müşteri tablosu satırı."""

    customer_id: str
    customer_name: str | None
    city: str | None
    gender: str | None
    age_group: str | None
    total_orders: int
    total_revenue: Decimal
    last_order_date: date_type | None


class CustomerFreqBucket(BaseModel):
    """Sipariş frekansı dağılımı (1, 2, 3, 4, 5-9, 10+ kovaları)."""

    bucket: str
    customer_count: int


class NewsletterCompare(BaseModel):
    """Newsletter abone olan vs olmayan ortalamaları."""

    is_subscriber: bool
    customer_count: int
    avg_orders: Decimal
    avg_revenue: Decimal


class CustomerDailyPoint(BaseModel):
    """Gün bazlı yeni müşteri trendi."""

    date: date_type
    new_customers: int


class ChannelPerformanceRow(BaseModel):
    """Tek kanalın detay metrikleri."""

    channel: str
    revenue: Decimal
    orders: int
    sessions: int
    conversion_rate: Decimal | None  # %
    ad_spend: Decimal
    ad_revenue: Decimal
    roas: Decimal | None
    customers: int  # distinct customer count
    aov: Decimal | None  # avg order value


class ChannelDailyPoint(BaseModel):
    """Bir kanalın günlük cirosu (top kanallar için multi-series)."""

    date: date_type
    channel: str
    revenue: Decimal


class ChannelAnalysisResponse(BaseModel):
    """`/dashboard/channel-analysis` — kanal performans sayfası."""

    date_range: DateRange
    # Üst KPI'lar
    active_channels: KPIResult
    top_channel_revenue: KPIResult
    avg_roas: KPIResult
    avg_conversion_rate: KPIResult
    # Detaylı kanal tablosu
    channels: list[ChannelPerformanceRow]
    # Chart verileri
    revenue_distribution: list[DimensionBreakdown]  # Donut için
    roas_by_channel: list[DimensionBreakdown]  # Horizontal bar
    conversion_by_channel: list[DimensionBreakdown]  # Horizontal bar
    daily_revenue_trend: list[ChannelDailyPoint]  # Multi-series line


class CustomersResponse(BaseModel):
    """`/dashboard/customers` — Müşteri analizi sayfası.

    KPI'lar + breakdown'lar + trend + top tablosu tek payload.
    """

    date_range: DateRange
    # KPI'lar (üstte 6 kart)
    total_customers: KPIResult
    new_customers: KPIResult
    repeat_rate: KPIResult
    avg_customer_value: KPIResult
    avg_orders_per_customer: KPIResult
    newsletter_subscription_rate: KPIResult
    # Breakdown'lar
    by_gender: list[DimensionBreakdown]
    by_age_group: list[DimensionBreakdown]
    by_city: list[DimensionBreakdown]
    order_frequency: list[CustomerFreqBucket]
    newsletter_comparison: list[NewsletterCompare]
    # Trend
    daily_new_customers: list[CustomerDailyPoint]
    # Top tablo
    top_customers: list[CustomerOverviewRow]
