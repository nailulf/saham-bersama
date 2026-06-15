# Screener Consolidation — Design Spec

**Date:** 2026-06-15
**Branch:** `feat/screener-consolidation`
**Status:** Approved (design), pending implementation plan

## Problem

The app accreted **three** screener surfaces:

1. **Home screener** — `web/src/components/home/screener-filters.tsx` + `screener-shell.tsx`. The fullest filter set, but **dead code**: `app/page.tsx` no longer mounts it (stale import) since the home page became a market-overview dashboard.
2. **`/screener`** — `components/screener/ScreenerListShell.tsx`. The results list (strategy tabs, active-filter chips, sort, pagination). Has **no filter form of its own** — it delegates building to surface #3 via a filter icon link.
3. **`/screener/strategy`** — `components/screener/StrategyBuilderShell.tsx`. The filter builder (live match-count, save/edit strategies). But it **renders inputs for only ~12 of the ~35 declared filter keys**.

The user-visible bug: filters that exist in the data model and query layer (Market Phase, Phase Duration, MACD cross-within-days, Avg Volume, Volume-change max, Price CAGR) are never drawn as inputs, so they are unreachable.

## Goal

Collapse to **one** screener at `/screener`: an inline filter panel + results + full strategy CRUD on a single page. Expose every **non-Wyckoff** filter the backend already supports. Delete the dead home screener and the separate builder route.

**Key constraint discovered:** this is almost entirely a **front-end** change. `applyScreenerFilters` / `getScreenerRows` (`lib/queries/stocks.ts`) already honor all ~35 keys, and `app/screener/page.tsx` already parses them all from the URL (`NUMERIC_PARAMS` + `STRING_PARAMS`). No query/schema work.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Architecture | **Merge into one `/screener` page** — inline filter panel + results table. Remove the separate `/screener/strategy` route. |
| 2 | Saved strategies | **Keep full strategy CRUD inline** — quick-apply tabs, name+description save/edit, live match-count, locked predefined strategies. |
| 3 | Filter scope | Add **all missing non-Wyckoff filters**. Keep **Wyckoff light** = v2 phase chips only (no event/FSM/confidence/recency pickers, no v1). |
| 4 | Filter → results sync | **Apply button + live count.** Local filter state; debounced `/api/strategies/count` preview; "Terapkan" commits to URL; server re-renders results (SSR preserved, like existing pagination/sort). |

## Architecture

`/screener` stays a **Server Component**. Results remain server-rendered from URL params (SSR-safe, keeps pagination/sort working). The filter UI is a **client sibling**.

```
ScreenerPage (server) ── reads searchParams → getScreenerRows → rows
├── ScreenerFilterDrawer (client)   ← NEW: owns the FilterPanel
│     • desktop md+: sticky left sidebar (~340px) beside results
│     • mobile <md: hidden; a "Filter" button opens it as a full-screen sheet
│     • local filter state seeded from searchParams
│     • debounced live count via existing /api/strategies/count → "47 saham"
│     • "Terapkan" → router.push(/screener?…filters) → server re-renders
│     • strategy NAME/DESC inputs + Save/Update (POST/PATCH /api/strategies)
└── Results (current ScreenerListShell content): StrategyTabs, results bar,
      StockCard list, pagination — fed server rows
```

The filter primitives (`Section`, `SectionHeader`, `RangeRow`, `MinRow`, `ChipButton`) currently live inside `StrategyBuilderShell.tsx`. **Extract them into a shared module** `components/screener/filters/` so the drawer reuses them and the 643-line builder file is not duplicated. This also fixes the "one file doing too much" smell.

## Filter panel — full section list

★ = newly exposed input (key already supported by backend, just not drawn today).

- **Kelas Saham** — Market Cap chips (min/max), Sector chips, ★ Board
- **Fundamental** — ROE, P/E, P/BV, Net Margin
- **Pertumbuhan** — Rev CAGR 3Y/5Y, OCF CAGR 3Y/5Y, ★ Price CAGR 3Y/5Y
- **Dividen** — Div Yield, Avg Yield 3Y/5Y
- **Teknikal** — ★ Market Phase (multiselect), ★ Phase Duration ≤ days, RSI range, MACD Sinyal, ★ MACD Cross within ≤ days, Volume Change ≥ % + ★ ≤ % (max), ★ Avg Volume ≥ (Jt), Fase Wyckoff (v2 phase chips — unchanged)

