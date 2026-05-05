"""Source config registry — `ImportDataType` → `SourceConfig`."""

from __future__ import annotations

from app.models import ImportDataType
from app.parsers.sources import (
    campaigns,
    customers,
    ga4_item_engagement,
    ga4_traffic,
    google_ads,
    meta_ads,
    meta_ads_breakdowns,
    order_items,
    orders,
    products,
)
from app.parsers.types import SourceConfig

REGISTRY: dict[ImportDataType, SourceConfig] = {
    ImportDataType.PRODUCTS: products.CONFIG,
    ImportDataType.CUSTOMERS: customers.CONFIG,
    ImportDataType.ORDERS: orders.CONFIG,
    ImportDataType.ORDER_ITEMS: order_items.CONFIG,
    ImportDataType.CAMPAIGNS: campaigns.CONFIG,
    ImportDataType.GA4_TRAFFIC: ga4_traffic.CONFIG,
    ImportDataType.GA4_ITEMS: ga4_item_engagement.CONFIG,
    ImportDataType.META_ADS: meta_ads.CONFIG,
    ImportDataType.META_BREAKDOWNS: meta_ads_breakdowns.CONFIG,
    ImportDataType.GOOGLE_ADS: google_ads.CONFIG,
}


def get_config(data_type: ImportDataType) -> SourceConfig | None:
    return REGISTRY.get(data_type)
