"""Import endpoint'leri için API şemaları."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class DataTypeColumn(BaseModel):
    """Bir CSV başlığının parser'da nasıl ele alındığını anlatır.

    Frontend wizard'ı 2. adımda yüklenen dosyanın başlıklarıyla bu listeyi
    karşılaştırır (eksik zorunlu / tanınmayan kolon uyarıları).
    """

    csv_header: str
    db_column: str
    type: str  # ColumnSpec.coerce — 'str' | 'int' | 'decimal' | 'date_iso' | ...
    required: bool


class DataTypeMeta(BaseModel):
    """Bir veri kaynağının import meta bilgileri."""

    data_type: str  # ImportDataType enum value (örn: 'products', 'ga4_traffic')
    label_tr: str
    target_table: str
    csv_headers: list[DataTypeColumn]
    dedup_keys: list[str]
    fk_count: int  # FK lookup sayısı; 0 ise master/leaf tablo


class ImportSampleError(BaseModel):
    """Sonuç panelinde gösterilecek örnek hata satırı."""

    source_row_number: int
    field_name: str | None = None
    error_code: str
    error_message: str | None = None


class ImportPreviewSummary(BaseModel):
    """Preview parse istatistikleri (ilk N satır üzerinden)."""

    previewed_rows: int  # Kaç satır parse denendi
    valid_rows: int  # Başarılı satır
    error_rows: int  # Hatalı satır


class ImportPreviewResponse(BaseModel):
    """`POST /imports/preview` cevabı — dosya DB'ye yazılmadan önce inceleme."""

    data_type: str
    file_name: str
    file_size_bytes: int
    # Dosyada bulunan tüm başlıklar (BOM temizlenmiş, sırasıyla)
    detected_headers: list[str]
    # Parser zorunlu istiyor ama dosyada yok — dosya kabul edilemez
    missing_required: list[str]
    # Parser tanımıyor ama dosyada var — sessiz drop edilir, kullanıcıyı bilgilendir
    unknown_headers: list[str]
    # İlk 10 başarıyla parse edilmiş satır (DB kolon adlarıyla)
    sample_rows: list[dict[str, Any]]
    sample_errors: list[ImportSampleError]
    summary: ImportPreviewSummary


class ImportListItem(BaseModel):
    """Import history tablosu satırı."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    data_type: str
    status: str
    total_rows: int | None = None
    valid_rows: int | None = None
    invalid_rows: int | None = None
    skipped_rows: int | None = None  # Dedup nedeniyle atlanan (zaten DB'de var)
    inserted_rows: int | None = None
    duration_seconds: int | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class ImportDetailResponse(ImportListItem):
    """Tek import detayı + örnek hatalar (ilk N)."""

    error_message: str | None = None
    sample_errors: list[ImportSampleError] = []


class ImportRunResult(ImportDetailResponse):
    """`POST /imports` cevabı — tek seferlik upload sonucu."""

    pass
