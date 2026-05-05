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
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.mysql import BIGINT as MysqlBigInt
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned

BigIntUnsignedRaw = BigInteger().with_variant(MysqlBigInt(unsigned=True), "mysql")


class GoogleCampaignStatus(StrEnum):
    ENABLED = "enabled"
    PAUSED = "paused"
    REMOVED = "removed"


class GoogleAdGroupStatus(StrEnum):
    ENABLED = "enabled"
    PAUSED = "paused"
    REMOVED = "removed"


class GoogleAdvertisingChannelType(StrEnum):
    SEARCH = "search"
    SHOPPING = "shopping"
    PERFORMANCE_MAX = "performance_max"
    DISPLAY = "display"
    VIDEO = "video"


class GoogleDevice(StrEnum):
    MOBILE = "mobile"
    DESKTOP = "desktop"
    TABLET = "tablet"
    OTHER = "other"


class GoogleKeywordMatchType(StrEnum):
    EXACT = "exact"
    PHRASE = "phrase"
    BROAD = "broad"


class GoogleAds(Base):
    """Google Ads API performans satırları — gün × kampanya × ad_group × kırılım.

    Para metrikleri (`cost`, `average_cpc`, `average_cpm`, `cost_per_conversion`)
    Google Ads API'de **micros** cinsinden gelir (÷1_000_000); parser TL'ye
    çevirir.

    `campaign_id` Google'ın numerik ID'si; `campaign_pk_id` opsiyonel FK
    (master `campaigns` kaydı `campaign_name` üzerinden eşleşir).
    """

    __tablename__ = "google_ads"

    id: Mapped[int] = BigIntPK()
    import_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("imports.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )

    date: Mapped[date_type] = mapped_column(Date, nullable=False)

    customer_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    customer_descriptive_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    campaign_pk_id: Mapped[int | None] = mapped_column(
        BigIntUnsigned,
        ForeignKey("campaigns.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    campaign_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    campaign_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    campaign_status: Mapped[GoogleCampaignStatus | None] = mapped_column(
        Enum(
            GoogleCampaignStatus,
            name="campaign_status",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )
    advertising_channel_type: Mapped[GoogleAdvertisingChannelType | None] = mapped_column(
        Enum(
            GoogleAdvertisingChannelType,
            name="advertising_channel_type",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )

    ad_group_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    ad_group_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ad_group_status: Mapped[GoogleAdGroupStatus | None] = mapped_column(
        Enum(
            GoogleAdGroupStatus,
            name="ad_group_status",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )

    device: Mapped[GoogleDevice | None] = mapped_column(
        Enum(
            GoogleDevice,
            name="device",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )
    ad_network_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    conversion_action_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    product_item_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    product_brand: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_type_l1: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_type_l2: Mapped[str | None] = mapped_column(String(100), nullable=True)

    keyword_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    keyword_match_type: Mapped[GoogleKeywordMatchType | None] = mapped_column(
        Enum(
            GoogleKeywordMatchType,
            name="keyword_match_type",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )
    search_term: Mapped[str | None] = mapped_column(String(500), nullable=True)

    impressions: Mapped[int] = mapped_column(BigIntUnsignedRaw, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(BigIntUnsignedRaw, nullable=False, default=0)
    cost: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    ctr: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    average_cpc: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=0)
    average_cpm: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=0)
    conversions: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    conversions_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    all_conversions: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    all_conversions_value: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0
    )
    cost_per_conversion: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    conversions_from_interactions_rate: Mapped[Decimal] = mapped_column(
        Numeric(8, 4), nullable=False, default=0
    )
    value_per_conversion: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    search_impression_share: Mapped[Decimal | None] = mapped_column(Numeric(7, 4), nullable=True)
    search_budget_lost_impression_share: Mapped[Decimal | None] = mapped_column(
        Numeric(7, 4), nullable=True
    )
    search_rank_lost_impression_share: Mapped[Decimal | None] = mapped_column(
        Numeric(7, 4), nullable=True
    )
    view_through_conversions: Mapped[int] = mapped_column(
        BigIntUnsignedRaw, nullable=False, default=0
    )
    interaction_rate: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
