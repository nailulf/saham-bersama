'use client'

/**
 * ScenarioCards — Terminal Dashboard design-system component.
 *
 * Renders bull / neutral / bear investment scenarios as three cards with a
 * single-active expand/collapse model:
 *
 *   Desktop (md+):  collapsed → 3 equal cards in a row. Expanding one reflows
 *                   the layout: the two non-active cards stay as compact cards
 *                   in a row on top, and the active card occupies the full width
 *                   below it.
 *   Mobile (<md):   cards are stacked. Tapping a card (or its corner toggle)
 *                   expands it in place as an accordion; expanding one collapses
 *                   any other. Only one card can be active at a time.
 *
 * All colours map to design tokens — no raw hex. SSR-safe: numbers go through
 * fmtNumID(), no time/locale-dependent render values.
 */

import { useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { fmtNumID } from '@/lib/calculations/formatters'

export type ScenarioTier = 'bull' | 'neutral' | 'bear'

export interface ScenarioCaseData {
  tier: ScenarioTier
  scenario: string
  drivers: string[]
  /** "Tanda awal" (bull/bear) or "Pemicu perubahan" (neutral) items. */
  signals: string[]
  signalLabel: string
  probability: number | string
  /** Point target (bull/bear). */
  target?: number | null
  /** Range bounds (neutral). */
  targetLow?: number | null
  targetHigh?: number | null
}

interface ScenarioCardsProps {
  cases: ScenarioCaseData[]
  currentPrice?: number | null
  /** Tier that matches the analyst verdict — gets an "AKTIF" badge. */
  activeTier?: ScenarioTier
  /** Tier that starts expanded. Omit / null → all collapsed. */
  defaultExpanded?: ScenarioTier | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function probNum(p: number | string | undefined): number {
  if (typeof p === 'number') return Math.min(100, Math.max(0, p))
  if (p === 'high')   return 70
  if (p === 'medium') return 45
  if (p === 'low')    return 20
  const n = parseFloat(p ?? '')
  return isNaN(n) ? 45 : n
}

function upsideLabel(target: number, current: number | null | undefined): string | null {
  if (!current) return null
  const pct = ((target - current) / current) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

function displayTargetOf(c: ScenarioCaseData): number | null {
  return c.target ?? c.targetHigh ?? null
}

// ── Theme tokens per tier ──────────────────────────────────────────────────────

const CASE_THEME: Record<ScenarioTier, {
  dot: string; label: string; activeBg: string; border: string; textColor: string
  divider: string; badgeText: string; probFill: string
  compactBg: string; compactBorder: string
}> = {
  bull: {
    dot: 'var(--color-brand)', label: 'BULL CASE',
    activeBg: 'var(--color-brand-bg)', border: 'var(--color-brand)',
    textColor: 'var(--color-brand-text)', divider: 'var(--color-border-subtle)',
    badgeText: '#0A0A0A', probFill: 'var(--color-brand-text)',
    compactBg: 'var(--color-brand-bg)', compactBorder: 'var(--color-brand)',
  },
  neutral: {
    dot: 'var(--color-warning-text)', label: 'NEUTRAL',
    activeBg: 'var(--color-warning-bg)', border: 'var(--color-warning-text)',
    textColor: 'var(--color-warning-text)', divider: 'var(--color-border-subtle)',
    badgeText: '#0A0A0A', probFill: 'var(--color-warning-text)',
    compactBg: 'var(--color-warning-bg)', compactBorder: 'var(--color-warning-text)',
  },
  bear: {
    dot: 'var(--color-negative-text)', label: 'BEAR CASE',
    activeBg: 'var(--color-negative-bg)', border: 'var(--color-negative)',
    textColor: 'var(--color-negative-text)', divider: 'var(--color-border-subtle)',
    badgeText: '#0A0A0A', probFill: 'var(--color-negative-text)',
    compactBg: 'var(--color-negative-bg)', compactBorder: 'var(--color-negative)',
  },
}

// ── Compact card (collapsed state) ──────────────────────────────────────────────

function CompactCard({ c, currentPrice, onExpand }: {
  c: ScenarioCaseData; currentPrice?: number | null; onExpand: () => void
}) {
  const t = CASE_THEME[c.tier]
  const prob = probNum(c.probability)
  const target = displayTargetOf(c)
  const upside = target != null ? upsideLabel(target, currentPrice) : null

  return (
    <button
      onClick={onExpand}
      aria-label={`Perluas ${t.label}`}
      className="group rounded-[10px] p-3 flex flex-col gap-1.5 text-left w-full h-full transition-all active:scale-[0.98]"
      style={{ background: t.compactBg, border: `1px solid ${t.compactBorder}` }}
    >
      <div className="flex items-center gap-1.5 w-full">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.dot }} />
        <span className="font-mono text-[9px] font-bold tracking-[0.5px]" style={{ color: t.textColor }}>{t.label}</span>
        <span className="font-mono text-[9px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>{prob}%</span>
        <Maximize2
          size={11}
          className="shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
          style={{ color: t.textColor }}
        />
      </div>
      {target != null && (
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Rp {fmtNumID(target)}
          </span>
          {upside && <span className="font-body text-[9px]" style={{ color: t.textColor }}>{upside}</span>}
        </div>
      )}
    </button>
  )
}

// ── Expanded card (active state) ────────────────────────────────────────────────

function ExpandedCard({ c, currentPrice, isVerdictActive, onCollapse }: {
  c: ScenarioCaseData; currentPrice?: number | null; isVerdictActive: boolean; onCollapse: () => void
}) {
  const t = CASE_THEME[c.tier]
  const prob = probNum(c.probability)
  const target = displayTargetOf(c)
  const upside = target != null ? upsideLabel(target, currentPrice) : null

  return (
    <div className="rounded-xl overflow-hidden w-full" style={{ background: t.activeBg, border: `1.5px solid ${t.border}` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.dot }} />
          <span className="font-mono text-[10px] font-bold tracking-[0.5px]" style={{ color: t.textColor }}>{t.label}</span>
          {isVerdictActive && (
            <span className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: t.dot, color: t.badgeText }}>
              AKTIF
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {target != null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{ background: 'var(--color-bg-inset)', border: `1px solid ${t.border}` }}>
              <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Rp {fmtNumID(target)}
              </span>
              {upside && <span className="font-mono text-[10px] font-semibold" style={{ color: t.textColor }}>{upside}</span>}
            </div>
          )}
          <button
            onClick={onCollapse}
            aria-label={`Tutup ${t.label}`}
            className="flex items-center justify-center w-6 h-6 rounded-md transition-opacity opacity-70 hover:opacity-100"
            style={{ background: 'var(--color-bg-inset)', border: `1px solid ${t.border}` }}
          >
            <Minimize2 size={11} style={{ color: t.textColor }} />
          </button>
        </div>
      </div>

      <div style={{ height: 1, background: t.divider }} />

      {/* Scenario text */}
      {c.scenario && (
        <div className="px-4 pt-3 pb-0">
          <p className="font-body text-[13px] md:text-[14px] leading-[1.6]" style={{ color: 'var(--color-text-primary)' }}>{c.scenario}</p>
        </div>
      )}

      {/* Drivers */}
      {c.drivers.length > 0 && (
        <div className="px-4 py-3 flex flex-col gap-2">
          {c.drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: t.dot }} />
              <span className="font-body text-[12px] md:text-[13px] leading-[1.45]" style={{ color: 'var(--color-text-primary)' }}>{d}</span>
            </div>
          ))}
        </div>
      )}

      {/* Signals / triggers */}
      {c.signals.length > 0 && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          <div className="font-mono text-[9px] font-bold tracking-[0.8px] mb-1" style={{ color: t.textColor }}>
            {c.signalLabel}
          </div>
          {c.signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono text-[9px] mt-0.5 shrink-0" style={{ color: t.textColor }}>▸</span>
              <span className="font-body text-[12px] md:text-[13px] leading-[1.45]" style={{ color: 'var(--color-text-primary)' }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Probability footer */}
      <div className="px-4 pt-2.5 pb-3.5 flex flex-col gap-1.5" style={{ borderTop: `1px solid ${t.divider}` }}>
        <div className="flex items-center justify-between">
          <span className="font-body text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Probabilitas Skenario</span>
          <span className="font-mono text-[13px] font-bold" style={{ color: t.textColor }}>{prob}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-inset)' }}>
          <div className="h-full rounded-full" style={{ width: `${prob}%`, background: t.probFill }} />
        </div>
      </div>
    </div>
  )
}

