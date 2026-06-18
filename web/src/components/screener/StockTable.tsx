'use client'

import Link from 'next/link'
import { fmtNumID, formatIDRCompact, formatCountCompact, formatPercent, formatMultiple } from '@/lib/calculations/formatters'
import type { ScreenerRow } from '@/lib/types/api'

// ---------------------------------------------------------------------------
// StockTable — screener results as a columns/rows table, mirroring the design
// (docs/FSA - stock detail page → ColHdr / Row_*). Columns are toggleable and
// sortable by clicking the header. Horizontally scrollable on narrow viewports.
// ---------------------------------------------------------------------------

type BadgeVariant = 'brand' | 'warning' | 'negative' | 'neutral'

const WYCKOFF_VARIANT: Record<string, BadgeVariant> = {
  markup:       'brand',
  accumulation: 'warning',
  distribution: 'negative',
  markdown:     'negative',
}

const BADGE_TOKENS: Record<BadgeVariant, { bg: string; text: string }> = {
  brand:    { bg: 'var(--color-brand-bg)',    text: 'var(--color-brand-text)' },
  warning:  { bg: 'var(--color-warning-bg)',  text: 'var(--color-warning-text)' },
  negative: { bg: 'var(--color-negative-bg)', text: 'var(--color-negative-text)' },
  neutral:  { bg: 'var(--color-bg-inset)',    text: 'var(--color-text-primary)' },
}

const COMPANY_MIN = 170

function SigBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  const t = BADGE_TOKENS[variant]
  return (
    <span
      className="font-mono rounded"
      style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, padding: '3px 8px', background: t.bg, color: t.text }}
    >
      {label}
    </span>
  )
}

type Tone = 'primary' | 'muted' | 'pos' | 'neg'
const TONE_COLOR: Record<Tone, string> = {
  primary: 'var(--color-text-primary)',
  muted:   'var(--color-text-muted)',
  pos:     'var(--color-brand-text)',
  neg:     'var(--color-negative-text)',
}

function Val({ children, tone = 'primary', weight = 500 }: { children: React.ReactNode; tone?: Tone; weight?: number }) {
  return <span className="font-mono" style={{ fontSize: 12, fontWeight: weight, color: TONE_COLOR[tone] }}>{children}</span>
}

const dash = <Val tone="muted">—</Val>

// Signed % — green when ≥0, red when <0 (CAGR, ROE, margin, volume change).
function signedPct(v: number | null | undefined): React.ReactNode {
  if (v == null) return dash
  return <Val tone={v >= 0 ? 'pos' : 'neg'} weight={600}>{formatPercent(v)}</Val>
}
function plainPct(v: number | null | undefined): React.ReactNode {
  return v == null ? dash : <Val>{formatPercent(v)}</Val>
}
function multiple(v: number | null | undefined): React.ReactNode {
  return v == null ? dash : <Val>{formatMultiple(v)}</Val>
}

// ── Column registry ────────────────────────────────────────────────────────
export interface ColumnDef {
  key: string
  label: string
  width: number            // fixed px; `company` flexes (width 0)
  sortKey?: string         // URL `sort` value; omit for non-sortable columns
  locked?: boolean         // always visible (not in the picker)
  defaultVisible?: boolean
  cell: (row: ScreenerRow) => React.ReactNode
}

