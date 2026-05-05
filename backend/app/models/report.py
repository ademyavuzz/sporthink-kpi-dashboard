"""`reports` tablosu — kullanıcı tarafından üretilen PDF raporlarının lifecycle kaydı.

Akış:
- Kullanıcı tarih aralığı + bölüm seçimi yapar (POST /reports)
- Service `pending` durumunda kayıt oluşturur, Celery task enqueue eder
- Worker veriyi toplar, HTML render eder, WeasyPrint ile PDF üretir,
  `uploads/reports/{id}.pdf` altına yazar, `status=completed` set eder
- Frontend status için poll eder; `completed` olunca download butonu açılır
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned


class ReportStatus(StrEnum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"


class ReportSection(StrEnum):
    """PDF içinde render edilebilecek bölüm anahtarları.

    Kullanıcı `sections` JSON listesinde hangi bölümlerin yer alacağını seçer;
    boş liste = tüm bölümler dahil.
    """

    OVERVIEW = "overview"  # Genel Özet — 8 KPI + günlük revenue trend
    GA4 = "ga4"  # Trafik kanal özeti
    ADS = "ads"  # Meta + Google Ads özet
    ECOMMERCE = "ecommerce"  # E-ticaret kanal × revenue
    FUNNEL = "funnel"  # Dönüşüm hunisi 4 adım
    TOP = "top"  # Top 10 ürün + Top 10 müşteri


class Report(Base):
    """Bir rapor üretim isteğinin lifecycle kaydı.

    Soft delete: `deleted_at IS NULL` aktif kayıtları temsil eder.
    """

    __tablename__ = "reports"

    id: Mapped[int] = BigIntPK()

    user_id: Mapped[int | None] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_from: Mapped[Any] = mapped_column(Date, nullable=False)
    date_to: Mapped[Any] = mapped_column(Date, nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="tr")

    # Hangi bölümlerin dahil edileceği (string list — ReportSection değerleri)
    sections: Mapped[list[str]] = mapped_column(JSON, nullable=False)

    status: Mapped[ReportStatus] = mapped_column(
        Enum(
            ReportStatus,
            name="report_status",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=False,
        default=ReportStatus.PENDING,
    )

    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
