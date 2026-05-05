"""Davet ve şifre sıfırlama tokenları.

Token plaintext olarak saklanmaz (`token_hash` = SHA-256 hex). `purpose`
ENUM ile davet (yeni kullanıcı şifre kurma) ve sıfırlama (mevcut kullanıcı
şifre değiştirme) ayrılır. Her kullanıcının `purpose` başına tek aktif
token'ı olur — yeni token üretilmeden önce eski aktifler revoke edilir
(`used_at` set edilir) ki bir önceki link mail kutusunda kullanılamasın.
"""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, BigIntPK, BigIntUnsigned


class TokenPurpose(str, Enum):
    INVITE = "invite"
    RESET = "reset"


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = BigIntPK()

    user_id: Mapped[int] = mapped_column(
        BigIntUnsigned,
        ForeignKey("users.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    purpose: Mapped[TokenPurpose] = mapped_column(
        SAEnum(TokenPurpose, native_enum=False, length=20),
        nullable=False,
        default=TokenPurpose.RESET,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    requested_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.current_timestamp(), nullable=False
    )
