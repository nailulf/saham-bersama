---
name: design-system-review
description: Audit changed frontend components against the FSA Terminal Dashboard design system and its WCAG AA color/typography hierarchy. Read-only — produces a findings report (violation + token/size fix + file:line), never edits. TRIGGER when the user asks to review/check/audit UI for design-system or accessibility alignment, before shipping or migrating a stock-detail/home/compare/investors/money-flow component, or after touching any .tsx/.css under web/src. Checks token usage (no raw hex / legacy tailwind palette), per-role typography sizes, WCAG AA contrast (size×token pairing), SSR/hydration rules, and mobile-first layout.
---

# design-system-review — FSA design-system & WCAG AA alignment audit

A **read-only** auditor. It reads changed frontend code, classifies every text node
and color usage by role, checks it against the design system, and emits a findings
report. **It never edits files.** To apply a fix, the user acts on the report or runs
`/simplify` afterward.

## Source of truth (read these first)

- **`.claude/Claude.md` → "Typography & Color Hierarchy — WCAG AA Reference"**
  ([../../Claude.md](../../Claude.md)) — the canonical Color Token table, the 15-role
  Typography Hierarchy table, and the 12 Pre-Ship Hard Rules. **This skill audits exactly
  that section.** Load it at the start of every run; if it has changed, the report follows
  the updated tables.
- **`.claude/Claude.md`** — design tokens, mobile-first rules, component conventions,
  SSR/hydration absolute rules, migration status.
- Root **[../../../CLAUDE.md](../../../CLAUDE.md)** — SSR hydration banned-patterns table,
  `fmtNumID()` requirement.
- Design frame **`Color & Font Hierarchy — WCAG AA Reference`** (Node ID `INaWf`) in
  [../../../docs/FSA - stock detail page](../../../docs/FSA%20-%20stock%20detail%20page) —
  the visual original the tables mirror.

## Scope

Default: **changed files only** — the working-tree + branch diff, filtered to frontend
files. Determine the set with:

```bash
cd web && git diff --name-only HEAD; git diff --name-only --staged; git ls-files --others --exclude-standard
```

Keep `web/src/**/*.{tsx,ts,css}` (components, widgets, pages, `globals.css`,
`tailwind.config.ts`). Drop tests, generated, and non-UI files.

- If the user passes explicit paths/globs as args, audit exactly those instead of the diff.
- If the diff is empty and no args were given, say so and offer to audit a named component.
- Read the **full** changed file, not just the hunk — a token/size violation is judged in
  the context of the element it styles.

## What to check — five dimensions

For each file, walk every styled element and every text node. A finding is `{severity,
file:line, rule, evidence, suggested fix}`.

### 1. Token usage (no raw values)
- **Raw hex in component code** — `text-[#…]`, `bg-[#…]`, `border-[#…]`, or
  `style={{ color: '#…' }}` / `style={{ background: '#…' }}`. Map to the matching token.
  Only allowed raw hex: **`#0A0A0A`** dark text on a bright badge fill.
- **Legacy Tailwind palette** — `text-blue-*`, `bg-blue-*`, `border-blue-*`, and
  `*-gray-*` / `*-slate-*` / `*-zinc-*` used as brand or surface. Map per the migration
  table in Claude.md (`blue-*`→`brand`, `bg-white` header→`bg-card`, `gray-500`→`text-muted`).
- ⚠ **Contrast hides in inline styles, not just classes.** Always grep `style={{` for
  `color`/`background`, not only Tailwind utilities — this is the recurring miss in the
  a11y audit.

### 2. Typography hierarchy (classify, then size)
For each text node, name its **role** from the Typography Hierarchy table, then verify:
- **Font family** matches (Space Grotesk for numbers scanned; Inter for reading copy;
  JetBrains Mono for ALL_CAPS labels). Never mix two fonts in one text node.
- **Size ≥ the mobile floor for that role.** Reading copy ≥13px (paragraphs), ≥12px (inline
  list items); labels floor at 9px. **No `text-[8px]` anywhere.** `font-body` sentences at
  `text-[10px]`/`text-[11px]` are reading copy mis-sized → flag.
- **Weight / case** match (700 ALL_CAPS for labels, etc.).

