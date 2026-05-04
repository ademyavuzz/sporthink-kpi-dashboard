"""Aggregation rebuild — raw tablolardan KPI aggregation tablolarına UPSERT.

Pipeline (`docs/overview/09` §9.2.1):
- Raw tablolar (`ga4_traffic`, `meta_ads`, `google_ads`, `orders`) →
  `kpi_daily_aggregates` (date × channel × platform × device)
- `kpi_daily_aggregates` → `kpi_monthly_aggregates`
- `meta_ads` + `google_ads` + `campaigns` → `kpi_campaign_aggregates`

UPSERT pattern: MySQL `INSERT ... ON DUPLICATE KEY UPDATE` ile UNIQUE
(date,channel,platform,device) çakışmalarında metric'ler güncellenir
(idempotent — task birden fazla kez çağrılırsa duplikat üretmez).

Channel haritası:
- GA4'te `session_default_channel_group` doğrudan kullanılır
  (Organic Search, Paid Search, Paid Social, Direct, Email, Referral, ...)
- Meta Ads → 'Paid Social' (sabit; ileri sürümde campaign objective bazlı)
- Google Ads → 'Paid Search' (sabit; SEARCH/SHOPPING/PMAX ayrımı sonradan)
- Orders → `orders.channel` (zaten doğru kanal grubu)
"""
from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# Daily UPSERT — GA4 trafik
_GA4_DAILY_UPSERT = text(
    """
    INSERT INTO kpi_daily_aggregates
        (date, channel, platform, device,
         sessions, users, new_users, bounce_sessions,
         total_session_duration, total_page_views, last_calculated_at)
    SELECT
        date,
        COALESCE(session_default_channel_group, 'Other') AS channel,
        'ga4' AS platform,
        device_category AS device,
        SUM(sessions),
        SUM(total_users),
        SUM(new_users),
        ROUND(SUM(sessions * bounce_rate)),
        SUM(user_engagement_duration),
        ROUND(SUM(sessions * screen_page_views_per_session)),
        NOW()
    FROM ga4_traffic
    WHERE date BETWEEN :date_from AND :date_to
    GROUP BY date, channel, device_category
    ON DUPLICATE KEY UPDATE
        sessions = VALUES(sessions),
        users = VALUES(users),
        new_users = VALUES(new_users),
        bounce_sessions = VALUES(bounce_sessions),
        total_session_duration = VALUES(total_session_duration),
        total_page_views = VALUES(total_page_views),
        last_calculated_at = NOW();
    """
)


# Daily UPSERT — Meta Ads
# Meta Ads tablosunda device kolonu yok (breakdowns'ta var); NULL bırak.
_META_DAILY_UPSERT = text(
    """
    INSERT INTO kpi_daily_aggregates
        (date, channel, platform, device,
         impressions, clicks, spend, ad_conversions, ad_revenue,
         last_calculated_at)
    SELECT
        date_start AS date,
        'Paid Social' AS channel,
        'meta' AS platform,
        NULL AS device,
        SUM(impressions),
        SUM(clicks),
        SUM(spend),
        SUM(actions_purchase),
        SUM(action_values_purchase),
        NOW()
    FROM meta_ads
    WHERE date_start BETWEEN :date_from AND :date_to
    GROUP BY date_start
    ON DUPLICATE KEY UPDATE
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        spend = VALUES(spend),
        ad_conversions = VALUES(ad_conversions),
        ad_revenue = VALUES(ad_revenue),
        last_calculated_at = NOW();
    """
)


# Daily UPSERT — Google Ads
_GOOGLE_DAILY_UPSERT = text(
    """
    INSERT INTO kpi_daily_aggregates
        (date, channel, platform, device,
         impressions, clicks, spend, ad_conversions, ad_revenue,
         last_calculated_at)
    SELECT
        date,
        'Paid Search' AS channel,
        'google' AS platform,
        device,
        SUM(impressions),
        SUM(clicks),
        SUM(cost),
        SUM(conversions),
        SUM(conversions_value),
        NOW()
    FROM google_ads
    WHERE date BETWEEN :date_from AND :date_to
    GROUP BY date, device
    ON DUPLICATE KEY UPDATE
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        spend = VALUES(spend),
        ad_conversions = VALUES(ad_conversions),
        ad_revenue = VALUES(ad_revenue),
        last_calculated_at = NOW();
    """
)


