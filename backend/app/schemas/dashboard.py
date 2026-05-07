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
    FunnelDropoffPoint,
    FunnelGroup,
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


class TrafficDailyPoint(BaseModel):
    """Trafik trend chart için günlük nokta — sessions/users/new_users.

    Combo line chart için (`docs/07` §7.5.2), filtrelenmiş GA4Traffic verisi.
    """

    date: date_type
    sessions: int
    users: int
    new_users: int


class LandingPageRow(BaseModel):
    """Landing page performans tablosu satırı.

    `page_path` GA4'teki `landing_page_plus_query_string` alanı; query string
    çıkartılmadan tutulur (raporlama için faydalı).
    """

    page_path: str
    sessions: int
    users: int
    bounce_rate: Decimal | None  # 0-100
    avg_session_duration: Decimal | None  # saniye
    conversion_rate: Decimal | None  # 0-100


class TrafficResponse(BaseModel):
    """`/dashboard/traffic` — GA4 trafik sayfası.

    Filtreler (`channels`, `devices`, `cities`) tüm chart/tablolarda uygulanır;
    KPI kartları da aynı filtre bağlamında hesaplanır. Filtre yokken tüm
    GA4Traffic kapsanır.
    """

    date_range: DateRange
    sessions: KPIResult
    users: KPIResult
    new_users: KPIResult
    bounce_rate: KPIResult
    pages_per_session: KPIResult
    avg_session_duration: KPIResult
    conversion_rate: KPIResult
    daily_series: list[TrafficDailyPoint]
    by_channel: list[DimensionBreakdown]
    by_device: list[DimensionBreakdown]
    by_city: list[DimensionBreakdown]
    landing_pages: list[LandingPageRow]


class MetaAdsResponse(BaseModel):
    """`/dashboard/meta` — Meta Ads sayfası."""

    date_range: DateRange
    ad_spend: KPIResult
    impressions: KPIResult
    clicks: KPIResult
    ctr: KPIResult
    cpc: KPIResult
    cpm: KPIResult
    ad_conversions: KPIResult
    cost_per_conversion: KPIResult
    roas: KPIResult
    frequency: KPIResult
    campaigns: list[CampaignMetric]
    daily_series: list[DailySeriesPoint]


class GoogleCampaignMetric(CampaignMetric):
    """Google'a özel kampanya satırı — `channel_type` ek alanı.

    Google Ads kampanya tipidir (search/shopping/performance_max/display/video).
    Frontend tab görünürlüğünü ve kanal-tipi filtresini bu alana göre yönetir.
    Bir kampanyada birden fazla tip varsa en yaygın görüleni; tip yoksa None.
    """

    channel_type: str | None


class GoogleChannelTypeBreakdown(BaseModel):
    """Kanal tipi (search/shopping/pmax/display) × harcama dağılımı (donut)."""

    channel_type: str | None
    spend: Decimal
    impressions: int
    clicks: int
    conversions: Decimal
    conversions_value: Decimal


class GoogleKeywordRow(BaseModel):
    """Anahtar kelime performans satırı (yalnızca Search kampanyaları için).

    `match_type`: `exact | phrase | broad`.
    """

    keyword: str
    match_type: str | None
    clicks: int
    impressions: int
    ctr: Decimal | None  # 0-100
    cpc: Decimal | None
    conversions: Decimal
    roas: Decimal | None


class GoogleProductRow(BaseModel):
    """Ürün performans satırı (Shopping ve Performance Max için)."""

    product_id: str
    product_name: str | None
    impressions: int
    clicks: int
    conversions: Decimal
    spend: Decimal
    conversions_value: Decimal
    roas: Decimal | None


