"""Tests for --daily-light date pre-flight, choice, and resolution."""
import os
import subprocess
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

PYTHON = sys.executable
RUN_ALL = os.path.join(os.path.dirname(__file__), "..", "run_all.py")


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


class TestRecommendMode:
    def test_recommends_2d_when_gap_small(self):
        from run_all import _recommend_mode
        fresh = {
            "idx_stock_summary": date(2026, 6, 11),
            "broker_flow": date(2026, 6, 11),
            "daily_prices": date(2026, 6, 11),
        }
        assert _recommend_mode(fresh, date(2026, 6, 12)) == "2d"

    def test_recommends_gap_when_gap_large(self):
        from run_all import _recommend_mode
        fresh = {
            "idx_stock_summary": date(2026, 6, 3),  # >2 weekdays behind
            "broker_flow": date(2026, 6, 11),
            "daily_prices": date(2026, 6, 11),
        }
        assert _recommend_mode(fresh, date(2026, 6, 12)) == "gap"

    def test_recommends_gap_when_table_empty(self):
        from run_all import _recommend_mode
        fresh = {"idx_stock_summary": None, "broker_flow": date(2026, 6, 11),
                 "daily_prices": date(2026, 6, 11)}
        assert _recommend_mode(fresh, date(2026, 6, 12)) == "gap"

    def test_recommends_2d_at_exact_2day_boundary(self):
        from run_all import _recommend_mode
        # idx last Wed 6-10, today Fri 6-12 -> 2 weekdays behind (Thu, Fri) -> "2d"
        fresh = {"idx_stock_summary": date(2026, 6, 10), "broker_flow": date(2026, 6, 11),
                 "daily_prices": date(2026, 6, 11)}
        assert _recommend_mode(fresh, date(2026, 6, 12)) == "2d"


class TestResolveSinceDates:
    FRESH = {
        "idx_stock_summary": date(2026, 6, 10),
        "broker_flow": date(2026, 6, 9),
        "daily_prices": date(2026, 6, 11),
    }

    def test_today_same_window_both_floor_today(self):
        from run_all import _resolve_since_dates
        plan = _resolve_since_dates("today", self.FRESH, date(2026, 6, 12))
        assert plan.idx_dates == [date(2026, 6, 12)]
        assert plan.mf_dates == [date(2026, 6, 12)]
        assert plan.start_floor == date(2026, 6, 12)

    def test_2d_same_window_floor_min(self):
        from run_all import _resolve_since_dates
        plan = _resolve_since_dates("2d", self.FRESH, date(2026, 6, 12))
        assert plan.idx_dates == [date(2026, 6, 11), date(2026, 6, 12)]
        assert plan.mf_dates == [date(2026, 6, 11), date(2026, 6, 12)]
        assert plan.start_floor == date(2026, 6, 11)

    def test_gap_per_table_floor_none(self):
        from run_all import _resolve_since_dates
        plan = _resolve_since_dates("gap", self.FRESH, date(2026, 6, 12))
        # idx last 6-10 -> 6-11, 6-12 ; broker_flow last 6-9 -> 6-10, 6-11, 6-12
        assert plan.idx_dates == [date(2026, 6, 11), date(2026, 6, 12)]
        assert plan.mf_dates == [date(2026, 6, 10), date(2026, 6, 11), date(2026, 6, 12)]
        assert plan.start_floor is None

    def test_gap_falls_back_to_2d_when_table_empty(self):
        from run_all import _resolve_since_dates
        fresh = {"idx_stock_summary": None, "broker_flow": date(2026, 6, 9),
                 "daily_prices": date(2026, 6, 11)}
        plan = _resolve_since_dates("gap", fresh, date(2026, 6, 12))
        assert plan.idx_dates == [date(2026, 6, 11), date(2026, 6, 12)]  # 2d fallback
        # broker_flow has data -> its own gap range, not the fallback
        assert plan.mf_dates == [date(2026, 6, 10), date(2026, 6, 11), date(2026, 6, 12)]

    def test_today_on_weekend_resolves_to_latest_weekday(self):
        from run_all import _resolve_since_dates
        # Sun 2026-06-14 -> latest weekday Fri 2026-06-12
        plan = _resolve_since_dates("today", self.FRESH, date(2026, 6, 14))
        assert plan.idx_dates == [date(2026, 6, 12)]
        assert plan.start_floor == date(2026, 6, 12)

    def test_unknown_mode_raises(self):
        import pytest
        from run_all import _resolve_since_dates
        with pytest.raises(ValueError):
            _resolve_since_dates("bogus", self.FRESH, date(2026, 6, 12))


