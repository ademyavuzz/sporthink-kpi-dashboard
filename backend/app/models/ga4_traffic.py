from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.mysql import INTEGER as MysqlInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned


class GA4DeviceCategory(StrEnum):
    MOBILE = "mobile"
    DESKTOP = "desktop"
    TABLET = "tablet"
    OTHER = "other"


class GA4NewVsReturning(StrEnum):
    NEW = "new"
    RETURNING = "returning"


# INT UNSIGNED — sayılar negatif olamaz, ama SQLAlchemy default Integer signed.
IntUnsigned = Integer().with_variant(MysqlInteger(unsigned=True), "mysql")


class GA4Traffic(Base):
    """GA4 Data API `runReport` çıktısı — günlük trafik kırılım satırları.

    Natural unique key yok (aynı gün/source/medium için birden çok landing
    page/city/device satırı normal); dedup parser tarafında devre dışı.
    Yeniden yükleme için import sil → yeniden yükle akışı kullanılır.
    """

    __tablename__ = "ga4_traffic"

    id: Mapped[int] = BigIntPK()
    import_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("imports.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )

    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    session_source: Mapped[str] = mapped_column(String(255), nullable=False)
    session_medium: Mapped[str] = mapped_column(String(100), nullable=False)
    session_campaign_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    session_default_channel_group: Mapped[str | None] = mapped_column(String(100), nullable=True)
    derived_channel: Mapped[str | None] = mapped_column(String(100), nullable=True)

    device_category: Mapped[GA4DeviceCategory] = mapped_column(
        Enum(
            GA4DeviceCategory,
            name="device_category",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=False,
    )
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    landing_page_plus_query_string: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    new_vs_returning: Mapped[GA4NewVsReturning | None] = mapped_column(
        Enum(
            GA4NewVsReturning,
            name="new_vs_returning",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )

    sessions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    total_users: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    new_users: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    bounce_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    average_session_duration: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=0
    )
    screen_page_views_per_session: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), nullable=False, default=0
    )
    engaged_sessions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    engagement_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False, default=0)
    user_engagement_duration: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0
    )
    conversions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    purchase_revenue: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    transactions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