export const STOCK_COLUMNS: ColumnDef[] = [
  { key: 'ticker', label: 'TICKER', width: 116, sortKey: 'ticker', locked: true,
    cell: (r) => <span className="font-display font-bold" style={{ fontSize: 14, letterSpacing: '-0.3px', color: 'var(--color-text-primary)' }}>{r.ticker}</span> },
  { key: 'company', label: 'COMPANY', width: 0, locked: true,
    cell: (r) => <span className="font-body block overflow-hidden whitespace-nowrap" style={{ fontSize: 12, color: 'var(--color-text-muted)', textOverflow: 'ellipsis' }}>{r.name ?? '—'}</span> },

  { key: 'price', label: 'PRICE', width: 108, sortKey: 'price', defaultVisible: true,
    cell: (r) => r.price != null ? <Val weight={600}>{`Rp ${fmtNumID(r.price)}`}</Val> : dash },
  { key: 'market_cap', label: 'MKT CAP', width: 100, sortKey: 'market_cap', defaultVisible: true,
    cell: (r) => r.market_cap != null ? <Val tone="muted">{`Rp ${formatIDRCompact(r.market_cap)}`}</Val> : dash },
  { key: 'pe_ratio', label: 'P/E', width: 64, sortKey: 'pe_ratio', defaultVisible: true, cell: (r) => multiple(r.pe_ratio) },
  { key: 'roe', label: 'ROE', width: 68, sortKey: 'roe', defaultVisible: true, cell: (r) => signedPct(r.roe) },
  { key: 'dividend_yield', label: 'YIELD', width: 68, sortKey: 'dividend_yield', defaultVisible: true, cell: (r) => plainPct(r.dividend_yield) },
  { key: 'wyckoff', label: 'WYCKOFF', width: 120, defaultVisible: true, cell: (r) => {
      const phase = r.current_wyckoff_phase_v2 ?? r.current_wyckoff_phase
      if (!phase) return dash
      const label = phase.charAt(0).toUpperCase() + phase.slice(1)
      return <SigBadge label={label} variant={WYCKOFF_VARIANT[phase] ?? 'neutral'} />
    } },

  // Optional metrics (toggle via the column picker) — every filterable metric.
  { key: 'pbv_ratio', label: 'PBV', width: 64, sortKey: 'pbv_ratio', cell: (r) => multiple(r.pbv_ratio) },
  { key: 'net_margin', label: 'NET MARGIN', width: 100, sortKey: 'net_margin', cell: (r) => signedPct(r.net_margin) },
  { key: 'revenue_cagr_3yr', label: 'REV CAGR 3Y', width: 116, sortKey: 'revenue_cagr_3yr', cell: (r) => signedPct(r.revenue_cagr_3yr) },
  { key: 'revenue_cagr_5yr', label: 'REV CAGR 5Y', width: 116, sortKey: 'revenue_cagr_5yr', cell: (r) => signedPct(r.revenue_cagr_5yr) },
  { key: 'price_cagr_3yr', label: 'PRICE CAGR 3Y', width: 124, sortKey: 'price_cagr_3yr', cell: (r) => signedPct(r.price_cagr_3yr) },
  { key: 'price_cagr_5yr', label: 'PRICE CAGR 5Y', width: 124, sortKey: 'price_cagr_5yr', cell: (r) => signedPct(r.price_cagr_5yr) },
  { key: 'ocf_cagr_3yr', label: 'OCF CAGR 3Y', width: 116, sortKey: 'ocf_cagr_3yr', cell: (r) => signedPct(r.ocf_cagr_3yr) },
  { key: 'ocf_cagr_5yr', label: 'OCF CAGR 5Y', width: 116, sortKey: 'ocf_cagr_5yr', cell: (r) => signedPct(r.ocf_cagr_5yr) },
  { key: 'div_yield_avg_3yr', label: 'YIELD 3Y', width: 88, sortKey: 'div_yield_avg_3yr', cell: (r) => plainPct(r.div_yield_avg_3yr) },
  { key: 'div_yield_avg_5yr', label: 'YIELD 5Y', width: 88, sortKey: 'div_yield_avg_5yr', cell: (r) => plainPct(r.div_yield_avg_5yr) },
  { key: 'rsi_14', label: 'RSI', width: 64, sortKey: 'rsi_14', cell: (r) => r.rsi_14 != null ? <Val>{r.rsi_14.toFixed(0)}</Val> : dash },
  { key: 'volume_change_pct', label: 'VOL Δ%', width: 92, sortKey: 'volume_change_pct', cell: (r) => signedPct(r.volume_change_pct) },
  { key: 'volume_avg_20d', label: 'VOL AVG', width: 100, sortKey: 'volume_avg_20d', cell: (r) => r.volume_avg_20d != null ? <Val tone="muted">{formatCountCompact(r.volume_avg_20d)}</Val> : dash },
  { key: 'completeness_score', label: 'SKOR', width: 64, sortKey: 'completeness_score', cell: (r) => r.completeness_score != null ? <Val>{r.completeness_score.toFixed(0)}</Val> : dash },
]

