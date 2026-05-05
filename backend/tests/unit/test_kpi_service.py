"""KPI service unit testleri — pure helper'lar (DB'siz)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

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
        change, direction, is_pos = kpi_service._trend(Decimal("120"), Decimal("100"), "revenue")
        assert change == Decimal("20.00")
        assert direction == "up"
        assert is_pos is True

    def test_positive_change_inverse_kpi(self):
        # bounce_rate yukarı gitmek = kötü
        change, direction, is_pos = kpi_service._trend(Decimal("60"), Decimal("50"), "bounce_rate")
        assert direction == "up"
        assert is_pos is False

    def test_negative_change_inverse_kpi(self):
        # bounce_rate aşağı gitmek = iyi
        change, direction, is_pos = kpi_service._trend(Decimal("40"), Decimal("50"), "bounce_rate")
        assert direction == "down"
        assert is_pos is True

    def test_zero_previous_returns_none_change(self):
        change, direction, _ = kpi_service._trend(Decimal("100"), Decimal("0"), "revenue")
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


class TestBuildCampaignMetric:
    """`_build_campaign_metric` raw SQL satırından CampaignMetric türetmeli;
    sıfır impressions/clicks/spend durumlarında ratio KPI'lar None gelmeli."""

    class _Row:
        """Raw SQL row stand-in — only attribute access, mimics SQLAlchemy Row."""

        def __init__(self, **kw):
            self.__dict__.update(kw)

    def test_normal_row_computes_ctr_cpc_roas(self):
        row = self._Row(
            pk_id=42,
            campaign_name="SP_Test_Campaign",
            impressions=10_000,
            clicks=200,
            spend=Decimal("500.00"),
            conversions=Decimal("10"),
            conversions_value=Decimal("3000.00"),
        )
        m = kpi_service._build_campaign_metric(row, "meta")
        assert m.campaign_id == 42
        assert m.campaign_name == "SP_Test_Campaign"
        assert m.platform == "meta"
        assert m.impressions == 10_000
        assert m.clicks == 200
        assert m.spend == Decimal("500.00")
        assert m.conversions == Decimal("10")
        assert m.conversions_value == Decimal("3000.00")
        # 200 / 10000 * 100 = 2.0
        assert m.ctr == Decimal("2.0000")
        # 500 / 200 = 2.5
        assert m.cpc == Decimal("2.5000")
        # 3000 / 500 = 6.0
        assert m.roas == Decimal("6.0000")

    def test_zero_impressions_returns_none_ctr(self):
        row = self._Row(
            pk_id=1,
            campaign_name="Test",
            impressions=0,
            clicks=0,
            spend=Decimal("100"),
            conversions=Decimal("0"),
            conversions_value=Decimal("0"),
        )
        m = kpi_service._build_campaign_metric(row, "google")
        assert m.ctr is None
        assert m.cpc is None  # clicks=0
        assert m.roas == Decimal("0.0000")  # spend>0, conv_value=0 → 0/100 = 0

    def test_zero_spend_returns_none_roas(self):
        # Spend=0 ama clicks var → CPC = 0/clicks = 0 (matematiksel olarak doğru),
        # ROAS = ad_revenue/spend → 0 bölme → None.
        row = self._Row(
            pk_id=1,
            campaign_name="Test",
            impressions=1000,
            clicks=10,
            spend=Decimal("0"),
            conversions=Decimal("0"),
            conversions_value=Decimal("0"),
        )
        m = kpi_service._build_campaign_metric(row, "meta")
        assert m.roas is None
        assert m.cpc == Decimal("0.0000")

    def test_none_aggregates_treated_as_zero(self):
        """SQL SUM() boş sonuçta None döner; build_campaign_metric bunu 0 saymalı."""
        row = self._Row(
            pk_id=99,
            campaign_name=None,
            impressions=None,
            clicks=None,
            spend=None,
            conversions=None,
            conversions_value=None,
        )
        m = kpi_service._build_campaign_metric(row, "google")
        assert m.impressions == 0
        assert m.clicks == 0
        assert m.spend == Decimal("0.00")
        assert m.ctr is None
        assert m.cpc is None
        assert m.roas is None
