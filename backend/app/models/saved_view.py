from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedMixin, Base, BigIntPK, BigIntUnsigned, SoftDeleteMixin


class SavedView(Base, AuditedMixin, SoftDeleteMixin):
    """Bir dashboard sayfası için kaydedilmiş filter durumu.

    Kullanıcı dashboard'da filtreleri ayarlar, "Görünüm Kaydet" der —
    aynı kombinasyon dropdown'dan tek tıkla geri yüklenir.
    """

    __tablename__ = "saved_views"

    id: Mapped[int] = BigIntPK()
    user_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    page: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    filters: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
