'use client'

import { useState, useMemo } from 'react'
import {
  computeGrahamNumber,
  computeDCFScenarios,
  IDX_BASE_WACC,
  IDX_TERMINAL_GROWTH,
  IDX_RISK_FREE_RATE,
  IDX_EQUITY_RISK_PREMIUM,
  DCF_MODE_LABELS,
  type DCFMode,
  type DCFScenario,
  type ScenarioLabel,
} from '@/lib/calculations/valuation'
import { formatIDRCompact, fmtNumID } from '@/lib/calculations/formatters'
import type { QuarterlyFinancial } from '@/lib/types/api'

interface Props {
  eps: number | null
  bvps: number | null
  fcf: number | null
  dividends: number | null
  netIncome: number | null
  currentPrice: number | null
  shares: number | null
  defaultGrowthRate: number
  peRatio: number | null
  pbRatio: number | null
  annualHistory: QuarterlyFinancial[]
}

/* ── Sub-components ────────────────────────────────────────────── */

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { color: string; bg: string; border: string; text: string }> = {
    'undervalued':   { color: 'var(--color-brand-text)',    bg: 'var(--color-brand-bg)',    border: 'var(--color-brand)',        text: 'Undervalued' },
    'fairly-valued': { color: 'var(--color-warning-text)',  bg: 'var(--color-warning-bg)',  border: 'var(--color-warning-text)', text: 'Fairly Valued' },
    'overvalued':    { color: 'var(--color-negative-text)', bg: 'var(--color-negative-bg)', border: 'var(--color-negative)',     text: 'Overvalued' },
    'na':            { color: 'var(--color-text-muted)',    bg: 'var(--color-bg-inset)',    border: 'var(--color-border)',       text: 'N/A' },
  }
  const s = styles[verdict] ?? styles.na
  return (
    <span
      className="font-mono text-[10px] font-bold px-2 py-0.5 border"
      style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}
    >
      {s.text}
    </span>
  )
}

