"""`google_ads.csv` parser config (target: `google_ads`).

CSV başlıkları (Google Ads Query Language stilinde noktalı):
    segments.date, customer.id, customer.descriptive_name,
    campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
    ad_group.id, ad_group.name, ad_group.status,
    segments.device, segments.ad_network_type,
    segments.product_item_id, segments.product_title, segments.product_brand,
    segments.product_type_l1, segments.product_type_l2,
    ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
    metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr,
    metrics.average_cpc, metrics.average_cpm,
    metrics.conversions, metrics.conversions_value,
    metrics.all_conversions, metrics.all_conversions_value,
    metrics.cost_per_conversion, metrics.conversions_from_interactions_rate,
    metrics.value_per_conversion,
    metrics.search_impression_share, metrics.search_budget_lost_impression_share,
    metrics.search_rank_lost_impression_share,
    metrics.view_through_conversions, metrics.interaction_rate

Notlar:
- **Micros dönüşümü:** `cost_micros`, `average_cpc`, `average_cpm`,
  `cost_per_conversion` Google Ads API'de 1/1.000.000 TRY birimi olarak
  döner; parser ÷1_000_000 yapar (DB DECIMAL kolon precision'ları zaten
  TRY birimine göre).
- ENUM kolonları CSV'de UPPERCASE — `enum_str` coercer otomatik lowercase.
- FK `campaign_pk_id` opsiyonel (campaign_name üzerinden lookup).
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.parsers.types import ColumnSpec, FKLookup, SourceConfig

_MICROS = Decimal(1_000_000)
_MICROS_FIELDS = ("cost", "average_cpc", "average_cpm", "cost_per_conversion")


def _post_coerce(row: dict[str, Any]) -> dict[str, Any]:
    for f in _MICROS_FIELDS:
        v = row.get(f)
        if isinstance(v, Decimal):
            row[f] = (v / _MICROS).quantize(Decimal("0.0001"))
    return row


CONFIG = SourceConfig(
    name="google_ads",
    target_table="google_ads",
    columns=[
        ColumnSpec("date", "segments.date", "date_iso", required=True),
        ColumnSpec("customer_id", "customer.id", "int", required=False),
        ColumnSpec(
            "customer_descriptive_name",
            "customer.descriptive_name",
            "str",
            required=False,
        ),
        ColumnSpec("campaign_id", "campaign.id", "int", required=True),
        ColumnSpec("campaign_name", "campaign.name", "str", required=False),
        ColumnSpec(
            "campaign_status",
            "campaign.status",
            "enum_str",
            required=False,
            allowed_values=frozenset({"enabled", "paused", "removed"}),
        ),
        ColumnSpec(
            "advertising_channel_type",
            "campaign.advertising_channel_type",
            "enum_str",
            required=False,
            allowed_values=frozenset(
                {"search", "shopping", "performance_max", "display", "video"}
            ),
        ),
        ColumnSpec("ad_group_id", "ad_group.id", "int", required=False),
        ColumnSpec("ad_group_name", "ad_group.name", "str", required=False),
        ColumnSpec(
            "ad_group_status",
            "ad_group.status",
            "enum_str",
            required=False,
            allowed_values=frozenset({"enabled", "paused", "removed"}),
        ),
        ColumnSpec(
            "device",
            "segments.device",
            "enum_str",
            required=False,
            allowed_values=frozenset({"mobile", "desktop", "tablet", "other"}),
        ),
        ColumnSpec("ad_network_type", "segments.ad_network_type", "str", required=False),
        ColumnSpec(
            "product_item_id", "segments.product_item_id", "str", required=False
        ),
        ColumnSpec("product_title", "segments.product_title", "str", required=False),
        ColumnSpec("product_brand", "segments.product_brand", "str", required=False),
        ColumnSpec(
            "product_type_l1", "segments.product_type_l1", "str", required=False
        ),
        ColumnSpec(
            "product_type_l2", "segments.product_type_l2", "str", required=False
        ),
        ColumnSpec(
            "keyword_text",
            "ad_group_criterion.keyword.text",
            "str",
            required=False,
        ),
        ColumnSpec(
            "keyword_match_type",
            "ad_group_criterion.keyword.match_type",
            "enum_str",
            required=False,
            allowed_values=frozenset({"exact", "phrase", "broad"}),
        ),
        ColumnSpec("impressions", "metrics.impressions", "int", required=False, default=0),
        ColumnSpec("clicks", "metrics.clicks", "int", required=False, default=0),
        # micros — post_coerce'ta ÷1_000_000
        ColumnSpec("cost", "metrics.cost_micros", "decimal", required=False, default=0),
        ColumnSpec("ctr", "metrics.ctr", "decimal", required=False, default=0),
        ColumnSpec(
            "average_cpc", "metrics.average_cpc", "decimal", required=False, default=0
        ),
        ColumnSpec(
            "average_cpm", "metrics.average_cpm", "decimal", required=False, default=0
        ),
        ColumnSpec(
            "conversions", "metrics.conversions", "decimal", required=False, default=0
        ),
        ColumnSpec(
            "conversions_value",
            "metrics.conversions_value",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "all_conversions",
            "metrics.all_conversions",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "all_conversions_value",
            "metrics.all_conversions_value",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "cost_per_conversion",
            "metrics.cost_per_conversion",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "conversions_from_interactions_rate",
            "metrics.conversions_from_interactions_rate",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "value_per_conversion",
            "metrics.value_per_conversion",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "search_impression_share",
            "metrics.search_impression_share",
            "decimal",
            required=False,
        ),
        ColumnSpec(
            "search_budget_lost_impression_share",
            "metrics.search_budget_lost_impression_share",
            "decimal",
            required=False,
        ),
        ColumnSpec(
            "search_rank_lost_impression_share",
            "metrics.search_rank_lost_impression_share",
            "decimal",
            required=False,
        ),
        ColumnSpec(
            "view_through_conversions",
            "metrics.view_through_conversions",
            "int",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "interaction_rate",
            "metrics.interaction_rate",
            "decimal",
            required=False,
            default=0,
        ),
    ],
    dedup_keys=[],
    fk_lookups=[
        FKLookup(
            pk_column="campaign_pk_id",
            external_id_column="campaign_name",
            lookup_table="campaigns",
            lookup_column="campaign_name",
            required=False,
        ),
    ],
    post_coerce=_post_coerce,
)
