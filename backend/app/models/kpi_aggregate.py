"""KPI aggregation tabloları (`docs/overview/04` §4.2.2).

Üç tablo:
- `kpi_daily_aggregates` — gün × kanal × platform × cihaz kırılımı
- `kpi_monthly_aggregates` — ay × kanal × platform × cihaz kırılımı
- `kpi_campaign_aggregates` — kampanya × dönem (ctr/cpc/roas STORED GENERATED)

KPI sorguları **bu tablolar üzerinden** yapılır, raw `ga4_traffic`/`meta_ads`/
`orders` üzerinden değil (`docs/09` §9.2.1 — iki katmanlı hesap).

Aggregation rebuild import sonrası `tasks/aggregation_tasks.py::rebuild_all_task`
ile tetiklenir.
"""

from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.mysql import BIGINT as MysqlBigInt
from sqlalchemy.dialects.mysql import INTEGER as MysqlInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned

IntUnsigned = Integer().with_variant(MysqlInteger(unsigned=True), "mysql")
BigIntUnsignedRaw = BigInteger().with_variant(MysqlBigInt(unsigned=True), "mysql")


class KPIPlatform(StrEnum):
    """Aggregation satırının hangi raw kaynaktan geldiğini gösterir."""

    GA4 = "ga4"
    META = "meta"
    GOOGLE = "google"
    ECOMMERCE = "ecommerce"


class KPIDailyAggregate(Base):
    """Gün × kanal × platform × cihaz aggregation kaydı.

    UNIQUE (date, channel, platform, device) — aynı kombinasyon iki kez
    yazılmaz; rebuild işlemi UPSERT ile çalışır.

    Bir satırın `platform` değeri belirler:
    - `ga4`     → sessions/users/bounce_sessions/total_session_duration/total_page_views
    - `meta`/`google` → impressions/clicks/spend/ad_conversions/ad_revenue
    - `ecommerce` → orders/revenue/items_sold/discount_total/refund_total
    """

    __tablename__ = "kpi_daily_aggregates"

    id: Mapped[int] = BigIntPK()

    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    channel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    platform: Mapped[KPIPlatform | None] = mapped_column(
        Enum(KPIPlatform, name="platform", values_callable=lambda x: [m.value for m in x]),
        nullable=True,
    )
    device: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # GA4 metrikleri
    sessions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    users: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    new_users: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    bounce_sessions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    total_session_duration: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0
    )
    total_page_views: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)

    # Reklam metrikleri (Meta/Google)
    impressions: Mapped[int] = mapped_column(BigIntUnsignedRaw, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(BigIntUnsignedRaw, nullable=False, default=0)
    spend: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    ad_conversions: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    ad_revenue: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)

    # E-ticaret metrikleri
    orders: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    revenue: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    items_sold: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    discount_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    refund_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)

    last_calculated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )


class KPIMonthlyAggregate(Base):
    """Ay × kanal × platform × cihaz aggregation kaydı.

    `period_month` ayın ilk günü (`DATE_FORMAT(d, '%Y-%m-01')`). Daily
    aggregate'lerden GROUP BY ile hesaplanır.
    """

    __tablename__ = "kpi_monthly_aggregates"

    id: Mapped[int] = BigIntPK()

    period_month: Mapped[date_type] = mapped_column(Date, nullable=False)
    channel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    platform: Mapped[KPIPlatform | None] = mapped_column(
        Enum(KPIPlatform, name="platform", values_callable=lambda x: [m.value for m in x]),
        nullable=True,
    )
    device: Mapped[str | None] = mapped_column(String(50), nullable=True)

    sessions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    users: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    new_users: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    bounce_sessions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)

    impressions: Mapped[int] = mapped_column(BigIntUnsignedRaw, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(BigIntUnsignedRaw, nullable=False, default=0)
    spend: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    ad_conversions: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    ad_revenue: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)

    orders: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    revenue: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    items_sold: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    discount_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    refund_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)

    last_calculated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )


class KPICampaignAggregate(Base):
    """Kampanya bazlı period aggregation. `ctr`, `cpc`, `roas` DB'de
    STORED GENERATED — parser/service yazmaz, kolon-listesi-bazlı bulk_insert
    bunları otomatik atlar."""

    __tablename__ = "kpi_campaign_aggregates"

    id: Mapped[int] = BigIntPK()

    campaign_pk_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("campaigns.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    campaign_external_id: Mapped[str] = mapped_column(String(100), nullable=False)
    campaign_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    platform: Mapped[KPIPlatform | None] = mapped_column(
        Enum(KPIPlatform, name="platform", values_callable=lambda x: [m.value for m in x]),
        nullable=True,
    )
    period_start: Mapped[date_type] = mapped_column(Date, nullable=False)
    period_end: Mapped[date_type] = mapped_column(Date, nullable=False)

    impressions: Mapped[int] = mapped_column(BigIntUnsignedRaw, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(BigIntUnsignedRaw, nullable=False, default=0)
    spend: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    conversions: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    conversions_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)

    # STORED GENERATED — bu alanlar bulk_insert'te atlanır (model kolon
    # filtresi `import_service`'te zaten bunu yapıyor; burada reflection
    # amacıyla tip belirtimi).
    ctr: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    cpc: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    roas: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)

    last_calculated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