export const DEFAULT_VISIBLE_COLUMNS = STOCK_COLUMNS.filter((c) => c.defaultVisible && !c.locked).map((c) => c.key)
export const OPTIONAL_COLUMNS = STOCK_COLUMNS.filter((c) => !c.locked)

function colStyle(width: number): React.CSSProperties {
  return width > 0 ? { width } : { flex: 1, minWidth: COMPANY_MIN }
}

// The first column (ticker) is frozen: it sticks to the left while the rest of the
// table scrolls horizontally. The sticky cell carries its own opaque background so the
// scrolling cells pass underneath it, plus a right divider.
function stickyStyle(bg: string, isHeader: boolean): React.CSSProperties {
  return {
    position: 'sticky',
    left: 0,
    zIndex: isHeader ? 3 : 2,
    background: bg,
    borderRight: `1px solid ${isHeader ? 'var(--color-border)' : 'var(--color-border-subtle)'}`,
  }
}

function HeadCell({ col, index, sortBy, sortDir, onSort }: { col: ColumnDef; index: number; sortBy: string; sortDir: 'asc' | 'desc'; onSort: (k: string) => void }) {
  const active = !!col.sortKey && col.sortKey === sortBy
  const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
  const sticky = index === 0
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
    color: active ? 'var(--color-brand-text)' : 'var(--color-text-muted)',
  }
  return (
    <div
      className={`flex-shrink-0 ${sticky ? 'pl-6 pr-1' : 'px-1'}`}
      style={{ ...colStyle(col.width), ...(sticky ? stickyStyle('var(--color-bg-page)', true) : {}) }}
    >
      {col.sortKey ? (
        <button
          type="button"
          onClick={() => onSort(col.sortKey!)}
          className="font-mono"
          style={{ ...labelStyle, cursor: 'pointer', textAlign: 'left' }}
        >
          {col.label + arrow}
        </button>
      ) : (
        <span className="font-mono" style={{ ...labelStyle, display: 'block' }}>{col.label}</span>
      )}
    </div>
  )
}

export function StockTable({
  rows, columns, sortBy, sortDir, onSort,
}: {
  rows: ScreenerRow[]
  columns: ColumnDef[]
  sortBy: string
  sortDir: 'asc' | 'desc'
  onSort: (sortKey: string) => void
}) {
  // Sum of column widths + the trailing 24px (pr-6) gutter.
  const minWidth = columns.reduce((sum, c) => sum + (c.width > 0 ? c.width : COMPANY_MIN), 0) + 24

  return (
    <div style={{ minWidth }}>
      {/* Column header */}
      <div className="flex items-center pr-6 py-2" style={{ background: 'var(--color-bg-page)', borderBottom: '1px solid var(--color-border)' }}>
        {columns.map((col, i) => (
          <HeadCell key={col.key} col={col} index={i} sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, i) => {
        const rowBg = i % 2 === 1 ? 'var(--color-bg-page)' : 'var(--color-bg-card)'
        return (
          <Link
            key={row.ticker}
            href={`/stock/${row.ticker}`}
            className="flex items-center pr-6 py-2.5"
            style={{ background: rowBg, borderBottom: '1px solid var(--color-border-subtle)' }}
          >
            {columns.map((col, ci) => {
              const sticky = ci === 0
              return (
                <div
                  key={col.key}
                  className={`flex-shrink-0 ${sticky ? 'pl-6 pr-1' : 'px-1'}`}
                  style={{ ...colStyle(col.width), ...(sticky ? stickyStyle(rowBg, false) : {}) }}
                >
                  {col.cell(row)}
                </div>
              )
            })}
          </Link>
        )
      })}
    </div>
  )
}