class GoogleAdsResponse(BaseModel):
    """`/dashboard/google` — Google Ads sayfası.

    Search/Shopping/PMax ayrımı kritik. `channel_breakdown` donut için,
    `keywords` Search kampanyaları için, `products` Shopping/PMax için
    alt kırılımlar; tek payload'da döner.
    """

    date_range: DateRange
    ad_spend: KPIResult
    impressions: KPIResult
    clicks: KPIResult
    ctr: KPIResult
    cpc: KPIResult
    cpm: KPIResult
    ad_conversions: KPIResult
    cost_per_conversion: KPIResult
    roas: KPIResult
    campaigns: list[GoogleCampaignMetric]
    top_campaigns_by_roas: list[GoogleCampaignMetric]
    channel_breakdown: list[GoogleChannelTypeBreakdown]
    keywords: list[GoogleKeywordRow]
    products: list[GoogleProductRow]
    daily_series: list[DailySeriesPoint]


class OrderListRow(BaseModel):
    """E-ticaret sayfasındaki sipariş listesi tablosu satırı.

    Sipariş tıklanınca `/dashboard/ecom/order-detail` ile detay açılır.
    `order_pk_id` UI'da görünmez ama detay çağrısında kullanılır.
    """

    order_pk_id: int
    order_id: str
    order_date: date_type
    customer_id: str
    customer_name: str | None
    net_revenue: Decimal
    order_status: str
    payment_method: str


class OrderLineItem(BaseModel):
    """Sipariş detay modal'ı içindeki kalem (`order_items` satırı)."""

    sku: str
    product_name: str | None
    brand: str | None
    category: str | None
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class OrderDetailCustomer(BaseModel):
    """Sipariş detay modal'ında gösterilen müşteri özeti."""

    customer_id: str
    customer_name: str | None
    city: str | None
    gender: str | None
    age_group: str | None
    is_newsletter_subscriber: bool
    total_orders: int
    total_revenue: Decimal


class OrderDetailResponse(BaseModel):
    """`/dashboard/ecom/order-detail` — tek siparişin detayı."""

    order_pk_id: int
    order_id: str
    order_date: date_type
    city: str
    device: str
    channel: str
    source: str | None
    medium: str | None
    campaign_name: str | None
    coupon_code: str | None
    order_status: str
    payment_method: str
    order_revenue: Decimal
    shipping_cost: Decimal
    discount_amount: Decimal
    refund_amount: Decimal
    net_revenue: Decimal
    line_items: list[OrderLineItem]
    customer: OrderDetailCustomer


class EcommerceResponse(BaseModel):
    """`/dashboard/ecom` — E-Ticaret sayfası.

    Filtreler (`categories`, `brands`, `statuses`, `payment_methods`,
    `segment_id`) tüm KPI/chart/tablolarda uygulanır. Filtreler boşsa veri
    aralığındaki tüm siparişler dahildir.
    """

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
    by_category: list[DimensionBreakdown]
    by_device: list[DimensionBreakdown]
    by_city: list[DimensionBreakdown]
    by_payment_method: list[DimensionBreakdown]
    new_vs_returning: list[CustomerTypeRevenue]
    top_products: list[TopProductRow]
    top_customers: list[TopCustomerRow]
    orders_list: list[OrderListRow]
    orders_total: int


class CampaignAnalysisResponse(BaseModel):
    """`/dashboard/campaign` — Kampanya analizi."""

    date_range: DateRange
    total_spend: KPIResult
    total_revenue: KPIResult
    overall_roas: KPIResult
    campaigns: list[CampaignMetric]


class FunnelResponse(BaseModel):
    """`/dashboard/funnel` — E-ticaret funnel + cihaz/kanal kırılımı + trend."""

    date_range: DateRange
    steps: list[FunnelStep]
    total_sessions: int  # ga4_traffic sessions (Trafik → Sipariş dönüşümü için)
    by_device: list[FunnelGroup]  # mobile / desktop / tablet
    by_channel: list[FunnelGroup]  # organic_search / paid_search / paid_social
    dropoff_series: list[FunnelDropoffPoint]  # günlük drop-off trend


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
