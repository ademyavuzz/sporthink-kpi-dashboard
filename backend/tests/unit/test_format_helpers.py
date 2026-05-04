"""Cache key + import_service helper testleri."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.core import cache_keys
from app.services.import_service import _jsonify


class TestCacheKeys:
    def test_kpi_summary_deterministic(self):
        k1 = cache_keys.kpi_summary(
            date_from=date(2025, 1, 1), date_to=date(2025, 1, 31)
        )
        k2 = cache_keys.kpi_summary(
            date_from=date(2025, 1, 1), date_to=date(2025, 1, 31)
        )
        assert k1 == k2

    def test_kpi_summary_different_for_different_dates(self):
        k1 = cache_keys.kpi_summary(
            date_from=date(2025, 1, 1), date_to=date(2025, 1, 31)
        )
        k2 = cache_keys.kpi_summary(
            date_from=date(2025, 2, 1), date_to=date(2025, 2, 28)
        )
        assert k1 != k2

    def test_user_perms_includes_id(self):
        assert cache_keys.user_perms(42) == "user_perms:42"

    def test_invalidation_pattern(self):
        assert cache_keys.kpi_invalidation_pattern() == "kpi:*"


class TestJsonify:
    def test_decimal_to_string(self):
        assert _jsonify(Decimal("12.34")) == "12.34"

    def test_date_to_iso(self):
        from datetime import datetime as dt

        assert _jsonify(dt(2025, 1, 15, 10, 30)) == "2025-01-15T10:30:00"

    def test_dict_recursive(self):
        result = _jsonify({"price": Decimal("10"), "name": "X"})
        assert result == {"price": "10", "name": "X"}

    def test_list_recursive(self):
        assert _jsonify([Decimal("1"), Decimal("2")]) == ["1", "2"]

    def test_passthrough_primitives(self):
        assert _jsonify(42) == 42
        assert _jsonify("hello") == "hello"
        assert _jsonify(None) is None
