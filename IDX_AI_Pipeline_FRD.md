**IDX Stock Analysis Platform**

**Phase 6: AI-Ready Data Pipeline**

*Functional Requirements Document*

| **Field**         | **Value**                                                                                                  |
|-------------------|------------------------------------------------------------------------------------------------------------|
| Version           | 3.0                                                                                                        |
| Status            | **Implemented** — pipeline live in production; this doc updated to match shipped architecture              |
| Phase Dependency  | Phases 1–5 operational (confirmed per PRD v2.0)                                                            |
| Primary Objective | Process all existing data layers into a clean, AI-ready context bundle                                      |
| Stack             | NextJS 16 + Supabase (PostgreSQL) + Python 3.11+ + multi-provider LLM (OpenAI `gpt-5.2` default / Anthropic `claude-sonnet-4`) |
| Claude Code Usage | Pass this FRD + companion .py files as primary implementation context                                      |
| Author            | Nailul                                                                                                     |
| Last Updated      | 2026-06-05                                                                                                  |

> 📌 **v3.0 update (2026-06-05):** This FRD originally described Phase 6 as *to be built*. The pipeline is now implemented and running. This revision aligns the document with the shipped code. Material changes since v2.0:
> - **Context bundle grew from 8 → 11 blocks** — added `technical_context`, `quarterly_trend`, and `dividend_profile` (Sections 4.2.10–4.2.12).
> - **AI analyst is multi-provider** — a provider factory supports OpenAI (`gpt-5.2`, default) and Anthropic (`claude-sonnet-4-20250514`). The earlier "Claude Sonnet 4 only" framing is superseded (Section 6).
> - **Single enriched call confirmed** — the legacy 3-call chain (Bull → Bear → Synthesis) is fully removed. A stale "Shared System Prompt (all three calls)" block from v2.0 is retained below only as historical context and marked DEPRECATED.
> - **Schema applied** — all 7 tables shipped in [docs/schema-v11-ai-pipeline.sql](docs/schema-v11-ai-pipeline.sql); `financials.is_ttm` added in [docs/schema-v12-is-ttm.sql](docs/schema-v12-is-ttm.sql). (Repo schema head is now v31; see root CLAUDE.md.)
> - **Valuation block** gained PEG (3yr/5yr) and an auto-selected valuation mode (FCF / Dividend-DDM / EPS) — Section 4.2.4.
> - **Normalizer** now computes `cagr_5yr` in addition to `cagr_full` and `cagr_3yr` — Section 3.2.

**1. Context & Scope**

The data backbone (Phases 1–5) is operational. All five data layers are live: stock universe, daily prices, financial statements (10yr via Stockbit), company profiles + shareholders, and money flow / smart money signals. The NextJS frontend has 25 widgets, a valuation engine (Graham + DCF), health scoring, and smart money confidence scoring.

Phase 6 introduces one new purpose-built capability: **AI-ready data preparation.** This is not a dashboard feature. It is a pre-processing and packaging pipeline that transforms all existing data into a clean, structured, normalized context bundle that can be passed directly to an LLM (OpenAI `gpt-5.2` by default, or Anthropic `claude-sonnet-4` — see Section 6) for investment thesis generation.

> ℹ Claude Code: this document is Phase 6 only. Do not modify existing tables, scrapers, or API routes. All additions are additive. The existing 12 scrapers and 15+ tables are fully operational and must not be touched.

**1.1 Why This Layer Exists**

The existing data is rich but not AI-ready. Three problems today:

- Data from Stockbit and yfinance exists in parallel for some tickers — conflicts are unresolved

- Financial statement anomalies (COVID 2020, restatements, scale errors) are unflagged in the DB

- There is no single structured payload that combines fundamentals + smart money + valuation + shareholder context into one clean, pre-processed input for Claude API

Phase 6 resolves all three. The output is an **ai_context_cache** table row per ticker — a JSON blob that is deterministically built, scored for quality, and ready to be passed as Claude API prompt context with no additional preprocessing.

**1.2 Relationship to Existing Components**

| **Existing Component**                                 | **Phase 6 Relationship**                                                 |
|--------------------------------------------------------|--------------------------------------------------------------------------|
| financials table (Stockbit primary, yfinance fallback) | Source input — read via data_cleaner.py                                  |
| broker_flow + bandar_signal + insider_transactions     | Source input — pre-aggregated signal summary included in context bundle  |
| signal-confidence.ts (smart money 100pt score)         | Output re-used — computed score + narrative injected into context bundle |
| valuation.ts (Graham + DCF)                            | Output re-used — calculated values injected into context bundle          |
| health-score.ts (7-metric system)                      | Output re-used — health score components injected into context bundle    |
| stocks.completeness_score + confidence_score           | Updated by Phase 6 scoring — score_calculator.py extended                |
| score_calculator.py                                    | Extended, not replaced — Phase 6 adds deeper signal scoring on top       |
| BrokerActivityWidget / AIInsightsWidget                | Will consume Phase 6 ai_analysis table output in future UI iteration     |

**2. Data Cleaning Layer**

Before normalization or AI context building, raw data must be validated and conflicts resolved. This is handled by scripts/scoring/data_cleaner.py. It reads from the existing financials table and produces two outputs: a cleaned view used by downstream modules, and the data_quality_flags table.

**2.1 New Table: data_quality_flags**

One row per (ticker, year). Stores all cleaning decisions for auditability. Claude Code must add this to the Supabase migration.

> -- Migration: docs/schema-v11-ai-pipeline.sql (shipped)
>
> CREATE TABLE data_quality_flags (
>
> ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
>
> year SMALLINT NOT NULL,
>
> -- Source conflict
>
> source_conflict BOOLEAN DEFAULT FALSE, -- Stockbit vs yfinance disagreement
>
> conflict_metric TEXT, -- which metric conflicts (JSON array)
>
> conflict_magnitude DECIMAL(8,4), -- max % difference between sources
>
> resolution TEXT, -- 'stockbit_wins' \| 'yfinance_wins' \| 'averaged'
>
> -- Anomaly detection (IQR on YoY changes)
>
> has_anomaly BOOLEAN DEFAULT FALSE,
>
> anomaly_metrics TEXT, -- JSON array of affected metric names
>
> anomaly_scores TEXT, -- JSON: {metric: iqr_z_score}
>
> -- Known structural flags
>
> is_covid_year BOOLEAN DEFAULT FALSE, -- 2020 always TRUE
>
> is_restated BOOLEAN DEFAULT FALSE, -- DEFERRED v1: always FALSE. Implement when multi-source ingestion is live
>
> has_one_time_items BOOLEAN DEFAULT FALSE, -- large non-recurring items detected

is_ipo_year BOOLEAN DEFAULT FALSE, -- TRUE if year == stocks.listing_date year (partial financial data)

> -- Scale validation
>
> scale_warning BOOLEAN DEFAULT FALSE, -- suspected millions vs full IDR mismatch
>
> scale_factor_applied DECIMAL(10,0), -- 1 or 1000000
>
> -- Overall usability
>
> usability_flag TEXT DEFAULT 'clean', -- 'clean' \| 'minor_issues' \| 'use_with_caution' \| 'exclude'
>
> cleaner_notes TEXT, -- JSON array of human-readable notes
>
> created_at TIMESTAMPTZ DEFAULT NOW(),
>
> updated_at TIMESTAMPTZ DEFAULT NOW(),
>
> PRIMARY KEY (ticker, year)
>
> );

**2.2 Cleaning Rules Applied by data_cleaner.py**

All rules are applied in sequence. Each rule produces a flag update. Rules are deterministic — no human judgment required. 13 rules total (2 deferred to Phase 6.1: restatement detection and stock split adjustment).

<table>
<colgroup>
<col style="width: 23%" />
<col style="width: 21%" />
<col style="width: 23%" />
<col style="width: 31%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Rule</strong></th>
<th><strong>Detection Method</strong></th>
<th><strong>Action</strong></th>
<th><strong>Flag Set</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td>COVID year</td>
<td>year == 2020</td>
<td>Tag universally</td>
<td>is_covid_year = TRUE, has_one_time_items = TRUE</td>
</tr>
<tr class="even">
<td><p><strong>Restatement detection</strong></p>
<p><em>(DEFERRED — v1)</em></p></td>
<td>Deferred to Phase 6.1. Current pipeline uses single data source (Stockbit). Restatement detection requires multi-source historical comparison which is not yet available.</td>
<td>No action in v1 — column preserved for forward compatibility</td>
<td>is_restated = FALSE (always, in v1)</td>
</tr>
<tr class="odd">
<td>Source conflict</td>
<td>For rows where source changes mid-history (e.g., 2015–2019 = yfinance, 2020–2024 = stockbit): compare overlapping years if both exist. If |revenue_diff| &gt; 3% or |net_income_diff| &gt; 5%, flag.</td>
<td>Stockbit wins per PRD §7 priority</td>
<td>source_conflict = TRUE, resolution = 'stockbit_wins'</td>
</tr>
<tr class="even">
<td>Scale detection</td>
<td>Applied to ALL stocks (not only LQ45). Check: revenue &gt; 0 AND revenue &lt; 1,000,000,000 (1 billion IDR) for any year. No legitimate IDX company has annual revenue below 1B IDR — if present, values are likely reported in thousands or millions. Secondary check: if revenue = 0 AND stocks.status = 'Active', flag as use_with_caution (could be pre-revenue holding company or data error). Auto-correction: if scale_warning = TRUE AND max(revenue) &lt; 1e9 AND sector peers' median revenue &gt; 1e12, apply scale_factor = 1,000,000 to all IDR fields for that ticker.</td>
<td>If revenue &lt; 1B IDR: flag. If sector peer comparison confirms scale mismatch: multiply all IDR fields by 1e6. If revenue = 0 on active stock: flag use_with_caution.</td>
<td>scale_warning = TRUE, scale_factor_applied = 1000000 (if corrected). For zero-revenue active stocks: usability_flag = 'use_with_caution', cleaner_notes includes 'zero_revenue_active_company'</td>
</tr>
<tr class="odd">
<td>Income anomaly</td>
<td>IQR on YoY net_income change ratios. Outlier threshold: z &gt; 2.5 AND |change| &gt; 20%.</td>
<td>Tag year</td>
<td>has_anomaly = TRUE, anomaly_metrics includes 'net_income'</td>
</tr>
<tr class="even">
<td>FCF anomaly</td>
<td>IQR on YoY free_cash_flow change ratios. Same threshold.</td>
<td>Tag year</td>
<td>has_anomaly = TRUE, anomaly_metrics includes 'free_cash_flow'</td>
</tr>
<tr class="odd">
<td>Negative equity</td>
<td>total_equity &lt; 0</td>
<td>Flag for exclusion from peer z-scores</td>
<td>usability_flag = 'use_with_caution'</td>
</tr>
<tr class="even">
<td>Missing critical fields</td>
<td>revenue IS NULL AND net_income IS NULL AND total_assets IS NULL for a year</td>
<td>Skip year from normalization</td>
<td>usability_flag = 'exclude' for that year</td>
</tr>
<tr class="odd">
<td>One-time item heuristic</td>
<td>Two detection patterns:<br />
(1) NI/OI ratio: abs(net_income / operating_income - 1) &gt; 0.40 in a year not flagged as COVID AND sector != 'Finance' (banking exempt — provision reversals and trading gains are structural, not one-time).<br />
(2) Revenue spike-and-drop: YoY revenue change &gt; 100% AND following year revenue drops &gt; 50% (retrospective pattern — only detectable when year+1 data exists). Indicates asset disposal or one-off contract.</td>
<td>Tag only — no data exclusion or correction. Record what was detected in cleaner_notes for AI context.</td>
<td>has_one_time_items = TRUE. cleaner_notes includes description, e.g.: 'one_time_2022: NI/OI ratio = 2.3x, possible asset disposal' or 'revenue_spike_2021: +180% YoY, followed by -60% in 2022'</td>
</tr>
<tr class="even">
<td><p><strong>IPO partial year exclusion</strong></p>
<p><em>(NEW)</em></p></td>
<td>Compare stocks.listing_date year against financial year. The IPO year is always excluded from trend analysis (partial-year data). Count remaining full post-IPO years. If post-IPO full years &lt; 3: ticker is ineligible for AI analysis. Example: company listed in Q3 2023 → exclude 2023, only 2024 and 2025 are full years → insufficient.</td>
<td>Exclude IPO year from CAGR/trend computation. If &lt; 3 full post-IPO years: set usability_flag = 'exclude' for the ticker (not per-year). Add descriptive reason to data_gap_flags: 'Recently listed (IPO {year}): insufficient data for trend analysis'.</td>
<td>IPO year row: usability_flag = 'exclude' for that year. If &lt; 3 full years: ready_for_ai = FALSE, data_gap_flags includes 'IPO {year}: insufficient post-IPO history ({n} full years, minimum 3 required)'</td>
</tr>
<tr class="odd">
<td><p><strong>Banking zero-override</strong></p>
<p><em>(NEW)</em></p></td>
<td>For banking stocks (subsector=Bank or sector contains Finance): if debt_to_equity, current_ratio, or interest_coverage == 0.0 for all years, Stockbit stores 0 instead of NULL. Override to NULL before normalization to prevent meaningless flat/R²=1.0 trends on constant zeros.</td>
<td>Set affected fields to NULL in cleaned rows</td>
<td>cleaner_notes includes "banking_zero_override: {metric} set to NULL (Stockbit stores 0 for banks)"</td>
</tr>
<tr class="even">
<td><p><strong>TTM/keystats data handling</strong></p>
<p><em>(NEW)</em></p></td>
<td>If year &gt;= current_year AND source contains "keystats": this is TTM (trailing twelve months) data, not a published annual report. Values are often rounded, dividends_paid is NULL, and the row nearly duplicates the prior year. Detected by: year &gt;= date.today().year AND "keystats" in source.</td>
<td>Flag as use_with_caution. Exclude from CAGR and trend computation. For valuation metrics (PE, PB, EPS), use TTM as latest display value but published annual for trend.</td>
<td>usability_flag = "use_with_caution". cleaner_notes: "ttm_estimate_{year}: keystats data, not published annual report"</td>
</tr>
<tr class="odd">
<td><p><strong>Stock split adjustment</strong></p>
<p><em>(DEFERRED — v1)</em></p></td>
<td>Deferred to Phase 6.1. Per-share metrics (EPS, BVPS, DPS) are affected by stock splits/bonus shares. Without adjustment, a 2:1 split causes EPS to show -50% YoY while net income is flat, producing misleading "strong_down" trends (confirmed in BBCA simulation). Detection: EPS drops &gt;40% YoY while net_income is flat/up — probable split. Adjustment: divide pre-split per-share values by split ratio. Source: yfinance splits data or corporate_events table.</td>
<td>No action in v1. Per-share trend signals flagged as unreliable when R² &lt; 0.5.</td>
<td>cleaner_notes: "per_share_split_unadjusted: EPS/BVPS/DPS trends may be distorted by stock splits"</td>
</tr>
</tbody>
</table>