# Daily UPSERT — Orders (e-ticaret)
_ORDERS_DAILY_UPSERT = text(
    """
    INSERT INTO kpi_daily_aggregates
        (date, channel, platform, device,
         orders, revenue, items_sold, discount_total, refund_total,
         last_calculated_at)
    SELECT
        DATE(order_date) AS date,
        COALESCE(channel, 'Direct') AS channel,
        'ecommerce' AS platform,
        device,
        COUNT(*),
        SUM(net_revenue),
        SUM(product_count),
        SUM(discount_amount),
        SUM(refund_amount),
        NOW()
    FROM orders
    WHERE DATE(order_date) BETWEEN :date_from AND :date_to
    GROUP BY DATE(order_date), channel, device
    ON DUPLICATE KEY UPDATE
        orders = VALUES(orders),
        revenue = VALUES(revenue),
        items_sold = VALUES(items_sold),
        discount_total = VALUES(discount_total),
        refund_total = VALUES(refund_total),
        last_calculated_at = NOW();
    """
)


# Monthly UPSERT — daily aggregate'lerden ay bazında topla
_MONTHLY_UPSERT = text(
    """
    INSERT INTO kpi_monthly_aggregates
        (period_month, channel, platform, device,
         sessions, users, new_users, bounce_sessions,
         impressions, clicks, spend, ad_conversions, ad_revenue,
         orders, revenue, items_sold, discount_total, refund_total,
         last_calculated_at)
    SELECT
        DATE_FORMAT(date, '%Y-%m-01') AS period_month,
        channel, platform, device,
        SUM(sessions), SUM(users), SUM(new_users), SUM(bounce_sessions),
        SUM(impressions), SUM(clicks), SUM(spend), SUM(ad_conversions), SUM(ad_revenue),
        SUM(orders), SUM(revenue), SUM(items_sold), SUM(discount_total), SUM(refund_total),
        NOW()
    FROM kpi_daily_aggregates
    WHERE date BETWEEN :date_from AND :date_to
    GROUP BY period_month, channel, platform, device
    ON DUPLICATE KEY UPDATE
        sessions = VALUES(sessions),
        users = VALUES(users),
        new_users = VALUES(new_users),
        bounce_sessions = VALUES(bounce_sessions),
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        spend = VALUES(spend),
        ad_conversions = VALUES(ad_conversions),
        ad_revenue = VALUES(ad_revenue),
        orders = VALUES(orders),
        revenue = VALUES(revenue),
        items_sold = VALUES(items_sold),
        discount_total = VALUES(discount_total),
        refund_total = VALUES(refund_total),
        last_calculated_at = NOW();
    """
)


