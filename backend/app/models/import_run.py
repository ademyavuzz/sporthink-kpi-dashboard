"""`imports` tablosu — bir import işleminin durumu, dosyası, sonuçları."""
from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned


class ImportStatus(StrEnum):
    PENDING = "pending"
    PARSING = "parsing"
    VALIDATING = "validating"
    COMMITTING = "committing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ImportFileFormat(StrEnum):
    CSV = "csv"
    XLSX = "xlsx"
    JSON = "json"


class ImportDataType(StrEnum):
    """Hedef tablo seçicisi — DB'deki `imports.data_type` ENUM ile birebir."""

    GA4_TRAFFIC = "ga4_traffic"
    GA4_ITEMS = "ga4_items"
    META_ADS = "meta_ads"
    META_BREAKDOWNS = "meta_breakdowns"
    GOOGLE_ADS = "google_ads"
    ORDERS = "orders"
    ORDER_ITEMS = "order_items"
    PRODUCTS = "products"
    CUSTOMERS = "customers"
    CAMPAIGNS = "campaigns"


class DuplicateStrategy(StrEnum):
    OVERWRITE = "overwrite"
    SKIP = "skip"
    CANCEL = "cancel"


class ErrorStrategy(StrEnum):
    SKIP = "skip"
    ABORT = "abort"
    ASK = "ask"


class Import(Base):
    """Bir import işleminin lifecycle kaydı.

    `data_type` hedef raw tabloyu, `status` lifecycle aşamasını gösterir.
    Faz 1'de tüm işlem sync — `pending → committing → completed/failed`.
    """

    __tablename__ = "imports"

    id: Mapped[int] = BigIntPK()

    user_id: Mapped[int | None] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_format: Mapped[ImportFileFormat] = mapped_column(
        Enum(ImportFileFormat, name="file_format", values_callable=lambda x: [m.value for m in x]),
        nullable=False,
    )
    data_type: Mapped[ImportDataType] = mapped_column(
        Enum(ImportDataType, name="data_type", values_callable=lambda x: [m.value for m in x]),
        nullable=False,
    )

    status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus, name="status", values_callable=lambda x: [m.value for m in x]),
        nullable=False,
        default=ImportStatus.PENDING,
    )
    progress_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    total_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    valid_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    invalid_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skipped_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    inserted_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)

    duplicate_strategy: Mapped[DuplicateStrategy | None] = mapped_column(
        Enum(
            DuplicateStrategy,
            name="duplicate_strategy",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )
    error_strategy: Mapped[ErrorStrategy | None] = mapped_column(
        Enum(
            ErrorStrategy,
            name="error_strategy",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=True,
    )

    column_mapping: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