**2.3 Banking Sector Exemptions**

Applied when stocks.subsector = 'Banks' or stocks.sector contains 'Finance':

- current_ratio: exempt — never populated for banks, do not flag as missing

- interest_coverage: exempt — NIM-based profitability used instead

- debt_to_equity: normal bank D/E is 5–12× — do not flag as anomaly unless D/E \> 20×

- operating_cash_flow: may be negative due to loan book growth — do not flag as anomaly

- one_time_items (NI/OI ratio): exempt — provision reversals, trading gains, and investment income are structural for banks, not one-time items. The NI/OI heuristic does not apply to Finance sector stocks.

**2.4 data_cleaner.py Interface**

> \# scripts/scoring/data_cleaner.py
>
> class DataCleaner:
>
> def clean_ticker(self, ticker: str, sb_client) -\> CleaningResult:
>
> '''
>
> Reads all financials rows for ticker, applies all cleaning rules,
>
> writes data_quality_flags rows, returns CleaningResult.
>
> '''
>
> def clean_batch(self, tickers: list\[str\], sb_client) -\> dict\[str, CleaningResult\]:
>
> '''Rate-limited batch clean. Updates data_quality_flags for each ticker.'''
>
> def get_clean_financials(self, ticker: str, sb_client) -\> list\[dict\]:
>
> '''
>
> Returns financials rows with scale corrections applied,
>
> anomaly flags attached, and usability_flag != 'exclude' rows only.
>
> Used by DataNormalizer as its input instead of raw financials.
>
> '''
>
> @dataclass
>
> class CleaningResult:
>
> ticker: str
>
> years_processed: int
>
> years_excluded: int
>
> flags_set: list\[str\] \# e.g. \['covid_2020', 'scale_corrected', 'anomaly_2020'\]

ipo_excluded: bool \# True if ticker's IPO year was excluded from analysis

> source_conflicts: int
>
> overall_quality: str \# 'clean' \| 'minor_issues' \| 'use_with_caution'

**3. Normalization & Scoring (Aligned to Existing Schema)**

The normalization and scoring modules (data_normalizer.py, scoring_engine.py) from the previous FRD are retained but modified to read from and write to the existing project schema rather than standalone tables.

**3.1 Schema Alignment Changes**

> ⚠ Key change: the previous FRD defined new standalone tables. Phase 6 aligns all output to the existing stocks table and adds only two new tables.

| **Previous FRD**                 | **Phase 6 Aligned**                         | **Notes**                                                                    |
|----------------------------------|---------------------------------------------|------------------------------------------------------------------------------|
| stock_universe (new table)       | stocks (existing table)                     | Use existing stocks table as-is. ticker is PK.                               |
| financial_statements (new table) | financials (existing table)                 | Read from existing. Columns: net_income maps to net_profit field names.      |
| stocks.completeness_score        | stocks.completeness_score (existing column) | Phase 6 scoring engine updates this column via score_calculator.py extension |
| stocks.confidence_score          | stocks.confidence_score (existing column)   | Phase 6 updates this column with deeper signal-aware confidence              |
| normalized_metrics (new table)   | normalized_metrics (NEW — add to schema)    | This is genuinely new. Add via migration.                                    |
| stock_scores (new table)         | stock_scores (NEW — add to schema)          | This is genuinely new. Add via migration.                                    |

**3.2 New Table: normalized_metrics**

One row per (ticker, metric_name). Stores computed trend signals for all 20 tracked metrics. This table is the primary input to both scoring and AI context building.

The 20 tracked metrics, with their canonical names used as metric_name in normalized_metrics:

TRACKED_METRICS = \[

\# Income statement (IDR absolute values)

'revenue', \# financials.revenue

'net_income', \# financials.net_income (FRD alias: net_profit)

'operating_income', \# financials.operating_income (EBIT — used instead of EBITDA, which is not stored)

'free_cash_flow', \# financials.free_cash_flow

'operating_cash_flow', \# financials.operating_cash_flow

'cash', \# financials.cash_and_equivalents

\# Margins & returns (pre-computed percentages, read directly)

'gross_margin', \# financials.gross_margin

'net_margin', \# financials.net_margin

'roe', \# financials.roe

'roa', \# financials.roa

\# Leverage & liquidity (pre-computed ratios, read directly)

'debt_to_equity', \# financials.debt_to_equity

'current_ratio', \# financials.current_ratio (NULL for banks — exempt)

'interest_coverage', \# financials.interest_coverage (NULL for banks — exempt)

\# Per-share metrics

'eps', \# financials.eps

'bvps', \# financials.book_value_per_share (name mapping)

'dps', \# COMPUTED: abs(financials.dividends_paid) / stocks.listed_shares

\# Derived ratios (computed by normalizer, not stored in financials)

'fcf_to_net_income', \# COMPUTED: free_cash_flow / net_income (NULL if net_income \<= 0)

\# Valuation multiples (pre-computed, read directly)

'pe_ratio', \# financials.pe_ratio

'pb_ratio', \# financials.pbv_ratio (name mapping)

'dividend_yield', \# financials.dividend_yield

\]

Derivation rules for computed metrics:

• dps: abs(financials.dividends_paid) / stocks.listed_shares. Use financials as primary source (available per-year alongside other annual data). If dividends_paid is NULL, fall back to NULL (do not use dividend_history table — it has different granularity).

• fcf_to_net_income: financials.free_cash_flow / financials.net_income. If net_income \<= 0, set to NULL and add year to anomaly_years (ratio meaningless with negative earnings).

• operating_income is used instead of EBITDA. Raw EBITDA is not stored in the schema (only ev_ebitda ratio exists). EBIT (operating_income) is consistently available from both Stockbit and yfinance sources.

> CREATE TABLE normalized_metrics (
>
> ticker TEXT NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
>
> metric_name TEXT NOT NULL,
>
> unit TEXT, -- idr\|ratio\|percent\|multiple
>
> latest_value DECIMAL(24,6),
>
> latest_year SMALLINT,
>
> cagr_full DECIMAL(10,6), -- full-period CAGR
>
> cagr_3yr DECIMAL(10,6), -- 3-year CAGR
>
> cagr_5yr DECIMAL(10,6), -- 5-year CAGR (v3.0 — added alongside 3yr/full)
>
> trend_direction TEXT, -- strong_up\|mild_up\|flat\|mild_down\|strong_down\|volatile
>
> trend_r2 DECIMAL(6,4), -- 0-1, linear fit quality
>
> trend_slope_pct DECIMAL(10,6), -- annualized % change from linear fit
>
> volatility DECIMAL(10,6), -- std dev of YoY changes
>
> z_score_vs_sector DECIMAL(8,4), -- NULL if peer_count \< 8 (statistically insufficient)
>
> percentile_vs_sector DECIMAL(6,2), -- 0-100, NULL if peer_count \< 8
>
> anomaly_years TEXT, -- JSON array: \[2020\]
>
> missing_years TEXT, -- JSON array: \[2018\]
>
> data_years_count SMALLINT,
>
> years_json TEXT, -- JSON array for inspection
>
> values_json TEXT, -- JSON array of raw values

peer_group_level TEXT, -- 'subsector' \| 'sector' \| NULL (insufficient peers)

peer_count SMALLINT, -- actual number of peers used in z-score computation

> updated_at TIMESTAMPTZ DEFAULT NOW(),
>
> PRIMARY KEY (ticker, metric_name)
>
> );

**3.3 New Table: stock_scores**

One row per ticker. Stores the full decomposed reliability and confidence scores. Also updates stocks.completeness_score and stocks.confidence_score as a side effect.

