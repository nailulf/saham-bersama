# Usability Test — Saham Bersama App

> Simulated moderated usability test (think-aloud protocol). Findings are grounded in the
> actual app code as of 2026-06-05, not invented screens. Persona voice is a mix of
> Indonesian + English, as a real Jakarta retail investor would talk.

---

## Test Setup

| Field | Value |
|---|---|
| Method | Moderated think-aloud, single session, mobile-first (iPhone, 390px) |
| App | Saham Bersama (IDX Stock Analyzer) |
| Session date | 2026-06-05 |
| Duration | ~25 min |
| Device | Phone, one-handed |
| Recording | Screen + verbal narration |

### Persona — "Bagus", Retail Investor (5 yrs experience)

- **Who:** Local Indonesian retail investor, ~32 y.o. Investing ~5 years.
- **Capital:** Rp 100–200 juta.
- **Skill level:** Can buy/sell confidently, reads charts, knows basic ratios (PER, PBV).
- **Behavior:** Still gets pulled in by influencers, Stockbit hype, news, and "gut feeling."
  Often buys because *"secara teknikal kelihatan bagus"* but isn't sure, then gets cut by
  stop loss. Knows fundamentals *exist* but never had the patience/tools to dig in.
- **Today's goal (his words):** *"Gue capek kejebak saham gorengan yang lagi rame. Gue mau
  liat fundamental-nya dan 'cerita'/thesis saham ini sebelum beli. Apakah app ini bisa
  kasih gue alasan yang jelas buat masuk atau nggak."*

### Tasks Given

1. Start from home. Find a stock you've been hearing about (he picks **BBRI** first — "saham aman", then a smaller hype name).
2. Decide whether the stock is fundamentally healthy.
3. Find the "story / thesis" — *why would I buy this, and what's the risk?*
4. Decide BUY / HOLD / AVOID and say what convinced you.

---

## Session Walkthrough (Think-Aloud)

### Step 1 — Home page (first impression)

> *"Oke, ini home-nya. Ada Market Overview, IHSG, dollar, emas — bagus ini gue suka, langsung
> keliatan kondisi pasar. Terus ada **Popular Stocks**."*

He immediately gravitates to **Popular Stocks** — exactly his old habit.

> *"Nah ini nih, 'Popular'. Gue biasanya emang gini, liat yang lagi rame. Tapi… ini popular
> berdasarkan apa? Volume? Yang lagi naik? Kayaknya cuma gede-gedean market cap doang."*

**Observation:** "Popular Stocks" is sorted by market cap (proxy), not actual activity. Each
card shows a sparkline placeholder and **no % change** (known API gap). Bagus expected the
change %.

> *"Loh, kartunya nggak ada persentase naik-turun hari ini? Cuma harga doang. Itu yang gue
> paling pengen liat pertama. Sparkline-nya juga datar, kayaknya belum jalan."*

He then notices **Strategy Picks**:

> *"Ini menarik — 'Strategy Picks'. Ada score-nya bulet-bulet. Tapi score 100 ini maksudnya
> apa? Bagus banget? Atau cuma datanya lengkap?"*

**Finding:** The circular score on Strategy Picks is `completeness_score` (data completeness),
NOT a quality/composite score — but it *looks* like a rating out of 100. Bagus misread it as
"how good the stock is." This is a **trust-damaging misinterpretation**.

> *"Kalo gue pikir 100 itu artinya sahamnya bagus banget, terus gue beli, padahal itu cuma
> 'datanya lengkap'… ya itu bahaya buat orang kayak gue."*

He searches instead. Taps search, types "BBRI". Dropdown shows ticker + name + sector.

> *"Search-nya enak sih, cepet. Langsung ketemu BBRI."* ✅

---

### Step 2 — Stock page, hero + first scan (BBRI)

> *"Oke masuk ke BBRI. Atas ada harga gede, perubahan harian ijo, ada chip 'Perbankan',
> 'LQ45'. Bagus, gue tau ini blue chip. Di bawah ada Mkt Cap, P/E, PBV, Yield. Ini yang gue
> butuh cepet."* ✅

Hero bar lands well — the three things he scans (price, valuation snapshot, category) are
above the fold.

