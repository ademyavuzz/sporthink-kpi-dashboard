from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedMixin, Base, BigIntPK, SoftDeleteMixin


class ChannelMapping(Base, AuditedMixin, SoftDeleteMixin):
    """`(source, medium)` → `channel_group` master/referans tablosu.

    GA4 trafik satırlarında `derived_channel` post-processing ile bu tablodan
    çözülür. Veri sabit bir referans setidir (16-20 satır) ve seed üzerinden
    yüklenir; kullanıcı UI dosya import'una konu değildir.
    """

    __tablename__ = "channel_mapping"

    id: Mapped[int] = BigIntPK()

    source: Mapped[str] = mapped_column(String(255), nullable=False)
    medium: Mapped[str] = mapped_column(String(100), nullable=False)
    channel_group: Mapped[str] = mapped_column(String(100), nullable=False)
    is_auto_assigned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
