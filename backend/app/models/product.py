from __future__ import annotations

from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Boolean, Enum, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedMixin, Base, BigIntPK, SoftDeleteMixin


class ProductGender(StrEnum):
    MALE = "male"
    FEMALE = "female"
    UNISEX = "unisex"


class Product(Base, AuditedMixin, SoftDeleteMixin):
    __tablename__ = "products"

    id: Mapped[int] = BigIntPK()

    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    product_name: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    sub_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    gender: Mapped[ProductGender | None] = mapped_column(
        Enum(ProductGender, name="gender", values_callable=lambda x: [m.value for m in x]),
        nullable=True,
    )
    price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    size_range: Mapped[str | None] = mapped_column(String(50), nullable=True)