# Campaign UPSERT — Meta + Google union, campaign × period
# `campaign_external_id` `campaigns.external_campaign_id` NULL olabilir,
# fallback olarak campaign_name kullanırız (UNIQUE constraint NOT NULL ister).
_CAMPAIGN_UPSERT = text(
    """
    INSERT INTO kpi_campaign_aggregates
        (campaign_pk_id, campaign_external_id, campaign_name, platform,
         period_start, period_end,
         impressions, clicks, spend, conversions, conversions_value,
         last_calculated_at)
    SELECT
        c.id AS campaign_pk_id,
        COALESCE(c.external_campaign_id, c.campaign_name) AS campaign_external_id,
        c.campaign_name,
        c.platform,
        :period_start AS period_start,
        :period_end AS period_end,
        agg.impressions,
        agg.clicks,
        agg.spend,
        agg.conversions,
        agg.conversions_value,
        NOW()
    FROM campaigns c
    JOIN (
        SELECT
            campaign_pk_id,
            SUM(impressions) AS impressions,
            SUM(clicks) AS clicks,
            SUM(spend) AS spend,
            SUM(actions_purchase) AS conversions,
            SUM(action_values_purchase) AS conversions_value
        FROM meta_ads
        WHERE date_start BETWEEN :period_start AND :period_end
          AND campaign_pk_id IS NOT NULL
        GROUP BY campaign_pk_id
        UNION ALL
        SELECT
            campaign_pk_id,
            SUM(impressions),
            SUM(clicks),
            SUM(cost),
            SUM(conversions),
            SUM(conversions_value)
        FROM google_ads
        WHERE date BETWEEN :period_start AND :period_end
          AND campaign_pk_id IS NOT NULL
        GROUP BY campaign_pk_id
    ) agg ON agg.campaign_pk_id = c.id
    ON DUPLICATE KEY UPDATE
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        spend = VALUES(spend),
        conversions = VALUES(conversions),
        conversions_value = VALUES(conversions_value),
        campaign_name = VALUES(campaign_name),
        platform = VALUES(platform),
        last_calculated_at = NOW();
    """
)


async def rebuild_daily_aggregates(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> dict[str, int]:
    """4 raw kaynaktan `kpi_daily_aggregates` tablosunu UPSERT eder.

    Returns: her kaynak için etkilenen satır sayısı (UPSERT'te
    affected_rows = inserted + 2*updated; yaklaşık değer).
    """
    params = {"date_from": date_from, "date_to": date_to}
    counts: dict[str, int] = {}

    for source, stmt in [
        ("ga4", _GA4_DAILY_UPSERT),
        ("meta", _META_DAILY_UPSERT),
        ("google", _GOOGLE_DAILY_UPSERT),
        ("ecommerce", _ORDERS_DAILY_UPSERT),
    ]:
        result = await db.execute(stmt, params)
        counts[source] = result.rowcount or 0
        logger.info(
            "daily_aggregate_upsert source=%s rows=%d", source, counts[source]
        )

    await db.commit()
    return counts


async def rebuild_monthly_aggregates(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> int:
    """Daily aggregate'lerden monthly tablosunu UPSERT eder."""
    result = await db.execute(
        _MONTHLY_UPSERT, {"date_from": date_from, "date_to": date_to}
    )
    affected = result.rowcount or 0
    await db.commit()
    logger.info("monthly_aggregate_upsert rows=%d", affected)
    return affected


async def rebuild_campaign_aggregates(
    db: AsyncSession,
    *,
    period_start: date,
    period_end: date,
) -> int:
    """Belirtilen dönem için kampanya × spend/clicks/conversions UPSERT.

    `period_start`/`period_end` çift olarak UNIQUE — aynı dönem yeniden
    çağrılırsa eski değer üzerine yazılır.
    """
    result = await db.execute(
        _CAMPAIGN_UPSERT,
        {"period_start": period_start, "period_end": period_end},
    )
    affected = result.rowcount or 0
    await db.commit()
    logger.info(
        "campaign_aggregate_upsert period=%s..%s rows=%d",
        period_start,
        period_end,
        affected,
    )
    return affected


async def rebuild_all(
    db: AsyncSession,
    *,
    date_from: date,
    date_to: date,
) -> dict[str, int | dict[str, int]]:
    """Daily → monthly → campaign sırasıyla full rebuild."""
    daily_counts = await rebuild_daily_aggregates(
        db, date_from=date_from, date_to=date_to
    )
    monthly_count = await rebuild_monthly_aggregates(
        db, date_from=date_from, date_to=date_to
    )
    campaign_count = await rebuild_campaign_aggregates(
        db, period_start=date_from, period_end=date_to
    )
    return {
        "daily": daily_counts,
        "monthly": monthly_count,
        "campaign": campaign_count,
    }
