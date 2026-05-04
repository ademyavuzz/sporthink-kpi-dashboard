from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntUnsigned


class AuditLog(Base):
    """Partition'lı tablo (TO_DAYS(created_at) bazında aylık RANGE).

    `user_id` SET NULL FK'sı partition için kaldırıldı; `user_email` snapshot
    olarak referential bütünlük yerine kullanılır (doc §4.5.9).
    """

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigIntUnsigned, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        primary_key=True,  # composite PK: partition key UNIQUE'lerde olmalı
        server_default=func.current_timestamp(),
        nullable=False,
    )

    user_id: Mapped[int | None] = mapped_column(BigIntUnsigned, nullable=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
