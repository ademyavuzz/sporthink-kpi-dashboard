from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Computed, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned


class OrderDevice(StrEnum):
    MOBILE = "mobile"
    DESKTOP = "desktop"
    TABLET = "tablet"


class OrderStatus(StrEnum):
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    PENDING = "pending"
    SHIPPED = "shipped"


class OrderPaymentMethod(StrEnum):
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    BANK_TRANSFER = "bank_transfer"
    PAY_AT_DOOR = "pay_at_door"


class Order(Base):
    """`orders` tablosu — `net_revenue` STORED GENERATED kolonu DB tarafında
    hesaplanır, INSERT'e dahil edilmez."""

    __tablename__ = "orders"

    id: Mapped[int] = BigIntPK()
    import_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("imports.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )

    order_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    order_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    customer_pk_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("customers.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    customer_id: Mapped[str] = mapped_column(String(50), nullable=False)

    city: Mapped[str] = mapped_column(String(100), nullable=False)
    device: Mapped[OrderDevice] = mapped_column(
        Enum(OrderDevice, name="device", values_callable=lambda x: [m.value for m in x]),
        nullable=False,
    )

    channel: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    medium: Mapped[str | None] = mapped_column(String(100), nullable=True)
    campaign_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    coupon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    product_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    order_revenue: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    shipping_cost: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)

    # STORED GENERATED — DB hesaplar
    net_revenue: Mapped[Decimal | None] = mapped_column(
        Numeric(15, 2),
        Computed("(`order_revenue` - `discount_amount` - `refund_amount`)", persisted=True),
        nullable=True,
    )

    order_status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status", values_callable=lambda x: [m.value for m in x]),
        nullable=False,
    )
    payment_method: Mapped[OrderPaymentMethod] = mapped_column(
        Enum(
            OrderPaymentMethod,
            name="payment_method",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
