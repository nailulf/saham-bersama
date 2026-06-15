# Data Dictionary

Field definitions for every table in the IDX Stock Analyzer database.

---

## stocks

Master list of all IDX-listed companies. Refreshed weekly.

| Column | Type | Description |
|--------|------|-------------|
| ticker | TEXT (PK) | IDX stock code, e.g. `BBRI`. No `.JK` suffix. |
| name | TEXT | Full company name |
| sector | TEXT | IDX sector (English-normalised) |
| subsector | TEXT | IDX subsector |
| listing_date | DATE | IPO / listing date on IDX |
| listed_shares | BIGINT | Total shares outstanding |
| market_cap | BIGINT | Latest market capitalisation in IDR |
| board | TEXT | `Main`, `Development`, or `Acceleration` |
| is_lq45 | BOOLEAN | Member of LQ45 index (current period) |
| is_idx30 | BOOLEAN | Member of IDX30 index (current period) |
| status | TEXT | `Active`, `Suspended`, or `Delisted` |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |
| last_data_change_at | TIMESTAMPTZ | Bumped by `--daily` scrapers (financials, financials_fallback) when new financial periods or NULL fills land. Compared against `ai_analysis.generated_at` to gate the Re-analyze button. (v28) |
| screener_metrics_updated_at | TIMESTAMPTZ | Last time `ratio_enricher` (`--enrich-ratios`) recomputed the denormalized screener CAGR (`revenue/price/ocf_cagr_*`) + `div_yield_avg_*`. Revenue/OCF CAGR use the canonical spec in [cagr-spec.md](cagr-spec.md) so they match the stock-detail widget. Refreshed when never-set, when `last_data_change_at` is newer (new financials), or as a ~monthly safety net. NULL = never refreshed since v32. (v32) |

---

## daily_prices

End-of-day price, volume, and foreign flow data. Refreshed daily.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Auto-increment PK |
| ticker | TEXT (FK) | References `stocks.ticker` |
| date | DATE | Trading date (IDX calendar) |
| open | DECIMAL | Opening price (IDR) |
| high | DECIMAL | Highest intraday price (IDR) |
| low | DECIMAL | Lowest intraday price (IDR) |
| close | DECIMAL | Closing price (IDR) |
| volume | BIGINT | Shares traded |
| value | BIGINT | Total transaction value in IDR |
| frequency | INTEGER | Number of transactions (orders matched) |
| foreign_buy | BIGINT | Foreign investor buy value in IDR |
| foreign_sell | BIGINT | Foreign investor sell value in IDR |
| foreign_net | BIGINT | `foreign_buy - foreign_sell` (positive = net buy) |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

**Source**: OHLCV via yfinance; foreign flow + value + frequency via IDX API (money_flow.py).

---

## financials

Annual and quarterly financial statements with computed ratios. Refreshed quarterly.

`quarter = 0` means annual report; `quarter = 1-4` means quarterly (Q1=Mar, Q2=Jun, Q3=Sep, Q4=Dec).

### Income Statement

| Column | Type | Description |
|--------|------|-------------|
| revenue | BIGINT | Total revenue (IDR) |
| cost_of_revenue | BIGINT | Cost of goods sold / cost of revenue (IDR) |
| gross_profit | BIGINT | Revenue minus cost of revenue (IDR) |
| operating_expense | BIGINT | Total operating expenses (IDR) |
| operating_income | BIGINT | Operating income / EBIT (IDR) |
| interest_expense | BIGINT | Interest expense (IDR) |
| income_before_tax | BIGINT | Pre-tax income (IDR) |
| tax_expense | BIGINT | Income tax expense (IDR) |
| net_income | BIGINT | Net income attributable to shareholders (IDR) |
| eps | DECIMAL | Earnings per share (IDR/share) |

### Balance Sheet

