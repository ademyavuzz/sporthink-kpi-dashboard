"""Campaign detail (drill-down) endpoint şeması."""

from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel


class CampaignAdMetrics(BaseModel):
    impressions: str
    clicks: str
    spend: str
    conversions: str
    conversions_value: str


class CampaignEcomSummary(BaseModel):
    orders: int
    revenue: str
    items_sold: int
    aov: str | None = None


class CampaignTopProduct(BaseModel):
    sku: str
    product_name: str | None = None
    brand: str | None = None
    category: str | None = None
    units_sold: int
    revenue: str
    orders: int


class CampaignDailyPoint(BaseModel):
    date: date
    revenue: str
    orders: int
    spend: str


class CampaignDetailResponse(BaseModel):
    """`/dashboard/campaign-detail` cevabı.

    Tek kampanya × tarih aralığı için:
    - ad_metrics: kpi_campaign_aggregates'tan (impressions/clicks/spend/conversions)
    - ecom_summary: orders.campaign_name attribution
    - top_products: order_items × products JOIN (top N)
    - daily_series: günlük revenue/spend
    """

    campaign_pk_id: int | None
    campaign_name: str | None
    platform: str | None
    date_from: date
    date_to: date
    ad_metrics: CampaignAdMetrics
    ecom_summary: CampaignEcomSummary
    top_products: list[CampaignTopProduct]
    daily_series: list[CampaignDailyPoint]

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> CampaignDetailResponse:
        return cls(
            campaign_pk_id=d["campaign_pk_id"],
            campaign_name=d["campaign_name"],
            platform=d["platform"],
            date_from=d["date_from"],
            date_to=d["date_to"],
            ad_metrics=CampaignAdMetrics(**d["ad_metrics"]),
            ecom_summary=CampaignEcomSummary(**d["ecom_summary"]),
            top_products=[CampaignTopProduct(**p) for p in d["top_products"]],
            daily_series=[CampaignDailyPoint(**p) for p in d["daily_series"]],
        )
