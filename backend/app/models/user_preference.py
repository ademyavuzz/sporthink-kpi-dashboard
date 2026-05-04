from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntUnsigned


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        primary_key=True,
    )

    theme: Mapped[str] = mapped_column(
        Enum("light", "dark", "system", name="user_pref_theme"),
        nullable=False,
        default="system",
    )
    language: Mapped[str] = mapped_column(
        Enum("tr", "en", name="user_pref_language"),
        nullable=False,
        default="tr",
    )
    sidebar_collapsed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.current_timestamp(),
        server_onupdate=func.current_timestamp(),
        nullable=False,
    )
