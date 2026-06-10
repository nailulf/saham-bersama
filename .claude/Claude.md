# Claude Instructions — FSA Design System & Mobile-First PWA

This file supplements the root `CLAUDE.md` with frontend-specific guidance for the Terminal Dashboard design system and the mobile-first PWA direction.

---

## Design System Identity

The FSA app uses a **Terminal Dashboard** aesthetic — inspired by Bloomberg Terminal and data terminals. The visual language is:

- Monospace type for all labels and metadata (`JetBrains Mono`)
- Display/numeric type for prices and scores (`Space Grotesk`)
- A strict two-tone dark palette with a single neon accent (`#00FF88`)
- ALL_CAPS labels throughout — this is intentional, not a bug
- Minimal use of border-radius (cards are mostly sharp-cornered)

There are two approved theme variants:
- **Dark** (default): `#0C0C0C` page background, `#080808` card surface
- **Light**: `#F8F8FA` page background, `#FFFFFF` card surface

Do not introduce gradients, shadows, or decorative illustrations. The design is data-dense and functional — ornamental elements break the terminal aesthetic.

---

## Design Tokens (Source of Truth)

When writing any CSS or Tailwind classes, map to these tokens. Do not use raw hex values in component code.

```css
/* ── Surfaces ───────────────────────────────────────────────────────────── */
--color-bg-page        dark: #0C0C0C   | light: #F2F6FA   ← cool blue-gray (updated Jun 2025)
--color-bg-card        dark: #131313   | light: #FFFFFF
--color-bg-inset       dark: #161616   | light: #E1EAF4   ← cool blue pill bg (updated Jun 2025)

/* ── Borders ────────────────────────────────────────────────────────────── */
--color-border         dark: #2A2A2A   | light: #E5E7EB
--color-border-subtle  dark: #1E1E1E   | light: #ECF0F5   ← cool blue row dividers (updated Jun 2025)

/* ── Text ───────────────────────────────────────────────────────────────── */
--color-text-primary   dark: #FFFFFF   | light: #0D0D0D   ← readable text (any size)
--color-text-muted     dark: #888888   | light: #6B7280   ← readable text; lowest tier for body/meta (avoid on light inset, ~4:1)
--color-text-dim       dark: #6E6E6E   | light: #7A8290   ← ≥3:1 — large-text/UI/disabled ONLY, never small body (was #555/#9CA3AF @ ~2.4:1)
--color-text-ghost     dark: #444444   | light: #C4C3C1   ← DECORATION ONLY (watermark glyphs, faint separators) — never readable text

/* ── Brand (green) ──────────────────────────────────────────────────────── */
--color-brand          dark: #00FF88   | light: #10B981
--color-brand-bg       dark: #00FF8820 | light: #D1FAE5
--color-brand-text     dark: #00FF88   | light: #047857   ← emerald-700, ≥4.5:1 WCAG on light surfaces (was #059669)

/* ── Negative (red) ─────────────────────────────────────────────────────── */
--color-negative       dark: #FF4B4B   | light: #EF4444
--color-negative-bg    dark: #FF4B4B20 | light: #FEE2E2
--color-negative-text  dark: #FF4B4B   | light: #C81E1E   ← ≥4.5:1 WCAG on light surfaces + tint (was #DC2626)

/* ── Score tiers ────────────────────────────────────────────────────────── */
--color-warning-bg     dark: #FFB80020 | light: #FEF3C7   (score 75–84 / volatility banner)
--color-warning-text   dark: #FFB800   | light: #B45309   ← amber-700, ≥4.5:1 WCAG on light surfaces + tint (was #D97706)
--color-neutral-bg     dark: #2A2A2A   | light: #F3F4F6   (score < 75)
--color-neutral-text   dark: #888888   | light: #9CA3AF

/* ── PWA Shell ──────────────────────────────────────────────────────────── */
--color-tab-bar        dark: #161616CC | light: #FFFFFFEE  (frosted pill)
--color-tab-active-bg  dark: #00FF8820 | light: #D1FAE5
--color-indicator      dark: #FFFFFF30 | light: #0D0D0D20  (iOS swipe bar)

/* ── Typography ─────────────────────────────────────────────────────────── */
--font-body     'Inter', sans-serif              (body text, light-theme labels, news)
--font-display  'Space Grotesk', sans-serif      (prices, scores, tickers)
--font-mono     'JetBrains Mono', monospace      (dark-theme labels, tags, ALL_CAPS)
```

**Light-theme background rationale (updated Jun 2025):** The warm beige (`#F5F4F1`) was replaced with a cool blue-gray (`#F2F6FA`). White cards read more crisply on the cooler base, and `#10B981` green reads more vivid against cool surroundings. This matches the `KnUbp` design variant.

