# User Journey Map — Saham Bersama

> Companion to [usability-test-persona-1-retail-fundamental.md](./usability-test-persona-1-retail-fundamental.md).
> Maps the end-to-end journey for **Persona 1 (Bagus — retail investor, 5 yrs, Rp 100–200jt,
> fundamentals-curious but FOMO-prone)**. Grounded in the live app, not idealized screens.
>
> Goal of this doc: see **which journey stages work and which break**, so we know where to invest.

---

## Persona & Core Job-To-Be-Done

**Bagus** hires this app to do one job:

> *"Help me stop FOMO-buying hyped stocks. Before I buy, show me the fundamentals AND the
> story/thesis so I buy with my head, not my ears — and tell me when I'm in dangerous territory."*

Two real-world scenarios drive the journey:
- **Scenario A — Blue chip he already trusts** (BBRI): wants confirmation + a disciplined entry/exit.
- **Scenario B — Hyped small-cap he heard about** (gorengan): wants a reality-check *before* he buys.

The journey works for A and **breaks for B** — and B is where his money actually gets lost.

---

## Journey Overview (7 stages)

```
1 TRIGGER ─▶ 2 ARRIVE ─▶ 3 DISCOVER ─▶ 4 ASSESS ─▶ 5 FIND THESIS ─▶ 6 DECIDE ─▶ 7 ACT/RETURN
 (hears a     (home)      (find the     (is it      (why buy?         (BUY/HOLD/   (trade +
  tip / FOMO)             stock)        healthy?)    what's the risk?) AVOID)       come back)
```

Emotional curve (Bagus):

```
  😀 high   │              ╭──╮ (BBRI thesis win)
            │        ╭─────╯  ╰──╮
  😐 neutral│   ╭────╯           ╰────╮          ╭── (BBRI decide: confident)
            │───╯                     ╰──╮  ╭────╯
  😟 low    │                            ╰──╯  ╲      ← Scenario B collapses here
  😣 frustr │                                   ╰────────────── (no thesis, FOMO wins)
            └──────────────────────────────────────────────────────────
              1      2       3        4        5         6        7
```

---

## Stage-by-Stage Map

Legend: **🟢 Works** · **🟡 Friction** · **🔴 Breaks**

---

### Stage 1 — TRIGGER (off-app)

| | |
|---|---|
| **Doing** | Hears a tip on Stockbit/IG/WA group, or sees a stock spiking. Feels urgency/FOMO. |
| **Thinking** | *"Ini lagi rame, jangan-jangan ketinggalan. Tapi gue capek kejebak. Cek dulu deh."* |
| **Feeling** | 😐 Anxious / tempted |
| **Touchpoint** | None (external) |
| **Status** | 🟡 The app isn't present at the moment of temptation. No alert, no "check before you buy" hook. |
| **Opportunity** | Push/notify on watchlist volatility; a "paste a ticker, get instant gut-check" entry. |

---

### Stage 2 — ARRIVE (Home)

| | |
|---|---|
| **Doing** | Opens app, lands on home: Market Overview, Popular Stocks, Strategy Picks, News, Calendar. |
| **Thinking** | *"Oke kondisi pasar keliatan. Ada 'Popular Stocks' — ini gue banget."* |
| **Feeling** | 🙂 Oriented |
| **Touchpoint** | `page.tsx`, `MarketOverview`, `PopularStocks`, `StrategyPicks` |
| **Status** | 🟡 Mixed — orients well, but reinforces the wrong instinct + has data gaps. |

**What works (🟢):** Market Overview strip (IHSG/USD/gold) gives fast macro context.

**Friction (🟡):**
- **Popular Stocks has no % change** and a placeholder sparkline (API gap) — his first instinct (scan movers) is unmet.
- **"Popular" = market cap**, not real activity — misleading label.
- **Strategy Picks 0–100 score is `completeness_score`** but reads like a quality rating → risk of false confidence at the *very first screen*.

---

### Stage 3 — DISCOVER (find the stock)

| | |
|---|---|
| **Doing** | Taps search, types ticker/name, picks result, lands on stock page. |
| **Thinking** | *"Cepet, langsung ketemu."* |
| **Feeling** | 🙂 Smooth |
| **Touchpoint** | `SearchBar`, `/stock/[ticker]` |
| **Status** | 🟢 **Works well.** Fast, forgiving search. No notable friction. |

---

### Stage 4 — ASSESS (is it fundamentally healthy?)

| | |
|---|---|
| **Doing** | Scans hero (price, PER/PBV/Yield, LQ45 chip). Opens FINANSIAL + VALUASI + METRIK PERUSAHAAN. |
| **Thinking** | *"Sehat nggak ini? Tapi mana yang penting? Chart-nya banyak banget."* |
| **Feeling** | 🙂 → 😐 (good start, then mild overwhelm) |
| **Touchpoint** | `HeroBar`, `FinancialStatementsWidget`, `CompanyMetricsWidget`, `ValuationWidget`, `DividendWidget` |
| **Status** | 🟡 Strong data, weak interpretation for a semi-novice. |

**What works (🟢):**
- Hero bar — three scan-points above the fold.
- **METRIK PERUSAHAAN peer-percentile badges** — "good/bad vs 42 peers," exactly his level. ⭐
- Dividend history/yield/CAGR for long-term view.

**Friction (🟡):**
- **FINANSIAL charts are raw** (Revenue/EBIT/EPS/margins) with no inline "healthy/weak" verdict — he can *see* but not *judge*.
- **Scenario B:** peer badges fall back to "THRESHOLD ABSOLUT — data peer tidak tersedia." Less guidance exactly when he's least informed.

