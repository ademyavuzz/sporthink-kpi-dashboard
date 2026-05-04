"""Parser tip tanımları.

Her veri kaynağı için bir `SourceConfig` ile parser davranışı tanımlanır:
- header_map: CSV kolonu → DB kolonu eşlemesi (gerekli + opsiyonel)
- coercers: hangi DB kolonu hangi tipe dönüştürülecek (date, int, decimal, bool, ...)
- dedup_keys: deduplikasyon için kullanılacak DB kolonları
- fk_lookups: external_id (string) → pk_id (BIGINT) eşlemesi gereken kolonlar

Generic CSV parser bu config'i alır, satırları işler, geçerli satırları
`ParsedRow` olarak yield eder; hatalar `ParseError` olarak biriktirilir.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

CoerceType = Literal[
    "str",
    "int",
    "decimal",
    "date_iso",         # "2024-10-01"
    "date_yyyymmdd",    # 20241001
    "datetime_iso",     # "2024-10-01 12:38:42" veya "2024-10-01T12:38:42"
    "bool",
    "enum_str",
]


@dataclass(frozen=True)
class ColumnSpec:
    """Tek bir DB kolonu için map + coercion + zorunluluk."""

    db_column: str
    csv_header: str
    coerce: CoerceType
    required: bool = True
    # enum_str için izinli değerlerin lowercase set'i (None ise koruma kapalı)
    allowed_values: frozenset[str] | None = None
    # değer boşsa kullanılacak default (optional kolonlar için)
    default: Any = None


@dataclass(frozen=True)
class FKLookup:
    """`<external_id_column>` (string) → `<pk_column>` (BIGINT) çözümü.

    `lookup_table` üzerinden `<lookup_column>` ile match edilir; bulunamazsa
    `required=True` ise satır hata olarak işaretlenir, aksi halde None konur.
    """

    pk_column: str
    external_id_column: str
    lookup_table: str
    lookup_column: str  # external_id_column'un karşılık geldiği kolon
    required: bool = True


@dataclass(frozen=True)
class SourceConfig:
    name: str  # ImportDataType enum value (örn: "orders")
    target_table: str  # ORM model'in tablo adı

    columns: list[ColumnSpec]
    dedup_keys: list[str]   # DB kolon adları
    fk_lookups: list[FKLookup] = field(default_factory=list)

    # Bazı kaynaklarda CSV'de hesaplanmış kolon var ama DB STORED GENERATED — atla.
    drop_columns: frozenset[str] = field(default_factory=frozenset)

    # CSV'den alıp DB'ye yazılmadan önce satır seviyesinde mutate eden hook'lar
    post_coerce: Callable[[dict[str, Any]], dict[str, Any]] | None = None


@dataclass
class ParseError:
    source_row_number: int
    field_name: str | None
    error_code: str
    error_message: str
    row_data: dict[str, Any]


@dataclass
class ParsedRow:
    source_row_number: int  # 1-based, header dahil değil
    data: dict[str, Any]    # DB kolon adı → coerce edilmiş değer