> CREATE TABLE stock_scores (
>
> ticker TEXT PRIMARY KEY REFERENCES stocks(ticker) ON DELETE CASCADE,
>
> -- Reliability (data quality gate)
>
> reliability_total DECIMAL(6,2),
>
> reliability_grade TEXT, -- A\|B\|C\|D\|F
>
> reliability_completeness DECIMAL(6,2),
>
> reliability_consistency DECIMAL(6,2),
>
> reliability_freshness DECIMAL(6,2),
>
> reliability_source DECIMAL(6,2),
>
> reliability_penalties DECIMAL(6,2),
>
> -- Confidence (signal strength)
>
> confidence_total DECIMAL(6,2),
>
> confidence_grade TEXT, -- HIGH\|MEDIUM\|LOW\|VERY LOW
>
> confidence_signal DECIMAL(6,2),
>
> confidence_trend DECIMAL(6,2),
>
> confidence_depth DECIMAL(6,2),
>
> confidence_peers DECIMAL(6,2),
>
> confidence_valuation DECIMAL(6,2),
>
> confidence_penalty DECIMAL(6,2),
>
> -- Composite
>
> composite_score DECIMAL(6,2),
>
> ready_for_ai BOOLEAN,
>
> -- Signal inventory (JSON arrays)
>
> bullish_signals TEXT,
>
> bearish_signals TEXT,
>
> neutral_signals TEXT,
>
> data_gap_flags TEXT, -- passed verbatim to AI prompt context
>
> -- Metadata
>
> data_years_available SMALLINT,
>
> primary_source TEXT,
>
> auditor_tier TEXT, -- populated from AUDITOR_MAP in pipeline_runner.py
>
> sector_peers_count SMALLINT DEFAULT 0, -- peers in subsector with financials. If \< 8, z-scores computed at sector level or set to NULL
>
> anomalous_metrics TEXT, -- JSON array
>
> sector_peers_count SMALLINT DEFAULT 0,
>
> computed_at TIMESTAMPTZ DEFAULT NOW()
>
> );
>
> ✓ SCORING MIGRATION (Option B — Full Replacement):  
>   
> Phase 6 scoring replaces v1 entirely. The stocks.completeness_score and stocks.confidence_score columns are overwritten with Phase 6 values. This requires a coordinated migration:  
>   
> 1. BATCH FIRST: Before enabling Phase 6 scoring in production, run scoring_engine.py for ALL ~960 active stocks. No mixed population — every stock must have v2 scores before any UI switch.  
>   
> 2. COLUMN SEMANTICS CHANGE:  
> • stocks.completeness_score ← stock_scores.reliability_total (was: pure data presence from v_data_completeness)  
> • stocks.confidence_score ← stock_scores.confidence_total (was: data quality from score_calculator.py)  
> • stocks.score_version ← "v2" (was: "v1")  
>   
> 3. SYNC COMMAND (after batch scoring completes):  
> UPDATE stocks SET completeness_score = ss.reliability_total,  
> confidence_score = ss.confidence_total,  
> score_version = 'v2',  
> scores_updated_at = ss.computed_at  
> FROM stock_scores ss WHERE stocks.ticker = ss.ticker;  
>   
> 4. UI UPDATES REQUIRED (implementation step — see Section 8.4):  
> • DataQualityWidget: replace v_data_completeness breakdown with stock_scores decomposed components  
> • Screener (stock-table.tsx): recalibrate color thresholds for new confidence semantics  
> • Preserve the existing Stockbit refresh wizard (StockbitRefreshModal) — it is not replaced  
> • completeness.ts query module: read from stock_scores instead of v_data_completeness  
>   
> 5. DEPRECATE v_data_completeness: After v2 migration is complete, the SQL view is no longer the source of truth. Keep it for debugging but the UI reads from stock_scores.  
>   
> 6. score_calculator.py: After full migration, update_scores_for_ticker() and update_all_scores() should invoke the Phase 6 scoring_engine instead of the v1 logic. The v1 code is archived, not deleted, in case rollback is needed.

**3.4 financials Table Field Name Mapping**

The existing financials table uses different column names than the previous FRD's YearlyFinancials dataclass. The data_normalizer.py must use these exact column names when reading from Supabase:

| **YearlyFinancials field** | **financials table column**           | **Notes**                                                                                                                    |
|----------------------------|---------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| net_profit                 | net_income                            | Same value, different name                                                                                                   |
| operating_income           | operating_income                      | Direct read (EBIT). Used instead of EBITDA in the 20 tracked metrics — raw EBITDA is not stored in the schema.               |
| operating_cf               | operating_cash_flow                   | Same value, different name                                                                                                   |
| free_cash_flow             | free_cash_flow                        | Same name — direct read                                                                                                      |
| total_equity               | total_equity                          | Same name                                                                                                                    |
| total_debt                 | total_debt                            | Same name                                                                                                                    |
| close_price                | Not in financials — join daily_prices | Use latest close from daily_prices WHERE date = MAX(date)                                                                    |
| eps                        | eps                                   | Same name                                                                                                                    |
| bvps                       | book_value_per_share                  | Different name                                                                                                               |
| dps                        | abs(dividends_paid) / listed_shares   | COMPUTED per year from financials.dividends_paid and stocks.listed_shares. NULL if dividends_paid is NULL.                   |
| gross_margin               | gross_margin                          | Pre-computed in financials — read directly                                                                                   |
| net_margin                 | net_margin                            | Pre-computed — read directly                                                                                                 |
| roe                        | roe                                   | Pre-computed — read directly                                                                                                 |
| roa                        | roa                                   | Pre-computed — read directly                                                                                                 |
| debt_to_equity             | debt_to_equity                        | Pre-computed — read directly                                                                                                 |
| current_ratio              | current_ratio                         | Pre-computed — read directly                                                                                                 |
| interest_coverage          | interest_coverage                     | Pre-computed — read directly                                                                                                 |
| pe_ratio                   | pe_ratio                              | Pre-computed — read directly                                                                                                 |
| pb_ratio                   | pbv_ratio                             | Different name                                                                                                               |
| dividend_yield             | dividend_yield                        | Pre-computed — read directly                                                                                                 |
| cash                       | cash_and_equivalents                  | Different name — direct read                                                                                                 |
| fcf_to_net_income          | free_cash_flow / net_income           | COMPUTED by normalizer. NULL if net_income \<= 0 (meaningless ratio). Year added to anomaly_years if net_income is negative. |

> ℹ Use financials WHERE quarter = 0 (annual records only) for normalization. Quarterly records (quarter 1-4) are excluded from trend analysis but used for recency-adjusted valuation ratios.

**4. AI Context Bundle**

The AI context bundle is the core deliverable of Phase 6. It is a structured JSON object that aggregates clean, normalized data from all five layers into a single payload. It is built by scripts/scoring/context_builder.py and cached in the ai_context_cache table.

Design principle: **the context bundle is self-contained.** The LLM receives this bundle as the sole data input. No additional database queries are made at inference time. Everything the AI needs to reason about a stock — fundamentals, valuation, smart money, shareholders, technicals, quarterly momentum, dividends, data quality limitations — is in the bundle.

**4.1 New Table: ai_context_cache**

> CREATE TABLE ai_context_cache (
>
> ticker TEXT PRIMARY KEY REFERENCES stocks(ticker) ON DELETE CASCADE,
>
> context_json JSONB NOT NULL, -- the full AI context bundle
>
> context_version TEXT DEFAULT '1.0', -- bump when bundle schema changes
>
> token_estimate INTEGER, -- estimated Claude API tokens
>
> ready_for_ai BOOLEAN DEFAULT FALSE, -- gates both reliability and confidence
>
> built_at TIMESTAMPTZ DEFAULT NOW(),
>
> data_as_of DATE -- latest date of any underlying data
>
> );

**4.2 AI Context Bundle Schema**

The complete JSON structure. All fields are required unless marked optional. Claude Code must implement context_builder.py to produce exactly this shape.

**4.2.1 Top-Level Structure**

> {
>
> "ticker": "BBCA",
>
> "name": "Bank Central Asia Tbk",
>
> "sector": "Finance",
>
> "sub_sector": "Banks",
>
> "is_bumn": false,
>
> "is_lq45": true,
>
> "is_idx30": true,
>
> "generated_at": "2026-03-27T...",
>
> "data_as_of": "2026-03-26",

"macro_context": { ... }, // Section 4.2.9

> "data_quality": { ... }, // Section 4.2.2
>
> "fundamentals": { ... }, // Section 4.2.3
>
> "valuation": { ... }, // Section 4.2.4
>
> "smart_money": { ... }, // Section 4.2.5
>
> "shareholders": { ... }, // Section 4.2.6
>
> "health_score": { ... }, // Section 4.2.7
>
> "sector_context": { ... }, // Section 4.2.8
>
> "technical_context": { ... }, // Section 4.2.10 (v3.0) — null if no signals
>
> "quarterly_trend": { ... }, // Section 4.2.11 (v3.0) — null if no quarterly data
>
> "dividend_profile": { ... }, // Section 4.2.12 (v3.0) — null if non-payer
>
> }

> ℹ **v3.0:** The bundle now has **11 data blocks** (was 8). The three blocks added in v3.0 — `technical_context`, `quarterly_trend`, `dividend_profile` — are **nullable**: `context_builder.py` emits the key with a `null` value when the underlying data does not exist (e.g. a small-cap with no technical signals, or a non-dividend payer). Claude is instructed to treat a `null` block as "data not available" and note it in `data_gaps_acknowledged`.

**4.2.2 data_quality Block**

Sourced from stock_scores and data_quality_flags. Tells Claude how much to trust the numbers and where the gaps are.

> "data_quality": {
>
> "reliability_score": 78.5, // from stock_scores.reliability_total
>
> "reliability_grade": "B",
>
> "confidence_score": 65.2, // from stock_scores.confidence_total
>
> "confidence_grade": "MEDIUM",
>
> "composite_score": 70.1,
>
> "ready_for_ai": true,
>
> "data_years_available": 10,
>
> "primary_source": "stockbit",
>
> "auditor_tier": "big4",
>
> "missing_metrics": \[\],
>
> "anomalous_years": \[2020\], // years with anomaly flags
>
> "flagged_issues": \["covid_year_2020", "one_time_items_2020"\],
>
> "data_gap_flags": \[\], // passed verbatim from stock_scores.data_gap_flags
>
> "banking_exemptions_applied": true // only for bank stocks
>
> }

**4.2.3 fundamentals Block**

Sourced from normalized_metrics. One entry per tracked metric. Includes latest value + trend signals. Pre-aggregated so Claude receives insight, not raw tables.

> "fundamentals": {
>
> "latest_year": 2024,
>
> "metrics": {
>
> "revenue": {
>
> "value": 107000000000000,
>
> "unit": "idr",
>
> "cagr_10yr": 0.077, // 7.7%
>
> "cagr_3yr": 0.101, // 10.1%
>
> "trend": "mild_up",
>
> "trend_r2": 0.91, // very consistent
>
> "vs_sector_pct": 95.0, // 95th percentile in peer group (null if \< 8 peers)  
> "peer_group": "subsector", // "subsector" \| "sector" \| null  
> "peer_count": 48, // actual peers used in comparison  
> "anomaly_years": \[\]
>
> "anomaly_years": \[\]
>
> },
>
> "roe": { "value": 0.123, "unit": "percent", "cagr_10yr": -0.021, "trend": "mild_down", "trend_r2": 0.47, ... },
>
> "net_margin": { ... },
>
> "gross_margin": { ... },
>
> "free_cash_flow": { ... },
>
> "fcf_to_net_income":{ ... },
>
> "debt_to_equity": { ... },
>
> "interest_coverage":{ ... },
>
> "eps": { ... },
>
> "dps": { ... }
>
> // ... remaining metrics: operating_income, operating_cash_flow, cash,  
> // gross_margin, roa, current_ratio, bvps, dps, pb_ratio, dividend_yield  
> // (20 total — see Section 3.2 for canonical names and derivation rules)
>
> },
>
> "key_signals": {
>
> "revenue_growth_acceleration": true, // cagr_3yr \> cagr_10yr
>
> "margin_compression": false,
>
> "deleveraging": true, // debt_to_equity trend = strong_down
>
> "fcf_quality_concern": false, // fcf_to_net_income \< 0.70
>
> "dividend_growth": true
>
> }
>
> }

**4.2.4 valuation Block**

Sourced from financials (latest annual + daily_prices latest close) and pre-computed Graham/DCF values. The context builder replicates the valuation.ts computation logic in Python to populate this block.

> "valuation": {
>
> "current_price": 9200,
>
> "price_date": "2026-03-26",
>
> "market_cap": 22560000000000,
>
> "pe_ratio": 5.95,
>
> "pb_ratio": 0.76,
>
> "ps_ratio": 0.21,
>
> "ev_ebitda": 4.10,
>
> "peg_3yr": 0.59, // pe_ratio / (3yr earnings CAGR ×100) — v3.0
>
> "peg_5yr": 0.71, // pe_ratio / (5yr earnings CAGR ×100) — v3.0
>
> "dividend_yield": 0.059,
>
> "payout_ratio": 0.35,
>
> "earnings_yield": 0.168,
>
> // Intrinsic value estimates
>
> "valuation_mode": "fcf", // v3.0: 'fcf' | 'dividend' | 'eps' — auto-selected (see below)
>
> "graham_number": 12450, // sqrt(22.5 × EPS × BVPS)
>
> "graham_margin_of_safety": 0.261, // (graham - price) / graham
>
> "dcf_bear": 9800,
>
> "dcf_base": 13200,
>
> "dcf_bull": 18500,
>
> "dcf_base_margin_of_safety": 0.303,
>
> // Sector-relative context
>
> "pe_vs_sector_median": -0.42, // z-score: below sector median
>
> "pb_vs_sector_median": -1.15,
>
> "verdict_hint": "below_intrinsic" // 'below_intrinsic'\|'near_fair_value'\|'above_intrinsic'
>
> }

