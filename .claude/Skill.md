# Skill Requirements — FSA Mobile-First PWA

This document defines the competency requirements for the **frontend developer** and **product team** working on the IDX Stock Analyzer (FSA) — a mobile-first Progressive Web App built on the Terminal Dashboard design system.

---

## Frontend Developer Skills

### 1. Mobile-First Layout Engineering

**Required:**
- Build layouts from the smallest breakpoint up (375px → 390px → 768px → 1440px)
- Use CSS Grid and Flexbox for responsive panel grids (verdict row, score cards, chart panels)
- Manage safe-area insets for iOS notch and Android system bars via `env(safe-area-inset-*)`
- Implement bottom navigation bars with thumb-zone awareness (44px minimum touch targets)
- Handle viewport height correctly (`dvh` / `svh` instead of `100vh` on mobile)

**Why this matters:** The design file shows a 1440px desktop layout. All components must collapse gracefully to a single-column 390px mobile view. Stock dashboards are primarily consulted on phone — the desktop layout is secondary.

---

### 2. Progressive Web App (PWA) Implementation

**Required:**
- Author `manifest.json`: `name`, `short_name`, `display: standalone`, `theme_color`, `background_color`, icons (192px, 512px, maskable)
- Register a Service Worker via Next.js (use `next-pwa` or a custom `sw.js` with Workbox)
- Implement caching strategies per resource type:
  - **Network-first** for API routes (`/api/stocks/*`) — data freshness is critical
  - **Stale-while-revalidate** for static assets, fonts, icons
  - **Cache-only** for app shell (layout, nav, skeleton components)
- Handle offline state gracefully — show stale data with a "last updated" timestamp rather than an error screen
- Test Add to Home Screen flow on both iOS Safari and Android Chrome
- Handle push notification permission flow (for price alerts, future feature)

**Key constraints:**
- `theme_color` must match the design token: `#0C0C0C` for dark mode, `#F8F8FA` for light
- App icon must use the STOCKID brand; background must match `theme_color`

---

### 3. Design System Implementation

**Required:**
- Implement the Terminal Dashboard token set as CSS custom properties (see Design Tokens section)
- Apply `Space Grotesk` for display/numeric content and `JetBrains Mono` for labels/metadata — load both via `next/font` to avoid hydration issues
- Build reusable primitives: `Badge`, `MetricRow`, `ScoreCircle`, `ProgressBar`, `VerticallySplitCard`, `TabBar`
- Enforce component contracts: every primitive must accept `className` for overrides but should never need internal style overrides for normal use
- Support dark/light theme switching via CSS `prefers-color-scheme` and a manual toggle stored in `localStorage`

**Token reference (source of truth is `globals.css` — this table must stay in sync):**

```
/* Surfaces */
--color-bg-page        dark: #0C0C0C   | light: #F2F6FA  (cool blue-gray)
--color-bg-card        dark: #131313   | light: #FFFFFF
--color-bg-inset       dark: #161616   | light: #E1EAF4  (cool blue pill/control bg)

/* Borders */
--color-border         dark: #2A2A2A   | light: #E5E7EB
--color-border-subtle  dark: #1E1E1E   | light: #ECF0F5  (cool blue row dividers)

/* Text */
--color-text-primary   dark: #FFFFFF   | light: #0D0D0D
--color-text-muted     dark: #888888   | light: #6B7280
--color-text-dim       dark: #555555   | light: #9CA3AF
--color-text-ghost     dark: #444444   | light: #C4C3C1

/* Brand */
--color-brand          dark: #00FF88   | light: #10B981
--color-brand-bg       dark: #00FF8820 | light: #D1FAE5
--color-brand-text     dark: #00FF88   | light: #059669

/* Negative */
--color-negative       dark: #FF4B4B   | light: #EF4444
--color-negative-bg    dark: #FF4B4B20 | light: #FEE2E2
--color-negative-text  dark: #FF4B4B   | light: #DC2626

/* Score tiers */
--color-warning-bg     dark: #FFB80020 | light: #FEF3C7
--color-warning-text   dark: #FFB800   | light: #D97706
--color-neutral-bg     dark: #2A2A2A   | light: #F3F4F6
--color-neutral-text   dark: #888888   | light: #9CA3AF

/* Fonts */
--font-body     Inter          (body text, light-theme labels)
--font-display  Space Grotesk  (prices, scores, tickers)
--font-mono     JetBrains Mono (dark-theme labels, ALL_CAPS tags)
--color-text-primary: #FFFFFF  (dark) / #111111  (light)
--color-text-muted:   #8A8A8A
--color-text-dim:     #6A6A6A

--font-display: 'Space Grotesk', sans-serif
--font-mono:    'JetBrains Mono', monospace
```

---

### 4. Data Visualization on Mobile

**Required:**
- Use `lightweight-charts` for price/volume OHLCV — it handles touch pan/zoom natively
- Use `recharts` for fundamentals (revenue, profit bar charts) — must implement `mounted` guard per project SSR conventions
- Ensure all charts render at the correct height inside a single-column mobile layout (min-height 200px, max-height 300px for inline charts)
- Disable animations on `prefers-reduced-motion`
- Implement chart skeleton components (`ChartSkeleton`) that match the chart's height during SSR

---

### 5. Performance Engineering