// ── Public component ────────────────────────────────────────────────────────────

export function ScenarioCards({ cases, currentPrice, activeTier, defaultExpanded = null }: ScenarioCardsProps) {
  const [expanded, setExpanded] = useState<ScenarioTier | null>(defaultExpanded)

  // Preserve bull → neutral → bear ordering regardless of input order.
  const ORDER: ScenarioTier[] = ['bull', 'neutral', 'bear']
  const ordered = ORDER.map(tier => cases.find(c => c.tier === tier)).filter(Boolean) as ScenarioCaseData[]
  if (ordered.length === 0) return null

  const expandedCase = expanded ? ordered.find(c => c.tier === expanded) ?? null : null
  const compactCases = ordered.filter(c => c.tier !== expanded)

  return (
    <>
      {/* ── Mobile: stacked accordion, expand in place ── */}
      <div className="flex flex-col gap-2 md:hidden">
        {ordered.map(c => (
          c.tier === expanded
            ? <ExpandedCard key={c.tier} c={c} currentPrice={currentPrice}
                isVerdictActive={c.tier === activeTier} onCollapse={() => setExpanded(null)} />
            : <CompactCard key={c.tier} c={c} currentPrice={currentPrice}
                onExpand={() => setExpanded(c.tier)} />
        ))}
      </div>

      {/* ── Desktop: reflow — compact row on top, expanded full-width below ── */}
      <div className="hidden md:flex md:flex-col md:gap-2">
        {expandedCase ? (
          <>
            <div className={`grid gap-2 ${compactCases.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {compactCases.map(c => (
                <CompactCard key={c.tier} c={c} currentPrice={currentPrice}
                  onExpand={() => setExpanded(c.tier)} />
              ))}
            </div>
            <ExpandedCard c={expandedCase} currentPrice={currentPrice}
              isVerdictActive={expandedCase.tier === activeTier} onCollapse={() => setExpanded(null)} />
          </>
        ) : (
          <div className={`grid gap-2 ${ordered.length === 3 ? 'grid-cols-3' : ordered.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {ordered.map(c => (
              <CompactCard key={c.tier} c={c} currentPrice={currentPrice}
                onExpand={() => setExpanded(c.tier)} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
