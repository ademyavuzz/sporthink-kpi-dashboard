from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.mysql import INTEGER as MysqlInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned

IntUnsigned = Integer().with_variant(MysqlInteger(unsigned=True), "mysql")


class MetaBreakdownAge(StrEnum):
    AG_13_17 = "13-17"
    AG_18_24 = "18-24"
    AG_25_34 = "25-34"
    AG_35_44 = "35-44"
    AG_45_54 = "45-54"
    AG_55_64 = "55-64"
    AG_65_PLUS = "65+"
    UNKNOWN = "unknown"


class MetaBreakdownGender(StrEnum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class MetaAdsBreakdowns(Base):
    """Meta insights breakdowns — tek satır = bir gün × kampanya × kırılım.

    Dummy CSV `publisher_platform / platform_position / impression_device`
    boyutları içeriyor; age/gender/country/region kolonları DB'de tanımlı
    ama CSV'de yok → NULL kalır.

    `campaign_id` Meta'nın numerik ID'si — CSV'de yok ve canlı API
    entegrasyonu olunca dolacak. Şimdilik NULL; `campaign_pk_id` FK üzerinden
    master `campaigns` kaydına bağlıyoruz (campaign_name ile match).
    """

    __tablename__ = "meta_ads_breakdowns"

    id: Mapped[int] = BigIntPK()
    import_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("imports.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )

    date_start: Mapped[date_type] = mapped_column(Date, nullable=False)
    date_stop: Mapped[date_type | None] = mapped_column(Date, nullable=True)

    campaign_pk_id: Mapped[int | None] = mapped_column(
        BigIntUnsigned,
        ForeignKey("campaigns.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    campaign_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    adset_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    adset_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ad_name: Mapped[str | None] = mapped_column(String(500), nullable=True)

    age: Mapped[MetaBreakdownAge | None] = mapped_column(
        Enum(
            MetaBreakdownAge,
            name="age",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )
    gender: Mapped[MetaBreakdownGender | None] = mapped_column(
        Enum(
            MetaBreakdownGender,
            name="gender",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )
    publisher_platform: Mapped[str | None] = mapped_column(String(50), nullable=True)
    platform_position: Mapped[str | None] = mapped_column(String(50), nullable=True)
    impression_device: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)

    impressions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    reach: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    spend: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    actions_purchase: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    action_values_purchase: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