### 3. WCAG AA contrast (the size × token pairing)
- Normal text needs **≥4.5:1**; large text (≥18px / ≥14px bold) and UI need **≥3:1**.
- **`text-dim` / `text-ghost` on readable text = FAIL.** `dim` is UI/large-only (~3:1);
  `ghost` is decoration only (<2:1). Promote to `muted` or `primary`.
- **Small text + `dim`/`ghost` = FAIL** — 9px label with a sub-4.5:1 token compounds.
- **`text-muted` on `--color-bg-inset` (light)** ≈4:1 → use `primary` there.
- **Light-mode `neutral-text` (`#9CA3AF`)** fails AA for body → pair with `primary`.
- **Badge text must be dark `#0A0A0A`** on brand/warning/negative fills — white fails (~3:1).
  Applies to BUY/HOLD/SELL and the AKTIF badge.

### 4. SSR / hydration
- **`toLocaleString` / `Intl.NumberFormat`** for numbers → must be `fmtNumID()` /
  `formatIDRCompact()` from [../../../web/src/lib/calculations/formatters.ts](../../../web/src/lib/calculations/formatters.ts).
- **`new Date()` / `Date.now()` / `Math.random()` in render** → behind a `mounted` guard.
- **Charts** (Recharts, `lightweight-charts`, `react-force-graph-2d`) and
  **`<input type="date">`** must be behind a `mounted` guard with a skeleton during SSR.
- **`dynamic(…, { ssr: false })`** → forbidden; flag.

### 5. Mobile-first & layout
- Hero metric bar and tab row: horizontal scroll, **never wrap** (`whitespace-nowrap` /
  `overflow-x-auto`, no `flex-wrap`).
- Default desktop page padding is `px-8`, not `px-4`.
- No new gradients, shadows, decorative fills, sidebars, or fonts outside the token set.
- Above-the-fold trio on `/stock/[ticker]` mobile: price, signal badge, AI score.

## Grep cheatsheet (starting points, not the whole audit)

```bash
cd web
# raw hex + legacy palette (exclude the one allowed badge hex)
rg -n "(text|bg|border)-\[#|style=\{\{[^}]*(color|background)" src | rg -v "0A0A0A"
rg -n "(text|bg|border)-(blue|slate|zinc|gray)-[0-9]" src
# sub-floor / mis-sized type
rg -n "text-\[(8|9|10|11)px\]" src
# SSR banned patterns
rg -n "toLocaleString|Intl\.NumberFormat|ssr:\s*false" src
rg -n "new Date\(|Date\.now\(|Math\.random\(" src
# low-contrast tokens on text — inspect each hit by role
rg -n "text-dim|text-ghost" src
```

Grep narrows the search; **every hit is judged in context** (a `text-dim` on a decorative
`—` glyph is fine; on a sentence it's a FAIL). Do not report a raw grep dump.

## Process

1. Load the Claude.md hierarchy section + this skill's checks.
2. Resolve the file set (diff or args). State which files are in scope.
3. Read each file fully; for each styled element / text node, run the five dimensions.
4. Judge each candidate in context — dark vs light theme, role, surface it sits on.
5. Emit the report. **Stop. Do not edit anything.**

## Output — findings report

Group by severity, ordered FAIL → WARN → INFO. One line per finding:

```
FAIL  AIInsightsWidget.tsx:142  WCAG AA — text-ghost on reading copy (scenario paragraph)
      → promote to text-muted (≥4.5:1); reading copy must also be ≥13px (currently text-[11px])
WARN  ScreenerShell.tsx:88      Token — bg-blue-50/border-blue-200 active tab (legacy palette)
      → map to --color-brand-bg + --color-brand
INFO  StockHero.tsx:54          Mobile — metric bar uses flex without whitespace-nowrap
      → add overflow-x-auto + whitespace-nowrap so it scrolls, never wraps
```

- **FAIL** = WCAG AA violation or SSR/hydration banned pattern (will break or be illegible).
- **WARN** = design-system drift (raw hex, legacy palette, wrong font/role) — correct but
  off-system.
- **INFO** = mobile-first / layout nits and migration opportunities.

End with a one-line summary (`N FAIL · M WARN · K INFO across X files`) and, if clean,
say so explicitly. Then remind the user this is read-only: to apply the fixes, they can
ask directly or run `/simplify` on the same files. Suggest `cd web && npx tsc --noEmit`
after any fixes they make.
