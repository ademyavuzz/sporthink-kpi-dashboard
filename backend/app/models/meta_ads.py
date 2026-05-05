from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.mysql import INTEGER as MysqlInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned

IntUnsigned = Integer().with_variant(MysqlInteger(unsigned=True), "mysql")


class MetaAds(Base):
    """Meta Marketing API `insights` çıktısı — günlük × ad bazında performans.

    `actions:*` ve `action_values:*` CSV kolonları DB'de snake_case'e
    flatten edilmiş: `actions_link_click`, `action_values_purchase` vb.

    `campaign_id` Meta'nın kendi numerik ID'si; `campaign_pk_id` FK opsiyonel
    (campaigns master kaydı yoksa NULL — backfill task'ı sonradan
    `campaign_name` üzerinden eşleyebilir).
    """

    __tablename__ = "meta_ads"

    id: Mapped[int] = BigIntPK()
    import_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("imports.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )

    date_start: Mapped[date_type] = mapped_column(Date, nullable=False)
    date_stop: Mapped[date_type] = mapped_column(Date, nullable=False)

    account_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    account_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    campaign_pk_id: Mapped[int | None] = mapped_column(
        BigIntUnsigned,
        ForeignKey("campaigns.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    campaign_id: Mapped[str] = mapped_column(String(50), nullable=False)
    campaign_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    adset_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    adset_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ad_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ad_name: Mapped[str | None] = mapped_column(String(500), nullable=True)

    objective: Mapped[str | None] = mapped_column(String(50), nullable=True)
    buying_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    impressions: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    reach: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    frequency: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    inline_link_clicks: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    spend: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    cpc: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=0)
    cpm: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=0)
    cpp: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=0)
    ctr: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    inline_link_click_ctr: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False, default=0)

    actions_link_click: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    actions_landing_page_view: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    actions_view_content: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    actions_add_to_cart: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    actions_initiate_checkout: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    actions_purchase: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    action_values_purchase: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=0
    )
    actions_page_engagement: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    actions_post_engagement: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    actions_video_view: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
