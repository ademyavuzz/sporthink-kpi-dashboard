"""CSV parser unit testleri — coerce + ParseError edge case'leri."""

from __future__ import annotations

import io
from datetime import date, datetime
from decimal import Decimal

from app.parsers.csv_parser import _coerce_value, parse_csv
from app.parsers.types import ColumnSpec, ParsedRow, ParseError, SourceConfig


def test_coerce_str_strips_whitespace():
    spec = ColumnSpec("name", "name", "str", required=True)
    assert _coerce_value(spec, "  hello  ") == "hello"


def test_coerce_int_valid():
    spec = ColumnSpec("count", "count", "int", required=True)
    assert _coerce_value(spec, "42") == 42


def test_coerce_decimal_valid():
    spec = ColumnSpec("price", "price", "decimal", required=True)
    assert _coerce_value(spec, "12.50") == Decimal("12.50")


def test_coerce_date_iso():
    spec = ColumnSpec("d", "d", "date_iso", required=True)
    assert _coerce_value(spec, "2025-03-15") == date(2025, 3, 15)


def test_coerce_date_yyyymmdd():
    spec = ColumnSpec("d", "d", "date_yyyymmdd", required=True)
    assert _coerce_value(spec, "20250315") == date(2025, 3, 15)


def test_coerce_datetime_with_t_separator():
    spec = ColumnSpec("d", "d", "datetime_iso", required=True)
    assert _coerce_value(spec, "2025-03-15T10:30:00") == datetime(2025, 3, 15, 10, 30, 0)


def test_coerce_bool_true_variants():
    spec = ColumnSpec("flag", "flag", "bool", required=False, default=False)
    for v in ("true", "True", "1", "yes", "evet"):
        assert _coerce_value(spec, v) is True
    for v in ("false", "0", "no", "hayır"):
        assert _coerce_value(spec, v) is False
    # Boş string optional bool'da default'a düşer
    assert _coerce_value(spec, "") is False


def test_coerce_enum_str_lowercases():
    spec = ColumnSpec(
        "status",
        "status",
        "enum_str",
        required=True,
        allowed_values=frozenset({"active", "paused"}),
    )
    assert _coerce_value(spec, "ACTIVE") == "active"


def test_coerce_enum_str_rejects_invalid():
    import pytest

    from app.parsers.csv_parser import CoerceError

    spec = ColumnSpec(
        "status",
        "status",
        "enum_str",
        required=True,
        allowed_values=frozenset({"active"}),
    )
    with pytest.raises(CoerceError) as exc_info:
        _coerce_value(spec, "unknown")
    assert exc_info.value.code == "INVALID_ENUM"


def test_coerce_required_empty_raises():
    import pytest

    from app.parsers.csv_parser import CoerceError

    spec = ColumnSpec("name", "name", "str", required=True)
    with pytest.raises(CoerceError) as exc:
        _coerce_value(spec, "")
    assert exc.value.code == "REQUIRED"


def test_coerce_optional_empty_returns_default():
    spec = ColumnSpec("city", "city", "str", required=False, default="Istanbul")
    assert _coerce_value(spec, "") == "Istanbul"


def test_parse_csv_missing_headers_yields_single_error():
    config = SourceConfig(
        name="test",
        target_table="test",
        columns=[
            ColumnSpec("sku", "sku", "str", required=True),
            ColumnSpec("name", "name", "str", required=True),
        ],
        dedup_keys=["sku"],
    )
    csv = "sku\nA\nB\n"
    items = list(parse_csv(io.StringIO(csv), config))
    assert len(items) == 1
    assert isinstance(items[0], ParseError)
    assert items[0].error_code == "MISSING_HEADERS"


def test_parse_csv_happy_path():
    config = SourceConfig(
        name="test",
        target_table="test",
        columns=[
            ColumnSpec("sku", "sku", "str", required=True),
            ColumnSpec("price", "price", "decimal", required=True),
        ],
        dedup_keys=["sku"],
    )
    csv = "sku,price\nA-1,10.50\nA-2,25.00\n"
    items = list(parse_csv(io.StringIO(csv), config))
    valid = [i for i in items if isinstance(i, ParsedRow)]
    assert len(valid) == 2
    assert valid[0].data == {"sku": "A-1", "price": Decimal("10.50")}


def test_parse_csv_invalid_row_collected_not_aborted():
    config = SourceConfig(
        name="test",
        target_table="test",
        columns=[
            ColumnSpec("count", "count", "int", required=True),
        ],
        dedup_keys=[],
    )
    csv = "count\n5\nNotANumber\n10\n"
    items = list(parse_csv(io.StringIO(csv), config))
    valid = [i for i in items if isinstance(i, ParsedRow)]
    errors = [i for i in items if isinstance(i, ParseError)]
    # 2 geçerli, 1 hata — ama akış durmadı
    assert len(valid) == 2
    assert len(errors) == 1
