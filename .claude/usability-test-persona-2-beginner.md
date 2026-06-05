# Usability Test — Saham Bersama App (Persona 2: Complete Beginner)

> Simulated moderated usability test (think-aloud protocol). Grounded in the actual app code
> as of 2026-06-05. Companion to Persona 1
> ([usability-test-persona-1-retail-fundamental.md](./usability-test-persona-1-retail-fundamental.md)).
> Persona voice is everyday Indonesian, a true first-timer.

---

## Test Setup

| Field | Value |
|---|---|
| Method | Moderated think-aloud, single session, mobile-first (iPhone, 390px) |
| App | Saham Bersama (IDX Stock Analyzer) |
| Session date | 2026-06-05 |
| Duration | ~20 min (gave up earlier on some tasks) |
| Device | Phone, one-handed |

### Persona — "Sinta", Complete Beginner

- **Who:** ~24 y.o., baru lulus kerja, baru buka rekening saham 2 minggu lalu (Ajaib/Bibit
  era). First-ever investing.
- **Capital:** < Rp 20 juta (uang nabung pertama).
- **Skill level:** Tahu "beli saham bisa untung/rugi". Tidak tahu apa itu PER, PBV, ROE,
  market cap, dividend yield. Belum pernah baca laporan keuangan. Tidak tahu istilah "bandar",
  "Wyckoff", "moat", "Lynch".
- **Behavior:** Ikut-ikutan teman & TikTok finance. Takut rugi. Butuh dituntun, bukan dikasih
  data mentah. Kalau bingung 1–2 layar, dia tutup app.
- **Today's goal (her words):** *"Aku pengen beli saham pertama yang 'aman'. Aku nggak ngerti
  istilah-istilahnya. Aku mau app-nya bantuin aku ngerti: ini saham bagus atau enggak, dan
  kenapa — pakai bahasa yang aku ngerti."*

### Tasks Given

