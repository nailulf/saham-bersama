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


class TestDaysBehind:
    def test_counts_weekdays_between_last_and_today(self):
        from run_all import _days_behind
        # last Tue 6-09, today Fri 6-12 -> Wed/Thu/Fri = 3
        assert _days_behind(date(2026, 6, 9), date(2026, 6, 12)) == 3

    def test_zero_when_current(self):
        from run_all import _days_behind
        assert _days_behind(date(2026, 6, 12), date(2026, 6, 12)) == 0

    def test_none_when_no_data(self):
        from run_all import _days_behind
        assert _days_behind(None, date(2026, 6, 12)) is None


class TestFreshness:
    def test_queries_each_table_max_date(self, monkeypatch):
        import run_all
        calls = []

        def fake_max_date(table, col):
            calls.append((table, col))
            return {
                ("idx_stock_summary", "date"): date(2026, 6, 10),
                ("broker_flow", "trade_date"): date(2026, 6, 9),
                ("daily_prices", "date"): date(2026, 6, 11),
            }[(table, col)]

        monkeypatch.setattr(run_all, "_max_date", fake_max_date)
        fresh = run_all._daily_light_freshness(today=date(2026, 6, 12))
        assert fresh == {
            "idx_stock_summary": date(2026, 6, 10),
            "broker_flow": date(2026, 6, 9),
            "daily_prices": date(2026, 6, 11),
        }
        assert set(calls) == {
            ("idx_stock_summary", "date"),
            ("broker_flow", "trade_date"),
            ("daily_prices", "date"),
        }


class TestMaxDate:
    def _patch_client(self, monkeypatch, rows):
        import utils.supabase_client as sc

        class _Resp:
            data = rows

        class _Q:
            def select(self, *a, **k):
                return self

            def order(self, *a, **k):
                return self

            def limit(self, *a, **k):
                return self

            def execute(self):
                return _Resp()

        class _Client:
            def table(self, *a, **k):
                return _Q()

        monkeypatch.setattr(sc, "get_client", lambda: _Client())

    def test_empty_table_returns_none(self, monkeypatch):
        from run_all import _max_date
        self._patch_client(monkeypatch, [])
        assert _max_date("daily_prices", "date") is None

    def test_iso_timestamp_string_is_parsed(self, monkeypatch):
        from run_all import _max_date
        # Supabase may return TIMESTAMPTZ as an ISO string; the [:10] slice handles it.
        self._patch_client(monkeypatch, [{"date": "2026-06-11T00:00:00+07:00"}])
        assert _max_date("daily_prices", "date") == date(2026, 6, 11)

    def test_null_column_returns_none(self, monkeypatch):
        from run_all import _max_date
        self._patch_client(monkeypatch, [{"date": None}])
        assert _max_date("daily_prices", "date") is None