> ℹ **v3.0 — valuation_mode auto-selection.** The intrinsic-value model is chosen per ticker instead of always running FCF-DCF:
>
> - **`fcf`** (default) — discounted free cash flow. Used for non-financial companies with positive trailing FCF.
> - **`dividend`** — dividend discount model (DDM). Used for banks (FCF is not meaningful for lenders) and high-yield payers. Falls back to the `dividend_history` table when per-year `dividends_paid` is missing from the annual financials.
> - **`eps`** — EPS-growth fallback. Used when FCF ≤ 0 and the stock is not a dividend payer.
>
> `valuation_mode` records which model produced `dcf_bear/base/bull`. PEG (`peg_3yr`, `peg_5yr`) is `null` when earnings growth is ≤ 0 (a negative or zero PEG is meaningless and is not emitted).

**4.2.5 smart_money Block**

Sourced from broker_flow, bandar_signal, and insider_transactions. The context builder aggregates the last 30 days of data using the same logic as signal-confidence.ts but in Python.

> "smart_money": {
>
> "window_days": 30,
>
> "data_as_of": "2026-03-26",
>
> "phase": "akumulasi", // akumulasi\|distribusi\|netral
>
> "confidence_score": 72, // 0-100, replicates signal-confidence.ts
>
> "confidence_grade": "Kuat",
>
> "narrative": "Smart money masuk — asing dan bandar top5 selaras beli.",
>
> // Component scores
>
> "components": {
>
> "broker_magnitude": 20, // abs(netFlow)/totalValue = 6.2%
>
> "foreign_alignment": 18,
>
> "bandar_confirmation": 15,
>
> "insider_weight": 10,
>
> "broker_concentration": 9
>
> },
>
> // 30-day aggregate flows (IDR)
>
> "asing_net_30d": 1240000000000, // positive = net buy
>
> "lokal_net_30d": 320000000000,
>
> "pemerintah_net_30d": -80000000000,
>
> "foreign_net_30d": 1240000000000, // from daily_prices.foreign_net
>
> // Bandar signal (latest date)
>
> "bandar_latest_date": "2026-03-26",
>
> "bandar_accdist": "Big Acc",
>
> "bandar_top5_accdist": "Acc",
>
> // Insider activity (last 90 days)
>
> "insider_window_days": 90,
>
> "insider_net_direction": "buy", // buy\|sell\|neutral
>
> "insider_buy_count": 2,
>
> "insider_sell_count": 0,
>
> "insider_material_change": true // any transaction \> 0.5% ownership change
>
> }

**4.2.6 shareholders Block**

Sourced from shareholders and shareholders_major (latest snapshot). Optional — included only if data exists.

> "shareholders": {
>
> "snapshot_date": "2025-12-31", // most recent report_date
>
> "top_holders": \[
>
> { "name": "Farindo Investments", "type": "institution", "pct": 54.94 },
>
> { "name": "Public", "type": "public", "pct": 45.06 }
>
> \],
>
> "foreign_ownership_pct": 28.1, // sum of asing broker_type holders if available
>
> "public_float_pct": 45.06,
>
> "government_ownership_pct": 0.0,
>
> "concentration_flag": "high" // high (\>50% in 1 holder) \| moderate \| low
>
> }

**4.2.7 health_score Block**

Sourced from latest annual financials row. Replicates health-score.ts 7-metric system in Python for consistency.

> "health_score": {
>
> "total": 82, // 0-100
>
> "grade": "Sehat", // Sehat\|Cukup Sehat\|Perlu Perhatian\|Tidak Sehat
>
> "components": {
>
> "roe": { "value": 0.123, "score": 12, "max": 15, "flag": "green" },
>
> "net_margin": { "value": 0.355, "score": 14, "max": 15, "flag": "green" },
>
> "roa": { "value": 0.025, "score": 10, "max": 15, "flag": "yellow" },
>
> "current_ratio": { "value": null, "score": null, "exempt": true },
>
> "debt_to_equity": { "value": 0.13, "score": 15, "max": 15, "flag": "green" },
>
> "free_cash_flow": { "value": 31000000000000, "score": 15, "max": 20, "flag": "green" },
>
> "gross_margin": { "value": 0.673, "score": 16, "max": 20, "flag": "green" }
>
> }
>
> }

**4.2.8 sector_context Block**

Sourced from stock_scores for all peers in same sector. Enables peer-relative analysis in Claude's reasoning.

> "sector_context": {
>
> "sector": "Finance",
>
> "sub_sector": "Banks",
>
> "peers_count": 48, // effective peers with financials in subsector  
> "peer_group_level": "subsector", // "subsector" if \>= 8 peers, "sector" if fallback
>
> "sector_median_pe": 14.5,
>
> "sector_median_pb": 1.8,
>
> "sector_median_roe": 0.156,
>
> "sector_median_net_margin": 0.28,
>
> "stock_percentile_pe": 12.5, // lower PE = higher percentile if lower is better
>
> "stock_percentile_roe": 71.3,
>
> "stock_percentile_composite": 87.5, // composite score vs peers
>
> "top_peers": \[
>
> { "ticker": "BBRI", "composite_score": 71.2, "pe": 8.1, "roe": 0.18 },
>
> { "ticker": "BMRI", "composite_score": 68.9, "pe": 9.2, "roe": 0.17 }
>
> \]
>
> }

4.2.9 macro_context Block (NEW)

Loaded from shared/macro-context.json (file) or a single-row macro_context Supabase table. Same for all stocks. Updated monthly by the user (takes ~5 minutes). Injected into the AI prompt as system-level context so analysis is time-aware.

"macro_context": {

"as_of": "2026-03",

"bi_rate": 5.75,

"bi_rate_direction": "easing_expected",

"usd_idr": 16200,

"idr_trend": "weakening",

"idx_composite_ytd": -3.2,

"foreign_flow_regime": "net_outflow",

"foreign_flow_note": "Broad EM de-risking driven by Fed policy, not IDX-specific.",

"key_events": \[

"BI rate decision April 15 — market expects hold",

"Q1 2026 earnings season starts mid-April"

\]

}

Storage options (choose one at implementation time):

Option A: shared/macro-context.json file — loaded at context build time. Simple, version-controlled.

Option B: macro_context Supabase table (single row) — editable via Pipeline Debug Panel (Section 8.5).

Recommendation: start with JSON file, migrate to DB table when Pipeline Debug Panel is implemented.

**Shipped:** macro context is loaded from `shared/macro-context.json`. Beyond the v2.0 fields it now also carries `idx_composite_level`, `foreign_flow_ytd_usd`, `global_sentiment`, `vix_level`, `fed_stance`, `dxy_level`, a `commodity_context` object (gold / coal / cpo / nickel trends — material for IDX commodity names), and an `indonesia_specific` object (fdi_trend, election_cycle, inflation).

**4.2.10 technical_context Block (v3.0 — NEW)**

Sourced from daily_prices, technical_signals, wyckoff_events, and market_phases. Gives the AI price-action and structural-phase awareness alongside the fundamental view. Nullable — set to `null` when no signals exist for the ticker.

> "technical_context": {
>
> "as_of": "2026-03-26",
>
> "price_trend": "uptrend", // from market_phases
>
> "market_phase": "markup", // accumulation\|markup\|distribution\|markdown
>
> "rsi_14": 58.2,
>
> "macd_signal": "bullish_cross", // bullish_cross\|bearish_cross\|neutral
>
> "volume_signal": "above_average", // from technical_signals
>
> "wyckoff_phase": "phase_D", // latest wyckoff_events FSM phase (v2 detector)
>
> "wyckoff_event": "SOS", // latest structural event (e.g. Spring, SOS, UTAD)
>
> "distance_from_52w_high": -0.08, // -8% below 52-week high
>
> "distance_from_52w_low": 0.34
>
> }

**4.2.11 quarterly_trend Block (v3.0 — NEW)**

Sourced from financials WHERE quarter IN (1,2,3,4) plus TTM/keystats rows. Captures short-term momentum that the annual-only fundamentals block cannot show. Nullable — set to `null` when quarterly data is unavailable.

> "quarterly_trend": {
>
> "latest_quarter": "2025-Q4",
>
> "ttm_revenue": 112000000000000,
>
> "ttm_net_income": 39800000000000,
>
> "revenue_qoq": 0.031, // quarter-over-quarter
>
> "revenue_yoy": 0.094, // year-over-year vs same quarter prior year
>
> "net_income_qoq": 0.021,
>
> "net_income_yoy": 0.118,
>
> "net_margin_trend_3q": "expanding", // expanding\|stable\|compressing — last 3 quarters
>
> "recent_quarters": \[ // last 6 quarters, compact
>
> { "period": "2025-Q4", "revenue": ..., "net_income": ..., "net_margin": 0.355 }
>
> // ... up to 6 entries
>
> \]
>
> }

**4.2.12 dividend_profile Block (v3.0 — NEW)**

Sourced from financials.dividends_paid and the dividend_history table. Supports the dividend valuation mode (Section 4.2.4) and dividend-income strategy classification. Nullable — set to `null` for non-payers.

> "dividend_profile": {
>
> "ttm_dividend_yield": 0.059,
>
> "payout_ratio": 0.35,
>
> "years_paid_consecutive": 12,
>
> "dps_cagr_5yr": 0.083, // 5-year DPS growth
>
> "dividend_trend": "growing", // growing\|stable\|declining\|irregular
>
> "sustainability": "strong", // strong\|adequate\|stretched — payout vs FCF/earnings
>
> "last_dividend_date": "2025-04-15"
>
> }

**5. context_builder.py Module**

New file: scripts/scoring/context_builder.py. Reads from all five data layers and assembles the AI context bundle. No scraping — reads only from existing Supabase tables.

**5.1 Class Interface**

> \# scripts/scoring/context_builder.py
>
> class ContextBuilder:
>
> def \_\_init\_\_(self, sb_client):
>
> self.sb = sb_client
>
> self.cleaner = DataCleaner()
>
> def build(self, ticker: str,
>
> smart_money_days: int = 30,
>
> insider_days: int = 90) -\> ContextBundle:
>
> '''
>
> Full build: clean → normalize → score → assemble all 8 blocks.
>
> Writes result to ai_context_cache. Returns ContextBundle.
>
> '''
>
> def build_batch(self, tickers: list\[str\], \*\*kwargs) -\> dict\[str, ContextBundle\]:
>
> '''Batch build with rate limiting. Writes all to ai_context_cache.'''
>
> def is_stale(self, ticker: str, max_age_hours: int = 24) -\> bool:
>
> '''Returns True if cache is older than max_age_hours or missing.'''
>
> @dataclass
>
> class ContextBundle:
>
> ticker: str
>
> context: dict \# the full JSON bundle (Section 4.2)
>
> token_estimate: int \# ~len(json.dumps(context)) / 4
>
> ready_for_ai: bool
>
> build_duration_ms: int

**5.2 Build Steps**

1.  1\. Load stock profile from stocks table

2.  2\. Run DataCleaner.get_clean_financials(ticker) → cleaned annual rows

3.  3\. Run DataNormalizer.normalize() on clean financials + sector peer data. For each metric, compute z-score and percentile against subsector peers. If subsector peer count \< 8, fall back to parent sector. Record peer_group_level ('subsector' \| 'sector' \| NULL) and peer_count per metric.

4.  4\. Run ScoringPipeline.run() → StockScoreBundle

5.  5\. Fetch smart money data: broker_flow + bandar_signal + insider_transactions (last 30/90 days)

6.  6\. Compute smart money confidence score (Python port of signal-confidence.ts logic)

7.  7\. Fetch shareholders_major (latest snapshot)

8.  8\. Fetch valuation inputs: latest close from daily_prices, Graham + DCF computation

9.  9\. Compute health score (Python port of health-score.ts logic)

10. 10\. Build sector_context by querying stock_scores peers in same sector

11. 10b\. (v3.0) Build technical_context (technical_signals + wyckoff_events + market_phases), quarterly_trend (quarterly financials + TTM), and dividend_profile (dividends_paid + dividend_history). Each is null if its source data is absent.

12. 11\. Assemble final context bundle dict

12. 12\. Estimate token count: len(json.dumps(bundle)) // 4

13. 13\. Write to ai_context_cache (upsert on ticker)

