"""`import_errors` — bir import sırasında oluşan satır seviyesi hatalar."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned


class ImportError_(Base):
    """`import_errors` tablosuna eşlenen ORM.

    Class adı sondaki `_` ile Python built-in'i `ImportError`'ı gölgelemiyor.
    Re-export `models/__init__.py`'da `ImportRowError` olarak yapılır.
    """

    __tablename__ = "import_errors"

    id: Mapped[int] = BigIntPK()
    import_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("imports.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )

    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    field_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_code: Mapped[str] = mapped_column(String(50), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    row_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
