from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, func
from sqlalchemy.dialects.mysql import BIGINT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base

__all__ = [
    "Base",
    "BigIntPK",
    "BigIntUnsigned",
    "TimestampMixin",
    "AuditedMixin",
    "SoftDeleteMixin",
]


# BIGINT UNSIGNED için MySQL-spesifik tip; diğer backend'lerde BigInteger'a fallback
BigIntUnsigned = BigInteger().with_variant(BIGINT(unsigned=True), "mysql")


def BigIntPK() -> Mapped[int]:
    return mapped_column(BigIntUnsigned, primary_key=True, autoincrement=True)


class TimestampMixin:
    """`created_at` ve `updated_at` server-side default'larıyla."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        server_onupdate=func.current_timestamp(),
        nullable=False,
    )


class AuditedMixin(TimestampMixin):
    """`created_by` ve `updated_by` users.id'ye SET NULL FK."""

    created_by: Mapped[int | None] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    updated_by: Mapped[int | None] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )


class SoftDeleteMixin:
    """`deleted_at` NULL = aktif kayıt."""

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