Filter keys NOT surfaced (deliberately, per decision #3): `wyckoffEvent`, `wyckoffPhase`, `maxWyckoffDays`, `minWyckoffConf`, `wyckoffEventV2`, `wyckoffFsmPhaseV2`, `maxWyckoffDaysV2`, `minWyckoffConfV2`. They remain valid URL params / query keys; the UI just doesn't draw them.

## Strategy CRUD (kept inline)

- **Quick-apply:** existing `StrategyTabs` row stays atop results; tapping one loads its filters via URL (as today).
- **Save/Edit:** NAME + DESCRIPTION inputs in the panel footer; Save = POST `/api/strategies`, editing existing = PATCH `/api/strategies/{id}`. Reuses the current `saveStrategy` logic almost verbatim — it just no longer lives on a separate route. On success: dispatch `strategy-change`, apply filters (`/screener?strategy=<id>&…`).
- **Predefined (`is_editable:false`):** show the existing lock banner; disable name/desc; filters still applyable.
- **Edit entry point:** `/strategies` edit links and the `/screener` filter affordance change from `/screener/strategy?id=<id>` to `/screener?strategy=<id>&edit=1`, which opens the panel pre-loaded (auto-open the sheet on mobile when `edit=1`).

## Deletions & redirects

- Delete `components/home/screener-filters.tsx` + `components/home/screener-shell.tsx` and the stale import in `app/page.tsx`.
- Delete `app/screener/strategy/` route + `StrategyBuilderShell.tsx` (its logic migrates into the drawer/panel). **Full removal — no redirect** (approved). All internal links are updated in the same change, and this is a personal-use tool with no external bookmarks to preserve.
- Update every link that targeted `/screener/strategy`: the filter icon in `ScreenerListShell`, and `/strategies` create/edit buttons.

## Design System Conformance (FIRST-CLASS REQUIREMENT)

The whole point of folding into the newer surfaces is to land on the **Terminal Dashboard** design system. Every new/modified node must satisfy `.claude/CLAUDE.md` rules. The `design-system-review` skill audits exactly this list — run it before declaring done.

**Tokens — no raw hex, no legacy tailwind palette.**
- Use CSS var tokens only: `--color-bg-page`, `--color-bg-card`, `--color-bg-inset`, `--color-border`, `--color-border-subtle`, `--color-text-{primary,muted,dim,ghost}`, `--color-brand`, `--color-brand-bg`, `--color-negative*`, `--color-warning*`. No `bg-blue-*`, `text-gray-*`, `border-[#…]`, or raw hex in component code (existing `#0C0C0C` badge-fg already used in ScreenerListShell is the one sanctioned dark-text-on-brand exception).
- Match the existing `screener/` components — they are already on-system; the panel must look identical in spirit.

**Typography — classify each node, then size it.**
- Section titles: `font-display` 14px 600, `--color-text-primary` (matches existing `SectionHeader`).
- Field labels: `font-mono` 11px 500 ALL-as-written, `--color-text-muted` (matches existing `RangeRow`/`MinRow`).
- Chips: `font-mono` 10px, `--color-text-muted` inactive / token-colored active (matches existing `ChipButton`).
- Strategy NAME/DESC labels: existing `.section-label` class (9px mono ALL_CAPS).
- Reading copy (lock banner, empty states): `font-body`/`font-mono` ≥12px. No 8px anywhere; labels floor at 9px.

**WCAG AA — size × token pairing.**
- Body/label text uses `muted` or `primary` only. **Never** `dim`/`ghost` on readable text. `dim` is reserved for the disabled/placeholder/large-decorative role it already plays (e.g. the `—` separator, chevrons).
- Badge fills (active-filter count, Apply state) use **dark text** on brand/warning/negative tint, never white.
- Active-input affordance keeps the existing pattern: `1px solid var(--color-brand)` border when a field has a value.

**SSR / hydration.**
- Results stay server-rendered; filter drawer is client-only state (no hydration coupling).
- All IDR/number display via `fmtNumID()` / `formatIDRCompact()` — never `toLocaleString('id-ID')`.
- No `<input type="date">` here; if any is added later it must be behind a `mounted` guard.
- No `dynamic(…, { ssr:false })`.

**Mobile-first.**
- Write the mobile sheet layout first, then `md:` sidebar. Filter panel = full-screen bottom-sheet on `<md` (design-system Bottom Sheet pattern: handle bar, max 85dvh, `overscroll-behavior: contain`, `bg-black/60` backdrop, tap-to-dismiss). Two-column at `md:+`.
- Results' three primary data points per `StockCard` stay legible at 390px; the metric/sort bar scrolls horizontally, never wraps.
- The "Filter" button carries the active-filter count badge (brand fill, dark text).
- Survives 200% zoom without clipping.

**Pre-ship gate:** run `design-system-review` on every changed `.tsx`; resolve all findings (token misuse, size×contrast pairing, SSR rules, mobile layout) before merge.

## Edge cases / risks

- **Param hygiene on Apply:** reset `page`; carry `sort`/`dir`/`strategy`. Clear (`Bersihkan`) resets local state and, on apply, the URL.
- **Count vs results agreement:** both route through `applyScreenerFilters`, so the live count and the rendered list match by construction.
- **Edit deep-link:** `?strategy=<id>&edit=1` must open the panel pre-loaded and (mobile) auto-open the sheet.
- **Predefined lock:** name/desc disabled, filters still applyable, banner shown.
- **Market cap chips ↔ min/max inputs:** keep the existing `getMktCapChip`/`setMktCapChip` round-trip so chips and raw inputs stay in sync.

## Testing / verification

Personal-use tool; verify by:
1. `design-system-review` skill on all changed components (gate).
2. Manual: each newly-exposed filter narrows results correctly (Apply → URL → server rows); live count matches rendered total.
3. Strategy save (new + edit), quick-apply tab, predefined-lock, clear-all.
4. Mobile (390px) sheet open/apply/dismiss; desktop sidebar; 200% zoom.
5. Dead routes removed; no stale links to `/screener/strategy`; home page unaffected.

## Out of scope

- Wyckoff event/FSM/confidence/recency pickers and v1 Wyckoff (decision #3).
- Any change to `applyScreenerFilters`, schema, or the count/screener API endpoints.
- Redesign of `StockCard` / results layout beyond reuse.
