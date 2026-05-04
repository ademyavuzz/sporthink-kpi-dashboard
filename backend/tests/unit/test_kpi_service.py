"""KPI service unit testleri — pure helper'lar (DB'siz)."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.services import kpi_service


class TestComputeComparisonPeriod:
    def test_sequential_30day_range(self):
        prev_from, prev_to = kpi_service.compute_comparison_period(
            date(2025, 1, 1), date(2025, 1, 30), "sequential"
        )
        # Önceki 30 gün: 2 Aralık - 31 Aralık 2024
        assert prev_to == date(2024, 12, 31)
        assert (prev_to - prev_from).days == 29  # 30 gün dahil

    def test_yoy_returns_same_period_previous_year(self):
        prev_from, prev_to = kpi_service.compute_comparison_period(
            date(2025, 4, 1), date(2025, 4, 30), "yoy"
        )
        assert prev_from == date(2024, 4, 1)
        assert prev_to == date(2024, 4, 30)

    def test_sequential_single_day(self):
        prev_from, prev_to = kpi_service.compute_comparison_period(
            date(2025, 6, 15), date(2025, 6, 15), "sequential"
        )
        assert prev_from == date(2025, 6, 14)
        assert prev_to == date(2025, 6, 14)


class TestTrend:
    def test_positive_change_normal_kpi(self):
        change, direction, is_pos = kpi_service._trend(
            Decimal("120"), Decimal("100"), "revenue"
        )
        assert change == Decimal("20.00")
        assert direction == "up"
        assert is_pos is True

    def test_positive_change_inverse_kpi(self):
        # bounce_rate yukarı gitmek = kötü
        change, direction, is_pos = kpi_service._trend(
            Decimal("60"), Decimal("50"), "bounce_rate"
        )
        assert direction == "up"
        assert is_pos is False

    def test_negative_change_inverse_kpi(self):
        # bounce_rate aşağı gitmek = iyi
        change, direction, is_pos = kpi_service._trend(
            Decimal("40"), Decimal("50"), "bounce_rate"
        )
        assert direction == "down"
        assert is_pos is True

    def test_zero_previous_returns_none_change(self):
        change, direction, _ = kpi_service._trend(
            Decimal("100"), Decimal("0"), "revenue"
        )
        assert change is None

    def test_none_current_returns_flat(self):
        _, direction, is_pos = kpi_service._trend(None, Decimal("50"), "revenue")
        assert direction == "flat"
        assert is_pos is True


class TestSafeDiv:
    def test_normal(self):
        assert kpi_service._safe_div(Decimal("10"), Decimal("4")) == Decimal("2.5")

    def test_zero_divisor_returns_none(self):
        assert kpi_service._safe_div(Decimal("10"), Decimal("0")) is None