1. Open the app for the first time. What do you think this app is for?
2. Find a stock that's "good for a beginner" and explain why (in your own words).
3. Look up BBCA (a name she's heard of). Tell me one thing you learned.
4. Decide if you'd buy it — and say what you'd want to understand first.

---

## Session Walkthrough (Think-Aloud)

### Step 1 — First open (no onboarding)

App drops her straight onto the home dashboard. No welcome, no tutorial, no "new here?" guide.

> *"Eh… langsung banyak banget angka. Ada 'IHSG', 'BR-IDX', 'USD-IDR'… ini apa ya? Aku kira
> bakal ada tutorial atau 'mulai dari sini'. Ini kayak dashboard buat orang yang udah ngerti."*

**Finding (Critical for this persona):** **Zero onboarding.** The first screen is a dense
terminal-style dashboard. A beginner has no entry ramp, no explanation of what the app does or
where to start. Sinta's confidence drops in the first 10 seconds.

> *"Market Overview, IHSG turun 0.4%… aku nggak tau ini bagus apa jelek buat aku."*

---

### Step 2 — Looking for "a good beginner stock"

She scrolls. Finds **Popular Stocks** and **Strategy Picks**.

> *"'Popular Stocks' — oh kayaknya ini yang banyak orang beli? Berarti aman dong?"*

**Finding:** She equates "Popular" with "safe/recommended" — a dangerous assumption. The label
gives no basis (it's actually market-cap sorted), so she fills the gap with a wrong mental model.

She taps **Strategy Picks** and sees strategy pills + a 0–100 circular score.

> *"Ada angka 100, 95, 88 bulet-bulet. Oh ini ratingnya ya? Berarti yang 100 paling bagus,
> aku beli yang itu aja!"*

**Finding (Critical):** The `completeness_score` (data completeness) is read by a beginner as
a **star rating / quality score**. She is one tap away from buying a stock purely because a
number says "100." This is the most dangerous misread in the whole app for a novice — it
actively manufactures false confidence.

> *"Tapi strateginya namanya… (baca pill) aku nggak ngerti artinya. Aku pilih aja yang
> score-nya tinggi."*

The strategy names/descriptions assume domain knowledge she doesn't have.

---

### Step 3 — Opens a stock (BBCA)

She searches "BBCA" (heard of "Bank BCA"). Search works fine.

> *"Search-nya gampang, ketemu BBCA."* ✅

Hero bar:

> *"Harga 9.850, ada panah ijo. Oh naik, bagus. Ada 'Perbankan', 'LQ45', 'IDX30'… IDX30 itu
> apa? Terus di bawah: Mkt Cap, P/E, PBV, Yield. Ini… aku nggak ngerti satupun."*

**Finding:** The hero's compact stats (P/E, PBV, Yield, Mkt Cap) — the app's "fast scan" win
for experienced users — are **pure jargon walls** for a beginner. No labels in plain language,
no tap-to-explain.

She opens the tabs: **OVERVIEW · VALUASI · FINANSIAL · MONEY FLOW · TEKNIKAL · PROFIL**.

> *"VALUASI, FINANSIAL, TEKNIKAL… ini semua istilah yang aku takut. Mana yang harus aku buka
> duluan? Aku nggak tau."*

**Finding:** Tab labels are all-caps domain terms. No "Start here" / "Ringkasan untuk pemula".
She doesn't know OVERVIEW is the friendliest starting point.

---

### Step 4 — OVERVIEW (the AI thesis)

Lands on **AI Insights**. For BBCA, analysis exists.

> *"Ada paragraf penjelasan! Ini enak, ada bacaan bukan cuma angka."* ✅
> *"Tapi… 'Stalwart', 'Wide moat', 'Lynch category'? Ini bahasa apa? Aku nggak ngerti istilahnya
> tapi kayaknya penting."*

**Mixed finding:** The narrative is the *most beginner-friendly* thing in the app (prose she can
read) — but it's salted with unexplained expert jargon (Lynch categories, moat, "Stalwart") and
no glossary/tooltips. She gets ~50% of the value.

The Target / Entry Zone / Stop Loss boxes:

> *"Target Harga, Zona Masuk, Stop Loss. Aku ngerti 'target harga' kayaknya. 'Stop Loss' itu…
> berhenti rugi? Aku nggak yakin. Nggak ada penjelasannya."*

**Finding:** Even the most actionable element (entry/stop) lacks a one-line "apa ini" for a
first-timer. She guesses meaning.

She does NOT tap "Lihat detail skenario" (bull/neutral/bear):

> *"Kebanyakan, aku skip."*

**Finding:** Beginner doesn't engage the deepest value (scenarios) because nothing signals it's
worth the effort or explains it simply.

Below, **Analyst Insight** for BBCA shows target + recommendation bars.

> *"Ada bar warna-warni 'Strong Buy', 'Buy', 'Hold'… oh kayaknya banyak yang bilang beli. Itu
> berarti aku harus beli ya?"*

**Finding:** She reads analyst consensus as a direct instruction ("they say buy → I buy"),
without understanding it's professional opinion, not advice for her risk profile.

---

### Step 5 — FINANSIAL / VALUASI (the wall)

She bravely opens **FINANSIAL**.

> *"Ada chart Laba Rugi, Arus Kas, Neraca. Banyak garis sama batang. Aku… nggak tau ini bagus
> apa enggak. Mana yang harus aku liat? (diam) … aku tutup aja deh, pusing."*

**Finding (Critical):** The FINANSIAL tab is a **hard stop** for a beginner. Raw composed
charts with no "ini artinya sehat/tidak" verdict. She abandons the tab. The METRIK PERUSAHAAN
peer badges (green/red) *would* help her — but they're below the charts and she gave up before
scrolling there.

VALUASI / DCF calculator:

> *"Ada kalkulator valuasi. Aku nggak ngerti harus isi apa. Skip."*

**Finding:** The DCF/valuation tool is invisible-value for a novice — too advanced, no guided mode.

---

### Step 6 — MONEY FLOW / TEKNIKAL (curiosity → confusion)

> *"'Identifikasi broker bandar'? 'Akumulasi'? 'Wyckoff'? Ini bahasa planet mana? Aku nggak
> berani sentuh."*

**Finding:** Money flow + technical = full jargon lockout. Zero beginner affordance. She doesn't
even attempt to interpret.

---

### Step 7 — Decision

> *"Jujur ya… aku cuma beneran ngerti dua hal: harganya lagi naik, dan ada paragraf yang
> bilang BBCA bagus. Sama angka '100' tadi di home. Jadi mungkin aku beli BBCA, atau yang
> score 100 itu. Tapi aku nggak bisa jelasin KENAPA pakai kata-kataku sendiri — aku cuma
> ngikut."*

**Critical outcome:** The app did **not** move Sinta from "ikut-ikutan" to "understands why."
She'd make a decision based on (1) price going up, (2) a number she misread, and (3) a paragraph
she half-understood. The core job — *teach me to judge for myself* — was not met. She'd likely
churn (close the app, go back to TikTok finance) within the first 2–3 sessions.

---

## Findings Summary

### ✅ What works even for a beginner

| # | Finding | Why it helps |
|---|---|---|
| W1 | **AI Insights narrative (prose)** | The only place that *explains* rather than dumps data — beginner can read it. |
| W2 | **Search** | Easy, forgiving — she found stocks without trouble. |
| W3 | **Hero shows price + direction clearly** | She understood "harga naik, panah ijo." |
| W4 | **Color coding (green/red)** is intuitive | Universal language; works without training. |

### ⚠️ Problems (ranked by severity for this persona)

| # | Severity | Finding | Impact | Suggested fix |
|---|---|---|---|---|
| B1 | **Critical** | **No onboarding / "start here."** First screen is a dense terminal dashboard. | Beginner is lost in 10 seconds; high early churn. | Add a first-run welcome + a "Pemula? Mulai di sini" guided path; a 3-step "how to read a stock" overlay. |
| B2 | **Critical** | **`completeness_score` 0–100 read as a quality rating** (worse than for Bagus — she'd buy purely on the number). | Manufactures false confidence; recreates the ikut-ikutan trap the app should break. | Relabel ("Kelengkapan Data"), de-emphasize visually, or replace with a real quality score + plain-language tier (e.g., "Sehat / Hati-hati"). |
| B3 | **Critical** | **Jargon everywhere, no glossary/tooltips** (P/E, PBV, Yield, IDX30, Lynch, Stalwart, moat, bandar, Wyckoff, akumulasi). | Beginner gets a fraction of the value; abandons tabs. | Tap-to-explain tooltips on every term; a beginner glossary; plain-language alt-labels (e.g., "P/E = harga vs laba"). |
| B4 | **Critical** | **FINANSIAL/VALUASI/TEKNIKAL are hard stops** — raw charts/tools with no verdict, no guided mode. | She abandons the analytical core entirely. | One-line plain verdict per chart ("Laba naik tiap tahun ✓"); a "Mode Pemula" that hides advanced widgets and shows only verdicts. |
| B5 | **High** | **No "is this safe for a beginner?" signal.** "Popular" misread as "safe." | Wrong mental model from the home screen. | A risk/suitability badge ("Cocok pemula / Spekulatif"); label what "Popular" actually means. |
| B6 | **High** | **Analyst consensus read as personal advice** ("they say Buy → I buy"). | Outsources judgment again; no understanding. | Add a one-line framing: "Ini opini analis profesional, bukan saran untuk kamu." Reinforce the disclaimer in plain language near the bars. |
| B7 | **Medium** | **Entry/Target/Stop Loss lack plain definitions.** | Even the actionable bits are guessed at. | Tiny "?" tooltips: "Stop Loss = batas rugi, jual kalau turun ke sini." |
| B8 | **Medium** | **Scenarios (bull/neutral/bear) not engaged** — collapsed + unexplained. | Deepest value skipped. | Label it "Apa yang bisa terjadi?" with a one-line teaser; auto-expand a simplified version in beginner mode. |
| B9 | **Low** | Tab labels all-caps domain terms; no "start here" tab. | Navigation paralysis. | Friendly first tab ("RINGKASAN") or reorder for novices. |

---

## The One-Sentence Verdict (persona's words)

> *"App-nya kayaknya pinter banget — tapi pinternya buat orang yang udah pinter. Aku yang baru
> mulai malah makin bingung dan takut salah. Aku butuh dituntun, bukan dikasih kontrol pesawat."*

**Translation:** The app is powerful but assumes expertise. For a true beginner it raises
anxiety instead of building competence — it hands over a cockpit when she needed a guided path.
The job ("teach me to judge for myself") is unmet, and churn risk is high.

---

## Top 3 Recommendations (priority order)

1. **Ship a "Mode Pemula" (Beginner Mode) + first-run onboarding (B1 + B4).** A simplified view
   that hides advanced widgets and shows only plain-language verdicts ("Sehat", "Hati-hati"),
   plus a 3-step intro on first open. Single biggest lever against beginner churn.
2. **Kill the misleading 100-score and add tap-to-explain everywhere (B2 + B3).** Relabel/replace
   the completeness score, and put tooltips/glossary on every jargon term. Removes the two
   sources of false confidence and the comprehension wall.
3. **Add verdicts + suitability signals (B4 + B5 + B6).** One-line "is this good/bad" on each
   chart, a "cocok pemula vs spekulatif" badge, and reframe analyst consensus as opinion — so
   she learns to *judge*, not *follow*.

---

## Cross-Persona Note

Compared to **Bagus (Persona 1)**, who hit the app's peak (AI thesis) and broke only on
*coverage* (hyped stocks lack analysis), **Sinta breaks much earlier and more often** — at
*comprehension*. The same features that delighted Bagus (peer badges, hero stats, financial
charts, bandar signals) are walls for Sinta. The shared root cause across both personas is the
same single feature done right: the **AI narrative thesis** — it's the only surface that
*explains*. The strategic implication: invest in an **interpretation/teaching layer** (verdicts,
plain language, beginner mode) on top of the existing strong data layer.
