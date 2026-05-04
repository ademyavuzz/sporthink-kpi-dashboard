"""`meta_ads_breakdowns.csv` parser config (target: `meta_ads_breakdowns`).

CSV başlıkları:
    date_start, date_stop, campaign_name, adset_name, ad_name,
    publisher_platform, platform_position, impression_device,
    impressions, clicks, spend

Notlar:
- DB'de `campaign_id` NULLABLE — CSV'de Meta numerik id yok; canlı API
  entegrasyonunda dolacak. Master kampanya bağlantısı `campaign_pk_id`
  FK üzerinden (campaign_name ile lookup).
- `campaign_name` model'de yok; FK lookup için tutulup `import_service`
  bulk_insert öncesinde model kolon filtresiyle düşer.
- Natural unique key yok; dedup boş.
"""
from __future__ import annotations

from app.parsers.types import ColumnSpec, FKLookup, SourceConfig

CONFIG = SourceConfig(
    name="meta_breakdowns",
    target_table="meta_ads_breakdowns",
    columns=[
        ColumnSpec("date_start", "date_start", "date_iso", required=True),
        ColumnSpec("date_stop", "date_stop", "date_iso", required=False),
        ColumnSpec("campaign_name", "campaign_name", "str", required=True),
        ColumnSpec("adset_name", "adset_name", "str", required=False),
        ColumnSpec("ad_name", "ad_name", "str", required=False),
        ColumnSpec(
            "publisher_platform", "publisher_platform", "str", required=False
        ),
        ColumnSpec("platform_position", "platform_position", "str", required=False),
        ColumnSpec("impression_device", "impression_device", "str", required=False),
        ColumnSpec("impressions", "impressions", "int", required=False, default=0),
        ColumnSpec("clicks", "clicks", "int", required=False, default=0),
        ColumnSpec("spend", "spend", "decimal", required=False, default=0),
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