| Column | Type | Description |
|--------|------|-------------|
| total_assets | BIGINT | Total assets (IDR) |
| current_assets | BIGINT | Current assets (IDR) |
| total_liabilities | BIGINT | Total liabilities (IDR) |
| current_liabilities | BIGINT | Current liabilities (IDR) |
| total_equity | BIGINT | Total shareholders' equity (IDR) |
| total_debt | BIGINT | Short-term + long-term interest-bearing debt (IDR) |
| cash_and_equivalents | BIGINT | Cash and cash equivalents (IDR) |
| book_value_per_share | DECIMAL | Equity / listed shares (IDR/share) |

### Cash Flow

| Column | Type | Description |
|--------|------|-------------|
| operating_cash_flow | BIGINT | Net cash from operating activities (IDR) |
| capex | BIGINT | Capital expenditures — usually negative (IDR) |
| free_cash_flow | BIGINT | `operating_cash_flow - abs(capex)` (IDR) |
| dividends_paid | BIGINT | Cash dividends paid — usually negative (IDR) |
| share_buybacks | BIGINT | Treasury stock repurchases — usually negative (IDR) |
| debt_issuance | BIGINT | Proceeds from new borrowings — usually positive (IDR) |
| debt_repayment | BIGINT | Payments to retire debt — usually negative (IDR) |
| net_change_in_cash | BIGINT | Net period change in cash and equivalents (IDR) |

### Computed Ratios

All ratios computed from raw values above. Percentages are stored as-is (e.g. 15.5% → 15.5, not 0.155).

| Column | Type | Formula |
|--------|------|---------|
| gross_margin | DECIMAL | `gross_profit / revenue × 100` |
| operating_margin | DECIMAL | `operating_income / revenue × 100` |
| net_margin | DECIMAL | `net_income / revenue × 100` |
| roe | DECIMAL | `net_income / total_equity × 100` |
| roa | DECIMAL | `net_income / total_assets × 100` |
| current_ratio | DECIMAL | `current_assets / current_liabilities` |
| debt_to_equity | DECIMAL | `total_debt / total_equity` |
| pe_ratio | DECIMAL | `price_per_share / eps` (uses market_cap from `stocks`) |
| pbv_ratio | DECIMAL | `price_per_share / book_value_per_share` |
| dividend_yield | DECIMAL | `dps / price_per_share × 100` |
| payout_ratio | DECIMAL | `abs(dividends_paid) / net_income × 100` |

### Metadata

| Column | Type | Description |
|--------|------|-------------|
| source | TEXT | `yfinance`, `idx`, or `manual` |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

---

## company_profiles

Detailed company information. Refreshed quarterly.

| Column | Type | Description |
|--------|------|-------------|
| ticker | TEXT (PK, FK) | References `stocks.ticker` |
| description | TEXT | Business description |
| website | TEXT | Company website URL |
| address | TEXT | Registered office address |
| phone | TEXT | Contact phone number |
| email | TEXT | Contact email address |
| npwp | TEXT | Indonesian tax ID (NPWP) |
| listing_date | DATE | Date of IPO on IDX |
| registry_agency | TEXT | Share registrar / Biro Administrasi Efek |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

---

## company_officers

Directors, commissioners, and committee members. Refreshed quarterly (full replacement).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL (PK) | Auto-increment |
| ticker | TEXT (FK) | References `stocks.ticker` |
| name | TEXT | Person's full name |
| role | TEXT | `director`, `commissioner`, or `committee` |
| title | TEXT | Specific title (e.g. `President Director`, `Independent Commissioner`) |
| is_independent | BOOLEAN | True if independent commissioner/director |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

---

## shareholders

Ownership structure snapshot. Refreshed quarterly (full replacement per ticker).

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL (PK) | Auto-increment |
| ticker | TEXT (FK) | References `stocks.ticker` |
| holder_name | TEXT | Shareholder name |
| holder_type | TEXT | `institution`, `individual`, `government`, or `public` |
| shares_held | BIGINT | Number of shares owned |
| percentage | DECIMAL | Ownership percentage (e.g. 25.5 means 25.5%) |
| snapshot_date | DATE | Date the ownership data was valid |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