When adding Tailwind utilities for these values, extend `tailwind.config.ts` under `theme.extend.colors` and `theme.extend.fontFamily` rather than using arbitrary values like `text-[#00FF88]`.

---

## Mobile-First Rules

The app is **mobile-first**. This means:

1. Write the mobile layout first, then add `md:` and `lg:` prefixes for larger breakpoints
2. The design file shows 1440px frames — treat those as the desktop target, not the baseline
3. Target breakpoints:
   - `sm`: 390px (primary mobile — iPhone 14)
   - `md`: 768px (tablet)
   - `lg`: 1280px (desktop)
   - `xl`: 1440px (design file native width)

4. Every page must be usable one-handed on a 390px screen. The three primary data points — **current price, signal badge (BUY/HOLD/SELL), and AI score** — must be above the fold without scrolling.

5. On mobile, the tab navigation (`SUMMARY`, `FUNDAMENTALS`, etc.) becomes a horizontally scrollable row. Do not wrap tabs to two lines.

6. The `verdictRow` component (Target / Entry Zone / Stop Loss) stacks vertically on mobile and goes horizontal at `md:`.

---

## PWA Requirements

Every new page or significant feature must consider PWA behavior:

- **App shell** (header, nav, bottom bar) is always cached — changes to shell components invalidate the SW cache; communicate this to the deployment checklist
- **API data** is network-first — never cache stock prices, AI analysis results, or money flow data beyond the current session
- **Offline fallback**: show cached last-known data with a `[CACHED — last updated: DATE]` badge, not an error screen
- **Install prompt**: managed via `beforeinstallprompt` event, stored in context; do not show unless the user has visited ≥3 times or explicitly requests it

When modifying `app/layout.tsx`, preserve the `<link rel="manifest">` and `<meta name="theme-color">` tags.

---

## Component Conventions

### Naming (from design file frame names → component files)

| Frame name in design  | Component                                     |
|-----------------------|-----------------------------------------------|
| `hero`                | `components/stock/StockHero.tsx`              |
| `Navigation Tabs`     | `components/stock/StockTabs.tsx`              |
| `verdictRow`          | `components/stock/VerdictRow.tsx`             |
| `verdictLeft`         | `components/stock/VerdictPanel.tsx`           |
| `scoreCard`           | `components/stock/ScoreCard.tsx`              |
| `scoreCircle`         | `components/ui/ScoreCircle.tsx`               |
| `buyBadge`            | `components/ui/SignalBadge.tsx`               |
| `aiCard`              | `components/stock/AIInsightsWidget.tsx`       |
| `confSection`         | `components/ui/ConfidenceBar.tsx`             |

### Signal badge variants

The `buyBadge` frame uses three states with distinct colors:
- `BUY` → `--color-brand` background, dark text (`#0A0A0A`)
- `HOLD` → `--color-warning` background, dark text (`#0A0A0A`)
- `SELL` → `--color-negative` background, **dark text (`#0A0A0A`)** — NOT white. White on the bright red is only 3.3:1 (fails). Dark text is 5.3–6.0:1 and matches the BUY/HOLD pattern.

Implement as `<SignalBadge variant="buy" | "hold" | "sell">`. All three badges use dark text on a bright accent fill — the same rule as the AKTIF badge in `AIInsightsWidget`.

### Score display

The `scoreCircle` is a circular badge (64px diameter) with:
- Border: 2px `--color-brand`
- Background: `#00FF8820` (brand at 12% opacity)
- Text: `Space Grotesk` 24px 700 weight

