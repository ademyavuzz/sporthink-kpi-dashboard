from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.mysql import INTEGER as MysqlInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned

IntUnsigned = Integer().with_variant(MysqlInteger(unsigned=True), "mysql")


class GA4ItemEngagement(Base):
    """GA4 ürün etkileşim metrikleri — günlük × itemId kırılımı.

    `cart_to_view_rate` DB'de STORED GENERATED — CSV'den okunsa da INSERT
    edilemez (parser drop eder).

    `item_id` (SKU) → `product_pk_id` FK opsiyonel: SKU products tablosunda
    yoksa NULL kalır (yeni reklamlanan ama henüz import edilmemiş ürün).
    """

    __tablename__ = "ga4_item_engagement"

    id: Mapped[int] = BigIntPK()
    import_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("imports.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )

    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    product_pk_id: Mapped[int | None] = mapped_column(
        BigIntUnsigned,
        ForeignKey("products.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    item_id: Mapped[str] = mapped_column(String(100), nullable=False)
    item_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    item_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    item_category2: Mapped[str | None] = mapped_column(String(100), nullable=True)
    item_brand: Mapped[str | None] = mapped_column(String(100), nullable=True)

    items_viewed: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    items_added_to_cart: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    items_checked_out: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    items_purchased: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    item_revenue: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    item_list_views: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)
    item_list_clicks: Mapped[int] = mapped_column(IntUnsigned, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
