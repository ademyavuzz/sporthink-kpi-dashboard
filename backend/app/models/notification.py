"""Kullanıcı bazlı bildirim — backend-driven notification merkezi.

Her kullanıcının kendi bildirimleri DB'de. Cihazdan bağımsız: A kullanıcısı
masaüstünden okur, telefonundan da okunmuş görür. Tetikleyiciler:
import.completed/failed, report.generated/failed, password.reset_by_admin
(services tarafında `notification_service.create_for_user` çağrılır).

Login/UI welcome gibi transient olaylar bu tabloya gitmez — sonner toast
ile gösterilir, kalıcı bildirim merkezine yazılmaz.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned, TimestampMixin


class NotificationType(StrEnum):
    """sonner toast'larıyla uyumlu 4 ton."""

    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"


class Notification(Base, TimestampMixin):
    """Kullanıcıya ait bildirim. Soft-delete yok — sınırlı saklama (30 gün
    Celery Beat ile fiziksel sil) + manuel sil. Mevcut backend'de cron yok;
    şimdilik kullanıcı manuel sil + DB temizliği ileride task'a alınır.
    """

    __tablename__ = "notifications"

    id: Mapped[int] = BigIntPK()

    user_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )

    type: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_notif_user_unread", "user_id", "is_read", "created_at"),
        Index("idx_notif_user_created", "user_id", "created_at"),
    )
