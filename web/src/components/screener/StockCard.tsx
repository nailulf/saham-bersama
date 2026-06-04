import Link from 'next/link'
import { ScoreBox } from '@/components/ui/score-box'
import { fmtNumID } from '@/lib/calculations/formatters'
import type { ScreenerRow } from '@/lib/types/api'

const WYCKOFF_COLORS: Record<string, string> = {
  markup:       'var(--color-brand)',
  accumulation: 'var(--color-warning-text)',
  distribution: 'var(--color-negative)',
  markdown:     'var(--color-negative)',
}

const SECTOR_SHORT: Record<string, string> = {
  'Financials':                  'Finance',
  'Energy':                      'Energy',
  'Basic Materials':             'Materials',
  'Barang Konsumen Primer':      'Staples',
  'Barang Konsumen Non-Primer':  'Consumer',
  'Industrials':                 'Industri',
  'Property & Real Estate':      'Properti',
  'Technology':                  'Tech',
  'Infrastructure':              'Infra',
  'Transportation & Logistics':  'Transport',
  'Healthcare':                  'Health',
}

function Pill({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5 rounded"
      style={{
        background: 'var(--color-bg-inset)',
        border: '1px solid var(--color-border-subtle)',
        flexShrink: 0,
      }}
    >
      <span style={{ color: 'var(--color-text-ghost)', fontSize: 9 }}>{label}:</span>
      <span
        className="font-semibold"
        style={{ color: valueColor ?? 'var(--color-text-muted)', fontSize: 9 }}
      >
        {value}
      </span>
    </div>
  )
}

export function StockCard({ row }: { row: ScreenerRow }) {
  const score = row.completeness_score ?? 0

  const wyckoffPhase = row.current_wyckoff_phase_v2 ?? row.current_wyckoff_phase
  const wyckoffLabel = wyckoffPhase
    ? wyckoffPhase.charAt(0).toUpperCase() + wyckoffPhase.slice(1)
    : '—'
  const wyckoffColor = wyckoffPhase ? WYCKOFF_COLORS[wyckoffPhase] : undefined

  const sectorLabel = row.sector ? (SECTOR_SHORT[row.sector] ?? row.sector.slice(0, 8)) : '—'

  const revCagr = row.revenue_cagr_3yr
  const revLabel = revCagr != null
    ? (revCagr >= 0 ? `+${revCagr.toFixed(0)}%` : `${revCagr.toFixed(0)}%`)
    : '—'

  const peLabel = row.pe_ratio != null ? `${row.pe_ratio.toFixed(0)}x` : 'N/A'

  const phasePositive = row.current_phase === 'uptrend' || row.current_phase === 'sideways_bullish'

  return (
    <Link
      href={`/stock/${row.ticker}`}
      className="block"
      style={{
        background: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <div className="flex flex-col gap-2 px-5 py-3.5">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScoreBox score={score} size={32} />
            <div className="flex flex-col gap-0.5">
              <span
                className="font-display font-bold leading-none"
                style={{ fontSize: 13, letterSpacing: '-0.3px', color: 'var(--color-text-primary)' }}
              >
                {row.ticker}
              </span>
              <span
                className="font-mono leading-none"
                style={{ fontSize: 10, color: 'var(--color-text-muted)' }}
              >
                {row.name ? row.name.slice(0, 26) : '—'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-0.5">
            <span
              className="font-mono font-bold leading-none"
              style={{ fontSize: 13, color: 'var(--color-text-primary)' }}
            >
              {row.price != null ? fmtNumID(row.price) : '—'}
            </span>
            {row.current_phase && (
              <span
                className="font-mono font-semibold leading-none"
                style={{
                  fontSize: 10,
                  color: phasePositive ? 'var(--color-brand)' : 'var(--color-negative)',
                }}
              >
                {row.current_phase.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Pills */}
        <div className="flex items-center gap-1.5">
          <Pill label="P/E"     value={peLabel} />
          <Pill label="Rev"     value={revLabel} />
          <Pill label="Wyckoff" value={wyckoffLabel} valueColor={wyckoffColor} />
          <Pill label="Sektor"  value={sectorLabel} />
        </div>
      </div>
    </Link>
  )
}
