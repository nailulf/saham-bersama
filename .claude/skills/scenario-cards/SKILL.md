---
name: scenario-cards
description: Use the ScenarioCards design-system component (or its expand/collapse pattern) when rendering 2–3 mutually-exclusive "cases" — e.g. bull/neutral/bear scenarios, plan tiers, A/B/C options — as cards with a single-active expand model. TRIGGER when building or restyling any grouped-card section where one card expands to full detail while the others stay compact, with desktop reflow + mobile accordion. The canonical instance is the Skenario & Risiko block in AIInsightsWidget.
---

# ScenarioCards — single-active expand/collapse cards

A Terminal Dashboard component for rendering a small set of mutually-exclusive
"cases" as cards where **exactly one can be expanded at a time**.

- **Component:** [web/src/components/ui/ScenarioCards.tsx](../../../web/src/components/ui/ScenarioCards.tsx)
- **Canonical usage:** the "Skenario & Risiko" block in
  [web/src/components/stock/widgets/AIInsightsWidget.tsx](../../../web/src/components/stock/widgets/AIInsightsWidget.tsx)

## Behavior contract

| Breakpoint | Collapsed (all) | One expanded |
|------------|-----------------|--------------|
| **Desktop (`md+`)** | 3 equal cards in a row (`grid-cols-3`) | Two non-active cards stay compact in a row **on top**; active card reflows to **full width below** |
| **Mobile (`<md`)** | Cards stacked vertically | Accordion — the tapped card expands **in place**; others stay compact, order preserved |

Rules that must hold:
- **Single-active**: expanding one collapses any other. State is `expanded: tier | null`.
- **Default collapsed**: omit `defaultExpanded` (or pass `null`) so all start compact.
- **Tap or corner toggle expands**: the whole compact card is the button, with a
  `Maximize2` icon in the top-right corner. The expanded card has a `Minimize2`
  collapse button in its header corner.
- **Order is canonical** (`bull → neutral → bear`) regardless of input array order.
- `activeTier` (the analyst verdict) only adds an `AKTIF` badge — it does **not**
  auto-expand.

## Using it

```tsx
import { ScenarioCards, type ScenarioCaseData, type ScenarioTier } from '@/components/ui/ScenarioCards'

const cases: ScenarioCaseData[] = [
  { tier: 'bull',    scenario, drivers, signals, signalLabel: 'TANDA AWAL',       target,            probability },
  { tier: 'neutral', scenario, drivers, signals, signalLabel: 'PEMICU PERUBAHAN', targetLow, targetHigh, probability },
  { tier: 'bear',    scenario, drivers, signals, signalLabel: 'TANDA AWAL',       target,            probability },
]

<ScenarioCards cases={cases} currentPrice={currentPrice} activeTier={verdictKey} />
```

- Build `cases` by mapping nullable source data and `.filter(Boolean)` — the
  component handles 1, 2, or 3 cards (`grid-cols` adapts).
- `bull`/`bear` use a point `target`; `neutral` uses `targetLow`/`targetHigh`
  (the component shows `targetHigh` as the headline).
- `probability` accepts a number (0–100) or the legacy `'high'|'medium'|'low'`
  strings — normalized internally.

## Adapting the pattern to a new domain

If you need the same expand model for non-scenario cards (plan tiers, options),
prefer **reusing `ScenarioCards`** by mapping your data into `ScenarioCaseData`.
Only fork the component if the per-card body differs structurally. When forking,
keep:
1. The two-tree responsive render (`md:hidden` accordion + `hidden md:flex`
   reflow) — do **not** try to do both with CSS `order` alone.
2. `expanded` state lifted to the container, single-active.
3. Per-tier theme tokens (see `CASE_THEME`) — never raw hex.

## Design-system + SSR guardrails (enforced)

- All colors map to tokens (`--color-brand`, `--color-warning-text`,
  `--color-negative`, `--color-bg-inset`, …). No raw hex except the `#0A0A0A`
  badge text on bright fills.
- Numbers go through `fmtNumID()` — never `toLocaleString` / `Intl`.
- No `new Date()` / `Math.random()` in render. The component is render-pure;
  `useState` for `expanded` is fine and SSR-safe (same initial value server+client).
- Reading copy (scenario paragraph 13px, drivers/signals 12px) and mono labels
  (9px floor) follow the font-size policy in `.claude/CLAUDE.md`.

## Verify after changes

```bash
cd web && npx tsc --noEmit
```

Then check on the stock page (`/stock/[ticker]`, SUMMARY tab): at ≥768px the
expanded card sits full-width below two compact ones; below 768px it's a stacked
accordion. Confirm only one card expands at a time and 200% zoom doesn't clip.
