"""`ga4_traffic.csv` parser config.

CSV başlıkları (camelCase, GA4 Data API stilinde):
    date, sessionSource, sessionMedium, sessionCampaignName,
    sessionDefaultChannelGroup, deviceCategory, city,
    landingPagePlusQueryString, newVsReturning,
    sessions, totalUsers, newUsers, bounceRate, averageSessionDuration,
    screenPageViewsPerSession, engagedSessions, engagementRate,
    userEngagementDuration, conversions, purchaseRevenue, transactions

Notlar:
- `date` GA4'te YYYYMMDD integer formatında geliyor → DATE'e çevir.
- `derived_channel` channel_mapping üzerinden post-processing ile doldurulacak;
  parser şu an NULL bırakır.
- Natural unique key yok — `dedup_keys` boş, aynı satır iki import'ta iki kez
  görünebilir (yeniden yükleme için import_id ile rollback yapılır).
"""

from __future__ import annotations

from app.parsers.types import ColumnSpec, SourceConfig

CONFIG = SourceConfig(
    name="ga4_traffic",
    target_table="ga4_traffic",
    columns=[
        ColumnSpec("date", "date", "date_yyyymmdd", required=True),
        ColumnSpec("session_source", "sessionSource", "str", required=True),
        ColumnSpec("session_medium", "sessionMedium", "str", required=True),
        ColumnSpec("session_campaign_name", "sessionCampaignName", "str", required=False),
        ColumnSpec(
            "session_default_channel_group",
            "sessionDefaultChannelGroup",
            "str",
            required=False,
        ),
        ColumnSpec(
            "device_category",
            "deviceCategory",
            "enum_str",
            required=True,
            allowed_values=frozenset({"mobile", "desktop", "tablet", "other"}),
        ),
        ColumnSpec("city", "city", "str", required=False),
        ColumnSpec(
            "landing_page_plus_query_string",
            "landingPagePlusQueryString",
            "str",
            required=False,
        ),
        ColumnSpec(
            "new_vs_returning",
            "newVsReturning",
            "enum_str",
            required=False,
            allowed_values=frozenset({"new", "returning"}),
        ),
        ColumnSpec("sessions", "sessions", "int", required=False, default=0),
        ColumnSpec("total_users", "totalUsers", "int", required=False, default=0),
        ColumnSpec("new_users", "newUsers", "int", required=False, default=0),
        ColumnSpec("bounce_rate", "bounceRate", "decimal", required=False, default=0),
        ColumnSpec(
            "average_session_duration",
            "averageSessionDuration",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec(
            "screen_page_views_per_session",
            "screenPageViewsPerSession",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec("engaged_sessions", "engagedSessions", "int", required=False, default=0),
        ColumnSpec("engagement_rate", "engagementRate", "decimal", required=False, default=0),
        ColumnSpec(
            "user_engagement_duration",
            "userEngagementDuration",
            "decimal",
            required=False,
            default=0,
        ),
        ColumnSpec("conversions", "conversions", "int", required=False, default=0),
        ColumnSpec("purchase_revenue", "purchaseRevenue", "decimal", required=False, default=0),
        ColumnSpec("transactions", "transactions", "int", required=False, default=0),
    ],
    dedup_keys=[],  # natural key yok
)
