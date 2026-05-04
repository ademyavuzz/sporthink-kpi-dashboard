"""Generic CSV parser.

Stream-friendly: dosyayı tek seferde belleğe almaz, satır satır okur, batch
halinde tüketiciye yield eder. UTF-8 BOM otomatik temizlenir.

Tip dönüşümleri (`ColumnSpec.coerce`):
- str          : strip; boşsa None (zorunluysa hata)
- int          : `int(value)`; trim
- decimal      : `Decimal(value)`; trim
- date_iso     : "YYYY-MM-DD"
- date_yyyymmdd: "20241001" (str veya int)
- datetime_iso : "YYYY-MM-DD HH:MM:SS" veya "YYYY-MM-DDTHH:MM:SS"
- bool         : "true"/"false"/"True"/"1"/"0" — case-insensitive
- enum_str     : `allowed_values` set'inde olmalı (lowercase eşleme)

Hatalar `ParseError` listesinde toplanır (fail-fast değil); çağıran taraf
import_error tablosuna yazar.
"""
from __future__ import annotations

import csv
from collections.abc import Iterator
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import IO, Any

from app.parsers.types import ColumnSpec, ParsedRow, ParseError, SourceConfig

_TRUE_LITERALS = frozenset({"true", "1", "yes", "y", "evet"})
_FALSE_LITERALS = frozenset({"false", "0", "no", "n", "hayir", "hayır", ""})


class CoerceError(ValueError):
    """Tip dönüşümü başarısız."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _coerce_value(spec: ColumnSpec, raw: str | None) -> Any:
    """`raw` CSV değerini `spec.coerce`'e göre Python tipine dönüştürür.

    Boş değer + `required=False` → `spec.default`.
    Boş değer + `required=True` → `CoerceError("REQUIRED")`.
    Geçersiz format → `CoerceError("INVALID_<TYPE>")`.
    """
    value = raw.strip() if isinstance(raw, str) else raw

    if value is None or value == "":
        if spec.required:
            raise CoerceError("REQUIRED", f"Required field '{spec.db_column}' is empty")
        return spec.default

    try:
        match spec.coerce:
            case "str":
                return value

            case "int":
                return int(value)

            case "decimal":
                # CSV'den gelebilen "1.234,56" gibi TR formatlarını ele almıyoruz —
                # dummy data tamamı US format. Gerekirse normalize burada eklenir.
                return Decimal(value)

            case "date_iso":
                return date.fromisoformat(value)

            case "date_yyyymmdd":
                if len(value) != 8 or not value.isdigit():
                    raise CoerceError(
                        "INVALID_DATE",
                        f"Expected YYYYMMDD integer, got {value!r}",
                    )
                return date(int(value[:4]), int(value[4:6]), int(value[6:8]))

            case "datetime_iso":
                # 'T' veya ' ' ayraçlı ISO-ish format
                normalized = value.replace("T", " ", 1)
                return datetime.fromisoformat(normalized)

            case "bool":
                lc = value.lower()
                if lc in _TRUE_LITERALS:
                    return True
                if lc in _FALSE_LITERALS:
                    return False
                raise CoerceError("INVALID_BOOL", f"Cannot parse boolean: {value!r}")

            case "enum_str":
                lc = value.lower()
                if spec.allowed_values is not None and lc not in spec.allowed_values:
                    raise CoerceError(
                        "INVALID_ENUM",
                        f"Value {value!r} not in {sorted(spec.allowed_values)}",
                    )
                return lc

            case _:
                raise CoerceError("UNKNOWN_COERCE", f"Unknown coerce type: {spec.coerce}")

    except CoerceError:
        raise
    except (ValueError, InvalidOperation, TypeError) as exc:
        raise CoerceError(f"INVALID_{spec.coerce.upper()}", str(exc)) from exc


def parse_csv(
    file: IO[str],
    config: SourceConfig,
) -> Iterator[ParsedRow | ParseError]:
    """CSV dosyasını oku, her satır için `ParsedRow` veya `ParseError` yield et.

    Çağıran taraf iki türü ayrıştırır (isinstance) ve uygun şekilde işler.
    """
    reader = csv.DictReader(file)

    # CSV header'da BOM olabilir; csv modülü ilk kolonun adına ekler.
    if reader.fieldnames is None:
        return
    cleaned: list[str] = []
    for h in reader.fieldnames:
        cleaned.append(h.lstrip("﻿").strip() if h else "")
    reader.fieldnames = cleaned

    # Konfig'deki zorunlu CSV kolonları dosyada var mı?
    csv_headers = set(reader.fieldnames)
    required_csv_headers = {c.csv_header for c in config.columns if c.required}
    missing = required_csv_headers - csv_headers
    if missing:
        # Tüm dosyayı tek hata ile reddet — header eksikse satır düzeyi hata anlamsız.
        yield ParseError(
            source_row_number=0,
            field_name=None,
            error_code="MISSING_HEADERS",
            error_message=f"Missing required headers: {sorted(missing)}",
            row_data={"present_headers": sorted(csv_headers)},
        )
        return

    column_specs_by_csv_header: dict[str, ColumnSpec] = {
        c.csv_header: c for c in config.columns if c.csv_header in csv_headers
    }

    for idx, row in enumerate(reader, start=1):
        coerced: dict[str, Any] = {}
        first_error: ParseError | None = None

        for csv_header, spec in column_specs_by_csv_header.items():
            raw = row.get(csv_header)
            try:
                coerced[spec.db_column] = _coerce_value(spec, raw)
            except CoerceError as exc:
                if first_error is None:
                    first_error = ParseError(
                        source_row_number=idx,
                        field_name=spec.db_column,
                        error_code=exc.code,
                        error_message=str(exc),
                        row_data=dict(row),
                    )
                # Devamı atla — ilk hata satırı geçersiz yapar; satır verisi
                # zaten import_errors'a row_data olarak yazılır.

        if first_error is not None:
            yield first_error
            continue

        if config.post_coerce is not None:
            coerced = config.post_coerce(coerced)

        yield ParsedRow(source_row_number=idx, data=coerced)
