"""Ortak response zarfı.

Tüm başarılı response'lar `{success: true, data: ...}` formatında döner
(`/CLAUDE.md` §6.1). Pagination'lı liste için `PaginatedEnvelope`
ek `pagination` alanı taşır (backend/CLAUDE.md §6.1).

Hatalı response'lar `SporthinkException.to_response()` tarafından üretilir.
"""

from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class SuccessEnvelope(BaseModel, Generic[T]):
    model_config = ConfigDict(extra="forbid")

    success: Literal[True] = True
    data: T


class PaginationMeta(BaseModel):
    """Sayfalama meta-bilgisi (kök CLAUDE.md §6.1 formatı)."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(..., ge=1, description="Mevcut sayfa numarası (1-bazlı)")
    page_size: int = Field(..., ge=1, le=200, description="Sayfa boyutu")
    total: int = Field(..., ge=0, description="Toplam kayıt sayısı")


class PaginatedEnvelope(BaseModel, Generic[T]):
    """Liste endpoint'leri için sayfalı envelope.

    `data` her zaman list[T]; `pagination` ise meta bilgisi taşır.
    Frontend bu yapıyı tek `unwrap` ile alır, mevcut SuccessEnvelope ile
    uyumlu olarak `success: true` set eder.
    """

    model_config = ConfigDict(extra="forbid")

    success: Literal[True] = True
    data: list[T]
    pagination: PaginationMeta
