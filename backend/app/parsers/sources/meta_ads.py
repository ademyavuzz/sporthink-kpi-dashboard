"""`meta_ads.csv` parser config (target: `meta_ads`).

CSV başlıkları (Meta Marketing API insights stilinde):
    date_start, date_stop, account_id, account_name,
    campaign_id, campaign_name, adset_id, adset_name, ad_id, ad_name,
    objective, buying_type,
    impressions, reach, frequency, clicks, inline_link_clicks, spend,
    cpc, cpm, cpp, ctr, inline_link_click_ctr,
    actions:link_click, actions:landing_page_view,
    actions:offsite_conversion.fb_pixel_view_content,
    actions:offsite_conversion.fb_pixel_add_to_cart,
    actions:offsite_conversion.fb_pixel_initiate_checkout,
    actions:offsite_conversion.fb_pixel_purchase,
    action_values:offsite_conversion.fb_pixel_purchase,
    actions:page_engagement, actions:post_engagement, actions:video_view

Notlar:
- CSV'deki `:` ve `.` içeren `actions:*` kolonları DB'de snake_case'e flatten.
- `campaign_id` Meta numerik id; campaigns tablosundaki master kayıtlar
  `campaign_name` üzerinden lookup edilir (campaigns.csv'de Meta id yok).
- FK opsiyonel: campaign master eksik olabilir, yine de satır yazılır.
- Natural unique key yok; dedup boş.
"""
from __future__ import annotations

from app.parsers.types import ColumnSpec, FKLookup, SourceConfig

CONFIG = SourceConfig(
    name="meta_ads",
    target_table="meta_ads",
    columns=[
        ColumnSpec("date_start", "date_start", "date_iso", required=True),
        ColumnSpec("date_stop", "date_stop", "date_iso", required=True),
        ColumnSpec("account_id", "account_id", "str", required=False),
        ColumnSpec("account_name", "account_name", "str", required=False),
        ColumnSpec("campaign_id", "campaign_id", "str", required=True),
        ColumnSpec("campaign_name", "campaign_name", "str", required=False),
        ColumnSpec("adset_id", "adset_id", "str", required=False),
        ColumnSpec("adset_name", "adset_name", "str", required=False),
        ColumnSpec("ad_id", "ad_id", "str", required=False),
        ColumnSpec("ad_name", "ad_name", "str", required=False),
        ColumnSpec("objective", "objective", "str", required=False),
        ColumnSpec("buying_type", "buying_type", "str", required=False),
        ColumnSpec("impressions", "impressions", "int", required=False, default=0),
        ColumnSpec("reach", "reach", "int", required=False, default=0),
        ColumnSpec("frequency", "frequency", "decimal", required=False, default=0),
        ColumnSpec("clicks", "clicks", "int", required=False, default=0),
        ColumnSpec(
            "inline_link_clicks", "inline_link_clicks", "int", required=False, default=0
        ),
        ColumnSpec("spend", "spend", "decimal", required=False, default=0),
        ColumnSpec("cpc", "cpc", "decimal", required=False, default=0),
        ColumnSpec("cpm", "cpm", "decimal", required=False, default=0),
        ColumnSpec("cpp", "cpp", "decimal", required=False, default=0),
        ColumnSpec("ctr", "ctr", "decimal", required=False, default=0),
        ColumnSpec(
            "inline_link_click_ctr",
            "inline_link_click_ctr",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "actions_link_click", "actions:link_click", "int", required=False, default=0
        ),
        ColumnSpec(
            "actions_landing_page_view",
            "actions:landing_page_view",
            "int",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "actions_view_content",
            "actions:offsite_conversion.fb_pixel_view_content",
            "int",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "actions_add_to_cart",
            "actions:offsite_conversion.fb_pixel_add_to_cart",
            "int",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "actions_initiate_checkout",
            "actions:offsite_conversion.fb_pixel_initiate_checkout",
            "int",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "actions_purchase",
            "actions:offsite_conversion.fb_pixel_purchase",
            "int",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "action_values_purchase",
            "action_values:offsite_conversion.fb_pixel_purchase",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "actions_page_engagement",
            "actions:page_engagement",
            "int",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "actions_post_engagement",
            "actions:post_engagement",
            "int",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "actions_video_view", "actions:video_view", "int", required=False, default=0
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
)