---

### Stage 5 — FIND THESIS (why buy? what's the risk?) ⭐ the make-or-break stage

| | |
|---|---|
| **Doing** | Looks for the "story." Hunts for a Stories/Cerita tab; doesn't find one. Eventually reads AI Insights under OVERVIEW. |
| **Thinking (A)** | *"OHHH ini dia. Narrative, Lynch 'Stalwart', moat, bull/bear, target & stop loss. INI YANG GUE CARI."* |
| **Thinking (B)** | *"'Analisis AI belum tersedia.' Harus pencet Generate… nunggu 3–7 menit?! Keburu FOMO."* |
| **Feeling (A)** | 😀 **Delight** |
| **Feeling (B)** | 😣 **Frustration / abandonment** |
| **Touchpoint** | `NavTabs`, `AIInsightsWidget`, `AIVerdictStrip`, `AnalystInsightWidget` |
| **Status (A)** | 🟢 **Peak of the journey.** Thesis + scenarios + entry/stop + honest caveats. The app's killer value. |
| **Status (B)** | 🔴 **Journey breaks.** No thesis, no analyst coverage, slow generate → safety net silent at peak temptation. |

**Two compounding problems here:**
1. **Discoverability:** the thesis has no labeled home (no STORIES tab in live `NavTabs`); buried in OVERVIEW.
2. **Coverage:** the hyped names that most need a thesis are the ones least likely to have one — and generating it is too slow to beat his FOMO.

---

### Stage 6 — DECIDE (BUY / HOLD / AVOID)

| | |
|---|---|
| **Doing (A)** | Synthesizes: AI Buy + green peer metrics + dividend + entry/stop. Decides with conviction. |
| **Doing (B)** | Has only "—" placeholders. Falls back to gut / influencer. |
| **Thinking (A)** | *"Pertama kali gue beli pakai kepala, bukan kuping."* |
| **Thinking (B)** | *"App-nya diem. Yaudah gue ikut feeling lagi."* |
| **Feeling (A)** | 😀 Confident |
| **Feeling (B)** | 😟 Resigned (back to old habit) |
| **Touchpoint** | `AIVerdictStrip`, `BrokerActivityWidget` (bandar signal) |
| **Status (A)** | 🟢 Works. |
| **Status (B)** | 🔴 Fails — and this is the trade that historically loses him money. |

**Friction (🟡) even in A:** bandar/money-flow combined signal lacks a "how to read / confidence"
affordance — a confident-but-shallow user could over-trust it.

---

### Stage 7 — ACT / RETURN (after the decision)

| | |
|---|---|
| **Doing** | Buys elsewhere (no broker integration). Wants to track thesis vs. reality later. |
| **Thinking** | *"Stop loss-nya kena nggak? Thesis-nya masih valid? Gue inget masuk di harga berapa?"* |
| **Feeling** | 😐 Uncertain — nothing closes the loop |
| **Touchpoint** | Watchlist (implicit), no position tracking, no "thesis changed" alert |
| **Status** | 🟡 Open loop. No follow-up keeps the discipline alive. |
| **Opportunity** | Watchlist with entry/stop tracking; alert when thesis/verdict changes or price hits stop. |

---

## Where the Journey Breaks — Summary

| Stage | Scenario A (blue chip) | Scenario B (hyped small-cap) | Severity |
|---|---|---|---|
| 1 Trigger | 🟡 not present | 🟡 not present | Med |
| 2 Arrive | 🟡 misleading score / data gaps | 🟡 same | High (P3) |
| 3 Discover | 🟢 | 🟢 | — |
| 4 Assess | 🟡 raw charts | 🔴 no peer data | Med |
| 5 Find Thesis | 🟢 **peak** (but hidden) | 🔴 **no thesis, slow generate** | **Critical (P1) + High (P2)** |
| 6 Decide | 🟢 | 🔴 falls back to gut | **Critical** |
| 7 Return | 🟡 open loop | 🟡 open loop | Med |

**The headline:** the journey is excellent for stocks already covered, and **collapses at
Stages 5–6 precisely for the speculative stocks that are the reason Bagus came**. The app
succeeds where he didn't need much help and goes silent where he needed it most.

---

## Moments That Matter (prioritized)

1. **🔴 Stage 5/B — "No thesis on the hyped stock."** The single highest-leverage fix. If the
   app gives even a fast *interim* "SPECULATIVE — thin data, here's what we can see" verdict
   instantly, the whole job-to-be-done is rescued. (→ P1)
2. **🟢→discoverable — Stage 5/A — "The thesis reveal."** Already the emotional peak; make it
   findable (label it, surface it at top of OVERVIEW). (→ P2)
3. **🔴 Stage 2 — "The misleading 100 score."** A trust trap on the first screen. (→ P3)
4. **🟡 Stage 4 — "Data without a verdict."** Add one-line interpretation so a semi-novice can
   judge, not just view. (→ P5)
5. **🟡 Stage 7 — "The open loop."** Position/thesis tracking turns one good decision into a
   sustained habit change. (new opportunity)

---

## How This Maps to Usability Findings

| Journey break | Usability finding |
|---|---|
| Stage 5/B no thesis + slow generate | **P1 (Critical)** |
| Stage 5 thesis not discoverable | **P2 (High)** |
| Stage 2 misleading completeness score | **P3 (High)** |
| Stage 2 popular cards no % change | **P4 (Medium)** |
| Stage 4 raw charts, no verdict | **P5 (Medium)** |
| Stage 6 bandar signal no confidence cue | **P6 (Medium)** |
| Stage 7 open loop | New (not in usability test) |