---

## broker_summary

Broker-level buy/sell activity. Refreshed daily for top 200 stocks by market cap.

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL (PK) | Auto-increment |
| ticker | TEXT (FK) | References `stocks.ticker` |
| date | DATE | Trading date |
| broker_code | TEXT | IDX broker code (e.g. `YP`, `MS`, `CC`) |
| broker_name | TEXT | Full broker name |
| buy_volume | BIGINT | Shares bought by this broker |
| buy_value | BIGINT | Buy value in IDR |
| sell_volume | BIGINT | Shares sold by this broker |
| sell_value | BIGINT | Sell value in IDR |
| net_volume | BIGINT | `buy_volume - sell_volume` |
| net_value | BIGINT | `buy_value - sell_value` (positive = net buyer) |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

---

## idx_stock_summary

IDX **official** daily per-stock trading summary — one row per `(ticker, date)`. Source of truth for total transaction **value** (IDR) and **official foreign buy/sell**, the latter in **shares** (not IDR). Populated by `python/scrapers/idx_stock_summary.py` (IDX `GetStockSummary`, one call per date — whole market). More current than `broker_flow` (Stockbit lags ~1 trading day) and used by the Money Flow page's "Most Active" view and as a foreign cross-check.

⚠️ **Two foreign definitions can disagree, by design:** IDX `foreign_buy/sell` is a transaction-level foreign flag (in shares); `broker_flow` `broker_type='Asing'` is Stockbit's broker classification (in IDR). A foreign fund trading via a local broker lands on the opposite side.

| Column | Type | Description |
|--------|------|-------------|
| ticker | VARCHAR(10) (FK) | References `stocks.ticker` |
| date | DATE | Trading date |
| prev_close | DECIMAL(12,2) | Previous close (IDR) |
| open / high / low / close | DECIMAL(12,2) | OHLC (IDR) |
| change | DECIMAL(12,2) | `close - prev_close` (IDR) |
| volume | BIGINT | Total volume (shares) |
| value | BIGINT | Total transaction value (IDR) |
| frequency | INTEGER | Number of transactions |
| foreign_buy | BIGINT | Official foreign buy — **shares**, not IDR |
| foreign_sell | BIGINT | Official foreign sell — **shares**, not IDR |
| foreign_net | BIGINT (generated) | `foreign_buy - foreign_sell` (shares) |
| listed_shares | BIGINT | Listed shares |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

PK `(ticker, date)`. Added in schema-v30.

**Money Flow RPCs (schema-v30, ranged in schema-v31):** `mf_summary_range(from, to)` — aggregates idx_stock_summary to one row/ticker over a window (powers Total/Foreign/Domestic + the 1D/7D/30D/YTD duration filter); `mf_top_brokers(from, to, dir, limit)` — market-wide top brokers by buy/sell value; `mf_broker_top_tickers(from, to, broker, dir, limit)` — a broker's top emiten. The v30 single-date `mf_top_brokers`/`mf_broker_top_tickers` are dropped & replaced by the ranged versions; `mf_top_flow_by_type` (v30) is unused.

---

## scraper_runs

Execution history for every scraper run.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL (PK) | Auto-increment |
| scraper_name | TEXT | e.g. `daily_prices`, `financials`, `stock_universe` |
| started_at | TIMESTAMPTZ | When the run began |
| finished_at | TIMESTAMPTZ | When the run ended (NULL if still running) |
| stocks_processed | INTEGER | Number of tickers successfully processed |
| stocks_failed | INTEGER | Number of tickers that errored |
| stocks_skipped | INTEGER | Number of tickers skipped (already up to date, etc.) |
| status | TEXT | `running`, `success`, `partial`, `failed` |
| error_message | TEXT | Error details if status = `failed` |
| metadata | JSONB | Extra context (date range, mode, etc.) |

