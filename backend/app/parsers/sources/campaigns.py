"""`campaigns.csv` parser config.

CSV başlıkları:
    campaign_name, platform, campaign_type, objective, start_date, end_date,
    daily_budget, total_budget, target_audience, status

Notlar:
- `external_campaign_id` DB'de NULLABLE — CSV'de yok, NULL bırakılır.
  Canlı API entegrasyonunda gerçek Meta/Google id'si bir backfill task'ı
  ile doldurulur.
- Dedup: aynı `(platform, campaign_name)` çifti tekrar gelirse skip
  (NULL external_id'ler UNIQUE constraint'i tetiklemez).
"""

from __future__ import annotations

from app.parsers.types import ColumnSpec, SourceConfig

CONFIG = SourceConfig(
    name="campaigns",
    target_table="campaigns",
    columns=[
        ColumnSpec("campaign_name", "campaign_name", "str", required=True),
        ColumnSpec(
            "platform",
            "platform",
            "enum_str",
            required=True,
            allowed_values=frozenset({"meta", "google"}),
        ),
        ColumnSpec("campaign_type", "campaign_type", "str", required=False),
        ColumnSpec("objective", "objective", "str", required=False),
        ColumnSpec("start_date", "start_date", "date_iso", required=False),
        ColumnSpec("end_date", "end_date", "date_iso", required=False),
        ColumnSpec("daily_budget", "daily_budget", "decimal", required=False),
        ColumnSpec("total_budget", "total_budget", "decimal", required=False),
        ColumnSpec("target_audience", "target_audience", "str", required=False),
        ColumnSpec(
            "status",
            "status",
            "enum_str",
            required=True,
            allowed_values=frozenset({"active", "paused", "completed"}),
        ),
    ],
    dedup_keys=["platform", "campaign_name"],
)