function MoSBar({ mos }: { mos: number | null }) {
  if (mos === null) return null
  const clamped = Math.max(-100, Math.min(100, mos))
  const isPositive = mos >= 0
  return (
    <div className="mt-1.5">
      <div className="h-1.5 bg-[var(--color-bg-inset)] overflow-hidden relative">
        <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--color-border)] z-10" />
        {isPositive ? (
          <div
            className="absolute inset-y-0 bg-[var(--color-brand)]"
            style={{ left: '50%', width: `${(clamped / 2).toFixed(1)}%` }}
          />
        ) : (
          <div
            className="absolute inset-y-0 bg-[var(--color-negative)]"
            style={{ right: '50%', width: `${(-clamped / 2).toFixed(1)}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="font-mono text-[9px] text-[var(--color-text-muted)]">Overvalued</span>
        <span className={`font-mono text-[11px] font-bold ${isPositive ? 'text-[var(--color-brand-text)]' : 'text-[var(--color-negative-text)]'}`}>
          {mos > 0 ? '+' : ''}{mos.toFixed(1)}% MoS
        </span>
        <span className="font-mono text-[9px] text-[var(--color-text-muted)]">Undervalued</span>
      </div>
    </div>
  )
}

function SliderInput({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] text-[var(--color-text-muted)] w-[130px] shrink-0">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 bg-[var(--color-border)] appearance-none cursor-pointer accent-[var(--color-brand)]"
      />
      <span className="font-mono text-[11px] font-semibold text-[var(--color-text-primary)] w-[40px] text-right">{value}{unit}</span>
    </div>
  )
}

const scenarioStyle: Record<ScenarioLabel, { border: string; bg: string; accent: string }> = {
  bearish: { border: 'border-[var(--color-negative)]', bg: 'bg-[var(--color-negative-bg)]', accent: 'text-[var(--color-negative-text)]' },
  base:    { border: 'border-[var(--color-border)]', bg: 'bg-[var(--color-bg-inset)]', accent: 'text-[var(--color-text-primary)]' },
  bullish: { border: 'border-[var(--color-brand)]', bg: 'bg-[var(--color-brand-bg)]', accent: 'text-[var(--color-brand-text)]' },
}

function ScenarioCard({ scenario }: { scenario: DCFScenario }) {
  const s = scenarioStyle[scenario.label]
  const iv = scenario.result.intrinsicValuePerShare
  const mos = scenario.result.marginOfSafety

  return (
    <div className={`flex-1 p-3 border ${s.border} ${s.bg}`}>
      <p className={`font-mono text-[9px] font-bold uppercase tracking-[0.5px] ${s.accent}`}>
        {scenario.label}
      </p>
      <p className={`font-mono text-[15px] font-bold mt-1 ${s.accent}`}>
        {iv != null ? `Rp${fmtNumID(Math.round(iv))}` : '—'}
      </p>
      {mos != null && (
        <p className={`font-mono text-[10px] font-semibold mt-0.5 ${mos >= 0 ? 'text-[var(--color-brand-text)]' : 'text-[var(--color-negative-text)]'}`}>
          {mos > 0 ? '+' : ''}{mos.toFixed(1)}% MoS
        </p>
      )}
      <div className="mt-1.5 font-mono text-[9px] text-[var(--color-text-muted)] space-y-0.5">
        <p>Growth: {scenario.growthRate.toFixed(1)}%</p>
        <p>WACC: {scenario.discountRate.toFixed(1)}%</p>
      </div>
    </div>
  )
}

/* ── Graham criteria check ────────────────────────────────────── */

function CriteriaCheck({ label, pass }: { label: string; pass: boolean | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-mono text-[10px] leading-none ${pass === null ? 'text-[var(--color-text-dim)]' : pass ? 'text-[var(--color-brand-text)]' : 'text-[var(--color-negative-text)]'}`}>
        {pass === null ? '—' : pass ? '✓' : '✗'}
      </span>
      <span className={`font-mono text-[10px] ${pass === null ? 'text-[var(--color-text-dim)]' : pass ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
        {label}
      </span>
    </div>
  )
}

/* ── Graham sparkline (SVG) ───────────────────────────────────── */

function GrahamSparkline({ points }: { points: { year: number; value: number }[] }) {
  if (points.length < 2) return null

  const w = 200
  const h = 36
  const pad = 2
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const pts = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - 2 * pad)
    const y = h - pad - ((p.value - min) / range) * (h - 2 * pad)
    return `${x},${y}`
  })

  return (
    <div className="mt-2">
      <svg width={w} height={h} className="w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex items-center justify-between font-mono text-[9px] text-[var(--color-text-muted)]">
        <span>{points[0].year}</span>
        <span>{points[points.length - 1].year}</span>
      </div>
    </div>
  )
}

/* ── Main ──────────────────────────────────────────────────────── */

export function ValuationCalculator({
  eps, bvps, fcf, dividends, netIncome, currentPrice, shares, defaultGrowthRate,
  peRatio, pbRatio, annualHistory,
}: Props) {
  const availableModes = useMemo(() => {
    const modes: DCFMode[] = []
    if (fcf && fcf > 0) modes.push('fcf')
    if (dividends && dividends > 0) modes.push('dividend')
    if (netIncome && netIncome > 0) modes.push('eps')
    return modes
  }, [fcf, dividends, netIncome])

  const [dcfMode, setDcfMode] = useState<DCFMode>(availableModes[0] ?? 'fcf')
  const [growthRate, setGrowthRate] = useState(Math.min(Math.max(defaultGrowthRate, 3), 25))
  const [terminalGrowthRate, setTerminalGrowthRate] = useState(IDX_TERMINAL_GROWTH)
  const [discountRate, setDiscountRate] = useState(IDX_BASE_WACC)
  const [showSliders, setShowSliders] = useState(false)

  const graham = computeGrahamNumber(eps, bvps, currentPrice)

  const activeMode = availableModes.includes(dcfMode) ? dcfMode : availableModes[0]
  const baseCashFlow = activeMode === 'fcf' ? fcf
    : activeMode === 'dividend' ? dividends
    : activeMode === 'eps' ? netIncome
    : null

  const scenarios = (baseCashFlow && baseCashFlow > 0 && shares && shares > 0)
    ? computeDCFScenarios(baseCashFlow, shares, growthRate, currentPrice, discountRate, terminalGrowthRate)
    : null

  const baseScenario = scenarios?.find((s) => s.label === 'base') ?? null

  const hasAnyData = eps || bvps || fcf || dividends || netIncome
  if (!hasAnyData) return null

  const modeLabel = activeMode ? DCF_MODE_LABELS[activeMode] : null

  // Graham criteria
  const pePb = (peRatio != null && pbRatio != null) ? peRatio * pbRatio : null
  const criteria = {
    pe: peRatio != null ? peRatio < 15 : null,
    pb: pbRatio != null ? pbRatio < 1.5 : null,
    pePb: pePb != null ? pePb < 22.5 : null,
  }

  // Historical Graham Numbers from annual data
  const grahamHistory = useMemo(() => {
    const points: { year: number; value: number }[] = []
    for (const row of annualHistory) {
      if (row.quarter !== 0) continue
      const e = row.eps
      const b = row.book_value_per_share
      if (e != null && e > 0 && b != null && b > 0) {
        points.push({ year: row.year, value: Math.sqrt(22.5 * e * b) })
      }
    }
    return points.sort((a, b) => a.year - b.year)
  }, [annualHistory])

  // Graham Number CAGR
  const grahamCagr = useMemo(() => {
    if (grahamHistory.length < 2) return null
    const first = grahamHistory[0]
    const last = grahamHistory[grahamHistory.length - 1]
    const years = last.year - first.year
    if (years <= 0 || first.value <= 0) return null
    return (Math.pow(last.value / first.value, 1 / years) - 1) * 100
  }, [grahamHistory])

  return (
    <div className="flex flex-col md:flex-row gap-3 items-stretch">

      {/* ── Graham Number (30%) ── */}
      <div className="w-full md:w-[30%] md:shrink-0 border border-[var(--color-border)] p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold tracking-[0.5px] text-[var(--color-text-muted)]">GRAHAM NUMBER</span>
            <span className="relative group cursor-help">
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] font-mono text-[9px] leading-none select-none">?</span>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-max max-w-[200px] px-2.5 py-1.5 bg-[var(--color-bg-inset)] text-[var(--color-text-primary)] border border-[var(--color-border)] font-mono text-[11px] leading-[1.4] rounded">
                sqrt(22.5 x EPS x BVPS) — nilai wajar menurut Benjamin Graham
              </span>
            </span>
          </div>
          {graham.verdict !== 'na' && <VerdictBadge verdict={graham.verdict} />}
        </div>

        {graham.grahamNumber ? (
          <div className="mt-2 flex-1 flex flex-col">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[18px] font-bold text-[var(--color-text-primary)]">
                Rp{fmtNumID(Math.round(graham.grahamNumber))}
              </span>
              {currentPrice && (
                <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                  vs Rp{fmtNumID(currentPrice)}
                </span>
              )}
            </div>
            <MoSBar mos={graham.marginOfSafety} />

            {/* Graham criteria checklist */}
            <div className="mt-3 space-y-1">
              <span className="font-mono text-[9px] font-bold text-[var(--color-text-muted)] tracking-[0.5px]">KRITERIA GRAHAM</span>
              <CriteriaCheck
                label={`P/E < 15${peRatio != null ? ` (${peRatio.toFixed(1)})` : ''}`}
                pass={criteria.pe}
              />
              <CriteriaCheck
                label={`P/B < 1.5${pbRatio != null ? ` (${pbRatio.toFixed(1)})` : ''}`}
                pass={criteria.pb}
              />
              <CriteriaCheck
                label={`P/E × P/B < 22.5${pePb != null ? ` (${pePb.toFixed(1)})` : ''}`}
                pass={criteria.pePb}
              />
            </div>

            {/* Historical sparkline + CAGR */}
            {grahamHistory.length >= 2 && (
              <div className="mt-auto pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold text-[var(--color-text-muted)] tracking-[0.5px]">TREN NILAI WAJAR</span>
                  {grahamCagr != null && (
                    <span className={`font-mono text-[10px] font-bold ${grahamCagr >= 0 ? 'text-[var(--color-brand-text)]' : 'text-[var(--color-negative-text)]'}`}>
                      {grahamCagr > 0 ? '+' : ''}{grahamCagr.toFixed(1)}%/yr
                    </span>
                  )}
                </div>
                <GrahamSparkline points={grahamHistory} />
              </div>
            )}

            {/* EPS / BVPS footnote */}
            <div className="mt-2 flex gap-4 font-mono text-[10px] text-[var(--color-text-muted)]">
              <span>EPS: <span className="text-[var(--color-text-primary)] font-semibold">{eps != null ? eps.toFixed(2) : '—'}</span></span>
              <span>BVPS: <span className="text-[var(--color-text-primary)] font-semibold">{bvps != null ? bvps.toFixed(2) : '—'}</span></span>
            </div>
          </div>
        ) : (
          <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-2">
            Membutuhkan EPS dan Book Value per Share positif.
          </p>
        )}
      </div>

      {/* ── DCF Scenarios (70%) ── */}
      <div className="w-full md:w-[70%] min-w-0 border border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold tracking-[0.5px] text-[var(--color-text-muted)]">DCF (10-YEAR)</span>
            {availableModes.length > 1 && (
              <div className="flex gap-0.5 p-0.5 bg-[var(--color-bg-inset)] border border-[var(--color-border)]">
                {availableModes.map((m) => (
                  <button
                    key={m}
                    onClick={() => setDcfMode(m)}
                    className={`px-2 py-0.5 font-mono text-[9px] font-bold transition-colors ${
                      activeMode === m
                        ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-dim)]'
                    }`}
                  >
                    {DCF_MODE_LABELS[m].short}
                  </button>
                ))}
              </div>
            )}
          </div>
          {baseScenario && baseScenario.result.verdict !== 'na' && (
            <VerdictBadge verdict={baseScenario.result.verdict} />
          )}
        </div>

        {scenarios ? (
          <div className="mt-3">
            <div className="flex gap-2">
              {scenarios.map((s) => (
                <ScenarioCard key={s.label} scenario={s} />
              ))}
            </div>

            {/* Current price + MoS bar */}
            <div className="mt-2">
              {currentPrice && (
                <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                  Harga saat ini: Rp{fmtNumID(currentPrice)}
                </span>
              )}
              <MoSBar mos={baseScenario?.result.marginOfSafety ?? null} />
            </div>

            {/* Base values */}
            <div className="mt-2 flex gap-4 font-mono text-[10px] text-[var(--color-text-muted)]">
              <span>{modeLabel?.baseLabel ?? 'Base'}: <span className="text-[var(--color-text-primary)] font-semibold">{formatIDRCompact(baseCashFlow)}</span></span>
              <span>Total PV: <span className="text-[var(--color-text-primary)] font-semibold">{formatIDRCompact(baseScenario?.result.totalPV ?? null)}</span></span>
            </div>

            {/* Collapsible sliders */}
            <div className="mt-3 border-t border-[var(--color-border)] pt-2">
              <button
                type="button"
                onClick={() => setShowSliders((v) => !v)}
                className="flex items-center gap-1.5 w-full text-left hover:bg-[var(--color-bg-inset)] -mx-1 px-1 py-0.5 transition-colors"
              >
                <span
                  className="font-mono text-[10px] text-[var(--color-text-muted)] transition-transform duration-200"
                  style={{ transform: showSliders ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  ▾
                </span>
                <span className="font-mono text-[10px] font-bold text-[var(--color-text-muted)]">Sesuaikan Asumsi</span>
              </button>

              <div
                className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
                style={{ maxHeight: showSliders ? '200px' : '0px' }}
              >
                <div className="pt-2 space-y-2">
                  <SliderInput
                    label="Growth Rate (10yr)" value={growthRate}
                    min={0} max={30} step={1} unit="%" onChange={setGrowthRate}
                  />
                  <SliderInput
                    label="Terminal Growth" value={terminalGrowthRate}
                    min={0} max={8} step={0.5} unit="%" onChange={setTerminalGrowthRate}
                  />
                  <SliderInput
                    label="Discount (WACC)" value={discountRate}
                    min={6} max={25} step={0.5} unit="%" onChange={setDiscountRate}
                  />
                </div>
              </div>
            </div>

            {/* Assumptions footnote */}
            <div className="mt-2 font-mono text-[9px] text-[var(--color-text-muted)] leading-[1.5]">
              WACC: BI 10Y {IDX_RISK_FREE_RATE}% + ERP {IDX_EQUITY_RISK_PREMIUM}% = {IDX_BASE_WACC}%
              {' · '}Scenarios: &plusmn;10% growth &amp; WACC
              {' · '}Terminal: {IDX_TERMINAL_GROWTH}%
            </div>
          </div>
        ) : availableModes.length === 0 ? (
          <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-2">
            Tidak ada data cash flow, dividen, atau laba positif untuk DCF.
          </p>
        ) : (
          <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-2">
            Data jumlah saham beredar tidak tersedia.
          </p>
        )}
      </div>
    </div>
  )
}