Then the tabs: **OVERVIEW · VALUASI · FINANSIAL · MONEY FLOW · TEKNIKAL · PROFIL**.

> *"Tab-nya jelas. Tapi… mana 'story'-nya? Gue nyari tab kayak 'Cerita' atau 'News' atau
> 'Kenapa harus beli'. Nggak ada. Mungkin di Overview kali ya?"*

**Finding (expectation gap):** The persona's stated goal is "fundamental + **story/thesis**".
The design doc references a **STORIES** tab, but the live `NavTabs` has no Stories/news tab.
The "story" actually lives *inside* the AI Insights widget under OVERVIEW. The persona did
not know to look there — he hunted for a labeled tab and didn't find one.

---

### Step 3 — OVERVIEW tab (the thesis hunt)

Lands on **AI Insights**. For BBRI, suppose analysis exists.

> *"OHHH ini dia. 'AI ANALYSIS'. Ada 'Stalwart' — itu istilah Peter Lynch ya? Ada 'Wide moat',
> 'Buy'. Terus ada **Ringkasan Analisis** — ini paragraf yang jelasin kenapa. INI YANG GUE
> CARI. Ini 'cerita'-nya."* ✅✅

Strong positive moment. This is the single feature that directly serves his goal.

> *"Terus ada kotak ijo Target Harga, biru Zona Masuk, merah Stop Loss. GILA ini bagus banget.
> Biasanya gue asal tebak stop loss, sekarang ada angkanya plus alesannya."*

He taps **"Lihat detail skenario"**:

> *"Ada bull / neutral / bear, ada probability, ada driver-nya. Ini ngajarin gue mikir
> skenario, bukan cuma 'pokoknya naik'. Mantap."* ✅

He opens **Catatan & Keterbatasan Data**:

> *"Bagus ada catatan keterbatasan data. Jadi gue tau ini bukan dewa. Gue lebih percaya
> justru karena dia ngaku ada batasnya."* ✅

**This is the app's killer moment for this persona.** It directly counteracts his
influencer/gut-feel habit by giving a structured, caveated thesis.

#### BUT — the catch

> *"Pertanyaan gue: ini AI analisis-nya update kapan? Di bawah ada tanggal generate. Kalo BBRI
> udah dianalisis sih enak. Tapi tadi pas gue iseng buka saham kecil yang lagi digoreng…"*

He navigates to a small-cap hype ticker. AI Insights shows the **empty state**:

> *"Analisis AI belum tersedia untuk saham ini. [Generate AI Analysis]"*

> *"Nah ini masalahnya. Justru saham gorengan yang RAME, yang gue PALING butuh diingetin,
> malah belum ada analisisnya. Gue harus pencet Generate."*

He taps Generate.

> *"…terus nunggu. Berapa lama ini? (3–7 menit, pipeline GitHub Actions). Wah, lama. Kalo lagi
> market jam-jaman gini, gue keburu FOMO duluan dan beli sebelum analisisnya kelar."*

**Finding (critical for this persona):** The exact stocks where he most needs a reality-check
(hyped small-caps) are the ones *least likely* to have a pre-computed thesis, and the
generate flow takes minutes. The safety net is absent at the moment of maximum temptation.

Below AI, **Analyst Insight** (Konsensus Analis):

> *"Buat BBRI ada target analis, ada bar rekomendasi Strong Buy/Buy/Hold. Keren, gue bisa liat
> konsensus."* ✅
> *"Tapi pas saham kecil tadi: 'Tidak ada cakupan analis'. Yaudah, makin buta gue di saham
> kecil."*

**Pattern:** Both the AI thesis AND analyst consensus are richest for big caps and thinnest
for the speculative names — a coverage gap aligned exactly opposite to his risk.

---

### Step 4 — FINANSIAL tab (does the fundamental hold up)

> *"Oke sekarang gue mau cek beneran sehat nggak. Masuk FINANSIAL. Ada 'LAPORAN KEUANGAN',
> bisa toggle Tahunan / Kuartalan. Ada chart Laba Rugi, Arus Kas, Neraca."*

