"""Tests for the canonical CAGR helpers in ratio_enricher (see docs/cagr-spec.md).

These mirror web/src/lib/calculations/cagr.ts — the SHARED_FIXTURES expected
values are also asserted by the Node parity check so both implementations agree.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scrapers.ratio_enricher import _cagr, _growth_rate, _series_cagr


def _series(key, pairs):
    """Build an annual series [{year, key: value}, ...] from (year, value) pairs."""
    return [{"year": y, key: v} for y, v in pairs]


class TestCagr:
    def test_basic_growth(self):
        # 100 → 200 over 5 years ≈ 14.87%
        assert _cagr(100, 200, 5) == 14.8698

    def test_flat_is_zero(self):
        assert _cagr(100, 100, 5) == 0.0

    def test_decline_is_negative(self):
        assert _cagr(100, 50, 5) < 0

    def test_invalid(self):
        assert _cagr(None, 100, 3) is None
        assert _cagr(100, None, 3) is None
        assert _cagr(100, 0, 3) is None
        assert _cagr(0, 100, 3) is None
        assert _cagr(100, 200, 0) is None


class TestGrowthRate:
    def test_positive_matches_cagr(self):
        assert _growth_rate(100, 200, 5) == _cagr(100, 200, 5)

    def test_negative_to_positive_turnaround(self):
        # -100 → +200 over 2 years: (1 + 300/100)^(1/2) - 1 = 2 - 1 = 100%
        assert _growth_rate(-100, 200, 2) == 100.0

    def test_zero_start_is_none(self):
        assert _growth_rate(0, 200, 3) is None

    def test_unrecoverable_base_is_none(self):
        # -100 → -300: total = -200/100 = -2, base = -1 ≤ 0 → None
        assert _growth_rate(-100, -300, 3) is None


class TestSeriesCagr:
    def test_contiguous_annual_revenue(self):
        # 10%/yr; 3yr window [2021..2024] span 3 → 10%
        s = _series("revenue", [(2020, 100), (2021, 110), (2022, 121), (2023, 133.1), (2024, 146.41)])
        assert _series_cagr(s, "revenue", 3) == 10.0

    def test_five_year_uses_actual_span(self):
        # Only 5 points spanning 4 years → cagr_5yr computed over span 4, still 10%
        s = _series("revenue", [(2020, 100), (2021, 110), (2022, 121), (2023, 133.1), (2024, 146.41)])
        assert _series_cagr(s, "revenue", 5) == 10.0

    def test_year_gap(self):
        # 2019→2024 with a gap: 3yr window has <2 points → None; 5yr spans 5 years
        s = _series("revenue", [(2019, 100), (2024, 200)])
        assert _series_cagr(s, "revenue", 3) is None
        assert _series_cagr(s, "revenue", 5) == 14.8698

    def test_unsorted_input_is_handled_by_window(self):
        # window picks earliest-in-window; caller sorts, but verify end = max year
        s = _series("revenue", [(2024, 146.41), (2021, 110), (2023, 133.1), (2022, 121), (2020, 100)])
        s.sort(key=lambda r: r["year"])
        assert _series_cagr(s, "revenue", 3) == 10.0

    def test_ocf_negative_turnaround_uses_growth_rate(self):
        # OCF -100 (2022) → 200 (2024), span 2 → 100%
        s = _series("operating_cash_flow", [(2022, -100), (2023, 50), (2024, 200)])
        assert _series_cagr(s, "operating_cash_flow", 3, allow_negative=True) == 100.0

    def test_insufficient_data(self):
        assert _series_cagr(_series("revenue", [(2024, 100)]), "revenue", 3) is None
        assert _series_cagr([], "revenue", 3) is None
