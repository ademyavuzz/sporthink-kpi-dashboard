from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedMixin, Base, BigIntPK, BigIntUnsigned, SoftDeleteMixin


class Segment(Base, AuditedMixin, SoftDeleteMixin):
    """Kullanıcı tarafından tanımlanmış müşteri segmenti.

    `rules` JSON: visual rule builder UI'dan gelen kural ağacı; runtime'da
    `segment_service.evaluate()` SQL'e çevirir.
    `cached_count` segmentin son hesaplanan müşteri sayısı (preview için).
    """

    __tablename__ = "segments"

    id: Mapped[int] = BigIntPK()
    user_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    rules: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    cached_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cached_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
