from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Boolean, Date, Enum, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedMixin, Base, BigIntPK, SoftDeleteMixin


class CustomerGender(StrEnum):
    MALE = "male"
    FEMALE = "female"


class CustomerAgeGroup(StrEnum):
    AG_18_24 = "18-24"
    AG_25_34 = "25-34"
    AG_35_44 = "35-44"
    AG_45_54 = "45-54"
    AG_55_64 = "55-64"
    AG_65_PLUS = "65+"


class Customer(Base, AuditedMixin, SoftDeleteMixin):
    __tablename__ = "customers"

    id: Mapped[int] = BigIntPK()

    customer_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    first_order_date: Mapped[date] = mapped_column(Date, nullable=False)
    registration_date: Mapped[date] = mapped_column(Date, nullable=False)

    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gender: Mapped[CustomerGender | None] = mapped_column(
        Enum(CustomerGender, name="gender", values_callable=lambda x: [m.value for m in x]),
        nullable=True,
    )
    age_group: Mapped[CustomerAgeGroup | None] = mapped_column(
        Enum(CustomerAgeGroup, name="age_group", values_callable=lambda x: [m.value for m in x]),
        nullable=True,
    )
    registration_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_newsletter_subscriber: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    total_orders: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_revenue: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    last_order_date: Mapped[date | None] = mapped_column(Date, nullable=True)
