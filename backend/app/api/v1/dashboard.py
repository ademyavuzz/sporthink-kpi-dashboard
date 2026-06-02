"""Dashboard endpoint'leri: 9 sayfa için tek noktada KPI + chart + tablo.

Tüm endpoint'ler:
- GET şeklinde, query param ile date_from/date_to/comparison_mode alır
- 5 dakikalık Redis cache (`cache_keys.kpi_dashboard`)
- İlgili `Permission.<PAGE>_VIEW` izni kontrolü (`docs/05` §5.5)

Cache invalidation: yeni veri import edildiğinde `cache.delete_pattern("kpi:*")`
import_service'in audit_log adımında çağrılır.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache_keys
from app.core.exceptions import ValidationError
from app.core.permissions import Permission
from app.dependencies import get_db, require_permission
from app.models import KPIPlatform, User
from app.repositories import kpi_aggregate_repository as agg_repo
from app.schemas import (
    CampaignAnalysisResponse,
    CampaignDetailResponse,
    ChannelAnalysisResponse,
    CohortCell,
    CohortResponse,
    CustomersResponse,
    DimensionBreakdown,
    EcommerceResponse,
    FunnelResponse,
    GoogleAdsResponse,
    GoogleCampaignMetric,
    GoogleChannelTypeBreakdown,
    GoogleKeywordRow,
    GoogleProductRow,
    LandingPageRow,
    MetaAdsResponse,
    OrderDetailResponse,
    OverviewResponse,
    ProductsResponse,
    SuccessEnvelope,
    TrafficDailyPoint,
    TrafficResponse,
)
from app.schemas.kpi import DateRange, KPIResult
from app.services import channel_service, customer_service, ecom_service, kpi_service
from app.services.cache_service import cache

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


ComparisonMode = Literal["sequential", "yoy"]


def _validate_range(date_from: date, date_to: date) -> None:
    """Tüm dashboard endpoint'leri için ortak tarih aralığı doğrulaması.

    `date_from > date_to` ise sessizce 0 döndürmek yerine 422 ile
    `VALIDATION_ERROR` dönüyoruz; aksi halde frontend'de "veri yok"
    gibi yorumlanır.
    """
    if date_from > date_to:
        raise ValidationError(
            "date_from must be less than or equal to date_to",
            field="date_from",
        )


def _date_range_with_comparison(
    date_from: date, date_to: date, comparison_mode: ComparisonMode
) -> DateRange:
    prev_from, prev_to = kpi_service.compute_comparison_period(date_from, date_to, comparison_mode)
    return DateRange(
        date_from=date_from,
        date_to=date_to,
        comparison_from=prev_from,
        comparison_to=prev_to,
        comparison_mode=comparison_mode,
    )


# ---------------------------------------------------------------------- #
# /dashboard/overview
# ---------------------------------------------------------------------- #


@router.get(
    "/overview",
    response_model=SuccessEnvelope[OverviewResponse],
    summary="Genel özet sayfası",
    description=(
        "Genel özet sayfasının verisini döner: 9 ana KPI ile birlikte gelir "
        "trendi, kanal dağılımı, yeni/dönen müşteri, dönüşüm hunisi, en çok "
        "satan ürünler ve şehir bazlı gelir dağılımı blokları. Kanal ve cihaz "
        "filtreleri çapraz filtre olarak uygulanır."
    ),
)
async def get_overview(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    channels: list[str] | None = Query(None, description="Kanal filtresi (çoklu, çapraz filtre)"),
    devices: list[str] | None = Query(None, description="Cihaz filtresi (çoklu, çapraz filtre)"),
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[OverviewResponse]:
    _validate_range(date_from, date_to)

    ch = channels or None
    dv = devices or None
    # Filtreler cache key'inin parçası; her filtre kombinasyonu ayrı entry.
    extra: dict[str, Any] = {}
    if ch:
        extra["ch"] = sorted(ch)
    if dv:
        extra["dv"] = sorted(dv)
    key = cache_keys.kpi_summary(
        date_from=date_from,
        date_to=date_to,
        comparison_mode=comparison_mode,
        extra_filters=extra or None,
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=OverviewResponse.model_validate(hit))

    summary = await kpi_service.calculate_summary(
        db,
        date_from=date_from,
        date_to=date_to,
        comparison_mode=comparison_mode,
        channels=ch,
        devices=dv,
    )
    # Kanal donut'u cross-filter seçicisidir; her zaman tüm kanalları gösterir.
    channels_data = await kpi_service.revenue_by_channel(
        db, date_from=date_from, date_to=date_to, limit=10, devices=dv
    )
    daily = await kpi_service.daily_revenue_series(
        db, date_from=date_from, date_to=date_to, channels=ch, devices=dv
    )
    geo = await kpi_service.revenue_by_city(
        db, date_from=date_from, date_to=date_to, channels=ch, devices=dv
    )
    # Funnel / new-vs-returning / top-products kanal kırılımı taşımaz; tarih kapsamlı.
    nvr = await kpi_service.new_vs_returning_revenue(db, date_from=date_from, date_to=date_to)
    funnel = await kpi_service.funnel_steps(db, date_from=date_from, date_to=date_to)
    top_products = await kpi_service.top_products(
        db, date_from=date_from, date_to=date_to, limit=10
    )

    response = OverviewResponse(
        summary=summary,
        channels=channels_data,
        daily_series=daily,
        new_vs_returning=nvr,
        funnel=funnel,
        top_products=top_products,
        geo=geo,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/traffic
# ---------------------------------------------------------------------- #


@router.get(
    "/traffic",
    response_model=SuccessEnvelope[TrafficResponse],
    summary="Trafik (GA4) sayfası",
    description=(
        "GA4 site trafiği sayfasının verisini döner: oturum, kullanıcı, yeni "
        "kullanıcı, hemen çıkma oranı, oturum başına sayfa, ortalama oturum "
        "süresi ve dönüşüm oranı KPI'ları; günlük seri, kanal/cihaz/şehir "
        "kırılımları ve giriş sayfası tablosu. Kanal, cihaz ve şehir filtreleri "
        "uygulanabilir."
    ),
)
async def get_traffic(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    channels: list[str] | None = Query(None, description="Kanal filtresi (çoklu)"),
    devices: list[str] | None = Query(None, description="Cihaz filtresi (çoklu)"),
    cities: list[str] | None = Query(None, description="Şehir filtresi (çoklu)"),
    _user: User = Depends(require_permission(Permission.TRAFFIC_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[TrafficResponse]:
    _validate_range(date_from, date_to)

    # Filtreler cache key'inin parçası; filtre değişince ayrı entry.
    filter_key: dict[str, str | list[str]] = {"cmp": comparison_mode}
    if channels:
        filter_key["ch"] = sorted(channels)
    if devices:
        filter_key["dv"] = sorted(devices)
    if cities:
        filter_key["ct"] = sorted(cities)

    key = cache_keys.kpi_dashboard(
        "traffic",
        date_from=date_from,
        date_to=date_to,
        extra_filters=filter_key,
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=TrafficResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(date_from, date_to, comparison_mode)

    kpis = await kpi_service.traffic_page_kpis(
        db,
        date_from=date_from,
        date_to=date_to,
        prev_from=prev_from,
        prev_to=prev_to,
        channels=channels,
        devices=devices,
        cities=cities,
    )
    daily_rows = await kpi_service.traffic_daily_series(
        db,
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        devices=devices,
        cities=cities,
    )
    by_channel_rows = await kpi_service.traffic_by_dimension(
        db,
        "channel",
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        devices=devices,
        cities=cities,
        limit=20,
    )
    by_device_rows = await kpi_service.traffic_by_dimension(
        db,
        "device",
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        devices=devices,
        cities=cities,
        limit=10,
    )
    by_city_rows = await kpi_service.traffic_by_dimension(
        db,
        "city",
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        devices=devices,
        cities=cities,
        limit=10,
    )
    landing_rows = await kpi_service.traffic_landing_pages(
        db,
        date_from=date_from,
        date_to=date_to,
        channels=channels,
        devices=devices,
        cities=cities,
        limit=100,
    )

    response = TrafficResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        sessions=kpis["sessions"],
        users=kpis["users"],
        new_users=kpis["new_users"],
        bounce_rate=kpis["bounce_rate"],
        pages_per_session=kpis["pages_per_session"],
        avg_session_duration=kpis["avg_session_duration"],
        conversion_rate=kpis["conversion_rate"],
        daily_series=[
            TrafficDailyPoint(
                date=r["date"],
                sessions=r["sessions"],
                users=r["users"],
                new_users=r["new_users"],
            )
            for r in daily_rows
        ],
        by_channel=[
            DimensionBreakdown(label=r["label"], value=r["value"]) for r in by_channel_rows
        ],
        by_device=[DimensionBreakdown(label=r["label"], value=r["value"]) for r in by_device_rows],
        by_city=[DimensionBreakdown(label=r["label"], value=r["value"]) for r in by_city_rows],
        landing_pages=[LandingPageRow(**r) for r in landing_rows],
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/meta
# ---------------------------------------------------------------------- #


@router.get(
    "/meta",
    response_model=SuccessEnvelope[MetaAdsResponse],
    summary="Meta Ads sayfası",
    description=(
        "Meta Ads (Facebook/Instagram) reklam performansı sayfasının verisini "
        "döner: harcama, gösterim, tıklama, CTR, CPC, CPM, dönüşüm, dönüşüm "
        "başına maliyet, ROAS ve frekans KPI'ları; kampanya tablosu ve günlük "
        "seri."
    ),
)
async def get_meta(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.META_ADS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[MetaAdsResponse]:
    _validate_range(date_from, date_to)
    key = cache_keys.kpi_dashboard(
        "meta",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=MetaAdsResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(date_from, date_to, comparison_mode)
    kw = {"prev_from": prev_from, "prev_to": prev_to, "platforms": [KPIPlatform.META]}

    spend = await kpi_service.kpi_ad_spend(db, date_from=date_from, date_to=date_to, **kw)
    impr = await kpi_service.kpi_impressions(db, date_from=date_from, date_to=date_to, **kw)
    clicks = await kpi_service.kpi_clicks(db, date_from=date_from, date_to=date_to, **kw)
    ctr = await kpi_service.kpi_ctr(db, date_from=date_from, date_to=date_to, **kw)
    cpc = await kpi_service.kpi_cpc(db, date_from=date_from, date_to=date_to, **kw)
    cpm = await kpi_service.kpi_cpm(db, date_from=date_from, date_to=date_to, **kw)
    conv = await kpi_service.kpi_ad_conversions(db, date_from=date_from, date_to=date_to, **kw)
    cpa = await kpi_service.kpi_cost_per_conversion(db, date_from=date_from, date_to=date_to, **kw)
    roas = await kpi_service.kpi_roas(db, date_from=date_from, date_to=date_to, **kw)
    # Frequency only applies to Meta; doesn't take platforms filter (raw meta_ads).
    freq = await kpi_service.kpi_frequency(
        db,
        date_from=date_from,
        date_to=date_to,
        prev_from=prev_from,
        prev_to=prev_to,
    )
    campaigns = await kpi_service.campaign_performance(
        db,
        period_start=date_from,
        period_end=date_to,
        platform=KPIPlatform.META,
        limit=50,
    )
    daily = await kpi_service.daily_revenue_series(db, date_from=date_from, date_to=date_to)

    response = MetaAdsResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        ad_spend=spend,
        impressions=impr,
        clicks=clicks,
        ctr=ctr,
        cpc=cpc,
        cpm=cpm,
        ad_conversions=conv,
        cost_per_conversion=cpa,
        roas=roas,
        frequency=freq,
        campaigns=campaigns,
        daily_series=daily,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/google
# ---------------------------------------------------------------------- #


@router.get(
    "/google",
    response_model=SuccessEnvelope[GoogleAdsResponse],
    summary="Google Ads sayfası",
    description=(
        "Google Ads reklam performansı sayfasının verisini döner: harcama, "
        "gösterim, tıklama, CTR, CPC, CPM, dönüşüm, dönüşüm başına maliyet ve "
        "ROAS KPI'ları; kampanya tablosu, ROAS'a göre en iyi kampanyalar, kanal "
        "türü kırılımı, en iyi anahtar kelimeler ve ürünler ile günlük seri."
    ),
)
async def get_google(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.GOOGLE_ADS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[GoogleAdsResponse]:
    _validate_range(date_from, date_to)
    key = cache_keys.kpi_dashboard(
        "google",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=GoogleAdsResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(date_from, date_to, comparison_mode)
    kw = {"prev_from": prev_from, "prev_to": prev_to, "platforms": [KPIPlatform.GOOGLE]}

    spend = await kpi_service.kpi_ad_spend(db, date_from=date_from, date_to=date_to, **kw)
    impr = await kpi_service.kpi_impressions(db, date_from=date_from, date_to=date_to, **kw)
    clicks = await kpi_service.kpi_clicks(db, date_from=date_from, date_to=date_to, **kw)
    ctr = await kpi_service.kpi_ctr(db, date_from=date_from, date_to=date_to, **kw)
    cpc = await kpi_service.kpi_cpc(db, date_from=date_from, date_to=date_to, **kw)
    cpm = await kpi_service.kpi_cpm(db, date_from=date_from, date_to=date_to, **kw)
    conv = await kpi_service.kpi_ad_conversions(db, date_from=date_from, date_to=date_to, **kw)
    cpa = await kpi_service.kpi_cost_per_conversion(db, date_from=date_from, date_to=date_to, **kw)
    roas = await kpi_service.kpi_roas(db, date_from=date_from, date_to=date_to, **kw)
    campaigns_base = await kpi_service.campaign_performance(
        db,
        period_start=date_from,
        period_end=date_to,
        platform=KPIPlatform.GOOGLE,
        limit=200,
    )
    campaigns = [GoogleCampaignMetric(**c.model_dump(), channel_type=None) for c in campaigns_base]
    top_by_roas = sorted(campaigns, key=lambda c: c.roas or 0, reverse=True)[:10]
    channel_breakdown_raw = await kpi_service.google_channel_breakdown(
        db, date_from=date_from, date_to=date_to
    )
    channel_breakdown = [GoogleChannelTypeBreakdown(**row) for row in channel_breakdown_raw]
    keywords_raw = await kpi_service.google_top_keywords(
        db, date_from=date_from, date_to=date_to, limit=20
    )
    keywords = [GoogleKeywordRow(**row) for row in keywords_raw]
    products_raw = await kpi_service.google_top_products(
        db, date_from=date_from, date_to=date_to, limit=20
    )
    products = [GoogleProductRow(**row) for row in products_raw]
    daily = await kpi_service.daily_revenue_series(db, date_from=date_from, date_to=date_to)

    response = GoogleAdsResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        ad_spend=spend,
        impressions=impr,
        clicks=clicks,
        ctr=ctr,
        cpc=cpc,
        cpm=cpm,
        ad_conversions=conv,
        cost_per_conversion=cpa,
        roas=roas,
        campaigns=campaigns,
        top_campaigns_by_roas=top_by_roas,
        channel_breakdown=channel_breakdown,
        keywords=keywords,
        products=products,
        daily_series=daily,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/ecom
# ---------------------------------------------------------------------- #


@router.get(
    "/ecom",
    response_model=SuccessEnvelope[EcommerceResponse],
    summary="E-ticaret sayfası",
    description=(
        "E-ticaret performansı sayfasının verisini döner: gelir, sipariş, "
        "ortalama sepet tutarı, satılan ürün, iade oranı, tekrar satın alma "
        "oranı ve kullanıcı başına gelir KPI'ları; günlük seri, kanal/kategori/"
        "cihaz/şehir/ödeme kırılımları, yeni/dönen müşteri, en iyi ürün ve "
        "müşteri listeleri ile sipariş tablosu. Kategori, marka, sipariş durumu "
        "ve ödeme yöntemi filtreleri uygulanabilir."
    ),
)
async def get_ecom(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    categories: list[str] | None = Query(None, description="Ürün kategorisi filtresi (çoklu)"),
    brands: list[str] | None = Query(None, description="Marka filtresi (çoklu)"),
    statuses: list[str] | None = Query(None, description="Sipariş durumu filtresi (çoklu)"),
    payment_methods: list[str] | None = Query(None, description="Ödeme yöntemi filtresi (çoklu)"),
    cities: list[str] | None = Query(None, description="Şehir filtresi (çoklu)"),
    devices: list[str] | None = Query(None, description="Cihaz filtresi (çoklu)"),
    orders_limit: int = Query(50, ge=1, le=200, description="Sipariş listesi sayfa boyutu"),
    _user: User = Depends(require_permission(Permission.ECOMMERCE_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[EcommerceResponse]:
    _validate_range(date_from, date_to)

    # Filtreler cache key'inin parçası; filtre değişince ayrı entry.
    filter_key: dict[str, Any] = {"cmp": comparison_mode}
    if categories:
        filter_key["cat"] = sorted(categories)
    if brands:
        filter_key["br"] = sorted(brands)
    if statuses:
        filter_key["st"] = sorted(statuses)
    if payment_methods:
        filter_key["pm"] = sorted(payment_methods)
    if cities:
        filter_key["ct"] = sorted(cities)
    if devices:
        filter_key["dv"] = sorted(devices)
    if orders_limit != 50:
        filter_key["lim"] = orders_limit

    key = cache_keys.kpi_dashboard(
        "ecom",
        date_from=date_from,
        date_to=date_to,
        extra_filters=filter_key,
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=EcommerceResponse.model_validate(hit))

    filters = ecom_service.EcomFilters(
        date_from=date_from,
        date_to=date_to,
        categories=tuple(categories or ()),
        brands=tuple(brands or ()),
        statuses=tuple(statuses or ()),
        payment_methods=tuple(payment_methods or ()),
        cities=tuple(cities or ()),
        devices=tuple(devices or ()),
    )
    prev_from, prev_to = kpi_service.compute_comparison_period(date_from, date_to, comparison_mode)
    prev_filters = filters.with_period(prev_from, prev_to)

    revenue = await ecom_service.kpi_revenue(db, filters, prev_filters)
    orders_kpi = await ecom_service.kpi_orders(db, filters, prev_filters)
    aov = await ecom_service.kpi_aov(db, filters, prev_filters)
    items = await ecom_service.kpi_items_sold(db, filters, prev_filters)
    refund = await ecom_service.kpi_refund_rate(db, filters, prev_filters)
    repeat = await ecom_service.kpi_repeat_purchase_rate(db, filters, prev_filters)
    rpu = await ecom_service.kpi_revenue_per_user(db, filters, prev_filters)

    daily = await ecom_service.daily_series(db, filters)
    by_channel = await ecom_service.by_channel(db, filters, limit=15)
    by_category = await ecom_service.by_category(db, filters, limit=20)
    by_device = await ecom_service.by_device(db, filters)
    by_city = await ecom_service.by_city(db, filters, limit=15)
    by_payment = await ecom_service.by_payment_method(db, filters)
    nvr = await ecom_service.new_vs_returning(db, filters)
    top_products = await ecom_service.top_products(db, filters, limit=20)
    top_customers = await ecom_service.top_customers(db, filters, limit=20)
    orders_list, orders_total = await ecom_service.list_orders(db, filters, limit=orders_limit)

    response = EcommerceResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        revenue=revenue,
        orders=orders_kpi,
        aov=aov,
        items_sold=items,
        refund_rate=refund,
        repeat_purchase_rate=repeat,
        revenue_per_user=rpu,
        daily_series=daily,
        by_channel=by_channel,
        by_category=by_category,
        by_device=by_device,
        by_city=by_city,
        by_payment_method=by_payment,
        new_vs_returning=nvr,
        top_products=top_products,
        top_customers=top_customers,
        orders_list=orders_list,
        orders_total=orders_total,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


@router.get(
    "/ecom/order-detail",
    response_model=SuccessEnvelope[OrderDetailResponse],
    summary="Sipariş detayını getir",
    description=(
        "Tek bir siparişin detayını döner (sipariş kalemleri ve özet bilgiler). "
        "E-ticaret sayfasındaki sipariş detay penceresi için kullanılır."
    ),
)
async def get_ecom_order_detail(
    order_pk_id: int = Query(..., ge=1, description="Sipariş kaydının PK değeri (orders.id)"),
    _user: User = Depends(require_permission(Permission.ECOMMERCE_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[OrderDetailResponse]:
    detail = await ecom_service.order_detail(db, order_pk_id=order_pk_id)
    return SuccessEnvelope(data=detail)


# ---------------------------------------------------------------------- #
# /dashboard/campaign
# ---------------------------------------------------------------------- #


@router.get(
    "/campaign",
    response_model=SuccessEnvelope[CampaignAnalysisResponse],
    summary="Kampanya analizi sayfası",
    description=(
        "Meta ve Google kampanyalarını birlikte analiz eder. Toplam harcama, "
        "toplam reklam geliri ve genel ROAS KPI'ları ile kampanya performans "
        "tablosunu döner. Platform parametresi ile tek platforma daraltılabilir."
    ),
)
async def get_campaign(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    platform: KPIPlatform | None = Query(
        None, description="Platform filtresi (meta veya google); boş ise her iki platform"
    ),
    _user: User = Depends(require_permission(Permission.CAMPAIGNS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[CampaignAnalysisResponse]:
    _validate_range(date_from, date_to)
    key = cache_keys.kpi_dashboard(
        "campaign",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode, "plat": platform.value if platform else "all"},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=CampaignAnalysisResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(date_from, date_to, comparison_mode)
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    # Platform filtresi seçildiyse total_spend / ad_revenue / ROAS de o platform'a
    # daraltılır; aksi halde meta + google toplamı.
    spend_platforms = [platform] if platform else None
    spend = await kpi_service.kpi_ad_spend(
        db, date_from=date_from, date_to=date_to, platforms=spend_platforms, **kw
    )
    roas_kpi = await kpi_service.kpi_roas(
        db, date_from=date_from, date_to=date_to, platforms=spend_platforms, **kw
    )
    revenue_platforms = [platform] if platform else [KPIPlatform.META, KPIPlatform.GOOGLE]
    cur_revenue = await agg_repo.sum_metric_daily(
        db,
        "ad_revenue",
        date_from=date_from,
        date_to=date_to,
        platforms=revenue_platforms,
    )
    p_revenue = await agg_repo.sum_metric_daily(
        db,
        "ad_revenue",
        date_from=prev_from,
        date_to=prev_to,
        platforms=revenue_platforms,
    )
    revenue_kpi = KPIResult(
        kpi_id="ad_revenue",
        label_tr="Reklam Geliri",
        value=cur_revenue.quantize(Decimal("0.01")),
        previous_value=p_revenue.quantize(Decimal("0.01")) if p_revenue else None,
        change_percentage=None,
        direction="flat",
        is_positive=True,
        unit="currency",
        trend_direction_positive="up",
    )

    campaigns = await kpi_service.campaign_performance(
        db,
        period_start=date_from,
        period_end=date_to,
        platform=platform,
        limit=100,
    )

    response = CampaignAnalysisResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        total_spend=spend,
        total_revenue=revenue_kpi,
        overall_roas=roas_kpi,
        campaigns=campaigns,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/campaign-detail
# ---------------------------------------------------------------------- #


@router.get(
    "/campaign-detail",
    response_model=SuccessEnvelope[CampaignDetailResponse],
    summary="Kampanya detayını getir",
    description=(
        "Tek bir kampanyanın detaylı verisini döner: reklam metrikleri, "
        "e-ticaret katkısı, en çok satan ürünler ve günlük trend. Kampanya "
        "`campaign_pk_id` veya `campaign_name` parametresi ile belirtilir; en "
        "az biri zorunludur."
    ),
)
async def get_campaign_detail(
    date_from: date = Query(...),
    date_to: date = Query(...),
    campaign_pk_id: int | None = Query(None, description="Kampanya kaydının PK değeri"),
    campaign_name: str | None = Query(None, description="Kampanya adı"),
    top_n: int = Query(10, ge=1, le=50, description="Listelenecek en iyi ürün sayısı"),
    _user: User = Depends(require_permission(Permission.CAMPAIGNS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[CampaignDetailResponse]:
    """`campaign_pk_id` veya `campaign_name` ile çağrılır."""
    if campaign_pk_id is None and campaign_name is None:
        raise ValidationError(
            "campaign_pk_id veya campaign_name gerekli",
            field="campaign_pk_id",
        )

    _validate_range(date_from, date_to)
    key = cache_keys.kpi_dashboard(
        "campaign-detail",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"id": campaign_pk_id, "name": campaign_name, "n": top_n},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=CampaignDetailResponse.model_validate(hit))

    result = await kpi_service.campaign_detail(
        db,
        campaign_pk_id=campaign_pk_id,
        campaign_name=campaign_name,
        date_from=date_from,
        date_to=date_to,
        top_n=top_n,
    )
    response = CampaignDetailResponse.from_dict(result)
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/funnel
# ---------------------------------------------------------------------- #


@router.get(
    "/funnel",
    response_model=SuccessEnvelope[FunnelResponse],
    summary="Dönüşüm hunisi sayfası",
    description=(
        "E-ticaret dönüşüm hunisini döner: Görüntüleme, Sepet, Ödeme ve Satın "
        "Alma adımları. Adım bazlı sayılar, toplam oturum, cihaz ve kanal "
        "kırılımları ile günlük terk (drop-off) serisini içerir."
    ),
)
async def get_funnel(
    date_from: date = Query(...),
    date_to: date = Query(...),
    _user: User = Depends(require_permission(Permission.FUNNEL_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[FunnelResponse]:
    _validate_range(date_from, date_to)
    key = cache_keys.kpi_dashboard("funnel", date_from=date_from, date_to=date_to)
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=FunnelResponse.model_validate(hit))

    steps = await kpi_service.funnel_steps(db, date_from=date_from, date_to=date_to)
    by_device = await kpi_service.funnel_by_device(db, date_from=date_from, date_to=date_to)
    by_channel = await kpi_service.funnel_by_channel(db, date_from=date_from, date_to=date_to)
    dropoff_series = await kpi_service.funnel_dropoff_daily(
        db, date_from=date_from, date_to=date_to
    )
    total_sessions = await kpi_service.total_ga4_sessions(db, date_from=date_from, date_to=date_to)
    response = FunnelResponse(
        date_range=_date_range_with_comparison(date_from, date_to, "sequential"),
        steps=steps,
        total_sessions=total_sessions,
        by_device=by_device,
        by_channel=by_channel,
        dropoff_series=dropoff_series,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/cohort
# ---------------------------------------------------------------------- #


@router.get(
    "/cohort",
    response_model=SuccessEnvelope[CohortResponse],
    summary="Kohort analizi sayfası",
    description=(
        "Müşteri elde tutma kohort analizini ısı haritası (heatmap) verisi "
        "olarak döner. Her hücre, bir başlangıç kohortunun sonraki dönemlerdeki "
        "geri dönüş oranını gösterir."
    ),
)
async def get_cohort(
    date_from: date = Query(...),
    date_to: date = Query(...),
    genders: list[str] | None = Query(None, description="Cinsiyet filtresi (çoklu)"),
    age_groups: list[str] | None = Query(None, description="Yaş grubu filtresi (çoklu)"),
    cities: list[str] | None = Query(None, description="Şehir filtresi (çoklu)"),
    _user: User = Depends(require_permission(Permission.COHORT_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[CohortResponse]:
    _validate_range(date_from, date_to)

    # Filtreler cache key'inin parçası; filtre değişince ayrı entry.
    filter_key: dict[str, Any] = {}
    if genders:
        filter_key["g"] = sorted(genders)
    if age_groups:
        filter_key["ag"] = sorted(age_groups)
    if cities:
        filter_key["ct"] = sorted(cities)

    key = cache_keys.kpi_dashboard(
        "cohort",
        date_from=date_from,
        date_to=date_to,
        extra_filters=filter_key or None,
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=CohortResponse.model_validate(hit))

    cells = await kpi_service.cohort_retention(
        db,
        date_from=date_from,
        date_to=date_to,
        genders=genders or None,
        age_groups=age_groups or None,
        cities=cities or None,
    )
    response = CohortResponse(
        date_range=_date_range_with_comparison(date_from, date_to, "sequential"),
        cells=[CohortCell(**c) for c in cells],
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/products
# ---------------------------------------------------------------------- #


@router.get(
    "/products",
    response_model=SuccessEnvelope[ProductsResponse],
    summary="Ürün performansı sayfası",
    description=(
        "Ürün performansı sayfasının verisini döner: satılan ürün KPI'ı, en çok "
        "satan ürünler tablosu ile kategori ve marka bazlı gelir dağılımları."
    ),
)
async def get_products(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    categories: list[str] | None = Query(None, description="Ürün kategorisi filtresi (çoklu)"),
    brands: list[str] | None = Query(None, description="Marka filtresi (çoklu)"),
    _user: User = Depends(require_permission(Permission.PRODUCTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ProductsResponse]:
    _validate_range(date_from, date_to)

    # Filtreler cache key'inin parçası; filtre değişince ayrı entry.
    filter_key: dict[str, Any] = {"cmp": comparison_mode}
    if categories:
        filter_key["cat"] = sorted(categories)
    if brands:
        filter_key["br"] = sorted(brands)

    key = cache_keys.kpi_dashboard(
        "products",
        date_from=date_from,
        date_to=date_to,
        extra_filters=filter_key,
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=ProductsResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(date_from, date_to, comparison_mode)
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    cat = categories or None
    br = brands or None

    items = await kpi_service.kpi_items_sold(db, date_from=date_from, date_to=date_to, **kw)
    top = await kpi_service.top_products(
        db, date_from=date_from, date_to=date_to, limit=20, categories=cat, brands=br
    )
    by_cat = await kpi_service.top_categories_brands(
        db,
        date_from=date_from,
        date_to=date_to,
        by="category",
        limit=15,
        categories=cat,
        brands=br,
    )
    by_brand = await kpi_service.top_categories_brands(
        db,
        date_from=date_from,
        date_to=date_to,
        by="brand",
        limit=15,
        categories=cat,
        brands=br,
    )

    response = ProductsResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        items_sold=items,
        top_products=top,
        by_category=[DimensionBreakdown(label=r["category"], value=r["revenue"]) for r in by_cat],
        by_brand=[DimensionBreakdown(label=r["brand"], value=r["revenue"]) for r in by_brand],
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/customers
# ---------------------------------------------------------------------- #


@router.get(
    "/customers",
    response_model=SuccessEnvelope[CustomersResponse],
    summary="Müşteri analizi sayfası",
    description=(
        "Müşteri analizi sayfasının verisini döner: müşteri KPI'ları ile "
        "cinsiyet, yaş, şehir ve satın alma frekansı dağılımları ve en değerli "
        "müşteri listesi. Yeni müşteri metrikleri seçili tarih aralığına göre, "
        "toplam ve dağılım metrikleri tüm aktif müşteri tabanına göre hesaplanır."
    ),
)
async def get_customers(
    date_from: date = Query(...),
    date_to: date = Query(...),
    genders: list[str] | None = Query(None, description="Cinsiyet filtresi (çoklu)"),
    age_groups: list[str] | None = Query(None, description="Yaş grubu filtresi (çoklu)"),
    cities: list[str] | None = Query(None, description="Şehir filtresi (çoklu)"),
    _user: User = Depends(require_permission(Permission.CUSTOMERS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[CustomersResponse]:
    """Müşteri overview sayfası.

    Yeni müşteri trendi ve "yeni müşteri" KPI'ı `date_from`/`date_to`
    aralığına göredir; toplam/dağılım gibi statik metrikler tüm aktif
    müşteri tabanını kapsar. Cinsiyet/yaş grubu/şehir filtreleri tüm müşteri
    KPI'larına ve dağılımlarına çapraz filtre olarak uygulanır.
    """
    _validate_range(date_from, date_to)

    # Filtreler cache key'inin parçası; filtre değişince ayrı entry.
    filter_key: dict[str, Any] = {}
    if genders:
        filter_key["g"] = sorted(genders)
    if age_groups:
        filter_key["ag"] = sorted(age_groups)
    if cities:
        filter_key["ct"] = sorted(cities)

    key = cache_keys.kpi_dashboard(
        "customers",
        date_from=date_from,
        date_to=date_to,
        extra_filters=filter_key or None,
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=CustomersResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(date_from, date_to, "sequential")

    payload = await customer_service.calculate_customer_overview(
        db,
        date_from=date_from,
        date_to=date_to,
        prev_from=prev_from,
        prev_to=prev_to,
        genders=genders or None,
        age_groups=age_groups or None,
        cities=cities or None,
    )

    response = CustomersResponse(
        date_range=_date_range_with_comparison(date_from, date_to, "sequential"),
        **payload,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/channel-analysis
# ---------------------------------------------------------------------- #


@router.get(
    "/channel-analysis",
    response_model=SuccessEnvelope[ChannelAnalysisResponse],
    summary="Kanal analizi sayfası",
    description=(
        "Pazarlama kanallarını karşılaştıran analiz sayfasının verisini döner: "
        "kanal KPI'ları ile ROAS ve dönüşüm karşılaştırmaları ve kanal "
        "performans tablosu. Kanal ve cihaz filtreleri kaynak veriye uygulanır; "
        "gelir, sipariş, ROAS ve dönüşüm aralığı filtreleri sonuç satırlarını "
        "süzer."
    ),
)
async def get_channel_analysis(
    date_from: date = Query(...),
    date_to: date = Query(...),
    channels: list[str] | None = Query(None),
    devices: list[str] | None = Query(None),
    revenue_min: float | None = Query(None),
    revenue_max: float | None = Query(None),
    orders_min: int | None = Query(None),
    orders_max: int | None = Query(None),
    roas_min: float | None = Query(None),
    roas_max: float | None = Query(None),
    conversion_min: float | None = Query(None),
    conversion_max: float | None = Query(None),
    _user: User = Depends(require_permission(Permission.CHANNEL_ANALYSIS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ChannelAnalysisResponse]:
    """Kanal performans sayfası (doc 6. bölüm "Kanal Analizi" karşılığı).

    `channels` / `devices` source data'ya pre-aggregation uygulanır.
    Range filtreler (revenue/orders/roas/conversion) sonuç satırlarını
    post-aggregation filtreler.
    """
    filter_payload = {
        "ch": channels or None,
        "dev": devices or None,
        "rev_min": revenue_min,
        "rev_max": revenue_max,
        "ord_min": orders_min,
        "ord_max": orders_max,
        "roas_min": roas_min,
        "roas_max": roas_max,
        "conv_min": conversion_min,
        "conv_max": conversion_max,
    }
    _validate_range(date_from, date_to)
    key = cache_keys.kpi_dashboard(
        "channel-analysis",
        date_from=date_from,
        date_to=date_to,
        extra_filters=filter_payload,
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=ChannelAnalysisResponse.model_validate(hit))

    payload = await channel_service.calculate_channel_overview(
        db,
        date_from=date_from,
        date_to=date_to,
        channels=channels or None,
        devices=devices or None,
        revenue_min=Decimal(str(revenue_min)) if revenue_min is not None else None,
        revenue_max=Decimal(str(revenue_max)) if revenue_max is not None else None,
        orders_min=orders_min,
        orders_max=orders_max,
        roas_min=Decimal(str(roas_min)) if roas_min is not None else None,
        roas_max=Decimal(str(roas_max)) if roas_max is not None else None,
        conversion_min=Decimal(str(conversion_min)) if conversion_min is not None else None,
        conversion_max=Decimal(str(conversion_max)) if conversion_max is not None else None,
    )
    response = ChannelAnalysisResponse(
        date_range=_date_range_with_comparison(date_from, date_to, "sequential"),
        **payload,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)