On mobile he sees one chart at a time with sub-tabs (LABA RUGI | ARUS KAS | NERACA).

> *"Di HP cuma satu chart, harus ganti tab. Oke lah. Chart-nya ada bar sama garis. Tapi…
> jujur, gue agak bingung metrik mana yang penting. Ada banyak: Revenue, EBIT, EPS, margin.
> Buat gue yang nggak terlalu dalem, gue pengennya ada yang bilang 'ini bagus' atau 'ini
> jelek' — bukan cuma kasih chart mentah."*

**Finding:** `FinancialStatementsWidget` shows raw composed charts. Powerful, but the persona
(self-described "tahu fundamental tapi belum dalam") wants *interpretation*, not just data
viz. No inline "good/bad" verdict here.

Then he finds **METRIK PERUSAHAAN** (CompanyMetricsWidget) — and this lands much better:

> *"NAH. Ini yang gue suka. Revenue Growth, ROE, Net Margin, terus di sebelahnya ada badge
> 'percentile vs 42 emiten di Perbankan'. Jadi gue tau ini bagus DIBANDING temennya, bukan cuma
> angka kosong. Ijo berarti bagus, merah jelek. Gampang."* ✅✅

**Strong finding:** Peer-percentile badges translate fundamentals into something a
non-expert can act on. This is the *fundamental equivalent* of the AI thesis win.

> *"Tapi tadi pas saham kecil, badge-nya 'THRESHOLD ABSOLUT — data peer nggak tavailable'.
> Lagi-lagi saham kecil kalah info."*

Dividend widget:

> *"Ada history dividen, yield, payout, CAGR. Buat gue yang mikir jangka panjang ini plus."* ✅

---

### Step 5 — MONEY FLOW (his old battlefield)

> *"Ini bagian yang gue penasaran. 'Identifikasi broker bandar'. Ini bisa kasih tau gue
> bandarnya lagi ngumpulin apa lagi buang? Kalo iya, ini ngebantu gue NGGAK kejebak."*

He sees the Combined Signal badge (Akumulasi / Distribusi / Netral).

> *"Oke ada sinyal 'Akumulasi' ijo, 'broker & insider selaras masuk'. Ini insight yang gue
> nggak pernah punya sebelumnya. Cuma… gue agak ragu seberapa bisa dipercaya. Ada penjelasan
> nggak metode-nya? Gue takut salah ngartiin terus malah makin pede salah."*

**Finding:** The bandar/flow signal is high-value for this persona but needs a plain-language
"how to read this / how confident" affordance. Without it, a confident-but-shallow user could
over-trust it — the same failure mode as following influencers, just dressed up.

---

### Step 6 — Decision

For **BBRI**:
> *"Gampang. AI bilang Stalwart, wide moat, Buy, ada target & stop loss. Metrik ijo semua vs
> peer. Dividen oke. Gue HOLD/BUY dengan PD. Dan yang penting gue ngerti KENAPA. Ini pertama
> kalinya gue beli bukan karena FOMO."* ✅

For the **small-cap hype stock**:
> *"AI belum ada, analis nggak ada, peer data nggak ada. Jadi app-nya secara nggak langsung
> bilang 'lo lagi di area gelap'. Sebenernya itu bagus — tapi gue pengennya dia TEGAS bilang
> 'hati-hati, data tipis, ini spekulatif' bukan cuma kosong-kosong '—'."*

---

## Findings Summary

### ✅ What works well (keep / amplify)

| # | Finding | Why it matters for this persona |
|---|---|---|
| W1 | **AI Insights = the thesis he wanted** (narrative + Lynch category + moat + bull/neutral/bear scenarios + target/entry/stop) | Directly replaces influencer/gut-feel with a structured, reasoned thesis. The #1 win. |
| W2 | **Target / Entry Zone / Stop Loss boxes** | He never set disciplined stop losses; now they're explicit *with* rationale. |
| W3 | **"Catatan & Keterbatasan Data" (caveats)** | Honesty *increases* his trust — counters over-confidence. |
| W4 | **Peer-percentile badges in METRIK PERUSAHAAN** | Turns raw fundamentals into "good/bad vs peers" — exactly his comprehension level. |
| W5 | **Hero bar** (price + PER/PBV/Yield + LQ45 chip above fold) | Fast scan, his three key data points are immediate. |
| W6 | **Bandar / money-flow combined signal** | A genuinely new edge he never had against "smart money." |
| W7 | **Search** | Fast, forgiving, gets him to a stock quickly. |