---

## market_indicators

Latest-only snapshot of homepage "Market Pulse" indicators — one row per indicator. Populated by `market_pulse.py` (yfinance for live daily quotes; ESDM HBA/HMA for monthly minerba reference prices). Source-agnostic; the indicator set is driven by the registry in `python/scrapers/market_pulse_config.py`. Added in schema-v29.

| Column | Type | Description |
|--------|------|-------------|
| indicator_key | TEXT (PK) | Stable key, e.g. `usd_idr`, `ihsg`, `coal_hba` |
| label | TEXT | Display label, e.g. `USD/IDR` |
| category | TEXT | `fx`, `index_id`, `index_us`, `metal`, `energy`, `minerba` |
| unit | TEXT | `IDR`, `points`, `USD/oz`, `USD/ton`, `USD/bbl` |
| provider | TEXT | `yfinance`, `esdm_hba`, `esdm_hma` |
| cadence | TEXT | `live_daily` or `monthly_reference` |
| value | DECIMAL(20,4) | Latest value (NULL until first successful fetch) |
| prev_value | DECIMAL(20,4) | Prior-period value (for change computation) |
| change_abs | DECIMAL(20,4) | `value - prev_value` |
| change_pct | DECIMAL(10,4) | `(value - prev_value)/prev_value * 100` (whole-percent) |
| as_of | DATE | Date the value applies to |
| reference_period | TEXT | `YYYY-MM` for monthly references; NULL for daily |
| sort_order | INTEGER | Display order in the header |
| is_active | BOOLEAN | Inactive indicators are hidden (e.g. CPO until a source is confirmed) |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

---

## market_indicator_history

Thin time series backing `market_indicators` — used to compute prev/change and to power future sparklines. Cards on the homepage read latest-only from `market_indicators`. Added in schema-v29.

| Column | Type | Description |
|--------|------|-------------|
| indicator_key | TEXT (PK) | References `market_indicators.indicator_key` (composite PK with `as_of`) |
| as_of | DATE (PK) | Date the value applies to |
| value | DECIMAL(20,4) | Indicator value on that date |
| reference_period | TEXT | `YYYY-MM` for monthly references; NULL for daily |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |

---

## market_news

Indonesian-market news headlines aggregated from RSS feeds (Kontan, Bisnis.com, Detik Finance, CNBC Indonesia, IDX). Populated by `market_pulse.py` via `feedparser`. Added in schema-v29.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | `sha1(link)` — dedupes headlines across re-runs |
| title | TEXT | Headline text |
| link | TEXT | URL to the source article |
| source | TEXT | Feed source name, e.g. `Kontan`, `Bisnis.com` |
| published_at | TIMESTAMPTZ | Article publish time (from the feed) |
| summary | TEXT | Short description/excerpt from the feed |
| fetched_at | TIMESTAMPTZ | When the scraper fetched this row |

---

## market_events

Curated "Important Dates" calendar for the Market Pulse header — index rebalancing (MSCI/FTSE), monetary decisions (BI rate/Fed FOMC), and macro releases (BPS GDP/inflation). Source of truth is the owner-edited `shared/market-events.json`; `market_pulse.py` loads it and upserts here. Added in schema-v30.

| Column | Type | Description |
|--------|------|-------------|
| event_date | DATE (PK) | Date the event occurs (composite PK with `title`) |
| title | TEXT (PK) | Event name, e.g. `BI Rate decision (RDG)` |
| category | TEXT | `index_rebalance`, `monetary`, `macro_release`, `global`, or `other` |
| importance | TEXT | `high`, `medium`, or `low` (visual emphasis) |
| source | TEXT | Issuing body, e.g. `MSCI`, `Bank Indonesia`, `BPS`, `Federal Reserve` |
| note | TEXT | Short context shown under the title |
| last_updated | TIMESTAMPTZ | Row refresh timestamp |
