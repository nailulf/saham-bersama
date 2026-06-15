# Canonical CAGR Spec

Single source of truth for how Compound Annual Growth Rate is computed across the
app. Two implementations must stay byte-for-byte equivalent in their output:

- **Web (TypeScript):** [`web/src/lib/calculations/cagr.ts`](../web/src/lib/calculations/cagr.ts) — used live by the stock-detail financial widget.
- **Python:** `_sync_screener_metrics` in [`python/scrapers/ratio_enricher.py`](../python/scrapers/ratio_enricher.py) — precomputes the denormalized `stocks.{revenue,ocf}_cagr_{3,5}yr` columns the screener filters on.

Both read the **same input** (annual `financials` rows, `quarter = 0`) and apply
the rules below, so a stock's screener CAGR equals the number shown on its detail
page (modulo refresh lag — see "Freshness").

> ⚠️ When you change one implementation, change the other and update this doc.
> `normalized_metrics.cagr_*` (the scoring pipeline) is a **separate** calculation
> for the AI analyst / scoring engine — it intentionally does NOT feed these
> screener columns, so the two need not match.

## Input

1. Take annual rows only: `quarter = 0`.
2. **Exclude TTM rows** (`is_ttm = true`). CAGR is over completed annual periods;
   a trailing-twelve-month partial would distort the endpoint.
3. Sort ascending by `year`. Let the latest remaining row be `end` (year `Y`).

## Window selection (year-aware)

For an N-year CAGR (N ∈ {3, 5}):

1. `window = rows where year ≥ Y − N`.
2. Require `len(window) ≥ 2`. Otherwise → `null`.
3. `start = window[0]` (earliest in window), `end = window[-1]` (= latest overall).
4. `span = end.year − start.year`. Require `span > 0`. Otherwise → `null`.

The exponent is the **actual elapsed years** (`span`), not a hardcoded 3/5. This
makes the result correct when annual data has gaps and avoids assuming a
contiguous series. With sparse data a "3-year" figure may span fewer years; that
is intentional and preferable to dividing by the wrong exponent.

## Growth formula

Let `s = start.value`, `e = end.value`.

- **Always-positive metrics** (revenue, gross_profit, total_equity, total_debt):
  - Require `s > 0` and `e > 0`, else → `null`.
  - `cagr = (e / s) ^ (1 / span) − 1`.
- **Sign-changing metrics** (operating_income, net_income, operating_cash_flow,
  free_cash_flow):
  - If `s > 0` and `e > 0` → standard CAGR as above.
  - If `s == 0` → `null` (division by zero).
  - Else `totalGrowth = (e − s) / |s|`; `base = 1 + totalGrowth`; if `base ≤ 0`
    → `null` (can't take a real root); else `base ^ (1 / span) − 1`. This lets a
    negative→positive turnaround produce a meaningful positive number.

## Units

Return **percent** (multiply by 100). The screener `stocks.*_cagr_*` columns and
the widget both store/show percent (e.g. `12.5`, not `0.125`).

## Freshness

The widget recomputes live from the latest `financials` (≤1h cache). The screener
columns are refreshed by `ratio_enricher` (`run_all.py --enrich-ratios`) and are
re-derived for a stock whenever its `last_data_change_at` is newer than its
`screener_metrics_updated_at` (i.e. as soon as new financials land), plus a
~monthly safety refresh. So after a new annual report the two converge on the next
enrich run rather than drifting indefinitely.
