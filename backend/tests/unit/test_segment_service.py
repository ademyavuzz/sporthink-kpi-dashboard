"""Segment service rule builder + RFM label testleri."""
from __future__ import annotations

import pytest

from app.services.segment_service import _build_rule_clause, _rfm_segment_label


def test_simple_equality_rule_compiles():
    rule = {"field": "city", "op": "==", "value": "Istanbul"}
    clause = _build_rule_clause(rule)
    # SQLAlchemy clause objesi — repr içinde alan adı olmalı
    assert "city" in str(clause)


def test_in_operator():
    rule = {"field": "city", "op": "IN", "value": ["Istanbul", "Izmir"]}
    clause = _build_rule_clause(rule)
    assert "IN" in str(clause).upper()


def test_compound_and_rule():
    rule = {
        "op": "AND",
        "rules": [
            {"field": "total_revenue", "op": ">=", "value": 5000},
            {"field": "total_orders", "op": ">=", "value": 2},
        ],
    }
    clause = _build_rule_clause(rule)
    assert "AND" in str(clause).upper()


def test_unknown_field_raises():
    with pytest.raises(ValueError, match="Unknown field"):
        _build_rule_clause({"field": "nonexistent_col", "op": "==", "value": 1})


def test_unknown_operator_raises():
    with pytest.raises(ValueError, match="Unknown operator"):
        _build_rule_clause({"field": "total_orders", "op": "**", "value": 1})


# RFM label tests


def test_rfm_champion_high_all():
    assert _rfm_segment_label(5, 5, 5) == "Champions"
    assert _rfm_segment_label(4, 4, 4) == "Champions"


def test_rfm_loyal_high_fm_lower_r():
    assert _rfm_segment_label(2, 5, 4) in ("Loyal", "At Risk")  # M ≥ 3, F ≥ 4
    assert _rfm_segment_label(3, 4, 4) == "Loyal"


def test_rfm_at_risk():
    assert _rfm_segment_label(1, 4, 4) == "At Risk"
    assert _rfm_segment_label(2, 4, 3) == "At Risk"


def test_rfm_lost_extreme_low():
    assert _rfm_segment_label(1, 1, 1) == "Lost"
    assert _rfm_segment_label(1, 2, 2) == "Lost"


def test_rfm_new_high_r_low_f():
    assert _rfm_segment_label(5, 1, 3) == "New"
    assert _rfm_segment_label(4, 1, 2) == "New"


def test_rfm_default_other():
    # Hiçbir kategoriye girmeyen kombinasyon
    assert _rfm_segment_label(2, 2, 1) == "Other"
