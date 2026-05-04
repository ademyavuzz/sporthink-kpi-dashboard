from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import Date, Enum, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedMixin, Base, BigIntPK, SoftDeleteMixin


class CampaignPlatform(StrEnum):
    META = "meta"
    GOOGLE = "google"


class CampaignStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"


class Campaign(Base, AuditedMixin, SoftDeleteMixin):
    """Pazarlama kampanyası master kaydı.

    `(platform, external_campaign_id)` çifti UNIQUE — aynı kampanya iki
    platformda farklı kayıt olarak durabilir. Dummy CSV'de external id
    sütunu yok; parser `campaign_name`'i external id olarak kullanır.
    """

    __tablename__ = "campaigns"

    id: Mapped[int] = BigIntPK()

    platform: Mapped[CampaignPlatform] = mapped_column(
        Enum(
            CampaignPlatform,
            name="platform",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=False,
    )
    # Canlı API entegrasyonunda Meta/Google'ın gerçek kampanya id'si yazılır.
    # Dummy CSV'de yok — NULL kalır; UNIQUE(platform, external_campaign_id)
    # MySQL'de NULL'lara izin verir, yani dedup üzerinde etkisi yok.
    external_campaign_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    campaign_name: Mapped[str] = mapped_column(String(500), nullable=False)
    campaign_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    objective: Mapped[str | None] = mapped_column(String(100), nullable=True)

    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    daily_budget: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    total_budget: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)

    target_audience: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(
            CampaignStatus,
            name="status",
            values_callable=lambda x: [m.value for m in x],
        ),
        nullable=False,
        default=CampaignStatus.ACTIVE,
    )