### ⚠️ Problems (ranked by severity for this persona)

| # | Severity | Finding | Impact | Suggested fix |
|---|---|---|---|---|
| P1 | **Critical** | The hyped/speculative stocks he most needs vetting on have **no AI analysis, no analyst coverage, no peer data** — and AI generation takes **3–7 min**. The safety net is missing exactly when temptation is highest. | He'll FOMO-buy before the thesis loads — the core problem the app is meant to solve goes unsolved for his riskiest trades. | Pre-generate AI analysis for any stock entering "popular/active" or high-volatility lists; show a fast interim "SPECULATIVE — thin data" verdict instantly; queue + notify when full analysis is ready. |
| P2 | **High** | **"Story/thesis" has no discoverable home.** Persona hunted for a Stories/News tab; the thesis is buried inside OVERVIEW's AI widget. | Users may never find the app's best feature. | Rename/route: add a "THESIS" or "CERITA" entry point, or surface a thesis summary at the very top of OVERVIEW with a clear label. |
| P3 | **High** | **Strategy Picks score (0–100) reads as a quality rating but is `completeness_score`** (data completeness). | A shallow user buys a "100" thinking it's a great stock — re-creates the exact mis-trust the app should prevent. | Relabel ("Kelengkapan Data 100%") or ship the real composite/quality score; never show a bare 0–100 circle that implies "rating." |
| P4 | **Medium** | **Popular Stocks cards lack % change** (API gap) and sparkline is a placeholder; "popular" = market cap, not activity. | His first instinct (scan movers) is unmet; "popular" is misleading. | Wire change% + real sparkline; define "popular" by turnover/volume, label the basis. |
| P5 | **Medium** | **FINANSIAL charts are raw** — no inline "this is healthy/weak" interpretation for a semi-novice. | He can see numbers but still can't *judge* them without the (separate) peer badges. | Add a one-line verdict per statement (e.g., "Laba bertumbuh, margin stabil") or link the chart to the relevant peer-percentile takeaway. |
| P6 | **Medium** | **Money-flow / bandar signal lacks "how to read / confidence" affordance.** | Confident-but-shallow user may over-trust a signal he doesn't fully understand. | Add a short methodology tooltip + a confidence indicator on the combined signal. |
| P7 | **Low** | **No explicit "← BACK" on stock page** (relies on browser back). | Minor mobile friction. | Add back affordance in mobile header per design spec. |
| P8 | **Low** | **Stories/news is mock data** ("Data ilustrasi…"). | If found, it erodes trust slightly. | Hide the section until the news API is live, rather than show illustrative data. |

---

## The One-Sentence Verdict (persona's words)

> *"Kalau sahamnya udah dianalisis — kayak BBRI — app ini JUARA, gue ngerti ceritanya dan
> beli pakai kepala bukan kuping. Tapi pas gue iseng ke saham gorengan yang lagi rame, app-nya
> diem, dan justru di situ gue paling butuh dia ngomong."*

**Translation:** For covered blue chips, the app fully delivers on his goal (understand
fundamentals + thesis, buy with conviction). For the speculative names that actually trap him,
the safety net is silent — which is precisely the highest-value gap to close.

---

## Top 3 Recommendations (priority order)

1. **Close the coverage gap on hot/speculative stocks (P1).** Auto-queue AI analysis for
   popular/high-volatility tickers and show an *instant* "thin-data / speculative" interim
   verdict. This is the difference between the app preventing his next bad trade or not.
2. **Make the thesis discoverable and rename the misleading score (P2 + P3).** Surface
   "CERITA/THESIS" prominently; never show a bare 0–100 that's really data completeness.
3. **Add lightweight interpretation layers (P5 + P6).** One-line verdicts on financial charts
   and a confidence/how-to-read note on the bandar signal — so a semi-novice can *judge*, not
   just *view*.
