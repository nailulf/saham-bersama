"""Tests for --daily-light date pre-flight, choice, and resolution."""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestRecentTradingDates:
    def test_includes_today_when_weekday(self):
        from run_all import _recent_trading_dates
        # 2026-06-12 is a Friday
        assert _recent_trading_dates(1, date(2026, 6, 12)) == [date(2026, 6, 12)]

    def test_two_days_are_today_and_prev_weekday(self):
        from run_all import _recent_trading_dates
        # Fri 2026-06-12 + Thu 2026-06-11
        assert _recent_trading_dates(2, date(2026, 6, 12)) == [
            date(2026, 6, 11), date(2026, 6, 12),
        ]

    def test_weekend_anchor_resolves_to_latest_weekday(self):
        from run_all import _recent_trading_dates
        # Sun 2026-06-14 -> latest weekday <= anchor is Fri 2026-06-12
        assert _recent_trading_dates(1, date(2026, 6, 14)) == [date(2026, 6, 12)]

    def test_two_days_span_a_weekend(self):
        from run_all import _recent_trading_dates
        # Mon 2026-06-15 + prev weekday Fri 2026-06-12
        assert _recent_trading_dates(2, date(2026, 6, 15)) == [
            date(2026, 6, 12), date(2026, 6, 15),
        ]

    def test_zero_or_negative_n_returns_empty(self):
        from run_all import _recent_trading_dates
        from datetime import date
        assert _recent_trading_dates(0, date(2026, 6, 12)) == []
        assert _recent_trading_dates(-1, date(2026, 6, 12)) == []


class TestTradingDatesBetween:
    def test_excludes_after_includes_through(self):
        from run_all import _trading_dates_between
        # after Tue 6-09, through Fri 6-12 -> Wed, Thu, Fri
        assert _trading_dates_between(date(2026, 6, 9), date(2026, 6, 12)) == [
            date(2026, 6, 10), date(2026, 6, 11), date(2026, 6, 12),
        ]

    def test_empty_when_up_to_date(self):
        from run_all import _trading_dates_between
        assert _trading_dates_between(date(2026, 6, 12), date(2026, 6, 12)) == []

    def test_skips_weekends(self):
        from run_all import _trading_dates_between
        # after Fri 6-12, through Mon 6-15 -> only Mon (Sat/Sun skipped)
        assert _trading_dates_between(date(2026, 6, 12), date(2026, 6, 15)) == [
            date(2026, 6, 15),
        ]

    def test_inverted_range_returns_empty(self):
        from run_all import _trading_dates_between
        from datetime import date
        # after later than through (e.g. clock/timezone drift) -> empty, no error
        assert _trading_dates_between(date(2026, 6, 15), date(2026, 6, 12)) == []