14. 14\. Update stocks.completeness_score and stocks.confidence_score

**5.3 Token Budget**

The context bundle must fit within Claude's usable context window after accounting for the system prompt and output tokens. Target:

| **Block**                   | **Typical Size** | **Notes**                           |
|-----------------------------|------------------|-------------------------------------|
| data_quality                | ~400 tokens      | Small — mostly scores and arrays    |
| fundamentals                | ~1,200 tokens    | 20 metrics × ~4 fields each         |
| valuation                   | ~600 tokens      | ~15 fields                          |
| smart_money                 | ~700 tokens      | Aggregated — not raw daily rows     |
| shareholders                | ~400 tokens      | Top 5 holders only                  |
| health_score                | ~500 tokens      | 7 components                        |
| sector_context              | ~500 tokens      | Top 3 peers only                    |
| macro_context               | ~400 tokens      | Shared across all stocks            |
| technical_context (v3.0)    | ~350 tokens      | Null if no signals                  |
| quarterly_trend (v3.0)      | ~450 tokens      | Last 6 quarters, compact            |
| dividend_profile (v3.0)     | ~250 tokens      | Null for non-payers                 |
| Overhead (keys, formatting) | ~400 tokens      |                                     |
| Total                       | ~6,200 tokens    | Well within the model context window (11 blocks) |

> ⚠ If token_estimate exceeds 6,000: trim smart_money.top_brokers to 5 entries, sector_context.top_peers to 3 entries, and truncate values_json arrays in normalized_metrics to latest 5 years. Log a warning.

5.4 Shared Scoring Configuration (TypeScript ↔ Python)

Three TypeScript modules must be ported to Python for context_builder.py: signal-confidence.ts (491 lines), health-score.ts (85 lines), and valuation.ts (165 lines). To prevent threshold drift between the UI and AI context bundle, all scoring constants are extracted into a single shared JSON config file.

New file: shared/scoring-config.json

Read by: TypeScript (web/src/lib/constants.ts) and Python (scripts/scoring/config.py)

{

"health_thresholds": {

"roe": { "green": 15, "yellow": 8 },

"net_margin": { "green": 10, "yellow": 5 },

"gross_margin": { "green": 30, "yellow": 15 },

"roa": { "green": 8, "yellow": 4 },

"current_ratio": { "green": 1.5, "yellow": 1.0 },

"debt_to_equity": { "green": 1.0, "yellow": 2.0, "invert": true },

"fcf": { "type": "sign", "green": 0 }

},

"smart_money": {

"broker_magnitude_tiers": \[0.10, 0.05, 0.02, 0.005\],

"broker_magnitude_scores": \[25, 20, 15, 10, 5\],

"broker_magnitude_max": 25,

"foreign_alignment_max": 25,

"foreign_dominance_tiers": \[0.5, 0.2\],

"foreign_dominance_muls": \[1.0, 0.8, 0.6\],

"bandar_confirmation_max": 20,

"bandar_blend_weights": \[0.6, 0.4\],

"bandar_aligned_scores": { "strong": 20, "normal": 15, "weak": 10 },

"bandar_contradict_scores": { "strong": 2, "normal": 5, "weak": 7 },

"insider_weight_max": 15,

"insider_value_tiers": \[10000000000, 1000000000, 100000000\],

"insider_value_scores": \[15, 12, 9, 6\],

"insider_ownership_bonus": 2,

"insider_ownership_threshold": 1.0,

"broker_concentration_max": 15,

"concentration_tiers": \[30, 20, 10\],

"concentration_scores": \[15, 12, 9, 5\],

"strength_labels": \[

{ "min": 80, "label": "Sangat Kuat" },

{ "min": 60, "label": "Kuat" },

{ "min": 40, "label": "Sedang" },

{ "min": 20, "label": "Lemah" },

{ "min": 0, "label": "Sangat Lemah" }

\]

},

"valuation": {

"risk_free_rate": 6.75,

"equity_risk_premium": 6.25,

"base_wacc": 13.0,

"terminal_growth": 3.0,

"scenario_variation": 0.10,

"graham_constant": 22.5,

"mos_undervalued": 30,

"mos_fairly_valued": 0

}

}

Implementation rules:

• TypeScript: web/src/lib/constants.ts reads from shared/scoring-config.json at build time (import JSON). Replace existing hardcoded HEALTH_THRESHOLDS and valuation constants.

• Python: scripts/scoring/config.py loads the same file. All scoring modules import from config.py.

• When a threshold changes: edit scoring-config.json once. Both languages pick it up automatically.

• The narrative generator (generateNarrative in signal-confidence.ts) is NOT shared — it is UI-only and not part of the AI context bundle. The Python port only needs computeConfidence() and its 5 component scorers.

• Scoring logic (if/else chains, clamp, alignment checks) is duplicated in both languages — only the threshold values are shared.

Validation (implementation step):

After Python port is complete, run a comparison test on 5 blue-chip tickers (BBCA, BBRI, BMRI, TLKM, ASII):

• Compute smart_money confidence via TypeScript (from the UI/API) and via Python (from context_builder.py)

• Compute health_score via TypeScript and Python

• Compute Graham number + DCF scenarios via both

• Assert: all scores match within ±1 point (rounding tolerance)

• If delta \> 1 for any ticker: investigate logic divergence before proceeding

**6. AI Analyst Module**

File: scripts/scoring/ai_analyst.py. Reads from ai_context_cache, calls an LLM via a **provider abstraction** (a single enriched call — not a multi-step chain), and writes the result to the ai_analysis table.

> ℹ **v3.0 — multi-provider.** `ai_analyst.py` is model-agnostic via a `get_provider(provider, model, ...)` factory:
> - **OpenAI** (default) — `OpenAIProvider`, default model `gpt-5.2` (also `gpt-5.4`, `gpt-4o`, mini/nano variants). Per-model input/output pricing is built in for cost estimation.
> - **Anthropic** — `AnthropicProvider`, default model `claude-sonnet-4-20250514` (`claude-haiku-4-5` for cheap test runs).
>
> `AIAnalyst(provider="openai"|"anthropic", model=None)` resolves the default model for the chosen provider. The `ai_analysis.model_used` column records whichever model actually ran.

**6.1 New Table: ai_analysis**

> CREATE TABLE ai_analysis (
>
> ticker TEXT PRIMARY KEY REFERENCES stocks(ticker) ON DELETE CASCADE,
>
> -- Classification
>
> lynch_category TEXT, -- slow_grower\|stalwart\|fast_grower\|cyclical\|turnaround\|asset_play
>
> lynch_rationale TEXT,
>
> buffett_moat TEXT, -- none\|narrow\|wide
>
> buffett_moat_source TEXT,
>
> business_narrative TEXT, -- 3-4 sentence business story
>
> financial_health_signal TEXT, -- improving\|stable\|deteriorating
>
> -- Three scenarios (stored as JSONB)
>
> bull_case JSONB, -- {scenario, drivers\[\], price_target, timeframe, probability, early_signs\[\]}
>
> bear_case JSONB, -- same structure
>
> neutral_case JSONB, -- {scenario, drivers\[\], price_range_low, price_range_high, probability, what_breaks_it\[\]}
>
> -- Strategy
>
> strategy_fit JSONB, -- {primary, ideal_investor, position_sizing}
>
> what_to_watch TEXT, -- JSON array of metric+threshold strings
>
> analyst_verdict TEXT, -- strong_buy\|buy\|hold\|avoid\|strong_avoid
>
> confidence_level SMALLINT, -- 1-10
>
> data_gaps_acknowledged TEXT, -- JSON array
>
> caveats TEXT, -- JSON array
>
> -- Metadata
>
> model_used TEXT DEFAULT 'claude-sonnet-4-20250514',
>
> context_version TEXT,
>
> prompt_tokens INTEGER,
>
> output_tokens INTEGER,
>
> generated_at TIMESTAMPTZ DEFAULT NOW()
>
> );

New Table: stock_notes (Layer 3 domain context, optional per ticker)

CREATE TABLE stock_notes (

ticker TEXT PRIMARY KEY REFERENCES stocks(ticker) ON DELETE CASCADE,

domain_notes TEXT, -- 2-5 sentences of business context (user-written)

updated_at TIMESTAMPTZ DEFAULT NOW()

);

When domain_notes is present for a ticker, context_builder.py injects it into the AI prompt. When absent, the AI works with the data bundle + macro context + sector template only and flags conclusions that would benefit from deeper company-specific knowledge.

> );

6.2 Single Enriched Call Architecture (replaces 3-call chain)

Simulation testing confirmed that the original 3-call chain (Bull Agent -\> Bear Agent -\> Synthesis Agent) produced data summaries, not investment insight. The AI restated numbers the user already sees on the dashboard. A single enriched call with domain context injection produced significantly better output: forward-looking scenarios, strategy classification, catalysts, and actionable what-to-watch metrics.

6.3 System Prompt Architecture

Single System Prompt (enriched with 3-layer context)

SYSTEM = '''  
You are a senior equity analyst for Indonesian stocks (IDX/BEI). You combine  
Warren Buffett's value investing framework and Peter Lynch's stock classification.  
  
BUFFETT FRAMEWORK — assess for every stock:  
- Economic moat (none\|narrow\|wide): what protects profits? Is it durable?  
- Owner earnings: look past accounting — what cash can the owner actually take out?  
- Margin of safety: how much can you be wrong and still not lose money?  
  
PETER LYNCH CATEGORIES — classify every stock into exactly ONE:  
- slow_grower: Large mature, 2-4% growth, buy for dividends  
- stalwart: Large quality, 10-12% growth, moderate upside, recession-resistant  
- fast_grower: Small/mid aggressive, 20%+ growth, highest upside but risky  
- cyclical: Revenue/profits follow economic or commodity cycles. Timing \> valuation.  
- turnaround: In crisis or recovering. Binary outcome.  
- asset_play: Valuable assets the market hasn't noticed  
  
CRITICAL RULES:  
- Do NOT summarize the data. The user already sees every number on their dashboard.  
- Your job is to provide INSIGHT that the numbers alone cannot show.  
- Explain the BUSINESS STORY: what is actually happening and why.  
- Each scenario must explain: what happens, what drives it, what the stock does,  
and the early signs that this scenario is playing out.  
- The neutral case is the MOST LIKELY path, not a blend of bull/bear.  
- If domain_notes are empty, work with data + macro + sector template.  
Flag conclusions that would benefit from deeper company-specific knowledge.  
- data_gap_flags must be acknowledged. Say what you don't know and how it  
would change your view.  
  
IDX-specific:  
- Banking: weight NIM, CASA, NPL. Ignore current_ratio/interest_coverage.  
- BUMN: apply 15-20% structural PE discount (governance + political lending risk).  
- COVID 2020: structural anomaly, not company-specific. Do not cite as pattern.  
- Low PE on cyclicals is often a trap (Lynch rule). High yield from BUMN may be  
government extracting cash, not shareholder-friendly policy.  
'''

| Component                        | Source                                                        | Purpose                                                                                                                                                                                                                                                            | Update Frequency                         |
|----------------------------------|---------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------|
| Layer 1: Macro Context           | shared/macro-context.json — single file, same for all stocks  | BI rate + direction, USD/IDR, IDX YTD, foreign flow regime, key upcoming events. Gives the AI time-awareness so analysis is not timeless/generic.                                                                                                                  | Monthly (manual, ~5 min)                 |
| Layer 2: Sector Template         | shared/sectors/{subsector}.json — 33 files, one per subsector | Key metrics for this sector, valuation methodology, current sector dynamics, sector-specific risks, exemptions (e.g. banking: ignore current_ratio). Prevents bank analysis from discussing current_ratio or coal analysis ignoring commodity cycle.               | Quarterly (manual review)                |
| Layer 3: Domain Notes (optional) | stock_notes table — free-text per ticker, user-written        | 2-5 sentences of company-specific context (competitive moat, business model, catalysts). When absent, AI works with data + macro + sector template only and flags limited context. Analysis still useful without it — macro + sector do most of the heavy lifting. | On demand (user writes when researching) |

**6.3-LEGACY System Prompt Architecture (DEPRECATED — historical only)**

