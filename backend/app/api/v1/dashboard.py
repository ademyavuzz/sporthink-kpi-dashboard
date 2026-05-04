"""Dashboard endpoint'leri — 9 sayfa için tek noktada KPI + chart + tablo.

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
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import cache_keys
from app.core.permissions import Permission
from app.dependencies import get_db, require_permission
from app.models import KPIPlatform, User
from app.schemas import (
    CampaignAnalysisResponse,
    CampaignDetailResponse,
    CohortCell,
    CohortResponse,
    DimensionBreakdown,
    EcommerceResponse,
    FunnelResponse,
    GoogleAdsResponse,
    MetaAdsResponse,
    OverviewResponse,
    ProductsResponse,
    SuccessEnvelope,
    TrafficResponse,
)
from app.schemas.kpi import DateRange, KPIResult
from app.services import kpi_service
from app.services.cache_service import cache

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


ComparisonMode = Literal["sequential", "yoy"]


def _date_range_with_comparison(
    date_from: date, date_to: date, comparison_mode: ComparisonMode
) -> DateRange:
    prev_from, prev_to = kpi_service.compute_comparison_period(
        date_from, date_to, comparison_mode
    )
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
    summary="Genel Özet — 9 KPI + 5 chart bloğu",
)
async def get_overview(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.DASHBOARD_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[OverviewResponse]:
    key = cache_keys.kpi_summary(
        date_from=date_from, date_to=date_to, comparison_mode=comparison_mode
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=OverviewResponse.model_validate(hit))

    summary = await kpi_service.calculate_summary(
        db, date_from=date_from, date_to=date_to, comparison_mode=comparison_mode
    )
    channels = await kpi_service.revenue_by_channel(
        db, date_from=date_from, date_to=date_to, limit=10
    )
    daily = await kpi_service.daily_revenue_series(
        db, date_from=date_from, date_to=date_to
    )
    nvr = await kpi_service.new_vs_returning_revenue(
        db, date_from=date_from, date_to=date_to
    )
    funnel = await kpi_service.funnel_steps(db, date_from=date_from, date_to=date_to)
    top_products = await kpi_service.top_products(
        db, date_from=date_from, date_to=date_to, limit=10
    )

    response = OverviewResponse(
        summary=summary,
        channels=channels,
        daily_series=daily,
        new_vs_returning=nvr,
        funnel=funnel,
        top_products=top_products,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/traffic
# ---------------------------------------------------------------------- #


@router.get(
    "/traffic",
    response_model=SuccessEnvelope[TrafficResponse],
    summary="GA4 trafik sayfası",
)
async def get_traffic(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.TRAFFIC_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[TrafficResponse]:
    key = cache_keys.kpi_dashboard(
        "traffic",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=TrafficResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(
        date_from, date_to, comparison_mode
    )
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    sessions = await kpi_service.kpi_sessions(db, date_from=date_from, date_to=date_to, **kw)
    users = await kpi_service.kpi_users(db, date_from=date_from, date_to=date_to, **kw)
    new_users = await kpi_service.kpi_new_users(
        db, date_from=date_from, date_to=date_to, **kw
    )
    bounce = await kpi_service.kpi_bounce_rate(
        db, date_from=date_from, date_to=date_to, **kw
    )
    pps = await kpi_service.kpi_pages_per_session(
        db, date_from=date_from, date_to=date_to, **kw
    )
    asd = await kpi_service.kpi_avg_session_duration(
        db, date_from=date_from, date_to=date_to, **kw
    )
    cvr = await kpi_service.kpi_conversion_rate(
        db, date_from=date_from, date_to=date_to, **kw
    )
    daily = await kpi_service.daily_revenue_series(
        db, date_from=date_from, date_to=date_to
    )

    by_channel_rows = await kpi_service.by_dimension_revenue(
        db, "channel", date_from=date_from, date_to=date_to, limit=20
    )
    by_device_rows = await kpi_service.by_dimension_revenue(
        db, "device", date_from=date_from, date_to=date_to, limit=10
    )
    cities = await kpi_service.ga4_traffic_by_city(
        db, date_from=date_from, date_to=date_to, limit=15
    )

    response = TrafficResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        sessions=sessions,
        users=users,
        new_users=new_users,
        bounce_rate=bounce,
        pages_per_session=pps,
        avg_session_duration=asd,
        conversion_rate=cvr,
        daily_series=daily,
        by_channel=[
            DimensionBreakdown(label=r["channel"], value=r["sessions"])
            for r in by_channel_rows
        ],
        by_device=[
            DimensionBreakdown(label=r["device"], value=r["sessions"])
            for r in by_device_rows
        ],
        by_city=[
            DimensionBreakdown(label=r["city"], value=r["sessions"]) for r in cities
        ],
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
)
async def get_meta(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.META_ADS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[MetaAdsResponse]:
    key = cache_keys.kpi_dashboard(
        "meta",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=MetaAdsResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(
        date_from, date_to, comparison_mode
    )
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    spend = await kpi_service.kpi_ad_spend(db, date_from=date_from, date_to=date_to, **kw)
    impr = await kpi_service.kpi_impressions(db, date_from=date_from, date_to=date_to, **kw)
    clicks = await kpi_service.kpi_clicks(db, date_from=date_from, date_to=date_to, **kw)
    ctr = await kpi_service.kpi_ctr(db, date_from=date_from, date_to=date_to, **kw)
    cpc = await kpi_service.kpi_cpc(db, date_from=date_from, date_to=date_to, **kw)
    conv = await kpi_service.kpi_ad_conversions(
        db, date_from=date_from, date_to=date_to, **kw
    )
    roas = await kpi_service.kpi_roas(db, date_from=date_from, date_to=date_to, **kw)
    freq = await kpi_service.kpi_frequency(
        db, date_from=date_from, date_to=date_to, **kw
    )
    campaigns = await kpi_service.campaign_performance(
        db,
        period_start=date_from,
        period_end=date_to,
        platform=KPIPlatform.META,
        limit=50,
    )
    daily = await kpi_service.daily_revenue_series(
        db, date_from=date_from, date_to=date_to
    )

    response = MetaAdsResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        ad_spend=spend,
        impressions=impr,
        clicks=clicks,
        ctr=ctr,
        cpc=cpc,
        ad_conversions=conv,
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
)
async def get_google(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.GOOGLE_ADS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[GoogleAdsResponse]:
    key = cache_keys.kpi_dashboard(
        "google",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=GoogleAdsResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(
        date_from, date_to, comparison_mode
    )
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    spend = await kpi_service.kpi_ad_spend(db, date_from=date_from, date_to=date_to, **kw)
    impr = await kpi_service.kpi_impressions(db, date_from=date_from, date_to=date_to, **kw)
    clicks = await kpi_service.kpi_clicks(db, date_from=date_from, date_to=date_to, **kw)
    ctr = await kpi_service.kpi_ctr(db, date_from=date_from, date_to=date_to, **kw)
    cpc = await kpi_service.kpi_cpc(db, date_from=date_from, date_to=date_to, **kw)
    conv = await kpi_service.kpi_ad_conversions(
        db, date_from=date_from, date_to=date_to, **kw
    )
    cpa = await kpi_service.kpi_cost_per_conversion(
        db, date_from=date_from, date_to=date_to, **kw
    )
    roas = await kpi_service.kpi_roas(db, date_from=date_from, date_to=date_to, **kw)
    campaigns = await kpi_service.campaign_performance(
        db,
        period_start=date_from,
        period_end=date_to,
        platform=KPIPlatform.GOOGLE,
        limit=50,
    )
    daily = await kpi_service.daily_revenue_series(
        db, date_from=date_from, date_to=date_to
    )

    response = GoogleAdsResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        ad_spend=spend,
        impressions=impr,
        clicks=clicks,
        ctr=ctr,
        cpc=cpc,
        ad_conversions=conv,
        cost_per_conversion=cpa,
        roas=roas,
        campaigns=campaigns,
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
    summary="E-Ticaret sayfası",
)
async def get_ecom(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.ECOMMERCE_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[EcommerceResponse]:
    key = cache_keys.kpi_dashboard(
        "ecom",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=EcommerceResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(
        date_from, date_to, comparison_mode
    )
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    revenue = await kpi_service.kpi_revenue(
        db, date_from=date_from, date_to=date_to, **kw
    )
    orders = await kpi_service.kpi_orders(db, date_from=date_from, date_to=date_to, **kw)
    aov = await kpi_service.kpi_aov(db, date_from=date_from, date_to=date_to, **kw)
    items = await kpi_service.kpi_items_sold(
        db, date_from=date_from, date_to=date_to, **kw
    )
    refund = await kpi_service.kpi_refund_rate(
        db, date_from=date_from, date_to=date_to, **kw
    )
    repeat = await kpi_service.kpi_repeat_purchase_rate(
        db, date_from=date_from, date_to=date_to, **kw
    )
    rpu = await kpi_service.kpi_revenue_per_user(
        db, date_from=date_from, date_to=date_to, **kw
    )
    daily = await kpi_service.daily_revenue_series(
        db, date_from=date_from, date_to=date_to
    )
    by_channel = await kpi_service.revenue_by_channel(
        db, date_from=date_from, date_to=date_to, limit=15
    )
    nvr = await kpi_service.new_vs_returning_revenue(
        db, date_from=date_from, date_to=date_to
    )
    top = await kpi_service.top_customers(
        db, date_from=date_from, date_to=date_to, limit=20
    )

    response = EcommerceResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        revenue=revenue,
        orders=orders,
        aov=aov,
        items_sold=items,
        refund_rate=refund,
        repeat_purchase_rate=repeat,
        revenue_per_user=rpu,
        daily_series=daily,
        by_channel=by_channel,
        new_vs_returning=nvr,
        top_customers=top,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/campaign
# ---------------------------------------------------------------------- #


@router.get(
    "/campaign",
    response_model=SuccessEnvelope[CampaignAnalysisResponse],
    summary="Kampanya analizi (Meta + Google)",
)
async def get_campaign(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.CAMPAIGNS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[CampaignAnalysisResponse]:
    key = cache_keys.kpi_dashboard(
        "campaign",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=CampaignAnalysisResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(
        date_from, date_to, comparison_mode
    )
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    spend = await kpi_service.kpi_ad_spend(db, date_from=date_from, date_to=date_to, **kw)
    roas_kpi = await kpi_service.kpi_roas(
        db, date_from=date_from, date_to=date_to, **kw
    )
    # ad_revenue toplamı için KPIResult lazım; Revenue gibi gösteriyoruz.
    from app.repositories import kpi_aggregate_repository as agg_repo

    cur_revenue = await agg_repo.sum_metric_daily(
        db,
        "ad_revenue",
        date_from=date_from,
        date_to=date_to,
        platforms=[KPIPlatform.META, KPIPlatform.GOOGLE],
    )
    p_revenue = await agg_repo.sum_metric_daily(
        db,
        "ad_revenue",
        date_from=prev_from,
        date_to=prev_to,
        platforms=[KPIPlatform.META, KPIPlatform.GOOGLE],
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
        db, period_start=date_from, period_end=date_to, limit=100
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
    summary="Tek kampanya detayı — ad + e-ticaret + top ürünler + günlük trend",
)
async def get_campaign_detail(
    date_from: date = Query(...),
    date_to: date = Query(...),
    campaign_pk_id: int | None = Query(None),
    campaign_name: str | None = Query(None),
    top_n: int = Query(10, ge=1, le=50),
    _user: User = Depends(require_permission(Permission.CAMPAIGNS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[CampaignDetailResponse]:
    """`campaign_pk_id` veya `campaign_name` ile çağrılır."""
    if campaign_pk_id is None and campaign_name is None:
        from app.core.exceptions import ValidationError

        raise ValidationError(
            "campaign_pk_id veya campaign_name gerekli",
            field="campaign_pk_id",
        )

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
    summary="E-ticaret funnel (View → Cart → Checkout → Purchase)",
)
async def get_funnel(
    date_from: date = Query(...),
    date_to: date = Query(...),
    _user: User = Depends(require_permission(Permission.FUNNEL_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[FunnelResponse]:
    key = cache_keys.kpi_dashboard(
        "funnel", date_from=date_from, date_to=date_to
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=FunnelResponse.model_validate(hit))

    steps = await kpi_service.funnel_steps(db, date_from=date_from, date_to=date_to)
    response = FunnelResponse(
        date_range=_date_range_with_comparison(date_from, date_to, "sequential"),
        steps=steps,
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)


# ---------------------------------------------------------------------- #
# /dashboard/cohort
# ---------------------------------------------------------------------- #


@router.get(
    "/cohort",
    response_model=SuccessEnvelope[CohortResponse],
    summary="Cohort retention heatmap",
)
async def get_cohort(
    date_from: date = Query(...),
    date_to: date = Query(...),
    _user: User = Depends(require_permission(Permission.COHORT_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[CohortResponse]:
    key = cache_keys.kpi_dashboard(
        "cohort", date_from=date_from, date_to=date_to
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=CohortResponse.model_validate(hit))

    cells = await kpi_service.cohort_retention(
        db, date_from=date_from, date_to=date_to
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
    summary="Ürün performans sayfası",
)
async def get_products(
    date_from: date = Query(...),
    date_to: date = Query(...),
    comparison_mode: ComparisonMode = Query("sequential"),
    _user: User = Depends(require_permission(Permission.PRODUCTS_VIEW)),
    db: AsyncSession = Depends(get_db),
) -> SuccessEnvelope[ProductsResponse]:
    key = cache_keys.kpi_dashboard(
        "products",
        date_from=date_from,
        date_to=date_to,
        extra_filters={"cmp": comparison_mode},
    )
    hit = await cache.get_json(key)
    if hit is not None:
        return SuccessEnvelope(data=ProductsResponse.model_validate(hit))

    prev_from, prev_to = kpi_service.compute_comparison_period(
        date_from, date_to, comparison_mode
    )
    kw = {"prev_from": prev_from, "prev_to": prev_to}

    items = await kpi_service.kpi_items_sold(
        db, date_from=date_from, date_to=date_to, **kw
    )
    top = await kpi_service.top_products(
        db, date_from=date_from, date_to=date_to, limit=20
    )
    by_cat = await kpi_service.top_categories_brands(
        db, date_from=date_from, date_to=date_to, by="category", limit=15
    )
    by_brand = await kpi_service.top_categories_brands(
        db, date_from=date_from, date_to=date_to, by="brand", limit=15
    )

    response = ProductsResponse(
        date_range=_date_range_with_comparison(date_from, date_to, comparison_mode),
        items_sold=items,
        top_products=top,
        by_category=[
            DimensionBreakdown(label=r["category"], value=r["revenue"]) for r in by_cat
        ],
        by_brand=[
            DimensionBreakdown(label=r["brand"], value=r["revenue"]) for r in by_brand
        ],
    )
    await cache.set_json(key, response.model_dump(mode="json"), ttl=cache_keys.TTL_KPI)
    return SuccessEnvelope(data=response)
