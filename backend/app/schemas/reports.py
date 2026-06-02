"""Rapor üretim modülü API contract'ı."""

from __future__ import annotations

from datetime import date as date_type
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ReportSectionKey = Literal[
    "overview",
    "ga4",
    "ads",
    "ecommerce",
    "funnel",
    "top",
]

ReportStatusKey = Literal["pending", "generating", "completed", "failed"]


class ReportCreateRequest(BaseModel):
    """`POST /reports` payload - kullanıcı tarih aralığı + bölüm seçimi sağlar.

    `sections` boş bırakılırsa frontend tüm bölümleri varsayılan açık göstermek
    yerine null göndermeli; servis boş listeyi reddeder.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=255)
    date_from: date_type
    date_to: date_type
    sections: list[ReportSectionKey] = Field(min_length=1)
    language: Literal["tr", "en"] = "tr"

    @model_validator(mode="after")
    def _validate_range(self) -> ReportCreateRequest:
        if self.date_from > self.date_to:
            raise ValueError("date_from must be <= date_to")
        return self


class ReportListItem(BaseModel):
    """Liste row'u - geçmiş raporlar tablosu için."""

    id: int
    name: str
    date_from: date_type
    date_to: date_type
    sections: list[ReportSectionKey]
    language: str
    status: ReportStatusKey
    file_size_bytes: int | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime


class ReportDetailResponse(ReportListItem):
    """Detay için aynı shape - şimdilik fark yok, ileride preview metadata
    eklenirse burada büyür.
    """


class ReportSectionMeta(BaseModel):
    """`/reports/sections` cevabı - UI checkbox listesi için."""

    key: ReportSectionKey
    label_tr: str
    label_en: str
    description_tr: str
    description_en: str