> ⚠ **DEPRECATED (v3.0).** The block below is the **old v2.0 "3-call chain" system prompt** ("Shared System Prompt (all three calls)"). It is superseded by the single enriched-call prompt documented immediately above (Section 6.3, "Single System Prompt"). It is retained only for historical traceability — **do not implement this version.** The shipped `ai_analyst.py` uses the single enriched call with the 3-layer context (macro + sector template + domain notes).

**Shared System Prompt (all three calls) — DEPRECATED**

> SYSTEM = '''
>
> You are a senior equity analyst specializing in Indonesian publicly listed
>
> companies (IDX/BEI). You follow a quality-first investment framework.
>
> You think in terms of business economics first, then financials as evidence
>
> of business quality, then valuation as the final gate.
>
> IDX-specific knowledge you must apply:
>
> \- Banking stocks (sub_sector=Banks): weight NIM trend, NPL, CASA ratio.
>
> Ignore missing current_ratio and interest_coverage (structural exemption).
>
> \- BUMN stocks (is_bumn=true): apply 15-20% structural P/E discount vs peers
>
> due to governance and political risk. This is NOT a flaw, it is structural.
>
> \- COVID year 2020: all anomalies in 2020 are structural, not company-specific.
>
> Do not cite 2020 as evidence of a business deterioration pattern.
>
> \- data_gap_flags in the context must be acknowledged in your output.
>
> Say exactly: 'Insufficient data to conclude on \[specific metric\]'.
>
> Output Schema (strict JSON — 3-scenario structure)
>
> {  
> "lynch_category": "\<slow_grower\|stalwart\|fast_grower\|cyclical\|turnaround\|asset_play\>",  
> "lynch_rationale": "\<2 sentences\>",  
> "buffett_moat": "\<none\|narrow\|wide\>",  
> "buffett_moat_source": "\<1-2 sentences\>",  
> "business_narrative": "\<3-4 sentences — the STORY, not the numbers\>",  
> "financial_health_signal": "\<improving\|stable\|deteriorating\>",  
> "bull_case": {  
> "scenario": "\<3-4 sentences: what happens to the business\>",  
> "drivers": \["\<specific factor\>", "\<another\>", "\<another\>"\],  
> "price_target": \<number\>,  
> "timeframe": "\<6-12m \| 1-2y \| 2-3y\>",  
> "probability": "\<low\|medium\|high\>",  
> "early_signs": \["\<observable sign\>", "\<another\>"\]  
> },  
> "bear_case": { /\* same structure as bull_case \*/ },  
> "neutral_case": {  
> "scenario": "\<3-4 sentences: most likely path\>",  
> "drivers": \["\<what keeps it here\>", "\<another\>"\],  
> "price_range_low": \<number\>,  
> "price_range_high": \<number\>,  
> "probability": "\<low\|medium\|high\>",  
> "what_breaks_it": \["\<event pushing to bull\>", "\<event pushing to bear\>"\]  
> },  
> "strategy_fit": {  
> "primary": "\<dividend_income\|growth_compounder\|deep_value\|speculative_growth\|turnaround_bet\|cyclical_trade\|avoid\>",  
> "ideal_investor": "\<who, time horizon, position size\>",  
> "position_sizing": "\<full_position\|half_position\|small_speculative\|avoid\>"  
> },  
> "what_to_watch": \["\<metric + threshold\>", "\<another\>", "\<another\>"\],  
> "analyst_verdict": "\<strong_buy\|buy\|hold\|avoid\|strong_avoid\>",  
> "confidence_level": \<1-10\>,  
> "data_gaps_acknowledged": \["\<gap + impact\>"\],  
> "caveats": \["\<warning\>"\]  
> }
>
> "target_price_12m": 12000,
>
> "confidence_level": 7,
>
> "data_gaps_acknowledged": \["gross_margin historical series incomplete"\],
>
> "caveats": \["ROE trend requires investigation of equity base growth"\]
>
> }

**6.4 ai_analyst.py Interface**

> class AIAnalyst:
>
> def \_\_init\_\_(self, provider: str = 'openai', model: str = None):
>
> \# provider: 'openai' \| 'anthropic'. model=None → provider default
>
> \# ('gpt-5.2' for openai, 'claude-sonnet-4-20250514' for anthropic)
>
> self.provider = get_provider(provider, model)
>
> def analyze(self, ticker: str, sb_client) -\> AIAnalysisResult:
>
> '''
>
> 1\. Load ai_context_cache row for ticker
>
> 2\. Check ready_for_ai = TRUE (raise AnalysisNotReady if not)
>
> 3\. Run ONE enriched call (single prompt + 3-layer context)
>
> 4\. Parse + validate strict-JSON output (Section 6.5); retry once on failure
>
> 5\. Upsert to ai_analysis table (model_used = the model that ran)
>
> 6\. Return AIAnalysisResult
>
> '''
>
> def analyze_batch(self, tickers: list\[str\], sb_client,
>
> delay_between: float = 2.0) -\> dict\[str, AIAnalysisResult\]:
>
> '''Rate-limited batch analysis.'''
>
> @dataclass
>
> class AIAnalysisResult:
>
> ticker: str
>
> verdict: str \# analyst_verdict
>
> confidence_level: int
>
> prompt_tokens: int
>
> output_tokens: int
>
> cost_usd_estimate: float \# approximate, for monitoring
>
> success: bool
>
> error: Optional\[str\]
>
> Cost monitoring: Single enriched call costs ~\$0.02-0.04 per ticker (vs \$0.07-0.12 for the original 3-call chain). For 800 stocks batch analysis costs ~\$16-32 USD total. Run selectively: only where ready_for_ai = TRUE and composite_score \> 50.

6.5 Post-Generation Output Validation

After Claude returns the JSON output, ai_analyst.py must validate before writing to ai_analysis table. Invalid outputs are retried once; if still invalid, marked as failed with error detail.

Structural checks:

\- JSON parseable and all required fields present

\- lynch_category is one of the 6 valid enum values

\- analyst_verdict is one of the 5 valid enum values

\- confidence_level is integer 1-10

Scenario consistency checks:

\- bull_case.price_target \> neutral_case.price_range_high \> bear_case.price_target (scenario ordering)

\- neutral_case.price_range_low \< neutral_case.price_range_high

\- All price targets are positive and within 5x of current price (catch hallucinated values)

Data quality alignment checks:

\- If reliability_grade is C or D: confidence_level should be \<= 6 (warn if higher)

\- If data_gap_flags is non-empty in the context bundle: data_gaps_acknowledged must be non-empty in the output

\- At least 1 caveat must be present

If validation fails after retry: write to ai_analysis with analyst_verdict = "error", store the raw output in a validation_errors JSONB column for debugging.

**7. Pipeline Orchestration**

Phase 6 adds a new orchestrator script that slots into the existing run_all.py system. Two new run modes are added. Existing modes are unchanged.

**7.1 New run_all.py Modes**

> \# New modes — add to run_all.py
>
> python run_all.py --build-ai-context \# clean + normalize + score + build context bundle
>
> python run_all.py --run-ai-analysis \# call Claude API → write ai_analysis table
>
> \# Combined (full AI pipeline for one ticker)
>
> python run_all.py --ai-full --ticker BBCA
>
> \# Batch — only stocks where ready_for_ai = TRUE AND composite_score \> 50
>
> python run_all.py --ai-full --min-composite 50
>
> \# Force rebuild even if cache is fresh
>
> python run_all.py --build-ai-context --ticker BBCA --force

**7.2 Execution Order for --ai-full**

15. 1\. DataCleaner.clean_ticker(ticker) → write data_quality_flags

16. 2\. DataNormalizer.normalize() on clean data → write normalized_metrics

17. 3\. ScoringPipeline.run() → write stock_scores + update stocks.completeness_score + stocks.confidence_score

18. 4\. ContextBuilder.build(ticker) → write ai_context_cache

19. 5\. AIAnalyst.analyze(ticker) → write ai_analysis \[only if ready_for_ai = TRUE\]

20. 6\. Log summary: ticker, reliability grade, confidence grade, composite, AI verdict, cost estimate

**7.3 Staleness Rules**

| **Table**          | **Rebuild trigger**                                                             | **Max age before rebuild** |
|--------------------|---------------------------------------------------------------------------------|----------------------------|
| data_quality_flags | financials table updated (new scraper run for ticker)                           | 30 days                    |
| normalized_metrics | financials updated OR data_quality_flags updated                                | 30 days                    |
| stock_scores       | normalized_metrics updated                                                      | 30 days                    |
| ai_context_cache   | stock_scores updated OR broker_flow updated OR bandar_signal updated            | 24 hours                   |
| ai_analysis        | ai_context_cache updated AND context meaningfully different (\>5% score change) | 7 days                     |

**7.4 Integration with Existing stock_refresh_requests**

The --ai-full mode integrates with the existing job tracking system when triggered via UI refresh:

> \# In pipeline_runner.py when --job-id is provided:
>
> \# Add Phase 6 scrapers to refresh_scraper_progress tracking:
>
> PHASE6_SCRAPERS = \[
>
> 'data_cleaner',
>
> 'data_normalizer',
>
> 'scoring_engine',
>
> 'context_builder',
>
> 'ai_analyst', \# only if ready_for_ai = TRUE after scoring
>
> \]
>
> \# Each scraper updates refresh_scraper_progress.status and rows_added
>
> \# ai_analyst is non-fatal — failure should not mark overall job as failed

**8. NextJS API Routes (New)**

Three new API routes. All are read-only — they query Supabase tables written by the Python pipeline. These are consumed by the existing widget system: AIInsightsWidget and InvestmentThesisWidget.

**8.1 GET /api/stocks/\[ticker\]/ai-analysis**

Returns the full ai_analysis row for a ticker. Used by AIInsightsWidget and InvestmentThesisWidget.

> // Response:
>
> {
>
> ticker: string,
>
> verdict: 'strong_buy'\|'buy'\|'hold'\|'avoid'\|'strong_avoid',
>
> verdictLabel: string, // Indonesian: 'Beli Kuat', 'Beli', etc.
>
> verdictColor: string, // hex color for badge
>
> businessQualityScore: number, // 1-10
>
> businessQualityRationale:string,
>
> financialHealthSignal: string,
>
> valuationVerdict: string,
>
> marginOfSafety: number,
>
> bullCase: string,
>
> bearCase: string,
>
> keyRisks: string\[\],
>
> keyInsights: string\[\],
>
> entryPriceLow: number,
>
> entryPriceHigh: number,
>
> targetPrice12m: number,
>
> confidenceLevel: number,
>
> dataGapsAcknowledged: string\[\],
>
> generatedAt: string,
>
> // Data quality context for display
>
> reliability: { score: number, grade: string },
>
> confidence: { score: number, grade: string },
>
> compositeScore: number,
>
> }

**8.2 GET /api/stocks/\[ticker\]/context-quality**

Returns the data quality block from ai_context_cache. Used by DataQualityWidget (which already exists — feeds it richer data).

> // Response: the data_quality block from context_json + ready_for_ai flag
>
> {
>
> readyForAI: boolean,
>
> compositeScore: number,
>
> reliabilityScore: number,
>
> reliabilityGrade: string,
>
> confidenceScore: number,
>
> confidenceGrade: string,
>
> dataYearsAvailable: number,
>
> primarySource: string,
>
> missingMetrics: string\[\],
>
> anomalousYears: number\[\],
>
> flaggedIssues: string\[\],
>
> dataGapFlags: string\[\],
>
> builtAt: string,
>
> }

**8.3 POST /api/stocks/\[ticker\]/trigger-ai-analysis**

Triggers the Phase 6 pipeline for a specific ticker. Adds Phase 6 scrapers to an existing stock_refresh_requests job. Returns job_id for polling.

> // Request body: { job_id?: number } // optional: attach to existing refresh job
>
> // Response: { job_id: number, status: 'queued' }
>
> // Runs: python run_all.py --ai-full --ticker {ticker} --job-id {job_id}
>
> // Same mechanism as existing /api/stocks/\[ticker\]/refresh (GitHub Actions or local)

8.4 DataQualityWidget UI Migration

The existing DataQualityWidget and DataQualityPanel (data-quality-panel.tsx) must be updated to display Phase 6 scoring. The Stockbit refresh wizard (StockbitRefreshModal, ~650 lines) is preserved unchanged — it is the interactive data pipeline trigger and is independent of the scoring display.

Current state (v1):

• Reads from v_data_completeness SQL view (11 category breakdown: price, annual, quarterly, profile, etc.)

• Reads stocks.confidence_score (single number, no breakdown)

• Shows: Completeness bar + Confidence bar + category breakdown table + "Refresh Data" button

Target state (v2):

• Reads from stock_scores table (decomposed reliability + confidence)

• Shows: Reliability bar (with grade A/B/C/D/F) + Confidence bar (with grade HIGH/MEDIUM/LOW) + Composite score

• Expanded breakdown shows 4 reliability components + 6 confidence components (from stock_scores columns)

• ready_for_ai badge: green "AI Ready" or amber "Not AI Ready" with reason

• "Refresh Data" button → StockbitRefreshModal (unchanged)

• After refresh completes: re-trigger Phase 6 scoring pipeline for the ticker

Components preserved (DO NOT modify):

• StockbitRefreshModal — the full refresh wizard (token → freshness → config → preview → running → done)

• AlternativeSources — shown when categories are missing

• Toast notifications for background pipeline completion

• Score before/after display in the "done" step of refresh wizard

Components replaced:

• ScoreLine display: show grade badge (A/B/C/D/F for reliability, HIGH/MEDIUM/LOW for confidence) next to score

• Category breakdown table: replace 11 v_data_completeness categories with stock_scores decomposed components:

Reliability: completeness, consistency, freshness, source quality, penalties

Confidence: signal strength, trend stability, data depth, peer availability, valuation anchors, penalties

• completeness.ts query module: add getStockScores(ticker) function that reads from stock_scores table

DataQuality type update (lib/types/api.ts):

Replace completeness_breakdown with reliability_breakdown and confidence_breakdown.

Add: reliabilityGrade, confidenceGrade, compositeScore, readyForAI, dataGapFlags.

Keep: scores_updated_at, last_scraped_at, missing_categories (derived from stock_scores.missing_metrics).

Color threshold recalibration (stock-table.tsx screener):

v1 confidence (data quality) typically scored 50-80 for most stocks.

v2 confidence (signal strength) will be lower for stocks without broker/bandar data.

New thresholds: green \>= 70, amber \>= 45, red \< 45 (was: green \>= 80, amber \>= 60, red \< 60).

Reliability thresholds remain: green \>= 80, amber \>= 60, red \< 60 (similar to v1 completeness).

8.5 Pipeline Debug Panel (AI Pipeline Inspector)

A collapsible developer/admin panel on the stock detail page (/stock/\[ticker\]) that exposes the full Phase 6 pipeline state for debugging and context management. Located in the TENTANG section, below DataQualityWidget.

VISIBILITY CONTROL:

The panel is hidden by default. Toggled via a "Pipeline Debug" button that only renders when:

\- Environment variable NEXT_PUBLIC_SHOW_DEBUG_PANEL=true, OR

\- URL query parameter ?debug=1 is present

When the pipeline is mature and trusted, remove the env var to hide from all users.

PANEL STRUCTURE — 5 collapsible sections:

--- Section A: Pipeline Stage Breakdown ---

Shows the output of each pipeline stage for this ticker. Read-only. Purpose: diagnose where data issues originate.

Stage 1 — Data Cleaner:

\- Table: one row per financial year, columns: year, usability_flag (color-coded badge), is_covid, is_ipo, has_anomaly, has_one_time, scale_warning, notes

\- Summary: "11 years processed, 1 excluded (IPO 2015), 2 flagged (COVID 2020, anomaly 2019)"

\- Source: data_quality_flags table

Stage 2 — Normalized Metrics:

\- Table: 20 rows (one per metric), columns: metric, latest_value, trend (with arrow icon), R², CAGR_full, CAGR_3yr, z_score, percentile, peer_group, peer_count

\- Missing metrics highlighted in amber. Anomaly years shown as tags.

\- Source: normalized_metrics table

Stage 3 — Scoring:

\- Two side-by-side score cards:

Reliability: total/100 + grade badge (A/B/C/D/F) + 5 component bars (completeness, consistency, freshness, source, penalties)

Confidence: total/100 + grade badge (HIGH/MEDIUM/LOW) + 6 component bars (signal, trend, depth, peers, valuation, penalty)

\- Composite score + ready_for_ai badge (green checkmark or red X with reason)

\- Bullish/bearish/neutral signals list. Data gap flags list.

\- Source: stock_scores table

Stage 4 — Context Bundle:

\- Collapsible JSON viewer showing the full ai_context_cache.context_json

\- Token estimate display

\- "Built at" timestamp + "Rebuild" button (triggers /api/stocks/\[ticker\]/trigger-ai-analysis)

\- Source: ai_context_cache table

Stage 5 — AI Analysis Result:

\- If ai_analysis exists: show lynch_category badge, buffett_moat badge, verdict badge, confidence level

\- Collapsible: full bull/bear/neutral scenarios, strategy_fit, what_to_watch

\- "Generated at" timestamp + model version

\- If not yet run: "AI analysis not generated. Click Rebuild in Stage 4 first." message

\- Source: ai_analysis table

--- Section B: Context Layer Editor ---

The interface for viewing and editing the 3-layer domain context. Editable sections have save buttons.

Layer 1 — Macro Context (read-only on this page):

\- Shows current macro context JSON (BI rate, IDR, IDX YTD, foreign flow, key events)

\- "Last updated" timestamp

\- Note: "Edit at /admin/macro-context or shared/macro-context.json"

\- Source: shared/macro-context.json (loaded at build time or from a single-row config table)

Layer 2 — Sector Template (editable):

\- Shows the template for this stock's subsector (e.g. "Bank" for BBCA)

\- Fields: key_metrics (tag list), valuation_method (text), cycle_context (text), current_dynamics (text), common_risks (bullet list), exemptions (text), bumn_note (text if applicable)

\- "Save" button upserts to sector_templates table or writes to shared/sectors/{subsector}.json

\- If no template exists for this subsector: show placeholder with "Create Template" button

\- Template example (shown as hint when creating):

key_metrics: "NIM, CASA ratio, NPL, cost-to-income, LDR"

valuation_method: "PBV primary, PE secondary. Premium banks 3-5x PBV, mid-tier 1-2x."

current_dynamics: "Rate easing benefits high-CASA banks. Digital banking competition intensifying."

common_risks: "NPL spike, NIM compression, digital disruption"

Layer 3 — Domain Notes (editable):

\- Text area with current stock_notes.domain_notes (or empty state)

\- "Save" button upserts to stock_notes table

\- Character count + token estimate

\- Template example (shown as placeholder text):

"BBCA is Indonesia's largest private bank by market cap with the highest CASA ratio (~77%) in the banking sector, giving it the lowest cost of funds. Controlled by the Salim/Djarum group via Dwimuria Investama (54.9%). Key competitive advantage is its transaction banking ecosystem (BCA mobile, Flazz, EDC network) which creates sticky deposits. Current strategic focus: digital ecosystem expansion via blu (neobank) and BCA mobile super-app."

\- If empty: "No domain notes yet. The AI will work with data + macro + sector template only. Add 2-5 sentences about this company's business model, competitive position, and key differentiators for richer AI analysis."

--- Section C: Data Freshness (existing, enhanced) ---

The existing freshness check from the refresh wizard, pulled out as a standalone view:

\- Per-category freshness status (fresh/stale/missing) with days since last update

\- "Refresh Data" button opens the existing StockbitRefreshModal

\- This section already exists in DataQualityWidget — show it here for the debug context

--- Section D: Raw Data Inspector ---

\- Dropdown: select a table (financials, daily_prices, broker_flow, bandar_signal, insider_transactions, shareholders)

\- Shows last 10 rows for this ticker from the selected table, as a compact data table

\- Purpose: spot-check raw data when Stage 1 or Stage 2 shows unexpected results

\- Paginated, sortable by date/year

COMPONENT STRUCTURE:

New file: web/src/components/stock/widgets/PipelineDebugWidget.tsx

\- 'use client' component with mounted guard (contains collapsible sections)

\- Only renders when debug mode is active

\- Each section is independently collapsible (default: all collapsed except Stage 3 scoring)

API ROUTES NEEDED:

GET /api/stocks/\[ticker\]/pipeline-debug — returns all Stage 1-5 data in one payload

GET /api/stocks/\[ticker\]/raw-data/\[table\] — returns last N rows from specified table

GET /api/admin/macro-context — returns current macro context JSON

GET /api/admin/sector-template/\[subsector\] — returns sector template

POST /api/admin/sector-template/\[subsector\] — upserts sector template

GET /api/stocks/\[ticker\]/domain-notes — returns stock_notes row

POST /api/stocks/\[ticker\]/domain-notes — upserts domain_notes

NEW TABLE: sector_templates (optional — can also be JSON files)

CREATE TABLE sector_templates (

subsector TEXT PRIMARY KEY,

key_metrics TEXT, -- JSON array of metric names

valuation_method TEXT,

cycle_context TEXT,

current_dynamics TEXT,

common_risks TEXT, -- JSON array

exemptions TEXT,

bumn_note TEXT,

updated_at TIMESTAMPTZ DEFAULT NOW()

);

**9. Implementation Order for Claude Code**

> ✋ Claude Code: follow this sequence exactly. Each step has a validation checkpoint. Do not skip or reorder. Phases 1-5 are live — do not modify any existing files unless explicitly stated.

| **Step** | **Action**                                                                                                                                                                                                                                                                                                     | **Files Created / Modified**                                                                                                                                                                                                                                                                                                                | **Validation**                                                                                                                                                                                                  |
|----------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 ✅      | **Done.** Supabase migration docs/schema-v11-ai-pipeline.sql with 7 new tables: data_quality_flags, normalized_metrics, stock_scores, ai_context_cache, ai_analysis, stock_notes, sector_templates. `financials.is_ttm` added in schema-v12-is-ttm.sql.                                                          | docs/schema-v11-ai-pipeline.sql, docs/schema-v12-is-ttm.sql                                                                                                                                                                                                                                                                                  | SELECT tablename FROM pg_tables returns all 7 new table names                                                                                                                                                   |
| 2        | Copy schema.py and data_normalizer.py into scripts/scoring/. Update data_normalizer.py to read from Supabase financials table using field name mapping from Section 3.4                                                                                                                                        | scripts/scoring/schema.py, scripts/scoring/data_normalizer.py                                                                                                                                                                                                                                                                               | python scripts/scoring/data_normalizer.py exits 0 (dry run on test data)                                                                                                                                        |
| 3        | Implement data_cleaner.py per Section 2. Must handle all 10 cleaning rules (1 deferred: restatement detection returns FALSE always in v1), banking sector exemptions (including one-time items NI/OI exemption), and IPO partial year exclusion logic.                                                         | scripts/scoring/data_cleaner.py                                                                                                                                                                                                                                                                                                             | python -c 'from scoring.data_cleaner import DataCleaner' exits 0                                                                                                                                                |
| 4        | Copy scoring_engine.py. Update ScoringPipeline to: (a) read clean financials from Supabase via DataCleaner, (b) write to stock_scores table, (c) UPDATE stocks SET completeness_score, confidence_score after scoring                                                                                          | scripts/scoring/scoring_engine.py                                                                                                                                                                                                                                                                                                           | python run_all.py --ai-full --ticker BBCA --dry-run shows pipeline steps                                                                                                                                        |
| 5        | Implement context_builder.py per Section 5. Build data_quality, fundamentals, valuation, smart_money, shareholders, health_score, sector_context blocks                                                                                                                                                        | scripts/scoring/context_builder.py                                                                                                                                                                                                                                                                                                          | SELECT context_json FROM ai_context_cache WHERE ticker='BBCA' returns valid JSON with all 8 top-level keys                                                                                                      |
| 6        | Implement ai_analyst.py per Section 6 with single enriched call architecture, 3-scenario output schema (bull/bear/neutral), Lynch + Buffett framework integration, and post-generation output validation (Section 6.5).                                                                                        | scripts/scoring/ai_analyst.py                                                                                                                                                                                                                                                                                                               | python run_all.py --run-ai-analysis --ticker BBCA produces ai_analysis row                                                                                                                                      |
| 7        | Add --build-ai-context and --run-ai-analysis and --ai-full modes to run_all.py. Integrate with stock_refresh_requests job tracking                                                                                                                                                                             | run_all.py (modified)                                                                                                                                                                                                                                                                                                                       | python run_all.py --ai-full --ticker BBCA --dry-run prints all 6 steps                                                                                                                                          |
| 8        | Implement GET /api/stocks/\[ticker\]/ai-analysis NextJS route                                                                                                                                                                                                                                                  | app/api/stocks/\[ticker\]/ai-analysis/route.ts                                                                                                                                                                                                                                                                                              | curl localhost:3000/api/stocks/BBCA/ai-analysis returns JSON with verdict field                                                                                                                                 |
| 9        | Implement GET /api/stocks/\[ticker\]/context-quality NextJS route. Also update DataQualityWidget and DataQualityPanel per Section 8.4: replace v_data_completeness breakdown with stock_scores decomposed components, preserve StockbitRefreshModal wizard unchanged, add reliability/confidence grade badges. | app/api/stocks/\[ticker\]/context-quality/route.ts, components/stock/data-quality-panel.tsx (modified), lib/queries/completeness.ts (modified), lib/types/api.ts (DataQuality type updated)                                                                                                                                                 | curl localhost:3000/api/stocks/BBCA/context-quality returns readyForAI field                                                                                                                                    |
| 10       | Implement POST /api/stocks/\[ticker\]/trigger-ai-analysis NextJS route                                                                                                                                                                                                                                         | app/api/stocks/\[ticker\]/trigger-ai-analysis/route.ts                                                                                                                                                                                                                                                                                      | POST returns job_id                                                                                                                                                                                             |
| 11       | Run full Phase 6 pipeline on 5 blue-chip tickers: BBCA, BBRI, BMRI, TLKM, ASII                                                                                                                                                                                                                                 | (no new files)                                                                                                                                                                                                                                                                                                                              | SELECT ticker, analyst_verdict, confidence_level FROM ai_analysis returns 5 rows                                                                                                                                |
| 12       | Batch score migration: run scoring_engine.py for ALL active stocks (~960). Update stocks table with v2 scores. Recalibrate screener color thresholds. Verify DataQualityWidget shows v2 breakdown for all stocks.                                                                                              | stock-table.tsx (threshold update), score_calculator.py (updated to call Phase 6 engine)                                                                                                                                                                                                                                                    | SELECT COUNT(\*) FROM stock_scores = number of active stocks. SELECT COUNT(\*) FROM stocks WHERE score_version = 'v2' matches active count. No stock has score_version = 'v1' after migration.                  |
| 13       | Implement PipelineDebugWidget per Section 8.5. Create pipeline-debug API route, raw-data inspector, sector template editor, domain notes editor. Wire up debug toggle (env var + query param).                                                                                                                 | components/stock/widgets/PipelineDebugWidget.tsx (new), app/api/stocks/\[ticker\]/pipeline-debug/route.ts (new), app/api/stocks/\[ticker\]/raw-data/\[table\]/route.ts (new), app/api/stocks/\[ticker\]/domain-notes/route.ts (new), app/api/admin/sector-template/\[subsector\]/route.ts (new), app/api/admin/macro-context/route.ts (new) | Visit /stock/BBCA?debug=1 — debug panel visible with all 5 stage sections. Edit domain notes, save, verify persisted. Edit sector template for Bank subsector, save, verify. Without ?debug=1, panel is hidden. |

**10. Data Quality Rules for AI Input**

These rules govern what makes a stock eligible for AI analysis. They are the final gate before calling the Claude API. Applied in context_builder.py and stored in ai_context_cache.ready_for_ai.

**10.1 Minimum Data Requirements**

| **Requirement**                | **Minimum**                                           | **Disqualifies if**                                                                        |
|--------------------------------|-------------------------------------------------------|--------------------------------------------------------------------------------------------|
| Years of annual financial data | ≥ 3 years (non-excluded)                              | \< 3 years clean data                                                                      |
| Revenue data                   | Must be present and \> 0 for latest year              | revenue NULL or 0 for latest year                                                          |
| Reliability score              | ≥ 45/100                                              | Below 45 — data too unreliable for AI reasoning                                            |
| Confidence score               | ≥ 40/100                                              | Below 40 — signals too weak for AI to interpret                                            |
| Source quality                 | Not UNKNOWN for \>50% of years                        | Majority of data from unknown sources                                                      |
| Anomaly year limit             | ≤ 3 anomaly years out of total years                  | More than 30% of years are anomalous                                                       |
| Scale validation               | scale_warning rows must have scale_factor_applied set | Unresolved scale error                                                                     |
| Post-IPO data history          | ≥ 3 full post-IPO years (IPO year excluded)           | \< 3 full years since listing — insufficient data for financial performance trend analysis |

**10.2 AI Prompt Data Hygiene Rules**

Applied by context_builder.py when assembling the context bundle before passing to AI:

- Exclude anomaly years from CAGR and trend computations unless flagged with explicit note

- For any metric with \< 3 valid years, set trend_direction = 'insufficient_data' — do not extrapolate

- If source_conflict = TRUE for a year, use Stockbit value and note the conflict in data_gap_flags

- Round all IDR values to nearest billion in the context bundle (divide by 1e9, round, label as Rp Billion) to reduce token count

- Round all percentages to 1 decimal place (e.g. 0.1234 → 12.3%)

- Cap smart_money block at last 30 calendar days — do not include historical broker rows

- Sector comparison requires minimum 8 peers with financials data. If a stock's subsector has \< 8 peers, z-scores and percentiles are computed against the parent sector (11 sectors, all with 38+ stocks). If neither level has 8+ peers (should not happen on IDX), set vs_sector_pct to null and add to data_gap_flags: "sector_comparison_unavailable: {metric} — {subsector} has {n} peers (minimum 8 required)". When the fallback to sector level is used, include peer_group_note in the metric entry: "compared against {sector} sector (broader group, subsector too small)".

- Truncate top_holders in shareholders block to max 5 entries

- For any block where source data does not exist (e.g., no broker_flow for small-cap), include the block but set all numeric fields to null and add a note to data_gap_flags

> ✓ The goal is not to make the data look better than it is. Data gaps and quality limitations must be passed through to the AI explicitly via data_gap_flags. An honest AI analysis with acknowledged limitations is more useful than a confident analysis built on incomplete data.

**11. Glossary**

| **Term**                 | **Definition**                                                                                                                                                                                                                                                                                     |
|--------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| AI context bundle        | The structured JSON payload built by context_builder.py. Contains 11 data blocks (v3.0; was 8) — data_quality, fundamentals, valuation, smart_money, shareholders, health_score, sector_context, macro_context, technical_context, quarterly_trend, dividend_profile. Passed verbatim to the LLM prompt. Cached in ai_context_cache. |
| Single enriched call     | The AI analyst architecture: one LLM call per ticker with 3-layer context injection (macro + sector template + domain notes) producing a 3-scenario output (bull/bear/neutral). Replaces the original 3-call chain (Bull Agent -\> Bear Agent -\> Synthesis) which produced data summaries. The call goes through a provider factory (OpenAI `gpt-5.2` default / Anthropic `claude-sonnet-4`). |
| valuation_mode (v3.0)    | Auto-selected intrinsic-value model recorded in the valuation block: `fcf` (DCF, default for non-financials with positive FCF), `dividend` (DDM, for banks and high-yield payers), or `eps` (fallback when FCF ≤ 0). |
| technical_context / quarterly_trend / dividend_profile (v3.0) | The three context blocks added in v3.0. Technical = price trend + RSI/MACD + Wyckoff phase + market phase. Quarterly = TTM + QoQ/YoY momentum over recent quarters. Dividend = yield, payout, consecutive years, DPS growth, sustainability. Each is nullable when source data is absent. |
| Reliability score        | 0-100 score measuring DATA QUALITY: completeness, source tier, freshness, anomaly count, restatements.                                                                                                                                                                                             |
| Confidence score         | 0-100 score measuring SIGNAL STRENGTH: directional signal agreement, trend stability, data depth, peer availability, valuation anchors.                                                                                                                                                            |
| Composite score          | Weighted blend: reliability gates confidence. If reliability \< 40, composite = min(30, confidence × 0.3).                                                                                                                                                                                         |
| ready_for_ai             | Boolean gate: reliability ≥ 45 AND confidence ≥ 40 AND clean years ≥ 3 AND revenue present.                                                                                                                                                                                                        |
| data_gap_flags           | String array in context bundle. Lists specific missing or unreliable data points. Passed to AI so it acknowledges limitations.                                                                                                                                                                     |
| usability_flag           | Per-year quality verdict: clean \| minor_issues \| use_with_caution \| exclude. Set by data_cleaner.py.                                                                                                                                                                                            |
| CAGR acceleration        | cagr_3yr \> cagr_10yr — recent growth faster than long-term average. Flagged as key_signal in fundamentals block.                                                                                                                                                                                  |
| FCF quality concern      | fcf_to_net_income \< 0.70 — earnings are not converting to cash. May indicate accrual accounting or aggressive revenue recognition.                                                                                                                                                                |
| Source conflict          | Stockbit and yfinance report different values for the same (ticker, year) with \> 3% difference. Resolved: Stockbit wins per PRD §7 source priority.                                                                                                                                               |
| Scale warning            | Revenue values \< 1e11 IDR for an LQ45 stock — likely reported in millions. Scale factor of 1e6 applied automatically by data_cleaner.py.                                                                                                                                                          |
| COVID exemption          | Year 2020 is universally flagged as structural anomaly. AI instructed not to cite 2020 data as evidence of long-term business deterioration.                                                                                                                                                       |
| BUMN structural discount | State-owned enterprises (is_bumn=TRUE) typically trade at 15-20% P/E discount vs private peers due to governance risk. Not a valuation flaw.                                                                                                                                                       |
| Banking exemptions       | Banks lack current_ratio and interest_coverage by design (not a data gap). Scoring engine and AI both exempt banks from these metrics.                                                                                                                                                             |
| Bandar                   | Indonesian market term for dominant institutional broker(s) controlling significant float. Detected via Stockbit bandar_detector signals.                                                                                                                                                          |
| Akumulasi / Distribusi   | Indonesian: Accumulation / Distribution. Phase detection from net broker flow direction over 30 days.                                                                                                                                                                                              |
| smart_money_confidence   | 0-100 score from signal-confidence.ts (TypeScript) and its Python equivalent in context_builder.py. 5 components: broker magnitude, foreign alignment, bandar confirmation, insider weight, broker concentration.                                                                                  |
| Lynch category           | Peter Lynch's 6 stock classifications: slow_grower, stalwart, fast_grower, cyclical, turnaround, asset_play. Auto-hinted from data (revenue R², CAGR) then confirmed/overridden by AI analyst.                                                                                                     |
| Buffett moat             | Warren Buffett's competitive advantage assessment: none, narrow, or wide. Based on pricing power, switching costs, network effects, cost advantages, intangible assets.                                                                                                                            |
| Macro context            | Layer 1 of the 3-layer context system. Monthly-updated JSON with BI rate, IDR, IDX performance, foreign flow regime. Same for all stocks. Gives AI time-awareness.                                                                                                                                 |
| Sector template          | Layer 2 of the 3-layer context system. Per-subsector JSON with key metrics, valuation methodology, current dynamics, risks, and exemptions. 33 templates for 33 IDX subsectors.                                                                                                                    |
| Domain notes             | Layer 3 of the 3-layer context system. Optional free-text per stock in stock_notes table. 2-5 sentences of company-specific context written by the user. Editable via Pipeline Debug Panel.                                                                                                        |
| Pipeline Debug Panel     | Collapsible admin panel on /stock/\[ticker\] page showing Stage 1-5 pipeline output, context layer editor, raw data inspector. Hidden by default (NEXT_PUBLIC_SHOW_DEBUG_PANEL=true or ?debug=1).                                                                                                  |
| TTM/keystats             | Trailing twelve months data from Stockbit keystats endpoint. Stored with source="stockbit_keystats" and year=current_year. Excluded from trend/CAGR computation. Used for latest valuation multiples only.                                                                                         |