**Required:**
- Achieve Lighthouse PWA score ≥ 90 and Performance ≥ 80 on mobile
- Lazy-load tab panel content — only mount `FUNDAMENTALS`, `SHAREHOLDERS`, etc. panels when the tab is first activated
- Use `React.memo` / `useMemo` for sub-scores, metric rows, broker tables — these re-render frequently due to polling
- Defer non-critical third-party scripts (analytics) until after TTI
- Preload fonts using `<link rel="preload">` in `layout.tsx`

---

### 6. SSR Safety & Hydration (Project-Critical)

See the root `CLAUDE.md` for the full ruleset. Key enforcement points:

- **Never** use `toLocaleString('id-ID')` — always use `fmtNumID()` from `lib/calculations/formatters`
- **Never** use `new Date()` / `Date.now()` in render output — guard with `mounted`
- **Always** guard Recharts, Mermaid, and browser-only inputs behind `mounted` state
- **Never** use `dynamic(() => ..., { ssr: false })` in Server Components

---

### 7. Accessibility (a11y) Baseline

**Required:**
- All interactive elements must be keyboard-navigable (Tab order, `role`, `aria-label`)
- Color is never the sole means of conveying meaning (e.g., positive/negative values must show `+`/`-` prefix in addition to green/red color)
- Touch targets minimum 44×44px
- Chart tooltips must have text alternatives
- Tab components use `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`

---

### 8. State Management & API Integration

**Required:**
- Use SWR or React Query for client-side data fetching with cache/revalidation
- Polling for AI analysis status (`/api/stocks/[ticker]/ai-analysis`) — implement with exponential backoff, not fixed intervals
- Optimistic UI for watchlist add/remove
- Handle Supabase SSR client correctly — server components use `lib/supabase/server.ts`, client components use `lib/supabase/client.ts`

---

## Product Team Skills

### 1. Mobile UX Pattern Knowledge

**Required:**
- Understand thumb-zone ergonomics: primary actions in bottom 40% of screen, secondary in top
- Know when to use bottom sheets vs. full-screen modals vs. inline expansion for financial data (e.g., AI analysis detail should be a bottom sheet on mobile)
- Design for one-handed use: primary CTAs (BUY badge, watchlist) reachable with thumb
- Understand swipe gesture conventions: horizontal swipe for tab navigation is acceptable; vertical swipe is always scroll

---

### 2. Financial Data Hierarchy

**Required:**
- Know the information hierarchy for IDX stock analysis: price/signal → score → AI verdict → fundamentals → shareholders → peers
- Understand that `STOP LOSS`, `ENTRY ZONE`, and `TARGET` are the three primary action signals — they must be above the fold on the stock detail page even on a 375px screen
- The Wyckoff phase and AI confidence score are secondary but must remain scannable in under 3 seconds
- Score sub-dimensions (GROWTH, FINANCIAL, VALUE) need progressive disclosure — show the composite score first, drill into sub-scores on tap

---

### 3. Design Token Governance

**Required:**
- Maintain the canonical token set in a single source of truth (CSS custom properties in `globals.css`)
- Do not introduce new colors outside the token set without documenting them — the terminal aesthetic depends on strict palette discipline
- Semantic naming is mandatory: use `--color-negative` not `--color-red` so that the light-theme variant can override correctly

---

### 4. Content Strategy for Financial UI

**Required:**
- All labels use ALL_CAPS with `JetBrains Mono` — this is intentional terminal aesthetic, not an accident
- Abbreviate correctly for IDR: Jt (Juta/million), M (Miliar/billion = 1,000 Jt), T (Triliun/trillion)
- "STOCKID SCORE" is the product name for the composite score — do not rename it in UI copy
- Confidence percentages from AI analysis must always show source timestamp ("as of [date]") to avoid stale signal confusion

---

### 5. PWA Product Behavior

**Required:**
- Define which pages are available offline (app shell + last-viewed stock data cached)
- Define the "install prompt" strategy — show after 3rd visit or after user adds first stock to watchlist
- Specify the update strategy: when a new SW version is available, show a non-blocking "Update available" banner; do not auto-reload
- Price alert push notifications are a future feature — the permission prompt should not be shown until the feature ships

---

### 6. Acceptance Criteria Hygiene

**Required:**
- Every screen must have both dark and light theme acceptance criteria
- Every feature must have a mobile (375px) and desktop (1440px) acceptance criteria
- Data-empty states must be designed: "No AI analysis yet" state, "No broker data" state, etc.
- Loading states must match the skeleton heights defined in the design system

---

## Shared Competency: Design ↔ Dev Handoff

Both roles must be able to read the Pencil design file (`docs/FSA - stock detail page`) and map frame names to component names:

| Design Frame Name | Component / File |
|---|---|
| `verdictRow` | `<VerdictRow>` in `components/stock/VerdictRow.tsx` |
| `scoreCard` | `<ScoreCard>` in `components/stock/ScoreCard.tsx` |
| `aiCard` | `<AIInsightsWidget>` in `components/stock/AIInsightsWidget.tsx` |
| `Navigation Tabs` | `<StockTabs>` in `components/stock/StockTabs.tsx` |
| `hero` | `<StockHero>` in `components/stock/StockHero.tsx` |
| `buyBadge` | `<SignalBadge variant="buy">` |
| `scoreCircle` | `<ScoreCircle>` |
| `confSection` + progress bar | `<ConfidenceBar>` |

All new components must follow this naming mapping so design changes can be traced to implementation without ambiguity.