class TestChooseMode:
    FRESH = {"idx_stock_summary": date(2026, 6, 10), "broker_flow": date(2026, 6, 9),
             "daily_prices": date(2026, 6, 11)}

    def test_flag_takes_precedence_no_prompt(self, monkeypatch):
        import run_all
        # Even on a TTY, an explicit flag must not prompt.
        monkeypatch.setattr(run_all.sys.stdin, "isatty", lambda: True)
        monkeypatch.setattr(run_all, "_prompt_daily_light_mode",
                            lambda *a, **k: pytest.fail("should not prompt"))
        assert run_all._choose_daily_light_mode("gap", self.FRESH, date(2026, 6, 12)) == "gap"

    def test_non_tty_defaults_to_2d(self, monkeypatch):
        import run_all
        monkeypatch.setattr(run_all.sys.stdin, "isatty", lambda: False)
        assert run_all._choose_daily_light_mode(None, self.FRESH, date(2026, 6, 12)) == "2d"

    def test_tty_no_flag_calls_prompt(self, monkeypatch):
        import run_all
        monkeypatch.setattr(run_all.sys.stdin, "isatty", lambda: True)
        monkeypatch.setattr(run_all, "_prompt_daily_light_mode", lambda *a, **k: "today")
        assert run_all._choose_daily_light_mode(None, self.FRESH, date(2026, 6, 12)) == "today"


class TestPromptMode:
    FRESH = {"idx_stock_summary": date(2026, 6, 10), "broker_flow": date(2026, 6, 9),
             "daily_prices": date(2026, 6, 11)}

    def test_choice_1_today(self, monkeypatch):
        import run_all
        monkeypatch.setattr("builtins.input", lambda *a, **k: "1")
        assert run_all._prompt_daily_light_mode(self.FRESH, date(2026, 6, 12)) == "today"

    def test_choice_2_2d(self, monkeypatch):
        import run_all
        monkeypatch.setattr("builtins.input", lambda *a, **k: "2")
        assert run_all._prompt_daily_light_mode(self.FRESH, date(2026, 6, 12)) == "2d"

    def test_choice_3_gap(self, monkeypatch):
        import run_all
        monkeypatch.setattr("builtins.input", lambda *a, **k: "3")
        assert run_all._prompt_daily_light_mode(self.FRESH, date(2026, 6, 12)) == "gap"

    def test_empty_uses_recommended(self, monkeypatch):
        import run_all
        # FRESH: broker_flow 6-09 -> >2 weekdays behind on 6-12 -> recommended "gap"
        monkeypatch.setattr("builtins.input", lambda *a, **k: "")
        assert run_all._prompt_daily_light_mode(self.FRESH, date(2026, 6, 12)) == "gap"

    def test_garbage_uses_recommended(self, monkeypatch):
        import run_all
        monkeypatch.setattr("builtins.input", lambda *a, **k: "xyz")
        assert run_all._prompt_daily_light_mode(self.FRESH, date(2026, 6, 12)) == "gap"


class TestSinceFlag:
    def test_since_flag_in_help(self):
        result = subprocess.run([PYTHON, RUN_ALL, "--help"],
                                capture_output=True, text=True, timeout=30)
        assert result.returncode == 0
        assert "--since" in result.stdout

    def test_since_rejects_bad_value(self):
        result = subprocess.run([PYTHON, RUN_ALL, "--daily-light", "--since", "bogus"],
                                capture_output=True, text=True, timeout=30)
        assert result.returncode != 0
        assert "since" in result.stderr.lower()
