"""
Stage 4: Context Builder — Assemble the 11-block AI context bundle.

Blocks: data_quality, fundamentals, valuation, smart_money,
shareholders, health_score, sector_context, macro_context,
technical_context (Block 9 — Wyckoff, RSI, MACD, SMAs, market phase),
quarterly_trend (Block 10), dividend_profile (Block 11)

Includes Python ports of:
- signal-confidence.ts → smart money phase detection
- health-score.ts → 7-metric health system
- valuation.ts → Graham number + DCF 3-scenario

FRD reference: Section 4 (AI Context Bundle), Section 5 (context_builder.py)
"""

from __future__ import annotations

import json
import math
import logging
import os
import time
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from scripts.scoring.schema import NormalizedMetric, StockScore, ContextBundle
from scripts.scoring.config import (
    health_thresholds,
    valuation_config,
    get_macro_context,
    METRIC_MAP,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Health score (Python port of health-score.ts)
# ---------------------------------------------------------------------------

def compute_health_score(latest_annual: dict, is_bank: bool = False) -> dict:
    """
    Compute 7-metric health score. Returns {total, grade, components}.
    Port of web/src/lib/calculations/health-score.ts
    """
    ht = health_thresholds()
    components = {}

    def _score_metric(metric: str, value, invert: bool = False) -> dict:
        if value is None:
            return {"value": None, "score": None, "flag": "na"}
        t = ht.get(metric)
        if t is None:
            return {"value": value, "score": None, "flag": "na"}
        if not invert:
            if value >= t["green"]:
                flag = "green"
            elif value >= t["yellow"]:
                flag = "yellow"
            else:
                flag = "red"
        else:
            if value <= t["green"]:
                flag = "green"
            elif value <= t["yellow"]:
                flag = "yellow"
            else:
                flag = "red"
        score_val = {"green": 15, "yellow": 10, "red": 3}.get(flag, 0)
        return {"value": round(value, 2) if value else value, "score": score_val, "max": 15, "flag": flag}

    for metric in ["roe", "net_margin", "gross_margin", "roa"]:
        val = latest_annual.get(metric)
        components[metric] = _score_metric(metric, val)

    # Current ratio — exempt for banks
    if is_bank:
        components["current_ratio"] = {"value": None, "score": None, "exempt": True}
    else:
        components["current_ratio"] = _score_metric("current_ratio", latest_annual.get("current_ratio"))

    # Debt/equity — inverted (lower is better), exempt display for banks but still scored if available
    de_val = latest_annual.get("debt_to_equity")
    if is_bank and de_val is None:
        components["debt_to_equity"] = {"value": None, "score": None, "exempt": True}
    else:
        components["debt_to_equity"] = _score_metric("debt_to_equity", de_val, invert=True)

    # Free cash flow — sign-based
    fcf = latest_annual.get("free_cash_flow")
    if fcf is None:
        components["free_cash_flow"] = {"value": None, "score": None, "flag": "na"}
    else:
        flag = "green" if fcf >= 0 else "red"
        components["free_cash_flow"] = {"value": fcf, "score": 15 if flag == "green" else 0, "max": 20, "flag": flag}

    # Total
    total_score = sum(c.get("score", 0) or 0 for c in components.values())
    max_score = sum(c.get("max", 15) for c in components.values() if not c.get("exempt"))
    health_pct = round(total_score / max_score * 100) if max_score > 0 else 0

    if health_pct >= 80:
        grade = "Sehat"
    elif health_pct >= 60:
        grade = "Cukup Sehat"
    elif health_pct >= 40:
        grade = "Perlu Perhatian"
    else:
        grade = "Tidak Sehat"

    return {"total": health_pct, "grade": grade, "components": components}


# ---------------------------------------------------------------------------
# Valuation (Python port of valuation.ts)
# ---------------------------------------------------------------------------

def compute_graham_number(eps: Optional[float], bvps: Optional[float]) -> Optional[float]:
    """Graham Number = sqrt(22.5 × EPS × BVPS). Returns None if inputs invalid."""
    vc = valuation_config()
    if not eps or eps <= 0 or not bvps or bvps <= 0:
        return None
    return math.sqrt(vc["graham_constant"] * eps * bvps)


def compute_dcf_scenarios(
    fcf: float,
    shares: int,
    base_growth_pct: float,
    current_price: Optional[float] = None,
) -> Dict[str, Optional[int]]:
    """
    Compute 3-scenario DCF (bear/base/bull).
    Returns {dcf_bear, dcf_base, dcf_bull, dcf_base_mos}.
    """
    vc = valuation_config()
    if not fcf or fcf <= 0 or not shares or shares <= 0:
        return {"dcf_bear": None, "dcf_base": None, "dcf_bull": None, "dcf_base_mos": None}

    wacc = vc["base_wacc"]
    tg = vc["terminal_growth"]
    var = vc["scenario_variation"]
    proj_years = vc["dcf_projection_years"]

    results = {}
    for label, g_mul, w_mul in [("bear", 1 - var, 1 + var), ("base", 1, 1), ("bull", 1 + var, 1 - var)]:
        g = base_growth_pct * g_mul / 100
        r = wacc * w_mul / 100
        gt = tg / 100

        if r <= gt:
            results[f"dcf_{label}"] = None
            continue

        total_pv = 0
        for t in range(1, proj_years + 1):
            proj_fcf = fcf * (1 + g) ** t
            total_pv += proj_fcf / (1 + r) ** t

        fcf_terminal = fcf * (1 + g) ** proj_years
        tv = (fcf_terminal * (1 + gt)) / (r - gt)
        total_pv += tv / (1 + r) ** proj_years

        results[f"dcf_{label}"] = round(total_pv / shares)

    # Margin of safety for base case
    dcf_base = results.get("dcf_base")
    if dcf_base and current_price and current_price > 0:
        results["dcf_base_mos"] = round((dcf_base - current_price) / dcf_base, 4)
    else:
        results["dcf_base_mos"] = None

    return results


# ---------------------------------------------------------------------------
# Smart money phase detection (simplified port of signal-confidence.ts)
# ---------------------------------------------------------------------------

def detect_smart_money_phase(
    asing_net: float,
    lokal_net: float,
    pemerintah_net: float,
) -> str:
    """Detect akumulasi / distribusi / netral from 30-day net flows."""
    net_flow = asing_net + lokal_net + pemerintah_net
    if net_flow > 0 and asing_net > 0:
        return "akumulasi"
    elif net_flow < 0 and asing_net < 0:
        return "distribusi"
    return "netral"


# ---------------------------------------------------------------------------
# IDR rounding for token reduction
# ---------------------------------------------------------------------------

def _round_idr_billions(val: Optional[float]) -> Optional[float]:
    if val is None:
        return None
    return round(val / 1e9, 1)


# ---------------------------------------------------------------------------
# Quarterly trend builder (Block 10)
# ---------------------------------------------------------------------------

def build_quarterly_trend(quarterly_rows: List[dict], n_quarters: int = 6) -> dict:
    """
    Block 10: quarterly_trend — recent quarterly momentum, TTM, QoQ/YoY changes.

    Args:
        quarterly_rows: rows from financials where quarter > 0, ordered desc by
                        (year DESC, quarter DESC). Should include at least 8 rows
                        to compute YoY comparisons.
        n_quarters:     number of recent quarters to show in the periods list.
    """
    if not quarterly_rows:
        return {}

    # Sort desc by (year, quarter) to guarantee order
    rows = sorted(quarterly_rows, key=lambda r: (r.get("year", 0), r.get("quarter", 0)), reverse=True)

    def _val(r, key, scale=1):
        v = r.get(key)
        return round(v / scale, 1) if v is not None else None

    def _pct_chg(curr, prev):
        if curr is None or prev is None or prev == 0:
            return None
        return round((curr - prev) / abs(prev) * 100, 1)

    # ── Periods table ────────────────────────────────────────────
    periods = []
    for r in rows[:n_quarters]:
        periods.append({
            "period":        f"{r.get('year')}Q{r.get('quarter')}",
            "revenue_b":     _val(r, "revenue",    1e9),
            "net_income_b":  _val(r, "net_income", 1e9),
            "net_margin_pct":_val(r, "net_margin"),
            "gross_margin_pct": _val(r, "gross_margin"),
            "operating_income_b": _val(r, "operating_income", 1e9),
            "eps":           _val(r, "eps"),
        })

    # ── TTM (Trailing Twelve Months = last 4 quarters) ───────────
    ttm_rows = rows[:4]
    ttm = {}
    if len(ttm_rows) == 4:
        rev_sum = sum(r.get("revenue") or 0 for r in ttm_rows)
        ni_sum  = sum(r.get("net_income") or 0 for r in ttm_rows)
        eps_sum = sum(r.get("eps") or 0 for r in ttm_rows)
        ttm = {
            "revenue_b":    round(rev_sum / 1e9, 0),
            "net_income_b": round(ni_sum  / 1e9, 0),
            "net_margin_pct": round(ni_sum / rev_sum * 100, 1) if rev_sum else None,
            "eps":          round(eps_sum, 0),
        }

    # ── Momentum: QoQ and YoY for latest quarter ────────────────
    momentum = {}
    if len(rows) >= 2:
        latest = rows[0]
        prev_q = rows[1]
        momentum["revenue_qoq_pct"]    = _pct_chg(latest.get("revenue"),    prev_q.get("revenue"))
        momentum["net_income_qoq_pct"] = _pct_chg(latest.get("net_income"), prev_q.get("net_income"))
        momentum["margin_qoq_bps"]     = (
            round(((latest.get("net_margin") or 0) - (prev_q.get("net_margin") or 0)) * 100, 0)
            if latest.get("net_margin") is not None and prev_q.get("net_margin") is not None else None
        )

    # YoY: find same quarter from a year ago
    latest_y = rows[0].get("year", 0)
    latest_q = rows[0].get("quarter", 0)
    yoy_match = next(
        (r for r in rows if r.get("year") == latest_y - 1 and r.get("quarter") == latest_q),
        None
    )
    if yoy_match:
        momentum["revenue_yoy_pct"]    = _pct_chg(rows[0].get("revenue"),    yoy_match.get("revenue"))
        momentum["net_income_yoy_pct"] = _pct_chg(rows[0].get("net_income"), yoy_match.get("net_income"))
        momentum["margin_yoy_bps"]     = (
            round(((rows[0].get("net_margin") or 0) - (yoy_match.get("net_margin") or 0)) * 100, 0)
            if rows[0].get("net_margin") is not None and yoy_match.get("net_margin") is not None else None
        )

    # ── Margin trend over last 3 quarters ───────────────────────
    if len(rows) >= 3:
        margins = [r.get("net_margin") for r in rows[:3] if r.get("net_margin") is not None]
        if len(margins) == 3:
            if margins[0] > margins[1] > margins[2]:
                margin_trend = "improving_3q"
            elif margins[0] < margins[1] < margins[2]:
                margin_trend = "declining_3q"
            elif abs(margins[0] - margins[2]) < 2:
                margin_trend = "stable_3q"
            else:
                margin_trend = "mixed_3q"
            momentum["margin_trend_3q"] = margin_trend
            momentum["latest_net_margin_pct"] = round(margins[0], 1)

    return {
        "periods":  periods,
        "ttm":      ttm,
        "momentum": momentum,
    }


# ---------------------------------------------------------------------------
# Dividend profile builder (Block 11)
# ---------------------------------------------------------------------------

def build_dividend_profile(
    dividend_history_rows: List[dict],
    current_price: Optional[float],
    eps_latest: Optional[float],
) -> dict:
    """
    Block 11: dividend_profile — historical DPS, TTM yield, payout ratio, sustainability.

    Args:
        dividend_history_rows: rows from dividend_history ordered desc by ex_date.
        current_price:         latest close price (for yield calculation).
        eps_latest:            latest annual EPS (for payout ratio).
    """
    if not dividend_history_rows:
        return {}

    from datetime import timedelta as _td
    today = date.today()
    # 450-day window handles annual payers whose most recent dividend was 13-15 months ago.
    ttm_cutoff = today - _td(days=450)

    by_year: dict[int, float] = {}
    ttm_dps = 0.0

    for row in dividend_history_rows:
        ex_date_str = str(row.get("ex_date") or "")[:10]
        amount = row.get("amount")
        if not amount or not ex_date_str:
            continue
        try:
            ex_d = date.fromisoformat(ex_date_str)
        except ValueError:
            continue
        by_year[ex_d.year] = by_year.get(ex_d.year, 0.0) + float(amount)
        if ex_d >= ttm_cutoff:
            ttm_dps += float(amount)

    if not by_year:
        return {}

    sorted_years = sorted(by_year.keys(), reverse=True)[:5]
    history = [{"year": y, "dps": round(by_year[y], 2)} for y in sorted_years]
    latest_annual_dps = round(by_year[sorted_years[0]], 2) if sorted_years else 0.0

    # Fall back to latest annual DPS when nothing falls in the extended TTM window
    # (e.g. company hasn't declared yet for the current cycle)
    effective_ttm_dps = ttm_dps if ttm_dps > 0 else latest_annual_dps

    # TTM yield
    ttm_yield_pct = None
    if effective_ttm_dps > 0 and current_price and current_price > 0:
        ttm_yield_pct = round(effective_ttm_dps / current_price * 100, 2)

    # Payout ratio vs latest annual EPS
    payout_ratio = None
    if effective_ttm_dps > 0 and eps_latest and eps_latest > 0:
        payout_ratio = round(effective_ttm_dps / eps_latest * 100, 1)

    # Sustainability
    sustainability = "unknown"
    if payout_ratio is not None:
        if payout_ratio > 100:
            sustainability = "unsustainable"
        elif payout_ratio > 80:
            sustainability = "stretched"
        elif payout_ratio > 50:
            sustainability = "moderate"
        else:
            sustainability = "healthy"

    # Trend: latest year vs prior year
    div_trend = "insufficient_data"
    if len(sorted_years) >= 2:
        latest_dps = by_year[sorted_years[0]]
        prev_dps   = by_year[sorted_years[1]]
        if prev_dps > 0:
            if latest_dps > prev_dps * 1.05:
                div_trend = "growing"
            elif latest_dps < prev_dps * 0.95:
                div_trend = "declining"
            else:
                div_trend = "stable"

    return {
        "ttm_dps":            round(effective_ttm_dps, 2),
        "latest_annual_dps":  latest_annual_dps,
        "ttm_yield_pct":      ttm_yield_pct,
        "payout_ratio_pct":   payout_ratio,
        "sustainability":     sustainability,
        "div_trend":          div_trend,
        "history":            history,
    }


# ---------------------------------------------------------------------------
# Main context builder
# ---------------------------------------------------------------------------

def build_technical_context(
    price_rows: List[dict],
    technical_signals: Optional[List[dict]] = None,
    wyckoff_events: Optional[List[dict]] = None,
    market_phase: Optional[dict] = None,
) -> dict:
    """
    Block 9: technical_context — price action, momentum, and Wyckoff signals.

    Args:
        price_rows:         daily_prices rows ordered desc, need ≥200 for SMA-200.
        technical_signals:  rows from technical_signals ordered desc (RSI, MACD).
        wyckoff_events:     last N rows from wyckoff_events ordered desc.
        market_phase:       single row from market_phases where is_current=True.

    Returns a dict ready to embed in the context bundle.
    """
    block: dict = {}

    # ── Price vs moving averages ─────────────────────────────────
    closes = [r["close"] for r in price_rows if r.get("close") is not None]
    if closes:
        latest_close = closes[0]
        latest_price_date = price_rows[0].get("date") if price_rows else None
        sma20  = round(sum(closes[:20])  / 20,  0) if len(closes) >= 20  else None
        sma50  = round(sum(closes[:50])  / 50,  0) if len(closes) >= 50  else None
        sma200 = round(sum(closes[:200]) / 200, 0) if len(closes) >= 200 else None

        def _gap(ma):
            if ma is None or ma == 0:
                return None
            return round((latest_close - ma) / ma * 100, 1)

        # Position label: above/below which MAs
        above = [f"SMA{p}" for p, ma in [(20, sma20), (50, sma50), (200, sma200)]
                 if ma is not None and latest_close > ma]
        below = [f"SMA{p}" for p, ma in [(20, sma20), (50, sma50), (200, sma200)]
                 if ma is not None and latest_close < ma]
        if not above:
            pos_label = "below_all_mas"
        elif not below:
            pos_label = "above_all_mas"
        else:
            pos_label = f"above_{'_'.join(above)}_below_{'_'.join(below)}"

        block["price_vs_ma"] = {
            "close": latest_close,
            "data_date": latest_price_date,
            "sma_20":  sma20,
            "sma_50":  sma50,
            "sma_200": sma200,
            "vs_sma20_pct":  _gap(sma20),
            "vs_sma50_pct":  _gap(sma50),
            "vs_sma200_pct": _gap(sma200),
            "position": pos_label,
        }

    # ── RSI + MACD from technical_signals ───────────────────────
    if technical_signals:
        latest_ts = technical_signals[0]
        rsi = latest_ts.get("rsi_14")
        macd_hist = latest_ts.get("macd_histogram")
        macd_line = latest_ts.get("macd_line")
        macd_sig  = latest_ts.get("macd_signal")

        rsi_zone = None
        if rsi is not None:
            if rsi < 30:
                rsi_zone = "oversold"
            elif rsi > 70:
                rsi_zone = "overbought"
            else:
                rsi_zone = "neutral"

        macd_trend = None
        if macd_hist is not None:
            macd_trend = "bullish" if macd_hist > 0 else "bearish"

        # Walk backwards to find the most recent histogram sign change (= MACD cross)
        last_cross_type = None
        last_cross_days_ago = None
        for i in range(len(technical_signals) - 1):
            curr_h = technical_signals[i].get("macd_histogram")
            prev_h = technical_signals[i + 1].get("macd_histogram")
            if curr_h is None or prev_h is None:
                continue
            if prev_h < 0 and curr_h > 0:
                last_cross_type = "golden_cross"
                last_cross_days_ago = i + 1
                break
            elif prev_h > 0 and curr_h < 0:
                last_cross_type = "death_cross"
                last_cross_days_ago = i + 1
                break

        block["momentum"] = {
            "data_date":          latest_ts.get("date"),
            "rsi_14":             rsi,
            "rsi_zone":           rsi_zone,
            "macd_histogram":     round(macd_hist, 3) if macd_hist is not None else None,
            "macd_line":          round(macd_line, 3) if macd_line is not None else None,
            "macd_signal":        round(macd_sig, 3)  if macd_sig  is not None else None,
            "macd_trend":         macd_trend,
            "macd_last_cross":    last_cross_type,
            "macd_cross_days_ago": last_cross_days_ago,
            "volume_change_pct":  latest_ts.get("volume_change_pct"),
        }

    # ── Wyckoff events ───────────────────────────────────────────
    if wyckoff_events:
        latest_we = wyckoff_events[0]
        current_wyckoff_phase = latest_we.get("inferred_phase")
        detection_version = latest_we.get("detection_version", "unknown")

        recent = []
        for e in wyckoff_events[:5]:
            recent.append({
                "type":       e.get("event_type"),
                "date":       e.get("event_date"),
                "price":      e.get("price"),
                "confidence": e.get("confidence"),
                "phase":      e.get("inferred_phase"),
                "notes":      (e.get("notes") or "")[:120],
            })

        block["wyckoff"] = {
            "current_phase":      current_wyckoff_phase,
            "detection_version":  detection_version,
            "latest_event": {
                "type":       latest_we.get("event_type"),
                "date":       latest_we.get("event_date"),
                "confidence": latest_we.get("confidence"),
                "notes":      (latest_we.get("notes") or "")[:120],
            },
            "recent_events": recent,
        }

    # ── Market phase ─────────────────────────────────────────────
    if market_phase:
        block["market_phase"] = {
            "phase_type":             market_phase.get("phase_type"),
            "trend_strength":         market_phase.get("trend_strength"),
            "change_pct_in_phase":    market_phase.get("change_pct"),
            "days_in_phase":          market_phase.get("days"),
            "phase_start":            market_phase.get("start_date"),
            "range_low":              market_phase.get("range_low"),
            "range_high":             market_phase.get("range_high"),
            "smart_money_alignment":  market_phase.get("smart_money_alignment"),
            "broker_flow_alignment":  market_phase.get("broker_flow_alignment"),
        }

    return block


class ContextBuilder:
    """
    Assemble the 9-block AI context bundle for one ticker.

    Blocks: data_quality, fundamentals, valuation, smart_money,
    shareholders, health_score, sector_context, macro_context,
    technical_context
    """

    def build(
        self,
        ticker: str,
        stock: dict,
        metrics: List[NormalizedMetric],
        score: StockScore,
        flags: Dict[int, Any],
        clean_rows: List[dict],
        latest_price: Optional[dict] = None,
        broker_flow_30d: Optional[List[dict]] = None,
        bandar_latest: Optional[dict] = None,
        insider_90d: Optional[List[dict]] = None,
        shareholders: Optional[List[dict]] = None,
        sector_peer_scores: Optional[List[dict]] = None,
        domain_notes: Optional[str] = None,
        sector_template: Optional[dict] = None,
        # Block 9: technical context
        price_history: Optional[List[dict]] = None,
        technical_signals: Optional[List[dict]] = None,
        wyckoff_events: Optional[List[dict]] = None,
        market_phase: Optional[dict] = None,
        # Block 10: quarterly financials (quarter > 0, ordered desc)
        quarterly_rows: Optional[List[dict]] = None,
        # Block 11: dividend history (ordered desc by ex_date)
        dividend_history_rows: Optional[List[dict]] = None,
    ) -> ContextBundle:
        """Build the full context bundle."""
        start = time.time()
        is_bank = (stock.get("subsector") or "").lower() in ("bank", "banks")

        # Defaults
        broker_flow_30d = broker_flow_30d or []
        insider_90d = insider_90d or []
        shareholders = shareholders or []
        sector_peer_scores = sector_peer_scores or []

        # ── Block 1: data_quality ────────────────────────────────
        anomalous_years = sorted(set(
            yr for yr, f in flags.items()
            if getattr(f, 'has_anomaly', False) or getattr(f, 'is_covid_year', False)
        ))
        flagged_issues = []
        for yr in sorted(flags.keys()):
            f = flags[yr]
            for note in getattr(f, 'notes', []):
                flagged_issues.append(note)

        data_quality = {
            "reliability_score": score.reliability_total,
            "reliability_grade": score.reliability_grade,
            "confidence_score": score.confidence_total,
            "confidence_grade": score.confidence_grade,
            "composite_score": score.composite_score,
            "ready_for_ai": score.ready_for_ai,
            "data_years_available": score.data_years_available,
            "primary_source": score.primary_source,
            "missing_metrics": score.missing_metrics,
            "anomalous_years": anomalous_years,
            "flagged_issues": flagged_issues,
            "data_gap_flags": score.data_gap_flags,
            "banking_exemptions_applied": is_bank,
        }

        # ── Block 2: fundamentals ────────────────────────────────
        published_rows = [r for r in clean_rows if not r.get("is_ttm")]
        latest_year = max((r["year"] for r in published_rows), default=None)
        metrics_dict = {}
        for m in metrics:
            entry = {
                "value": m.latest_value,
                "unit": m.unit,
                "cagr_full": m.cagr_full,
                "cagr_3yr": m.cagr_3yr,
                "trend": m.trend_direction,
                "trend_r2": m.trend_r2,
                "vs_sector_pct": m.percentile_vs_sector,
                "peer_group": m.peer_group_level,
                "peer_count": m.peer_count,
                "anomaly_years": m.anomaly_years,
            }
            if m.unit == "idr" and m.latest_value is not None:
                entry["value_display"] = f"{_round_idr_billions(m.latest_value)} Rp Billion"
            metrics_dict[m.metric_name] = entry

        # Key signals
        def _m(name):
            return next((x for x in metrics if x.metric_name == name), None)

        rev_m = _m("revenue")
        nm_m = _m("net_margin")
        de_m = _m("debt_to_equity")
        fcf_ni = _m("fcf_to_net_income")
        dy_m = _m("dividend_yield")

        key_signals = {
            "revenue_growth_acceleration": bool(
                rev_m and rev_m.cagr_3yr is not None and rev_m.cagr_full is not None
                and rev_m.cagr_3yr > rev_m.cagr_full
            ),
            "margin_compression": bool(
                nm_m and nm_m.trend_direction in ("mild_down", "strong_down")
            ),
            "deleveraging": bool(
                de_m and de_m.trend_direction in ("mild_down", "strong_down")
            ),
            "fcf_quality_concern": bool(
                fcf_ni and fcf_ni.latest_value is not None and fcf_ni.latest_value < 0.70
            ),
            "dividend_growth": bool(
                dy_m and dy_m.trend_direction in ("mild_up", "strong_up")
            ),
        }

        fundamentals = {
            "latest_year": latest_year,
            "metrics": metrics_dict,
            "key_signals": key_signals,
        }

        # ── Block 3: valuation ───────────────────────────────────
        close = latest_price.get("close") if latest_price else None
        price_date = latest_price.get("date") if latest_price else None
        eps_val = _m("eps")
        eps_v = eps_val.latest_value if eps_val else None
        bvps_val = _m("bvps")
        bvps_v = bvps_val.latest_value if bvps_val else None
        pe_m = _m("pe_ratio")
        pb_m = _m("pb_ratio")
        fcf_m = _m("free_cash_flow")
        fcf_v = fcf_m.latest_value if fcf_m else None
        listed_shares = stock.get("listed_shares") or 0

        # PEG ratio — requires PE and positive EPS CAGR
        eps_m_full = _m("eps")
        eps_cagr_3yr_pct = (eps_m_full.cagr_3yr * 100) if eps_m_full and eps_m_full.cagr_3yr else None
        eps_cagr_5yr_pct = (eps_m_full.cagr_5yr * 100) if eps_m_full and eps_m_full.cagr_5yr else None
        pe_latest = pe_m.latest_value if pe_m else None
        peg_3yr = (
            round(pe_latest / eps_cagr_3yr_pct, 2)
            if pe_latest and pe_latest > 0 and eps_cagr_3yr_pct and eps_cagr_3yr_pct > 0
            else None
        )
        peg_5yr = (
            round(pe_latest / eps_cagr_5yr_pct, 2)
            if pe_latest and pe_latest > 0 and eps_cagr_5yr_pct and eps_cagr_5yr_pct > 0
            else None
        )

        graham = compute_graham_number(eps_v, bvps_v)
        graham_mos = None
        if graham and close and close > 0:
            graham_mos = round((graham - close) / graham, 4)

        # DCF — pick the best basis depending on stock type:
        #  1. FCF-based (default for non-financial companies with positive FCF)
        #  2. Dividend-based (for banks and high-yield stocks where FCF is meaningless)
        #  3. EPS-based (for companies with negative FCF but positive earnings)
        dcf = {"dcf_bear": None, "dcf_base": None, "dcf_bull": None, "dcf_base_mos": None}
        dcf_mode = None
        rev_cagr_pct = (rev_m.cagr_3yr * 100) if rev_m and rev_m.cagr_3yr else 8.0
        fcf_cagr_pct = (fcf_m.cagr_3yr * 100) if fcf_m and fcf_m.cagr_3yr else None
        # Growth anchor: for FCF-based DCF use FCF CAGR (captures margin expansion);
        # blend with revenue CAGR and cap at 20% to limit the effect of outlier years.
        if fcf_v and fcf_v > 0 and fcf_cagr_pct and fcf_cagr_pct > 0:
            base_growth = min((rev_cagr_pct + fcf_cagr_pct) / 2, 20.0)
        else:
            base_growth = max(rev_cagr_pct, 2.0)  # floor at 2% to avoid near-zero perpetuity

        # Get dividend and NI values for alternative bases
        latest_annual = published_rows[-1] if published_rows else {}
        dividends_paid = latest_annual.get("dividends_paid")
        ni_val = latest_annual.get("net_income")

        # DDM fallback: if dividends_paid is missing from financials, derive from
        # dividend_history. Uses effective TTM DPS (450-day window) or latest annual DPS.
        div_hist_dps = 0.0
        if (not dividends_paid or dividends_paid == 0) and dividend_history_rows and listed_shares > 0:
            _profile_tmp = build_dividend_profile(dividend_history_rows, close, eps_v)
            # ttm_dps already incorporates the latest_annual_dps fallback
            div_hist_dps = _profile_tmp.get("ttm_dps") or 0.0

        effective_div = abs(dividends_paid) if (dividends_paid and dividends_paid != 0) else (
            div_hist_dps * listed_shares if div_hist_dps > 0 else 0
        )

        if fcf_v and fcf_v > 0 and listed_shares > 0 and not is_bank:
            # Option 1: FCF-based (best for non-financial companies)
            dcf = compute_dcf_scenarios(fcf_v, listed_shares, base_growth, close)
            dcf_mode = "fcf"
        elif effective_div > 0 and listed_shares > 0:
            # Option 2: Dividend-based (DDM — best for banks and high-yield payers)
            # Uses dividends_paid from financials, or TTM DPS from dividend_history as fallback
            dcf = compute_dcf_scenarios(effective_div, listed_shares, base_growth, close)
            dcf_mode = "dividend"
        elif ni_val and ni_val > 0 and listed_shares > 0:
            # Option 3: EPS-based (for negative FCF but profitable companies)
            dcf = compute_dcf_scenarios(ni_val, listed_shares, base_growth, close)
            dcf_mode = "eps"

        valuation = {
            "current_price": close,
            "price_date": price_date,
            "market_cap": stock.get("market_cap"),
            "pe_ratio": round(pe_m.latest_value, 2) if pe_m and pe_m.latest_value else None,
            "pb_ratio": round(pb_m.latest_value, 2) if pb_m and pb_m.latest_value else None,
            "peg_3yr": peg_3yr,
            "peg_5yr": peg_5yr,
            "eps_cagr_3yr_pct": round(eps_cagr_3yr_pct, 1) if eps_cagr_3yr_pct else None,
            "eps_cagr_5yr_pct": round(eps_cagr_5yr_pct, 1) if eps_cagr_5yr_pct else None,
            "graham_number": round(graham) if graham else None,
            "graham_margin_of_safety": graham_mos,
            "dcf_mode": dcf_mode,
            "dcf_growth_pct": round(base_growth, 2),
            **dcf,
        }

        # ── Block 4: smart_money ─────────────────────────────────
        asing_net = sum(r.get("net_value", 0) for r in broker_flow_30d if r.get("broker_type") == "Asing")
        lokal_net = sum(r.get("net_value", 0) for r in broker_flow_30d if r.get("broker_type") == "Lokal")
        pemerintah_net = sum(r.get("net_value", 0) for r in broker_flow_30d if r.get("broker_type") == "Pemerintah")

        phase = detect_smart_money_phase(asing_net, lokal_net, pemerintah_net)

        insider_buys = sum(1 for t in insider_90d if t.get("action") == "BUY")
        insider_sells = sum(1 for t in insider_90d if t.get("action") == "SELL")

        smart_money = {
            "window_days": 30,
            "phase": phase,
            "asing_net_30d": asing_net,
            "lokal_net_30d": lokal_net,
            "pemerintah_net_30d": pemerintah_net,
            "bandar_latest_date": bandar_latest.get("trade_date") if bandar_latest else None,
            "bandar_accdist": bandar_latest.get("broker_accdist") if bandar_latest else None,
            "bandar_top5_accdist": bandar_latest.get("top5_accdist") if bandar_latest else None,
            "insider_window_days": 90,
            "insider_net_direction": "buy" if insider_buys > insider_sells else ("sell" if insider_sells > insider_buys else "neutral"),
            "insider_buy_count": insider_buys,
            "insider_sell_count": insider_sells,
        }

        # ── Block 5: shareholders ────────────────────────────────
        shareholders_block = {
            "top_holders": [
                {"name": s.get("holder_name", ""), "type": s.get("holder_type"), "pct": s.get("percentage")}
                for s in shareholders[:5]
            ],
            "public_float_pct": next(
                (s.get("percentage") for s in shareholders if s.get("holder_type") == "public"), None
            ),
        }

        # ── Block 6: health_score ────────────────────────────────
        latest_annual = published_rows[-1] if published_rows else {}
        health = compute_health_score(latest_annual, is_bank=is_bank)

        # ── Block 7: sector_context ──────────────────────────────
        sector_context = {
            "sector": stock.get("sector"),
            "sub_sector": stock.get("subsector"),
            "peers_count": len(sector_peer_scores),
            "top_peers": sector_peer_scores[:3],
        }

        # ── Block 8: macro_context ───────────────────────────────
        try:
            macro = get_macro_context()
        except Exception:
            macro = {"as_of": "unknown", "note": "macro context file not found"}

        # ── Block 9: technical_context ───────────────────────────
        technical_context = build_technical_context(
            price_rows=price_history or [],
            technical_signals=technical_signals,
            wyckoff_events=wyckoff_events,
            market_phase=market_phase,
        )

        # ── Block 10: quarterly_trend ────────────────────────────
        quarterly_trend = build_quarterly_trend(quarterly_rows or [])

        # ── Block 11: dividend_profile ───────────────────────────
        dividend_profile = build_dividend_profile(
            dividend_history_rows or [],
            current_price=close,
            eps_latest=eps_v,
        )

        # ── Assemble top-level bundle ────────────────────────────
        context = {
            "ticker": ticker,
            "name": stock.get("name"),
            "sector": stock.get("sector"),
            "sub_sector": stock.get("subsector"),
            "is_lq45": stock.get("is_lq45", False),
            "is_idx30": stock.get("is_idx30", False),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data_as_of": price_date,
            "data_quality": data_quality,
            "fundamentals": fundamentals,
            "valuation": valuation,
            "smart_money": smart_money,
            "shareholders": shareholders_block,
            "health_score": health,
            "sector_context": sector_context,
            "macro_context": macro,
            "technical_context": technical_context if technical_context else None,
            "quarterly_trend": quarterly_trend if quarterly_trend else None,
            "dividend_profile": dividend_profile if dividend_profile else None,
        }

        # Domain notes (injected if available)
        if domain_notes:
            context["domain_notes"] = domain_notes

        # Sector template (injected if available)
        if sector_template:
            context["sector_template"] = sector_template

        token_estimate = len(json.dumps(context, default=str)) // 4
        duration_ms = int((time.time() - start) * 1000)

        return ContextBundle(
            ticker=ticker,
            context=context,
            token_estimate=token_estimate,
            ready_for_ai=score.ready_for_ai,
            build_duration_ms=duration_ms,
        )
