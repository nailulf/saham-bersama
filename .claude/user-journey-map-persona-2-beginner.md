# User Journey Map — Saham Bersama (Persona 2: Complete Beginner)

> Companion to [usability-test-persona-2-beginner.md](./usability-test-persona-2-beginner.md)
> and the Persona 1 journey map
> ([user-journey-map-persona-1-retail-fundamental.md](./user-journey-map-persona-1-retail-fundamental.md)).
> Maps the end-to-end journey for **Persona 2 (Sinta — complete beginner, <Rp 20jt, first-ever
> investor, no jargon knowledge)**. Grounded in the live app.

---

## Persona & Core Job-To-Be-Done

**Sinta** hires this app to do one job:

> *"I'm brand new. Teach me to understand if a stock is good or bad — in language I understand —
> so I can buy my first stock with confidence instead of just copying TikTok/teman."*

Unlike Bagus (who *has* a mental model and wants coverage), Sinta has **no model at all**. Her
journey is gated not by data coverage but by **comprehension** — she breaks the moment she meets
a term or chart she can't read, and her tolerance is ~1–2 confusing screens before she closes the app.

Single scenario (she has no segmentation between blue chip vs gorengan — she can't tell them apart yet):
- **Find and understand her first "safe" stock** (she gravitates to BBCA, a name she's heard of).

---

## Journey Overview (7 stages)

```
1 TRIGGER ─▶ 2 ARRIVE ─▶ 3 DISCOVER ─▶ 4 ASSESS ─▶ 5 FIND THESIS ─▶ 6 DECIDE ─▶ 7 ACT/RETURN
 (FOMO from   (home —     (search the   (jargon     (half-readable    (follows,    (likely
  TikTok/      no onboard) name she     wall →      narrative +       doesn't      churns)
  teman)                   knows)       gives up)   unexplained terms) understand)
```

Emotional curve (Sinta):

```
  😀 high   │
            │
  😐 neutral│──╮ (curious at open)
            │  ╰──╮         ╭──╮ (AI prose: "ada bacaan!")
  😟 low    │     ╰──╮  ╭───╯  ╰──╮
  😣 frustr │        ╰──╯ (jargon)  ╰────╮ (FINANSIAL wall)
  😩 give-up│                            ╰────────────────── (decides by copying, churn risk)
            └──────────────────────────────────────────────────────────
              1     2      3       4        5         6        7
```

Note: no high point. The ceiling is "😐 ada bacaan yang bisa kubaca" — never delight.

---

## Stage-by-Stage Map

Legend: **🟢 Works** · **🟡 Friction** · **🔴 Breaks**

---

### Stage 1 — TRIGGER (off-app)

| | |
|---|---|
| **Doing** | Sees a finance TikTok / teman says "beli saham X". Wants to start but scared of losing money. |
| **Thinking** | *"Aku mau mulai investasi tapi takut salah. Cari app yang bisa bantu."* |
| **Feeling** | 😐 Hopeful but anxious |
| **Touchpoint** | None (external) |
| **Status** | 🟡 App not present; she arrives carrying fear, not a plan. |
| **Opportunity** | App-store / first-open promise: "Belajar saham dari nol" framing to set the right expectation. |

---

### Stage 2 — ARRIVE (Home, first open)

| | |
|---|---|
| **Doing** | Lands directly on the dense terminal dashboard. No welcome, no tutorial. |
| **Thinking** | *"Banyak banget angka… ini buat orang yang udah ngerti. Mulai dari mana?"* |
| **Feeling** | 😟 Overwhelmed |
| **Touchpoint** | `page.tsx`, `MarketOverview`, `PopularStocks`, `StrategyPicks` |
| **Status** | 🔴 **Breaks early.** No onboarding; first impression = "this isn't for me." |

**Compounding breaks:**
- **No onboarding / "start here"** → instant disorientation (B1, Critical).
- **"Popular" misread as "safe/recommended"** → wrong mental model (B5).
- **0–100 completeness score read as a quality rating** → false confidence on screen 1 (B2, Critical).

---

### Stage 3 — DISCOVER (find the stock)

| | |
|---|---|
| **Doing** | Searches a name she's heard of ("BBCA"). |
| **Thinking** | *"Oh gampang, ketemu."* |
| **Feeling** | 🙂 Brief relief |
| **Touchpoint** | `SearchBar` |
| **Status** | 🟢 **Works.** The one frictionless stage. (Same as Persona 1.) |

---

### Stage 4 — ASSESS (is it good?) — the comprehension wall

| | |
|---|---|
| **Doing** | Reads hero stats; bravely opens FINANSIAL / VALUASI; retreats. |
| **Thinking** | *"P/E? PBV? Yield? IDX30? … Laba Rugi, Neraca, chart banyak banget. Aku nggak ngerti. Tutup aja."* |
| **Feeling** | 😣 Frustrated → 😩 gives up on the tab |
| **Touchpoint** | `HeroBar`, `NavTabs`, `FinancialStatementsWidget`, `ValuationWidget`, `CompanyMetricsWidget` |
| **Status** | 🔴 **Hard stop.** Jargon + raw charts with no verdict. She abandons the analytical core. |

**Key irony:** the **METRIK PERUSAHAAN peer badges** (green/red — the thing that would actually
help her) sit *below* the raw charts; she quits before scrolling to them. Good help, buried
behind a wall.

---

### Stage 5 — FIND THESIS (why?) — partial, half-understood

| | |
|---|---|
| **Doing** | Reaches AI Insights under OVERVIEW; reads the narrative; skips scenarios. |
| **Thinking** | *"Ada bacaan, ini enak — tapi 'Stalwart', 'moat', 'Lynch'? Apaan tuh. Stop Loss artinya apa?"* |
| **Feeling** | 😐 → 🙂 (relief at prose) → 😟 (jargon re-confuses) |
| **Touchpoint** | `AIInsightsWidget`, `AnalystInsightWidget` |
| **Status** | 🟡 **Partial.** The narrative is her *highest* point — but ~50% lost to unexplained jargon, deepest value (scenarios) skipped, analyst bars misread as personal advice. |

This is the closest the app comes to serving her — and the clearest signal of where to invest:
make the explaining layer beginner-readable.

---

### Stage 6 — DECIDE

| | |
|---|---|
| **Doing** | Picks based on (1) price up, (2) the "100" score, (3) half-read paragraph. |
| **Thinking** | *"Aku ngikut aja. Aku nggak bisa jelasin kenapa."* |
| **Feeling** | 😟 Unsure, low conviction |
| **Touchpoint** | `AIVerdictStrip` |
| **Status** | 🔴 **Job fails.** She decides by copying — exactly the behavior the app should replace. No understanding gained. |

---

### Stage 7 — ACT / RETURN

| | |
|---|---|
| **Doing** | Maybe buys elsewhere; more likely closes the app, returns to TikTok/teman. |
| **Thinking** | *"App-nya susah. Mungkin aku belum level ini."* |
| **Feeling** | 😩 Defeated |
| **Touchpoint** | — (no re-engagement hook, no learning loop) |
| **Status** | 🔴 **High churn risk.** Nothing builds competence over time or invites her back. |
| **Opportunity** | Progressive learning path, "kamu belajar X hari ini," beginner streaks/checklists. |

---

## Where the Journey Breaks — Summary

| Stage | Status | Root cause | Severity |
|---|---|---|---|
| 1 Trigger | 🟡 absent | App not at moment of intent | Med |
| 2 Arrive | 🔴 break | No onboarding; misleading score; "popular"=safe | **Critical** |
| 3 Discover | 🟢 works | — | — |
| 4 Assess | 🔴 break | Jargon wall + raw charts, no verdict | **Critical** |
| 5 Find Thesis | 🟡 partial | Narrative helps but jargon-salted | High |
| 6 Decide | 🔴 break | Decides by copying; no comprehension | **Critical** |
| 7 Return | 🔴 break | No learning loop; high churn | High |

**The headline:** Persona 1 (Bagus) breaks *late and narrowly* (only on coverage of hyped
stocks). Persona 2 (Sinta) breaks **early and repeatedly** — at Stages 2, 4, 6, 7 — because the
gate is **comprehension, not coverage**. She never reaches a "peak"; her best moment is merely
"there's text I can read." Without a teaching/interpretation layer, she churns.

---

## Moments That Matter (prioritized)

1. **🔴 Stage 2 — "First open with no ramp."** Fix onboarding + the misleading score, or she's
   gone before reaching any value. (→ B1, B2, B5)
2. **🔴 Stage 4 — "The jargon/chart wall."** A Beginner Mode with plain-language verdicts turns a
   hard stop into a learning moment. (→ B3, B4)
3. **🟡 Stage 5 — "Readable but half-understood thesis."** De-jargon the narrative + tap-to-explain
   = the app's existing peak feature becomes accessible to her. (→ B3, B6, B7, B8)
4. **🔴 Stage 7 — "No learning loop."** A progressive path converts a one-off confused visit into
   retained competence + retention. (new opportunity)

---

## How This Maps to Usability Findings

| Journey break | Usability finding |
|---|---|
| Stage 2 no onboarding | **B1 (Critical)** |
| Stage 2 misleading 100-score | **B2 (Critical)** |
| Stage 2 "popular"=safe | **B5 (High)** |
| Stage 4 jargon wall | **B3 (Critical)** |
| Stage 4 raw charts, no verdict | **B4 (Critical)** |
| Stage 5 analyst bars as advice | **B6 (High)** |
| Stage 5 entry/stop undefined | **B7 (Medium)** |
| Stage 5 scenarios skipped | **B8 (Medium)** |
| Stage 7 no learning loop | New (not in usability test) |

---

## Cross-Persona Comparison (Persona 1 vs Persona 2)

| Dimension | Bagus (P1 — experienced) | Sinta (P2 — beginner) |
|---|---|---|
| Gate that breaks the journey | **Coverage** (hyped stocks lack analysis) | **Comprehension** (jargon, no verdicts) |
| Where it breaks | Late (Stage 5–6), only Scenario B | Early + repeated (Stage 2, 4, 6, 7) |
| Emotional peak | 😀 Delight (AI thesis reveal) | 😐 Mild relief ("ada bacaan") — no peak |
| Reaction to peer badges | ⭐ Loves them | 🔴 Never reaches them (buried) |
| Reaction to FINANSIAL charts | 🟡 Wants a verdict | 🔴 Hard stop, abandons |
| Reaction to 100-score | 🟡 Suspicious ("data lengkap?") | 🔴 Buys on it (false confidence) |
| Churn risk | Low (returns for covered stocks) | **High** (closes app, back to TikTok) |
| Shared bright spot | **AI narrative thesis** — the only surface that *explains* | same |

**Strategic implication (both personas point to one thing):** the data layer is strong; the
gap is an **interpretation/teaching layer**. For Bagus that means *fast interim verdicts on
uncovered stocks*; for Sinta that means *plain-language verdicts, de-jargoned narrative, and a
beginner mode*. Both are the same investment: **make the app explain, not just display.**
