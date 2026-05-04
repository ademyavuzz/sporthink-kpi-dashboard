from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = BigIntPK()
    import_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("imports.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )

    order_pk_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("orders.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    order_id: Mapped[str] = mapped_column(String(50), nullable=False)
    line_id: Mapped[int] = mapped_column(Integer, nullable=False)

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

    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