Score thresholds for color:
- ≥ 7.0 → `--color-brand` (#00FF88)
- 4.0–6.9 → `--color-warning` (#FFAA00)
- < 4.0 → `--color-negative` (#FF4444)

### Metric rows (hero bar)

The hero bar shows inline metrics separated by `  |  ` in `--color-border`. Each metric is `JetBrains Mono` 11px 500 weight in `--color-text-muted`. On mobile, this bar scrolls horizontally — do not wrap.

---

## Typography Rules

- **Tickers** (`BBCA`, `BMRI`): `Space Grotesk` 32px 700, letter-spacing -1px, `--color-text-primary`
- **Prices** (`Rp 9,850`): `Space Grotesk` 32px 700, letter-spacing -1px, `--color-brand` (positive) or `--color-negative` (loss)
- **Section labels / tab names**: `JetBrains Mono` 10px 700, letter-spacing 1px, ALL_CAPS
- **Body metadata**: `JetBrains Mono` 11px 500, `--color-text-muted`
- **Sub-labels** (TARGET, ENTRY ZONE, STOP LOSS): `JetBrains Mono` 9px 700, letter-spacing 0.5px, ALL_CAPS

Never mix `Space Grotesk` and `JetBrains Mono` within the same text node. Use `Space Grotesk` for numbers the user scans, `JetBrains Mono` for labels the user reads.

---

## Font Size Policy — Reading Copy vs. Labels (ACCESSIBILITY)

WCAG 2.x sets **no minimum font size** (only 1.4.4 Resize Text — content must survive 200% zoom without clipping). Expected contrast ratio of 4.5:1 minimum. But for a mobile-first app read on a 390px screen, the *reading content* must clear a practical floor. The rule that governs every text node: 

**Classify the text, then size it.**

| Class | What it is | Min size | Font | Notes |
|-------|-----------|----------|------|-------|
| **Reading copy** | Full sentences / paragraphs the user *reads* — AI narrative, scenario text, drivers, early-signs, news, descriptions | **13px** (paragraphs), **12px** (inline list items) | `font-body` | NEVER below 12px. These carry meaning the user must absorb. |
| **Data values** | Numbers the user *scans* — prices, ratios, %, scores | 11px+ | `font-display` / `font-mono` | Table cells may go to 11px; hero values are large per spec. |
| **Labels / tags** | ALL_CAPS mono labels the user *glances* — section headers, tab names, sub-labels, chips, freshness badges | **9px** floor | `font-mono` | The terminal aesthetic's small ALL_CAPS labels are intentional. 9px is the floor — do not go to 8px. |

**Hard rules:**
1. **No `text-[8px]`** anywhere. Bump any existing 8px to 9px (labels) or higher (anything readable).
2. **Reading copy is never `text-[10px]` or `text-[11px]`** — it reads as "fine print." Use 12–13px.
3. `font-body` (Inter) at 10px is the most common offender — if it's a sentence, it's reading copy → 12px minimum.
4. Pair small sizes with high-contrast tokens only. Never combine `text-[9px]` with `--color-text-dim` / `--color-text-ghost` (both fail WCAG contrast) — small + low-contrast compounds illegibility.
5. Verify the page survives **200% browser zoom** with no clipping in the horizontally-scrolling metric bars (SC 1.4.4).

**Applied reference:** `AIInsightsWidget` (Skenario & Risiko card) — scenario paragraph 13px, drivers/early-signs 12px, INVESTMENT THESIS narrative 13px, mono sub-labels 9px. Use it as the template when migrating other stock-detail widgets off the old 10/11px reading copy.

---

## Gray Text Tiers & WCAG Roles (ACCESSIBILITY)

There cannot be more than two gray tiers that carry **readable text** — `muted` already sits near the WCAG 4.5:1 floor, so anything "dimmer" can't also be legible. The tiers therefore have **roles**, not just shades:

| Token | Role | Min contrast | Allowed uses |
|-------|------|--------------|--------------|
| `--color-text-primary` | Primary readable | ~18:1 | Any text, any size |
| `--color-text-muted` | Secondary readable — **lowest tier for body/meta text** | ~4.5–5:1 (card) | Labels, metadata, secondary copy. ⚠️ On the **light inset** surface it's only ~4:1 — use `primary` for text sitting on `--color-bg-inset` in light mode. |
| `--color-text-dim` | **Non-essential / UI only** | ≥3:1 (large-text & UI-component threshold) | Disabled states, placeholder glyphs (`—`, `▬`), large (≥18px/≥14px-bold) decorative labels, the "off" half of a toggle. **Never small body text.** |
| `--color-text-ghost` | **Decoration only** | no guarantee | Watermark glyphs, the faintest separators. **Never carries information.** Anything a user must read or act on must not use this. |

When you reach for `dim` or `ghost` on text the user is meant to *read*, that's a bug — promote it to `muted` (or `primary`). These two tiers were darkened (Jun 2025) to clear ≥3:1 so existing decorative/UI uses are safe, but the role boundary above is the rule.

---

## Typography & Color Hierarchy — WCAG AA Reference (Source of Truth)

> **Canonical source:** the **"Color & Font Hierarchy — WCAG AA Reference"** frame (Node ID `INaWf`) in the design file [docs/FSA - stock detail page](../docs/FSA%20-%20stock%20detail%20page). The two sections above ("Font Size Policy", "Gray Text Tiers") are the **mental model**; the tables below are the **per-role / per-token lookup** that mirrors the design frame. When that frame changes, update these tables **and** the `design-system-review` skill together. The `design-system-review` skill audits changed components against exactly these rules.

**WCAG AA thresholds:** normal text needs **≥4.5:1**; large text (**≥18px**, or **≥14px bold**) and UI components need **≥3:1**. The terminal aesthetic leans on small ALL_CAPS mono labels — those are normal text and must clear 4.5:1, so small + low-contrast never combine.

### Color Tokens & Contrast Ratios

Contrast ratios (CR) are measured against the card surface (`--color-bg-card`). `△ large-only` = clears 3:1 but not 4.5:1, so it is valid for large/UI text only, never small body copy.

| Token | Role | Dark | Light | Dark CR | Light CR | AA (normal text) | Allowed uses |
|-------|------|------|-------|---------|----------|------------------|--------------|
| `--color-text-primary` | Primary readable text | `#FFFFFF` | `#0D0D0D` | ~17:1 | ~20:1 | ✓ | Any text, any size, any bg. Default for headings, prices, tickers. |
| `--color-text-muted` | Secondary readable text | `#888888` | `#6B7280` | ~4.5:1 | ~4.8:1 | ✓ (borderline) | Labels, metadata, secondary copy, hero-bar metrics. ⚠ On **light inset** (`#E1EAF4`) drops to ~4.0:1 — use `primary` there. |
| `--color-text-dim` | Non-essential / UI only | `#6E6E6E` | `#7A8290` | ~3.2:1 | ~3.9:1 | △ large-only | Disabled states, placeholder glyphs (`—`,`▬`), large (≥18px) decorative labels, toggle-off. **Never small body text.** |
| `--color-text-ghost` | Decoration only | `#444444` | `#C4C3C1` | ~2.1:1 | ~1.8:1 | ✕ | Watermark glyphs, faint separators. Carries **no information**. Never readable text. |
| `--color-brand-text` | Brand accent — readable | `#00FF88` | `#047857` | ~12.6:1 | ~5.6:1 | ✓ | Green accent text on dark/light cards. Score badges, positive values, brand labels. |
| `--color-negative-text` | Error / loss — readable | `#FF4B4B` | `#C81E1E` | ~6.5:1 | ~5.8:1 | ✓ | Negative change, loss values, SELL badge text, error states. |
| `--color-warning-text` | Caution — readable | `#FFB800` | `#B45309` | ~9.8:1 | ~5.1:1 | ✓ | Score tier 75–84, HOLD badge, caution banners, stale-data labels. |
| `--color-neutral-text` | Neutral / inactive | `#888888` | `#9CA3AF` | ~4.5:1 | ~2.8:1 | △ large-only | Score < 75, inactive tab labels. ⚠ Light `#9CA3AF` **fails AA** — pair with `primary` for body text. |

**Surface & border tokens** (backgrounds/borders — never carry text; listed for pairing): `--color-bg-page` `#0C0C0C`/`#F2F6FA` · `--color-bg-card` `#131313`/`#FFFFFF` · `--color-bg-inset` `#161616`/`#E1EAF4` (⚠ `text-muted` ≈4:1 here — use `primary`) · `--color-brand-bg` `#00FF8820`/`#D1FAE5` (pair with `brand-text`) · `--color-negative-bg` `#FF4B4B20`/`#FEE2E2` (pair with `negative-text`) · `--color-warning-bg` `#FFB80020`/`#FEF3C7` (pair with `warning-text`) · `--color-neutral-bg` `#2A2A2A`/`#F3F4F6` · `--color-border` `#2A2A2A`/`#E5E7EB` · `--color-border-subtle` `#1E1E1E`/`#ECF0F5`.

**Categorical (non-semantic) tokens** — for distinguishing data **categories**, never status. Status (good/bad/caution) always uses `brand`/`negative`/`warning`. Use these only when a set has more distinct members than the 4 semantic colors can carry (e.g. Peter-Lynch stock types, bandar mode). Green/amber/gray/red categories reuse `brand`/`warning`/`neutral`/`negative`; these three cover the rest. Each `-text` value clears ≥4.5:1 on the card surface in both themes; pair `-text` with its `-bg` tint (and use `-text` as the chip border).

| Token | Dark text | Light text | Tint (`-bg`) dark / light |
|-------|-----------|------------|---------------------------|
| `--color-cat-blue` | `#60A5FA` | `#2563EB` | `#60A5FA1A` / `#DBEAFE` |
| `--color-cat-purple` | `#C084FC` | `#7C3AED` | `#C084FC1A` / `#EDE9FE` |
| `--color-cat-teal` | `#2DD4BF` | `#0F766E` | `#2DD4BF1A` / `#CCFBF1` |

Applied reference: the Lynch-category and Moat badges in `AIInsightsWidget` and the bandar-mode badge in `MarketPhaseWidget` (`fast_grower`/`wide`→`brand`, `cyclical`/`narrow`→`warning`, `none`→`negative`, `slow_grower`→`neutral`, `stalwart`→`cat-blue`, `turnaround`/bandar→`cat-purple`, `asset_play`→`cat-teal`).

### Typography Hierarchy — Mobile & Desktop

Classify every text node by **role**, then apply its row. Mobile sizes are the floor for a 390px screen; desktop sizes are the 1440px target.

| Role | Element examples | Font | Mobile | Desktop | Weight | Case | Color token | Notes |
|------|------------------|------|--------|---------|--------|------|-------------|-------|
| Display / Ticker | Ticker (`BBCA`), Price (`Rp 9,850`) | Space Grotesk | 28–32px | 32px | 700 | as-is | `primary` / `brand` | Letter-spacing −1px. `brand` for positive price, `negative` for loss. |
| Display / Score | Score circle value, composite score | Space Grotesk | 24px | 24px | 700 | as-is | `brand` / `warning` / `negative` | Color by tier: ≥7→brand, 4–6.9→warning, <4→negative. |
| Display / Large Number | Market cap, volume large values | Space Grotesk | 16–20px | 18–22px | 600 | as-is | `primary` | Use `formatIDRCompact()`. Never `toLocaleString()`. |
| Body — Reading Copy | AI narrative, scenario text, drivers, news | Inter (`font-body`) | **13px** | 14px | 400–500 | Sentence | `primary` / `muted` | **MIN 13px** for paragraphs, **12px** floor for inline list items. Never below 12px. |
| Body — Secondary Copy | Widget descriptions, sub-narrative | Inter (`font-body`) | **12px** | 13px | 400 | Sentence | `muted` | Readable copy — ≥12px on mobile, CR ≥4.5:1. |
| Label — Section Header | `SUMMARY`, `FUNDAMENTALS`, widget titles | JetBrains Mono | 9–10px | 10–11px | 700 | ALL_CAPS | `muted` / `brand` (active) | Letter-spacing 1–1.5px. `brand` for active/highlighted section. |
| Label — Sub-label | `TARGET`, `ENTRY ZONE`, `STOP LOSS` | JetBrains Mono | **9px** | 9px | 700 | ALL_CAPS | `muted` | 9px floor. High-contrast token only — **never `dim` at this size.** |
| Label — Data Tag / Badge | `BUY`, `HOLD`, `SELL`, `LIVE`, `STALE` | JetBrains Mono | 9–10px | 10px | 700 | ALL_CAPS | **dark `#0A0A0A` on tinted bg** | Dark text on brand/warning/negative tint — all three badge types. White on bright fill fails (~3:1). |
| Metadata / Hero Bar | `MKT CAP \| VOL \| P/E \| ROE \| 52W \| BETA` | JetBrains Mono | 10–11px | 11px | 500 | as-is | `muted` | Horizontally scrollable on mobile, never wraps. Separator `\|` in `ghost`. |
| Table Cell — Value | P/E ratio, revenue, share count | JetBrains Mono | 11px | 11–12px | 500 | as-is | `primary` / `brand` / `negative` | Data values may go to 11px. Color by sign. |
| Table Cell — Label | Column headers, row labels | JetBrains Mono | 9px | 10px | 700 | ALL_CAPS | `muted` | Letter-spacing 0.5–1px. |
| Chart Axis / Tooltip | Price axis, date labels, tooltip values | JetBrains Mono | 10px | 11px | 500 | as-is | `muted` | `lightweight-charts` handles price axis; Recharts custom Tooltip uses JetBrains Mono. |
| Freshness Badge | `LIVE`, `STALE`, `OUTDATED`, `CACHED` | JetBrains Mono | 9px | 9px | 700 | ALL_CAPS | `brand` / `warning` / `negative` / `dim` | Dot + label pattern. Do not go below 9px. |
| Tab Navigation | `SUMMARY`, `FUNDAMENTALS`, `SENTIMENT`… | JetBrains Mono | 9–10px | 10px | 700 | ALL_CAPS | `muted` (inactive) / `brand` (active) | Horizontally scrollable on mobile, no wrap. Active: brand underline + bg tint. |
| Error / Empty State | No-data messages, empty states | Inter (`font-body`) | **13px** | 14px | 500 | Sentence | `muted` | Full-sentence copy → 13px minimum. Pair with an action button if actionable. |

### Pre-Ship Hard Rules (the ship gate)

Check every one before shipping a component. The `design-system-review` skill audits exactly this list.

1. **4.5:1 minimum for all body text.** `text-muted` on a dark card is ~4.5:1 (borderline); on light inset use `text-primary`.
2. **No `text-dim` on body copy.** It's ~3:1 — UI / large-text only. Any sentence-level copy must be `text-muted` or `text-primary`.
3. **No `text-ghost` on readable content.** Decoration only (<2:1) — watermarks and separators exclusively.
4. **Reading copy ≥13px** (paragraphs); inline list items ≥12px. Never `font-body` at 10–11px for sentences.
5. **Labels floor at 9px.** Mono ALL_CAPS labels may be 9px, never 8px, always paired with a high-contrast token.
6. **Small text + dim/ghost token = bug.** 9px with `dim`/`ghost` fails AA — promote to `muted`.
7. **Dark text (`#0A0A0A`) on badge fills.** BUY/HOLD/SELL on brand/warning/negative tint; white fails (~3:1).
8. **`fmtNumID()` / `formatIDRCompact()` for all IDR numbers.** Never `toLocaleString('id-ID')` / `Intl.NumberFormat('id-ID')` — SSR hydration mismatch.
9. **Mounted guard for charts.** Recharts, `lightweight-charts`, `react-force-graph-2d` behind a `mounted` guard; show `ChartSkeleton` during SSR.
10. **Mounted guard for date inputs.** `<input type="date">` renders only after `mounted === true`.
11. **200% zoom test (SC 1.4.4).** Hero bar and tab row must scroll, not clip, at 200% browser zoom.
12. **No `ssr: false` with `next/dynamic`.** Forbidden in Server Components — use the `mounted` pattern instead.

---

## Tab Navigation Sections

The stock detail page has 7 tabs. Each is a separate content panel:

1. **SUMMARY** — hero + verdict row + score card + AI insights + price chart (default tab)
2. **FUNDAMENTALS** — income statement, balance sheet, ratios (Recharts bar/line charts)
3. **PRODUCTS** — business segment breakdown (future / currently static)
4. **SHAREHOLDERS** — major shareholders, ownership delta, investor network
5. **SENTIMENT** — money flow, broker summary, foreign net flow
6. **STORIES** — corporate events, dividend history, news links
7. **PEERS** — sector peer comparison table

Only mount a tab panel's content when the tab is first activated (lazy mount). Use a `Set` to track which tabs have been activated — never unmount a tab once mounted (preserves scroll position and avoids refetch).

---

## SSR / Hydration — Absolute Rules

These supplement the root `CLAUDE.md` and are enforced for every component:

1. Use `fmtNumID()` for all IDR number formatting — never `toLocaleString`
2. Wrap all Recharts components in a `mounted` guard — show `<ChartSkeleton>` during SSR
3. Wrap `<input type="date">` in a `mounted` guard
4. Use `suppressHydrationWarning` **only** as a last resort on leaf text nodes, never on container elements
5. Do not use `dynamic(..., { ssr: false })` — it is forbidden in Server Components and causes layout shift

---

## Interaction Patterns for Mobile

| Interaction | Pattern |
|---|---|
| Switch stock detail tab | Horizontal tap on tab bar (no swipe — swipe conflicts with chart pan) |
| View AI analysis detail | Bottom sheet slide-up (not a modal) |
| Add to watchlist | Icon button in hero (heart/star), immediate optimistic update |
| Trigger AI re-analysis | Button in AI card, shows inline spinner with status polling |
| View broker detail | Expandable row accordion, not a new page |
| Price chart pan/zoom | Native touch via `lightweight-charts` — do not intercept touch events |

---

## What NOT to Do

- Do not add decorative gradients, shadows, or color fills outside the token set
- Do not change label casing — ALL_CAPS for JetBrains Mono labels is part of the brand
- Do not introduce a new font — only `Space Grotesk` and `JetBrains Mono` are approved
- Do not add a sidebar layout — this is a mobile-first app with bottom navigation only
- Do not use `px-4` as a default page padding on desktop — use `px-8` (32px) as shown in the design file hero frame (`padding: [16, 32]`)
- Do not cache API data in the service worker — only cache the app shell

---

## Design Migration Status

The existing codebase is built on an **older design system** (white navbar, blue-primary accents, rounded cards, `bg-blue-50/border-blue-200` tab states). The Terminal Dashboard design system described in this file is the **target state**. When touching any component, migrate it to the token set and typography rules above — do not layer the new system on top of old classes.

Key components confirmed still on the old design (as of June 2025):
- `components/nav/navbar.tsx` — white header, green `IDX Analyzer` badge (pre-Terminal style)
- `components/home/quick-access-bar.tsx` — `bg-blue-50 border-blue-200 text-blue-700` active tab state
- `components/home/screener-shell.tsx` — sidebar + table layout with old colors

When migrating, replace:
- `bg-blue-*` / `border-blue-*` / `text-blue-*` → `--color-brand` token
- `bg-white` headers → `--color-bg-card`
- `text-gray-500` muted text → `--color-text-muted` (`#8A8A8A`)
- `border-[#E5E4E1]` → `--color-border`

---

## Navigation Architecture (PWA Shell)

### Current (pre-PWA)
A sticky top navbar (`components/nav/navbar.tsx`) with:
- Logo: "IDX" + green "Analyzer" badge
- Center: `<SearchBar>` (max-width 384px)
- Right: desktop nav links (Screener, Money Flow, Compare, Investors)
- Mobile: hamburger → dropdown with the same links

### Target (PWA mobile-first)
Replace the hamburger dropdown with a **fixed bottom tab bar** on mobile (`sm:hidden`). The top navbar remains on desktop (`hidden sm:flex`).

**Bottom tab bar layout (mobile only):**
```
[ 🏠 Home ] [ 🔍 Screener ] [ ↔ Compare ] [ 〰 Money Flow ] [ 👥 Investors ]
```
- Fixed to bottom, `z-50`, height 56px + `env(safe-area-inset-bottom)`
- Active tab: `--color-brand` icon + label, `--color-bg-card` background
- Inactive tab: `--color-text-dim` icon + label
- Tab bar is part of the cached app shell — do not put dynamic data in it

**Back navigation on `/stock/[ticker]`:**
- Shows a `← BACK` button in the header on mobile in place of the tab bar (or as an overlay)
- On desktop, the tab bar is hidden entirely — rely on browser back or the top nav

---

## Per-Page Context

### Home — `/`

**Purpose:** Primary entry point. Shows the user's watchlist for quick price checks and a full-market screener for discovery.

**Component tree:**
```
page.tsx (Server Component)
├── MarketPulseHeader       — market-wide stats bar (IHSG, top movers, sentiment)
├── MarketVolatilityBanner  — optional banner if VIX/volatility threshold is triggered
├── QuickAccessBar          — tabbed panel: Watchlists | Strategies
├── ScreenerShell           — 2-column layout
│   ├── ScreenerFilters     — left sidebar (collapsible on mobile)
│   └── StockTable          — sortable, paginated stock rows
```

**Mobile layout:**
- `MarketPulseHeader` is a horizontally scrollable stats ticker — do not wrap
- `QuickAccessBar` is full-width, stacked above the table
- `ScreenerFilters` sidebar: hidden by default, slides in as a full-screen overlay on "FILTERS" button tap (not a bottom sheet — it has many fields)
- `StockTable`: single column, smaller font; hide lower-priority columns (keep ticker, price, change%, phase)
- `StrategyBar`: chip row above the table for quick filter presets; scrolls horizontally on mobile

**Empty states:**
- Empty watchlist: "No stocks in watchlist — tap ☆ on any stock to add" centered in the QuickAccessBar panel
- Zero screener results: "No stocks match these filters" with a "CLEAR ALL FILTERS" button inline in the table body

**Navigation from this page:** Tapping any stock row navigates to `/stock/[ticker]`.

---

### Stock Detail — `/stock/[ticker]`

**Purpose:** Deep-dive on a single stock. The primary analysis surface.

**Component tree (StockPageClient):**
```
StockPageClient.tsx ('use client')
├── StockHero (stock-header.tsx)     — ticker, price, change, market cap bar
├── NavTabs (widgets/NavTabs.tsx)    — 7-tab navigation
└── Tab panels (lazy-mounted):
    ├── SUMMARY
    │   ├── VerdictWidget           — BUY/HOLD/SELL verdict + target/entry/SL
    │   ├── AIInsightsWidget        — AI analysis card + confidence bar
    │   ├── MarketPhaseWidget       — current market phase
    │   ├── TechnicalWidget         — RSI, MACD, Wyckoff signals
    │   └── PriceWidget             — lightweight-charts OHLCV chart
    ├── FUNDAMENTALS
    │   ├── FinancialHighlightsWidget
    │   ├── FinancialChartsWidget   — Recharts revenue/profit bar charts
    │   ├── FinancialStatementsWidget
    │   └── ValuationWidget
    ├── PRODUCTS
    │   └── ProductsWidget
    ├── SHAREHOLDERS
    │   └── ShareholdersWidget
    ├── SENTIMENT
    │   ├── SentimentWidget
    │   └── BrokerActivityWidget
    ├── STORIES
    │   └── StoriesWidget
    └── PEERS
        └── PeersWidget
```

**Mobile layout:**
- `StockHero`: ticker + price in hero section (above fold). Metrics bar (`MKT CAP | VOL | P/E | ROE | 52W | BETA`) scrolls horizontally — never wraps
- `NavTabs`: scrollable horizontal row, no wrap; active tab has `--color-brand` bottom border + background tint
- `VerdictWidget`: on mobile, BUY badge + verdict title stack above the Target/Entry/SL row; Target/Entry/SL themselves stack vertically (3 rows), go horizontal at `md:`
- `PriceWidget`: min-height 200px, handles touch pan/zoom natively — never intercept touch events on the chart

**AI analysis flow:**
1. Page loads — check if `ai_analysis` exists for ticker
2. If cached and fresh: render `AIInsightsWidget` directly
3. If stale or missing: show "ANALYSIS PENDING" state with a "REFRESH ANALYSIS" button
4. On trigger: poll `/api/stocks/[ticker]/ai-analysis` every 3s with exponential backoff; show spinner inline in the card
5. On completion: update the card in-place — do NOT full-page reload

**Empty states per widget:**
- No price data: "PRICE DATA UNAVAILABLE" in chart area with last-known date
- No AI analysis: `AIInsightsWidget` renders a placeholder with "DAISY HAS NOT ANALYSED THIS STOCK YET" + trigger button
- No broker data: `BrokerActivityWidget` shows "BROKER DATA NOT AVAILABLE FOR THIS PERIOD"
- No shareholders: `ShareholdersWidget` shows "SHAREHOLDER DATA NOT YET LOADED"

---

### Compare — `/compare`

**Purpose:** Side-by-side comparison of 2–4 IDX stocks across fundamentals, valuation, and signals.

**Component tree:**
```
page.tsx
├── TickerSelector         — add/remove tickers (max 4)
└── ComparisonMetricsGrid  — grid of metric cards, one column per ticker
    └── ComparisonCharts   — overlaid price chart + bar chart comparisons
```

**Mobile layout:**
- `TickerSelector`: horizontal chip row (add/remove stocks). "ADD STOCK" chip opens a search bottom sheet
- `ComparisonMetricsGrid`: on mobile, one stock at a time with a swipeable carousel — not side-by-side. At `md:` and above, show 2-column grid. At `lg:`, show all columns
- Metric labels stay fixed-left (sticky column) on the table view at desktop; on mobile they appear as section headers above each card row

**Empty state:**
- No tickers selected: "SELECT UP TO 4 STOCKS TO COMPARE" centered with the `TickerSelector` below

---

### Investors — `/investors`

**Purpose:** Visualize institutional and major shareholder networks across IDX stocks using a force-directed graph.

**Component tree:**
```
page.tsx
├── InvestorPanel          — sidebar: investor list, filter controls
└── NetworkGraph           — react-force-graph-2d (browser-only)
```

**Mobile layout:**
- `NetworkGraph` takes full screen on mobile; `InvestorPanel` slides in from the bottom as a drawer when a node is tapped
- Graph controls (zoom in/out, reset) appear as floating action buttons (bottom-right, above bottom tab bar)
- Node tap → shows investor/stock summary in the bottom drawer
- The graph must be wrapped in a `mounted` guard (`react-force-graph-2d` is browser-only and uses canvas)

**Performance constraint:**
- Limit rendered nodes to 200 by default with a "SHOW ALL" option — the force simulation is expensive on mobile CPUs
- Do not re-run the simulation on every render; stabilize the graph after initial layout

**Empty state:**
- No investor data: "INVESTOR NETWORK DATA IS BEING COMPILED" centered in the graph canvas

---

### Money Flow — `/money-flow`

**Purpose:** Track foreign and domestic institutional money flow across the IDX market and by individual stock.

**Component tree:**
```
page.tsx
├── FilterBar              — date range picker, stock/sector filter, board filter
├── MostActiveTable        — top stocks by net foreign flow (buy - sell)
└── TopBrokersSection      — most active brokers by volume/value
    └── BuySellSection     — net buy vs net sell breakdown
```

**Mobile layout:**
- `FilterBar`: inline on desktop; on mobile, collapses to a single "FILTER" chip that opens a bottom sheet with date range and stock filters
- `MostActiveTable`: full-width scrollable table; show ticker, net flow (Miliar), and direction badge. Hide lower-priority columns at mobile
- `TopBrokersSection`: broker chips in a horizontal scroll row; tapping a broker expands its buy/sell breakdown accordion below
- Date range picker: `<input type="date">` must be behind a `mounted` guard

**Data notes (from memory):**
- "M" in flow amounts means **Miliar (billion IDR)**, not million — enforce this in all chart axis labels and tooltips
- Foreign net flow numbers differ from IDX official page due to gross-vs-net methodology differences — this is expected, not a bug
- Broker flow data lags by 1 trading day — show "AS OF [DATE]" in the section header

**Empty state:**
- No data for selected date: "NO FLOW DATA AVAILABLE FOR [DATE]. IDX data may lag by 1 trading day."

---

## Shared UI Patterns

### Bottom Sheet
Used for: AI analysis detail, investor detail, mobile filters, search results
- Slide up from bottom with 300ms ease-out
- Handle bar at top (`w-12 h-1 bg-[--color-border] rounded-full mx-auto mb-4`)
- Max height 85dvh with internal scroll
- Backdrop: `bg-black/60` with tap-to-dismiss
- Never use `position: fixed` on the inner content — use `overscroll-behavior: contain`

### Skeleton Loaders
Every data-driven widget must have a skeleton that matches its rendered height. Skeleton blocks use `--color-bg-inset` with a subtle shimmer animation. Never show an empty div — always show a skeleton during load.

### Status Badges
Beyond `SignalBadge` (BUY/HOLD/SELL), use these for data freshness:
- `LIVE` — data ≤ 1 day old: `--color-brand` dot + label
- `STALE` — data 2–7 days old: `--color-warning` dot + label  
- `OUTDATED` — data > 7 days old: `--color-negative` dot + label
- `CACHED` — shown in offline mode: `--color-text-dim` dot + label
