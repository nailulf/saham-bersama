'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { BarChart2, TrendingUp, Search, FileText } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, Area, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, ComposedChart,
} from 'recharts'
import type {
  StockBrokerSummary, StockBrokerBucket, BandarSignalRow,
  InsiderTransactionRow, DailyFlowByType, BrokerConcentrationRow,
  SmartMoneyData,
} from '@/lib/queries/broker'
import { formatIDRCompact, formatNumber, fmtNumID } from '@/lib/calculations/formatters'
import { computeConfidence as computeConfidenceScore, generateNarrative as generateNarrativeText, type ConfidenceScore, type Narrative } from '@/lib/calculations/signal-confidence'

/* ─── constants ─────────────────────────────────────────────────────── */

const DURATION_PRESETS = [
  { label: '10D', days: 10 },
  { label: '20D', days: 20 },
  { label: '30D', days: 30 },
  { label: '60D', days: 60 },
  { label: '90D', days: 90 },
  { label: '120D', days: 120 },
  { label: '200D', days: 200 },
]

const TABS = [
  { key: 'daily',    label: 'Aliran broker harian' },
  { key: 'cum',      label: 'Kumulatif net flow' },
  { key: 'identify', label: 'Identifikasi broker bandar' },
  { key: 'insider',  label: 'Insider Filings' },
] as const

type TabKey = (typeof TABS)[number]['key']

const TAB_ICONS: Record<TabKey, React.ElementType> = {
  daily:    BarChart2,
  cum:      TrendingUp,
  identify: Search,
  insider:  FileText,
}

/* ─── combined signal logic ─────────────────────────────────────────── */

type BrokerDirection = 'net_beli' | 'netral' | 'net_jual'
type InsiderAction = 'buy' | 'sell' | 'mixed' | 'none'
type SignalPhase = 'akumulasi' | 'distribusi' | 'netral'

interface CombinedSignal {
  signal: string
  phase: SignalPhase
  label: string
  color: string
  bgColor: string
  description: string        // static explanation for matrix cells
}

const T = {
  acc:    { color: 'var(--color-brand-text)',    bg: 'var(--color-brand-bg)'    },
  warn:   { color: 'var(--color-warning-text)',  bg: 'var(--color-warning-bg)'  },
  dist:   { color: 'var(--color-negative-text)', bg: 'var(--color-negative-bg)' },
  neutral:{ color: 'var(--color-text-muted)',    bg: 'var(--color-bg-inset)'    },
}

const SIGNAL_MAP: Record<string, CombinedSignal> = {
  'net_beli:buy':   { signal: 'STRONG_ACC',   phase: 'akumulasi',  label: 'Akumulasi kuat',   color: T.acc.color,     bgColor: T.acc.bg,     description: 'Broker & insider selaras masuk' },
  'net_beli:none':  { signal: 'ACCUMULATION', phase: 'akumulasi',  label: 'Akumulasi',         color: T.acc.color,     bgColor: T.acc.bg,     description: 'Broker masuk, insider diam' },
  'net_beli:sell':  { signal: 'CONFLICT',     phase: 'netral',     label: 'Konflik',           color: T.warn.color,    bgColor: T.warn.bg,    description: 'Broker masuk tapi insider keluar' },
  'net_beli:mixed': { signal: 'CONFLICT',     phase: 'netral',     label: 'Konflik',           color: T.warn.color,    bgColor: T.warn.bg,    description: 'Broker masuk, insider campuran' },
  'netral:buy':     { signal: 'EARLY_ACC',    phase: 'netral',     label: 'Sinyal awal',       color: T.warn.color,    bgColor: T.warn.bg,    description: 'Insider mulai masuk' },
  'netral:none':    { signal: 'NEUTRAL',      phase: 'netral',     label: 'Netral',            color: T.neutral.color, bgColor: T.neutral.bg, description: 'Tidak ada pergerakan' },
  'netral:sell':    { signal: 'EARLY_DIST',   phase: 'netral',     label: 'Waspada',           color: T.warn.color,    bgColor: T.warn.bg,    description: 'Insider mulai keluar' },
  'netral:mixed':   { signal: 'EARLY_DIST',   phase: 'netral',     label: 'Waspada',           color: T.warn.color,    bgColor: T.warn.bg,    description: 'Insider campuran, broker diam' },
  'net_jual:buy':   { signal: 'CONFLICT',     phase: 'netral',     label: 'Konflik',           color: T.warn.color,    bgColor: T.warn.bg,    description: 'Broker keluar tapi insider masuk' },
  'net_jual:none':  { signal: 'DISTRIBUTION', phase: 'distribusi', label: 'Distribusi',        color: T.dist.color,    bgColor: T.dist.bg,    description: 'Broker keluar, insider diam' },
  'net_jual:sell':  { signal: 'STRONG_DIST',  phase: 'distribusi', label: 'Distribusi berat',  color: T.dist.color,    bgColor: T.dist.bg,    description: 'Broker & insider selaras keluar' },
  'net_jual:mixed': { signal: 'STRONG_DIST',  phase: 'distribusi', label: 'Distribusi berat',  color: T.dist.color,    bgColor: T.dist.bg,    description: 'Broker keluar, insider campuran' },
}

/** Classify broker direction relative to total trading volume.
 *  - Flow < 1% of total volume → netral (noise)
 *  - Actors pulling in opposite directions with large offsetting flows → netral (conflict) */
function computeBrokerDirection(
  netFlow: number,
  totalTradingValue: number,
  asingNet: number,
  lokalNet: number,
  bumnNet: number,
): BrokerDirection {
  const ratio = totalTradingValue > 0 ? Math.abs(netFlow) / totalTradingValue : 0
  if (ratio < 0.01) return 'netral' // < 1% of volume = noise

  // Detect conflict: if actors disagree significantly, treat as netral.
  // "Significant" = the minority side's flow is > 50% of the majority side.
  const positiveFlow = (asingNet > 0 ? asingNet : 0) + (lokalNet > 0 ? lokalNet : 0) + (bumnNet > 0 ? bumnNet : 0)
  const negativeFlow = Math.abs((asingNet < 0 ? asingNet : 0) + (lokalNet < 0 ? lokalNet : 0) + (bumnNet < 0 ? bumnNet : 0))
  const majority = Math.max(positiveFlow, negativeFlow)
  const minority = Math.min(positiveFlow, negativeFlow)
  if (majority > 0 && minority / majority > 0.5) return 'netral' // tug of war → conflict

  if (netFlow > 0) return 'net_beli'
  if (netFlow < 0) return 'net_jual'
  return 'netral'
}

function computeInsiderAction(insiders: InsiderTransactionRow[], days: number): InsiderAction {
  if (insiders.length === 0) return 'none'
  const hasBuy = insiders.some((t) => t.action === 'BUY')
  const hasSell = insiders.some((t) => t.action === 'SELL')
  if (hasBuy && hasSell) return 'mixed'
  if (hasSell) return 'sell'
  if (hasBuy) return 'buy'
  return 'none'
}

function getCombinedSignal(brokerDir: BrokerDirection, insiderAction: InsiderAction): CombinedSignal {
  return SIGNAL_MAP[`${brokerDir}:${insiderAction}`] ?? SIGNAL_MAP['netral:none']!
}

/* ─── insider helpers ──────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function initialsColor(action: 'BUY' | 'SELL'): string {
  return action === 'BUY' ? 'var(--color-brand-text)' : 'var(--color-negative-text)'
}

/* ─── bandar signal helpers ──────────────────────────────────────────── */

function signalColor(signal: string | null): string {
  if (!signal) return 'var(--color-text-muted)'
  const s = signal.toLowerCase()
  if (s.includes('big acc'))   return 'var(--color-brand-text)'
  if (s.includes('acc'))       return 'var(--color-brand-text)'
  if (s.includes('big dist'))  return 'var(--color-negative-text)'
  if (s.includes('dist'))      return 'var(--color-negative-text)'
  return 'var(--color-text-muted)'
}

function signalLabel(signal: string | null): string {
  if (!signal) return '—'
  const s = signal.toLowerCase()
  if (s.includes('big acc'))   return 'Akumulasi Kuat'
  if (s.includes('acc'))       return 'Akumulasi'
  if (s.includes('big dist'))  return 'Distribusi Kuat'
  if (s.includes('dist'))      return 'Distribusi'
  if (s.includes('normal'))    return 'Normal'
  return signal
}

/* ─── broker flow constants ────────────────────────────────────────── */

const BROKER_COLORS = {
  asing:      '#2EAE7B',  // green  — foreign
  bumn:       '#E8A838',  // gold   — government / SOE
  retail:     '#5B8DEF',  // blue   — domestic retail / institutional
  harga:      '#CC3333',  // red    — price line
} as const

/** Format a value that is already in Rp juta into human-readable Jt/M/T (Indonesian) */
function fmtFlowJuta(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}T`   // triliun
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(1)}M`       // miliar
  return `${sign}${abs.toFixed(0)}Jt`                                      // juta
}

/* ─── chart tooltip formatter ──────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  // Deduplicate: _pos and _neg keys map to the same series — merge them
  const merged = new Map<string, { name: string; color: string; value: number }>()
  for (const p of payload) {
    const baseKey = (p.dataKey as string).replace(/_pos$|_neg$/, '')
    const existing = merged.get(baseKey)
    if (existing) {
      existing.value += (p.value ?? 0)
    } else {
      merged.set(baseKey, { name: p.name, color: p.color, value: p.value ?? 0 })
    }
  }
  // Inject harga from the underlying data row (Area has tooltipType="none")
  const row = payload[0]?.payload
  if (row?.harga != null && !merged.has('harga')) {
    merged.set('harga', { name: 'Harga', color: BROKER_COLORS.harga, value: row.harga })
  }
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 shadow-sm font-mono text-[11px]">
      <div className="font-bold text-[var(--color-text-primary)] mb-1">{label}</div>
      {[...merged.entries()].map(([key, { name, color, value }]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[var(--color-text-muted)]">{name}:</span>
          <span style={{ color }}>
            {key === 'harga' ? `Rp ${fmtNumID(value)}` : `Rp ${fmtFlowJuta(value)}`}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── summary card ──────────────────────────────────────────────────── */

function SummaryCard({
  label, value, sub, valueClass, dot,
}: {
  label: string
  value: string
  sub: string
  valueClass?: string
  dot?: string
}) {
  return (
    <div className="border border-[var(--color-border)] px-4 py-3 flex flex-col gap-1">
      <span className="font-mono text-[10px] font-bold tracking-[0.5px] text-[var(--color-text-muted)] uppercase">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot }} />}
        <span className={`font-mono text-[18px] font-bold tracking-[-0.5px] ${valueClass ?? 'text-[var(--color-text-primary)]'}`}>
          {value}
        </span>
      </div>
      <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{sub}</span>
    </div>
  )
}

/* ─── signal summary card with hover tooltip ───────────────────────── */

const PHASE_BAR_COLOR: Record<string, string> = {
  akumulasi:  '#22C55E', // green
  distribusi: '#EF4444', // red
  netral:     '#F59E0B', // amber
}

function ConfidenceBar({ score, max, label, phase }: { score: number; max: number; label: string; phase?: string }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  const barColor = PHASE_BAR_COLOR[phase ?? 'netral'] ?? '#F59E0B'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--color-text-muted)] w-[90px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <span className="text-white w-[36px] text-right">{score}/{max}</span>
    </div>
  )
}

function SignalSummaryCard({ signal, confidence, narrative }: {
  signal: CombinedSignal | null
  confidence: ConfidenceScore | null
  narrative: Narrative | null
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      className="border border-[var(--color-border)] px-4 py-3 flex flex-col gap-1 relative cursor-default"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="font-mono text-[10px] font-bold tracking-[0.5px] text-[var(--color-text-muted)] uppercase">
        SINYAL GABUNGAN
      </span>
      <div className="flex items-center gap-1.5">
        {signal && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: signal.color }} />}
        <span className={`font-mono text-[18px] font-bold tracking-[-0.5px] ${signal ? '' : 'text-[var(--color-text-muted)]'}`}>
          {signal ? signal.label : '—'}
        </span>
        {confidence && (
          <span className="font-mono text-[11px] font-bold ml-auto" style={{ color: confidence.color }}>
            {confidence.total}/100 {confidence.label}
          </span>
        )}
      </div>
      {/* Thin confidence bar */}
      {confidence && signal && (
        <div className="h-1 bg-[var(--color-border-subtle)] rounded-full overflow-hidden mt-0.5">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${confidence.total}%`, backgroundColor: PHASE_BAR_COLOR[signal.phase] ?? '#F59E0B' }}
          />
        </div>
      )}
      <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
        {narrative?.conclusion ?? (signal ? signal.description : 'Belum ada data')}
      </span>

      {/* Confidence breakdown tooltip on hover */}
      {hover && signal && confidence && (
        <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-[var(--color-bg-inset)] text-[var(--color-text-primary)] border border-[var(--color-border)] px-4 py-3 rounded-lg shadow-xl font-mono text-[10px] leading-relaxed">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: signal.color }} />
            <span className="text-[12px] font-bold">{signal.label}</span>
            <span className="text-[var(--color-text-muted)]">{signal.signal}</span>
            <span className="ml-auto font-bold text-[12px]" style={{ color: confidence.color }}>
              {confidence.total}/100
            </span>
          </div>

          {/* Narrative detail */}
          {narrative && (
            <div className="border-t border-[#444] pt-2 pb-1 text-[11px] text-[#ccc] leading-snug">
              {narrative.detail}
            </div>
          )}

          {/* 5-component breakdown bars */}
          <div className="border-t border-[#444] pt-2 space-y-1.5">
            <ConfidenceBar score={confidence.components.brokerMagnitude} max={25} label="Flow magnitude" phase={signal.phase} />
            <ConfidenceBar score={confidence.components.foreignAlignment} max={25} label="Asing alignment" phase={signal.phase} />
            <ConfidenceBar score={confidence.components.bandarConfirmation} max={20} label="Bandar confirm" phase={signal.phase} />
            <ConfidenceBar score={confidence.components.insiderWeight} max={15} label="Insider weight" phase={signal.phase} />
            <ConfidenceBar score={confidence.components.brokerConcentration} max={15} label="Konsentrasi" phase={signal.phase} />
          </div>

          {/* Explanations */}
          <div className="border-t border-[#444] mt-2 pt-2 space-y-1 text-[9px] text-[#999]">
            <div>{confidence.explanations.brokerMagnitude}</div>
            <div>{confidence.explanations.foreignAlignment}</div>
            <div>{confidence.explanations.bandarConfirmation}</div>
            <div>{confidence.explanations.insiderWeight}</div>
            <div>{confidence.explanations.brokerConcentration}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── daily flow bar chart (Tab 1) — diverging stacked ──────────────── */

/** Aggregate daily flow rows into ISO-week buckets (Mon–Fri).
 *  Returns summed flows + last close_price per week. */
function aggregateToWeekly(data: DailyFlowByType[]): DailyFlowByType[] {
  const weeks = new Map<string, DailyFlowByType & { _count: number }>()
  for (const d of data) {
    // ISO week key: get Monday of the week
    const dt = new Date(d.trade_date + 'T00:00:00')
    const day = dt.getDay()
    const diff = day === 0 ? -6 : 1 - day // shift to Monday
    const mon = new Date(dt)
    mon.setDate(dt.getDate() + diff)
    const weekKey = mon.toISOString().slice(0, 10)

    const existing = weeks.get(weekKey)
    if (existing) {
      existing.asing_net += d.asing_net
      existing.lokal_net += d.lokal_net
      existing.pemerintah_net += d.pemerintah_net
      existing.asing_buy += d.asing_buy
      existing.asing_sell += d.asing_sell
      existing.lokal_buy += d.lokal_buy
      existing.lokal_sell += d.lokal_sell
      existing.close_price = d.close_price ?? existing.close_price // last price in the week
      existing._count++
    } else {
      weeks.set(weekKey, { ...d, trade_date: weekKey, _count: 1 })
    }
  }
  return Array.from(weeks.values())
    .sort((a, b) => a.trade_date.localeCompare(b.trade_date))
}

function DailyFlowChart({ data }: { data: DailyFlowByType[] }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Aggregate to weekly when > 90 data points to keep bars readable
  const isWeekly = data.length > 90

  // Split each type into _pos / _neg so positive bars stack upward,
  // negative bars stack downward — true diverging bar chart.
  const chartData = useMemo(() => {
    const source = isWeekly ? aggregateToWeekly(data) : data
    return source.map((d) => {
      const asing = d.asing_net / 1e6
      const bumn  = d.pemerintah_net / 1e6
      const retail = d.lokal_net / 1e6
      return {
        date:        d.trade_date.slice(5), // MM-DD
        bumn_pos:    bumn > 0 ? bumn : 0,
        bumn_neg:    bumn < 0 ? bumn : 0,
        asing_pos:   asing > 0 ? asing : 0,
        asing_neg:   asing < 0 ? asing : 0,
        retail_pos:  retail > 0 ? retail : 0,
        retail_neg:  retail < 0 ? retail : 0,
        harga:       d.close_price,
      }
    })
  }, [data, isWeekly])

  if (!mounted) {
    return <div className="h-[300px] bg-[var(--color-bg-inset)] rounded animate-pulse" />
  }

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] border border-dashed border-[var(--color-border)] flex items-center justify-center bg-[var(--color-bg-inset)]">
        <span className="font-mono text-[11px] text-[var(--color-text-ghost)]">Belum ada data broker flow</span>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#888' }}
          tickLine={false}
          axisLine={{ stroke: '#E0E0E5' }}
        />
        <YAxis
          yAxisId="flow"
          tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#888' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtFlowJuta}
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#888' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `Rp ${fmtNumID(v)}`}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.12)', strokeWidth: 28, fill: 'none' }} />
        <Legend
          wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }}
          iconType="square"
          iconSize={8}
          payload={[
            { value: 'BUMN',   type: 'square', color: BROKER_COLORS.bumn },
            { value: 'Asing',  type: 'square', color: BROKER_COLORS.asing },
            { value: 'Retail', type: 'square', color: BROKER_COLORS.retail },
            { value: 'Harga',  type: 'line',   color: BROKER_COLORS.harga },
          ]}
        />
        <ReferenceLine yAxisId="flow" y={0} stroke="#E0E0E5" />
        {/* Positive stack (upward) */}
        <Bar yAxisId="flow" dataKey="bumn_pos"   name="BUMN"   fill={BROKER_COLORS.bumn}   stackId="pos" />
        <Bar yAxisId="flow" dataKey="asing_pos"  name="Asing"  fill={BROKER_COLORS.asing}  stackId="pos" />
        <Bar yAxisId="flow" dataKey="retail_pos" name="Retail" fill={BROKER_COLORS.retail} stackId="pos" />
        {/* Negative stack (downward) */}
        <Bar yAxisId="flow" dataKey="bumn_neg"   name="BUMN"   fill={BROKER_COLORS.bumn}   stackId="neg" legendType="none" />
        <Bar yAxisId="flow" dataKey="asing_neg"  name="Asing"  fill={BROKER_COLORS.asing}  stackId="neg" legendType="none" />
        <Bar yAxisId="flow" dataKey="retail_neg" name="Retail" fill={BROKER_COLORS.retail} stackId="neg" legendType="none" />
        {/* Price overlay — rendered as Area with transparent fill so only
            Bar components drive the tooltip cursor (block highlight) */}
        <Area
          yAxisId="price" dataKey="harga" name="Harga"
          stroke={BROKER_COLORS.harga} strokeWidth={2}
          fill="transparent"
          dot={false} activeDot={{ r: 4, fill: BROKER_COLORS.harga, stroke: '#fff', strokeWidth: 2 }}
          type="monotone"
          tooltipType="none"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ─── cumulative flow line chart (Tab 2) ────────────────────────────── */

function CumulativeFlowChart({ data }: { data: DailyFlowByType[] }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const chartData = useMemo(() => {
    let cumAging = 0, cumLokal = 0, cumDom = 0
    return data.map((d) => {
      cumLokal += d.lokal_net
      cumAging += d.asing_net
      cumDom += d.pemerintah_net
      return {
        date: d.trade_date.slice(5),
        lokal: cumLokal / 1e6,
        asing: cumAging / 1e6,
        domestik: cumDom / 1e6,
        harga: d.close_price,
      }
    })
  }, [data])

  if (!mounted) {
    return <div className="h-[300px] bg-[var(--color-bg-inset)] rounded animate-pulse" />
  }

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] border border-dashed border-[var(--color-border)] flex items-center justify-center bg-[var(--color-bg-inset)]">
        <span className="font-mono text-[11px] text-[var(--color-text-ghost)]">Belum ada data kumulatif</span>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#888' }}
          tickLine={false}
          axisLine={{ stroke: '#E0E0E5' }}
        />
        <YAxis
          yAxisId="flow"
          tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#888' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtFlowJuta}
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#888' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `Rp ${fmtNumID(v)}`}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }}
          iconType="line"
          iconSize={12}
        />
        <ReferenceLine yAxisId="flow" y={0} stroke="#E0E0E5" />
        <Line
          yAxisId="flow" dataKey="lokal" name="Retail"
          stroke={BROKER_COLORS.retail} strokeWidth={2} dot={false} type="monotone"
        />
        <Line
          yAxisId="flow" dataKey="asing" name="Asing"
          stroke={BROKER_COLORS.asing} strokeWidth={2} dot={false} type="monotone"
        />
        <Line
          yAxisId="flow" dataKey="domestik" name="BUMN"
          stroke={BROKER_COLORS.bumn} strokeWidth={1.5} dot={false} type="monotone"
        />
        <Line
          yAxisId="price" dataKey="harga" name="Harga"
          stroke={BROKER_COLORS.harga} strokeWidth={2} dot={false} type="monotone"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/* ─── broker identification table (Tab 3) ──────────────────────────── */

function BandarExplanationBox() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-4 py-3 mt-1">
      <div className="font-mono text-[10px] text-[var(--color-text-muted)] leading-relaxed flex flex-col gap-2">
        <div>
          <strong className="text-[var(--color-text-dim)]">Cara baca tabel:</strong> Broker dengan badge{' '}
          <span className="text-red-700 font-bold">Kandidat bandar</span> memiliki konsentrasi tinggi,
          arah konsisten, dan spesifik di saham ini. Platform broker (CC, YP, XL, XC, PD) diabaikan
          karena mewakili order retail yang tersebar.
        </div>

        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-left text-[10px] font-bold text-[var(--color-brand-text)] hover:text-[var(--color-brand)] font-mono"
          >
            Selengkapnya...
          </button>
        )}

        {expanded && (
          <>
            <div className="border-t border-[var(--color-border)] pt-2 flex flex-col gap-2">
              <div>
                <strong className="text-[var(--color-text-dim)]">TIER</strong> — Seberapa besar dan konsisten arah broker:
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  <li><span className="text-red-700 font-bold">A</span> — Konsentrasi &ge;8% + arah konsisten &ge;65% hari</li>
                  <li><span className="text-orange-700 font-bold">A2</span> — Konsentrasi &ge;5% + arah konsisten &ge;70% hari</li>
                  <li><span className="text-yellow-700 font-bold">B</span> — Konsentrasi &ge;3% + arah konsisten &ge;75% hari</li>
                </ul>
              </div>

              <div>
                <strong className="text-[var(--color-text-dim)]">SPESIFIK</strong> — Apakah broker ini fokus di saham ini atau aktif di mana-mana?
                <br />Dihitung: volume broker di saham ini / rata-rata volume broker di semua saham.
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  <li><span className="text-emerald-700 font-bold">&ge;3.0x</span> SPECIFIC — broker ini menaruh uang jauh lebih banyak di saham ini dari biasanya</li>
                  <li><span className="text-amber-700 font-bold">&ge;1.5x</span> ELEVATED — di atas rata-rata, perlu diperhatikan</li>
                  <li><span className="text-gray-400 font-bold">&lt;1.5x</span> UBIQ — broker ini sama aktifnya di mana-mana (bukan sinyal bandar)</li>
                </ul>
              </div>

              <div>
                <strong className="text-[var(--color-text-dim)]">CR (Counter-Retail)</strong> — Broker bergerak berlawanan arah dengan platform retail.
                <br />Contoh: retail (CC, XL, YP) net jual, tapi broker ini net beli = potensi akumulasi saat retail panik.
              </div>

              <div className="border-t border-[var(--color-border)] pt-2 flex flex-col gap-1">
                <div>
                  <strong className="text-[var(--color-text-dim)]">Kesimpulan:</strong> Broker dengan tier A/A2 + SPECIFIC + counter-retail = kandidat bandar paling kuat.
                  Broker UBIQ (spesifisitas rendah) meskipun tier A biasanya hanya institusi besar yang aktif di semua saham.
                </div>
                <div>
                  <span className="inline-block w-3 h-2 bg-amber-400 mr-1 align-middle" />
                  <span className="text-amber-600 font-bold">(Big Player)</span> — broker dengan konsentrasi &ge;15%.
                  Uang sebesar ini tidak bisa disembunyikan — perhatikan arah dan konsistensinya.
                </div>
              </div>
            </div>

            <button
              onClick={() => setExpanded(false)}
              className="text-left text-[10px] font-bold text-[var(--color-brand-text)] hover:text-[var(--color-brand)] font-mono"
            >
              Sembunyikan
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ThTip({ children, tip, align = 'left' }: { children: React.ReactNode; tip: string; align?: 'left' | 'right' | 'center' }) {
  const textAlign = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  return (
    <th className={`${textAlign} px-2 py-2 font-bold text-[var(--color-text-muted)] text-[10px]`}>
      <span className="relative group border-b border-dashed border-[#BBBBBB] cursor-help">
        {children}
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-52 px-2.5 py-1.5 rounded bg-[#1A1A1A] text-[9px] text-white font-normal leading-snug text-left opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-normal shadow-lg">
          {tip}
        </span>
      </span>
    </th>
  )
}

function TierBadge({ tier }: { tier: BrokerConcentrationRow['tier'] }) {
  if (!tier) return <span className="font-mono text-[10px] text-[#CCCCCC]">--</span>
  const cfg = {
    A:  { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500' },
    A2: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    B:  { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  }
  const c = cfg[tier]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {tier}
    </span>
  )
}

function SpecificityBadge({ label, value }: { label: BrokerConcentrationRow['specificity_label']; value: number | null }) {
  if (!label || value == null) return <span className="font-mono text-[10px] text-[#CCCCCC]">--</span>
  const cfg = {
    SPECIFIC: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    ELEVATED: { bg: 'bg-amber-50',   text: 'text-amber-700' },
    UBIQ:     { bg: 'bg-gray-100',   text: 'text-gray-400' },
  }
  const c = cfg[label]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${c.bg} ${c.text}`}>
      {value.toFixed(1)}x
    </span>
  )
}

function StatusBadge({ status }: { status: BrokerConcentrationRow['status'] }) {
  const config = {
    kandidat_bandar: { label: 'Kandidat bandar', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    asing:           { label: 'Asing',           bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    retail:          { label: 'Retail/domestik', bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  }
  const c = config[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

function BrokerIdentificationTable({
  rows,
  daysCount,
}: {
  rows: BrokerConcentrationRow[]
  daysCount: number
}) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-mono text-[11px] text-[var(--color-text-ghost)]">Belum ada data broker</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] text-[var(--color-text-muted)] leading-relaxed hidden sm:block">
        Algoritma 3-layer analisis {daysCount} hari: konsentrasi + konsistensi arah + spesifisitas saham + counter-retail
      </span>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-[11px] font-mono">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-inset)]">
              <th className="text-left px-2 py-2 font-bold text-[var(--color-text-muted)] text-[10px]">BROKER</th>
              <ThTip align="right" tip="Total nilai transaksi neto (beli - jual) dalam Rupiah selama periode terpilih">NET FLOW</ThTip>
              <ThTip align="right" tip="Rata-rata harga beli (B) dan jual (S) per lembar saham — menunjukkan di level harga berapa broker ini bertransaksi">AVG PRICE</ThTip>
              <ThTip align="right" tip="Jumlah lot neto yang dikumpulkan (+) atau dilepas (-) oleh broker — menunjukkan seberapa besar posisi yang dibangun">NET LOT</ThTip>
              <ThTip align="right" tip="Persentase volume transaksi broker ini dibanding total semua broker — semakin besar, semakin dominan">KONSEN%</ThTip>
              <ThTip align="right" tip="Seberapa konsisten arah transaksi harian — contoh: 80% berarti 8 dari 10 hari broker ini net beli (atau jual) terus-menerus">KONSIST%</ThTip>
              <ThTip align="center" tip="Klasifikasi kekuatan sinyal: A (konsen &ge;8% + konsist &ge;65%), A2 (5%+70%), B (3%+75%)">TIER</ThTip>
              <ThTip align="center" tip="Seberapa spesifik broker fokus di saham ini vs saham lain — 3.0x berarti broker ini menaruh 3x lebih banyak uang di sini dari biasanya">SPESIFIK</ThTip>
              <ThTip align="center" tip="Counter-Retail — broker bergerak berlawanan arah dengan platform retail (CC, YP, XL, XC, PD)">CR</ThTip>
              <ThTip align="right" tip="Kesimpulan: Kandidat bandar (tier + spesifik), Asing (institusi asing), atau Retail/domestik">STATUS</ThTip>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const netColor = r.total_net_value > 0 ? 'text-emerald-600' : r.total_net_value < 0 ? 'text-red-500' : 'text-[var(--color-text-muted)]'
              const rowOpacity = r.is_platform ? 'opacity-50' : ''
              const highConc = !r.is_platform && r.concentration_pct >= 15
              return (
                <tr key={r.broker_code} className={`border-b last:border-0 ${rowOpacity} ${highConc ? 'border-l-2 border-l-amber-400 bg-amber-50/40 border-b-[#E0E0E5]' : 'border-b-[#E0E0E5]'}`}>
                  <td className="px-2 py-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-[var(--color-text-primary)]">
                        {r.broker_code}
                        {r.is_platform && <span className="ml-1 text-[9px] text-[var(--color-text-ghost)] font-normal">(Platform)</span>}
                        {highConc && <span className="ml-1 text-[9px] text-amber-600 font-bold">(Big Player)</span>}
                      </span>
                      {r.broker_name && (
                        <span className="text-[9px] text-[var(--color-text-ghost)] leading-tight">{r.broker_name}</span>
                      )}
                    </div>
                  </td>
                  <td className={`px-2 py-2 text-right font-semibold ${netColor}`}>
                    <div className="flex flex-col items-end">
                      <span>{r.total_net_value > 0 ? '+' : ''}{formatIDRCompact(r.total_net_value)}</span>
                      <span className="text-[9px] text-[var(--color-text-ghost)] font-normal">{r.net_direction}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex flex-col items-end text-[10px]">
                      {r.avg_buy_price != null
                        ? <span className="text-emerald-600">B {fmtNumID(r.avg_buy_price)}</span>
                        : <span className="text-[#CCCCCC]">—</span>}
                      {r.avg_sell_price != null
                        ? <span className="text-red-400">S {fmtNumID(r.avg_sell_price)}</span>
                        : <span className="text-[#CCCCCC]">—</span>}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`font-semibold ${r.net_lot > 0 ? 'text-emerald-600' : r.net_lot < 0 ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                        {r.net_lot > 0 ? '+' : ''}{fmtNumID(r.net_lot)}
                      </span>
                      <span className="text-[9px] text-[var(--color-text-ghost)]">{fmtNumID(r.net_lot * 100)} shrs</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-[var(--color-text-primary)]">{r.concentration_pct.toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[var(--color-text-primary)]">{r.dir_pct}%</span>
                      <span className="text-[9px] text-[var(--color-text-ghost)]">{r.buy_days}B/{r.sell_days}S/{r.active_days}T</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.is_platform ? <span className="text-[10px] text-[#CCCCCC]">--</span> : <TierBadge tier={r.tier} />}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {r.is_platform
                      ? <span className="text-[10px] text-[#CCCCCC]">--</span>
                      : <SpecificityBadge label={r.specificity_label} value={r.specificity} />}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {!r.is_platform && r.counter_retail
                      ? <span className="text-[10px] text-amber-600 font-bold">CR</span>
                      : <span className="text-[10px] text-[#CCCCCC]">--</span>}
                  </td>
                  <td className="px-2 py-2 text-right"><StatusBadge status={r.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <BandarExplanationBox />
    </div>
  )
}

/* ─── insider filings table (Tab 4) ────────────────────────────────── */

function InsiderFilingsTab({ rows }: { rows: InsiderTransactionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-mono text-[11px] text-[var(--color-text-ghost)]">Belum ada data insider filing</span>
      </div>
    )
  }

  const sellTxns = rows.filter((r) => r.action === 'SELL')
  const buyTxns = rows.filter((r) => r.action === 'BUY')
  const totalSellLots = sellTxns.reduce((s, r) => s + r.share_change, 0)
  const totalBuyLots = buyTxns.reduce((s, r) => s + r.share_change, 0)
  const totalSellValue = sellTxns.reduce((s, r) => s + (r.total_value ?? 0), 0)
  const totalBuyValue = buyTxns.reduce((s, r) => s + (r.total_value ?? 0), 0)

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] text-[var(--color-text-muted)] leading-relaxed hidden sm:block">
        Filing transaksi orang dalam (OJK) — {rows.length} transaksi terakhir
      </span>

      <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
        <table className="w-full text-[12px] font-mono">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-inset)]">
              <th className="text-left px-3 py-2 font-bold text-[var(--color-text-muted)] text-[11px]">TANGGAL</th>
              <th className="text-left px-3 py-2 font-bold text-[var(--color-text-muted)] text-[11px]">NAMA</th>
              <th className="text-center px-3 py-2 font-bold text-[var(--color-text-muted)] text-[11px]">AKSI</th>
              <th className="text-right px-3 py-2 font-bold text-[var(--color-text-muted)] text-[11px]">SAHAM</th>
              <th className="text-right px-3 py-2 font-bold text-[var(--color-text-muted)] text-[11px]">HARGA</th>
              <th className="text-right px-3 py-2 font-bold text-[var(--color-text-muted)] text-[11px]">NILAI</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.insider_name}-${r.transaction_date}-${i}`} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-3 py-2 text-[var(--color-text-muted)] whitespace-nowrap">{r.transaction_date}</td>
                <td className="px-3 py-2 text-[var(--color-text-primary)] font-semibold truncate max-w-[200px]">{r.insider_name}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    r.action === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {r.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">{fmtNumID(r.share_change)}</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-muted)]">{r.price != null ? fmtNumID(r.price) : '—'}</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">{r.total_value != null ? formatIDRCompact(r.total_value) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pattern detection box */}
      {(sellTxns.length > 0 || buyTxns.length > 0) && (
        <div className="border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-4 py-3 mt-1">
          <span className="font-mono text-[11px] font-bold text-[var(--color-text-primary)]">Pola: </span>
          <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
            {sellTxns.length > 0 && buyTxns.length === 0 && (
              <>Insider menjual total <strong className="text-[var(--color-text-primary)]">{fmtNumID(totalSellLots)} lot</strong>{totalSellValue > 0 && <> ({formatIDRCompact(totalSellValue)})</>}. Tidak ada insider buy — sinyal distribusi.</>
            )}
            {buyTxns.length > 0 && sellTxns.length === 0 && (
              <>Insider membeli total <strong className="text-[var(--color-text-primary)]">{fmtNumID(totalBuyLots)} lot</strong>{totalBuyValue > 0 && <> ({formatIDRCompact(totalBuyValue)})</>}. Tidak ada insider sell — sinyal akumulasi.</>
            )}
            {buyTxns.length > 0 && sellTxns.length > 0 && (
              <>Campuran: {sellTxns.length} jual ({fmtNumID(totalSellLots)} lot) + {buyTxns.length} beli ({fmtNumID(totalBuyLots)} lot).</>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

/* ─── bandar signal detail ───────────────────────────────────────────── */

function BandarSignalDetail({ signal }: { signal: BandarSignalRow }) {
  const levels = [
    { label: 'Overall', value: signal.broker_accdist },
    { label: 'Top 1',   value: signal.top1_accdist },
    { label: 'Top 3',   value: signal.top3_accdist },
    { label: 'Top 5',   value: signal.top5_accdist },
    { label: 'Top 10',  value: signal.top10_accdist },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4 flex-wrap">
        {levels.map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">{l.label}:</span>
            <span
              className="font-mono text-[11px] font-bold px-2 py-0.5 rounded"
              style={{ color: signalColor(l.value), backgroundColor: `${signalColor(l.value)}15` }}
            >
              {signalLabel(l.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[11px] font-mono text-[var(--color-text-muted)]">
        <span>Buyer: {signal.total_buyer ?? '—'}</span>
        <span>Seller: {signal.total_seller ?? '—'}</span>
        <span>Data: {signal.trade_date}</span>
      </div>
    </div>
  )
}

/* ─── signal matrix (3x3 grid) ─────────────────────────────────────── */

function SignalMatrix({ currentBroker, currentInsider, confidence }: {
  currentBroker: BrokerDirection
  currentInsider: InsiderAction
  confidence: ConfidenceScore
}) {
  const brokerLabels: { key: BrokerDirection; label: string }[] = [
    { key: 'net_beli', label: 'Broker net beli' },
    { key: 'netral',   label: 'Broker netral' },
    { key: 'net_jual', label: 'Broker net jual' },
  ]
  const insiderLabels: { key: InsiderAction; label: string }[] = [
    { key: 'buy',  label: 'Insider beli' },
    { key: 'none', label: 'Tidak ada' },
    { key: 'sell', label: 'Insider jual' },
  ]

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] font-bold text-[var(--color-text-primary)]">
        Semua kombinasi — sinyal gabungan
      </span>
      <div className="overflow-x-auto">
      <div className="grid grid-cols-4 gap-0 min-w-[280px]">
        {/* Header row */}
        <div />
        {insiderLabels.map((il) => (
          <div key={il.key} className="text-center font-mono text-[10px] font-bold text-[var(--color-text-muted)] py-2">
            {il.label}
          </div>
        ))}

        {/* Data rows */}
        {brokerLabels.map((bl) => (
          <React.Fragment key={bl.key}>
            <div className="flex items-center font-mono text-[10px] font-bold text-[var(--color-text-muted)] pr-2">
              {bl.label}
            </div>
            {insiderLabels.map((il) => {
              const sig = getCombinedSignal(bl.key, il.key)
              const isCurrent = bl.key === currentBroker && il.key === currentInsider
              return (
                <div
                  key={`${bl.key}-${il.key}`}
                  className={`px-2 py-2 border ${isCurrent ? 'border-[var(--color-text-primary)] border-2' : 'border-[var(--color-border)]'}`}
                  style={{ backgroundColor: sig.bgColor }}
                >
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[11px] font-bold" style={{ color: sig.color }}>
                      {sig.label}
                    </span>
                    {isCurrent && (
                      <span className="font-mono text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: confidence.color, color: 'var(--color-text-primary)' }}>
                        {confidence.total}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[9px] text-[var(--color-text-muted)]">
                    {sig.description}
                  </div>
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>
      </div>
    </div>
  )
}

/* ─── signal matrix modal (CTA + overlay) ──────────────────────────── */

function SignalMatrixModal({ currentBroker, currentInsider, confidence }: {
  currentBroker: BrokerDirection
  currentInsider: InsiderAction
  confidence: ConfidenceScore
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="px-4 md:px-6 pb-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1.5"
        >
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-ghost)] font-mono text-[8px] leading-none select-none">?</span>
          Pelajari 9 kombinasi sinyal
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border)] shadow-[0_4px_24px_rgba(26,25,24,0.12)] w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] shrink-0">
              <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">MATRIKS SINYAL GABUNGAN</span>
              <button
                onClick={() => setOpen(false)}
                className="text-[#9C9B99] hover:text-[var(--color-text-primary)] text-lg leading-none transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <SignalMatrix
                currentBroker={currentBroker}
                currentInsider={currentInsider}
                confidence={confidence}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── skeleton ──────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse p-6">
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 h-[90px] bg-[var(--color-bg-inset)] rounded" />
        ))}
      </div>
      <div className="h-[300px] bg-[var(--color-bg-inset)] rounded" />
    </div>
  )
}

/* ─── broker table (right panel) ────────────────────────────────────── */

function BrokerTable({ buckets, netBrokerFlow }: { buckets: StockBrokerBucket[]; netBrokerFlow: number }) {
  return (
    <div className="bg-[var(--color-bg-card)] flex flex-col min-h-full">
      <div className="px-5 py-3">
        <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">
          TOP BROKER ACTIVITY
        </span>
      </div>

      <div className="flex items-center px-3 py-2 border-y border-[var(--color-border)] bg-[var(--color-bg-inset)]">
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] flex-1">BROKER</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] w-[104px] text-right">BUY VOL</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] w-[104px] text-right">SELL VOL</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] w-[104px] text-right">NET</span>
      </div>

      <div className="flex-1">
        {buckets.length > 0 ? (
          buckets.map((b) => {
            const net = b.total_net_value
            const netColor = net > 0 ? 'text-emerald-500' : net < 0 ? 'text-red-400' : 'text-[var(--color-text-muted)]'
            return (
              <div key={b.broker_code} className="flex items-center px-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
                <span className="font-mono text-[12px] font-semibold text-[var(--color-text-primary)] flex-1 truncate flex items-center gap-1.5">
                  {b.broker_code}
                  <TypeBadge type={b.broker_type} />
                </span>
                <span className="font-mono text-[12px] text-emerald-500 w-[104px] text-right">
                  {formatIDRCompact(b.total_buy_value)}
                </span>
                <span className="font-mono text-[12px] text-red-400 w-[104px] text-right">
                  {formatIDRCompact(b.total_sell_value)}
                </span>
                <span className={`font-mono text-[12px] font-semibold w-[104px] text-right ${netColor}`}>
                  {net > 0 ? '+' : ''}{formatIDRCompact(net)}
                </span>
              </div>
            )
          })
        ) : (
          <div className="flex items-center justify-center py-12">
            <span className="font-mono text-[11px] text-[var(--color-text-ghost)]">Belum ada data broker</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-inset)]">
        <span className="font-mono text-[12px] font-bold text-[var(--color-text-muted)]">NET BROKER FLOW</span>
        <span className={`font-mono text-[13px] font-bold ${
          buckets.length === 0 ? 'text-[var(--color-text-muted)]' : netBrokerFlow >= 0 ? 'text-emerald-500' : 'text-red-400'
        }`}>
          {buckets.length === 0 ? '—' : `${netBrokerFlow >= 0 ? '+' : ''}${formatIDRCompact(netBrokerFlow)}`}
        </span>
      </div>
    </div>
  )
}

/* ─── broker type badge ──────────────────────────────────────────────── */

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null
  const colors: Record<string, string> = {
    'Asing':       'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]',
    'Lokal':       'bg-gray-100 text-gray-600',
    'Pemerintah':  'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${colors[type] ?? 'bg-gray-100 text-gray-500'}`}>
      {type === 'Asing' ? 'F' : type === 'Pemerintah' ? 'G' : 'D'}
    </span>
  )
}

/* ─── main widget ───────────────────────────────────────────────────── */

interface Props {
  ticker: string
  initialData: StockBrokerSummary | null
  insiderTransactions: InsiderTransactionRow[]
  dailyBrokerFlow: DailyFlowByType[]
  brokerConcentration: BrokerConcentrationRow[]
}

export function BrokerActivityWidget({
  ticker,
  initialData,
  insiderTransactions,
  dailyBrokerFlow: initialDailyFlow,
  brokerConcentration: initialConcentration,
}: Props) {
  const [data, setData] = useState<StockBrokerSummary | null>(initialData)
  const [dailyFlow, setDailyFlow] = useState<DailyFlowByType[]>(initialDailyFlow)
  const [concentration, setConcentration] = useState<BrokerConcentrationRow[]>(initialConcentration)
  const [days, setDays] = useState(30)
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('daily')
  const [maxAvailableDays, setMaxAvailableDays] = useState<number | null>(null)
  const maxRef = React.useRef<number | null>(null) // ref for use inside callbacks without stale closures

  const fetchAndApply = useCallback(async (d: number, ed: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ days: String(d), mode: 'smart-money' })
      if (ed) params.set('endDate', ed)
      const res = await fetch(`/api/stocks/${ticker}/broker?${params}`)
      if (!res.ok) throw new Error(`Broker API ${res.status}`)
      const json: SmartMoneyData | null = await res.json()
      if (json) {
        setData(json.summary)
        setDailyFlow(json.dailyFlow)
        setConcentration(json.concentration)
        // Every response tells us the actual data ceiling:
        // if we asked for more than came back, that IS the max.
        const actual = json.summary.daysCount
        if (actual < d && (maxRef.current === null || actual < maxRef.current)) {
          maxRef.current = actual
          setMaxAvailableDays(actual)
        }
      }
      return json
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [ticker])

  // Track whether user has changed filters
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // On mount: fetch max range (200D) to learn the data ceiling,
  // then auto-select the best matching preset
  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    const init = async () => {
      const json = await fetchAndApply(200, '')
      if (cancelled || !json) return
      const actual = json.summary.daysCount
      maxRef.current = actual
      setMaxAvailableDays(actual)
      // Auto-select the lowest preset that covers all available data (round up)
      const bestPreset = DURATION_PRESETS.find((p) => p.days >= actual)
      const targetDays = bestPreset?.days ?? 30
      setDays(targetDays)
      // Only re-fetch if the best preset is less than what we already have
      if (targetDays < actual) {
        await fetchAndApply(targetDays, '')
      }
    }
    init()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, ticker])

  // Compute aggregates
  const allBuckets = data ? mergeBuckets(data) : []
  const topBuckets = allBuckets.slice(0, 8)
  const bucketBuy = allBuckets.reduce((s, b) => s + b.total_buy_value, 0)
  const bucketSell = allBuckets.reduce((s, b) => s + b.total_sell_value, 0)
  const netFlow = bucketBuy - bucketSell

  // Total trading volume from dailyFlow (all brokers, not just top buckets)
  const totalBuy = dailyFlow.reduce((s, d) => s + d.asing_buy + d.lokal_buy, 0)
  const totalSell = dailyFlow.reduce((s, d) => s + d.asing_sell + d.lokal_sell, 0)
  const totalTradingValue = totalBuy + totalSell

  // Compute per-actor flows from daily data
  const asingNetFlow = dailyFlow.reduce((s, d) => s + d.asing_net, 0)
  const lokalNetFlow = dailyFlow.reduce((s, d) => s + d.lokal_net, 0)
  const bumnNetFlow = dailyFlow.reduce((s, d) => s + d.pemerintah_net, 0)

  // Filter insider transactions to match broker data date range
  const insidersInRange = useMemo(() => {
    if (dailyFlow.length === 0) return insiderTransactions
    const earliest = dailyFlow[0]?.trade_date
    const latest = dailyFlow[dailyFlow.length - 1]?.trade_date
    if (!earliest || !latest) return insiderTransactions
    const from = earliest < latest ? earliest : latest
    const to = earliest < latest ? latest : earliest
    return insiderTransactions.filter((t) => t.transaction_date >= from && t.transaction_date <= to)
  }, [insiderTransactions, dailyFlow])

  // Compute insider summary (only transactions within broker data period)
  const insiderBuyCount = insidersInRange.filter((t) => t.action === 'BUY').length
  const insiderSellCount = insidersInRange.filter((t) => t.action === 'SELL').length
  const insiderAction = computeInsiderAction(insidersInRange, days)

  // Compute combined signal
  const brokerDirection = computeBrokerDirection(netFlow, totalTradingValue, asingNetFlow, lokalNetFlow, bumnNetFlow)
  const combinedSignal = getCombinedSignal(brokerDirection, insiderAction)

  const bandar = data?.bandarSignal ?? null

  // Confidence score + narrative — layers all available data on top of the 9-signal truth table
  const confidenceInput = useMemo(() => ({
    signal: combinedSignal.signal,
    phase: combinedSignal.phase,
    netFlow,
    totalTradingValue: totalTradingValue,
    asingNetFlow,
    lokalNetFlow,
    pemerintahNetFlow: bumnNetFlow,
    bandarSignal: bandar,
    insiderTransactions: insidersInRange,
    concentration,
  }), [combinedSignal.signal, combinedSignal.phase, netFlow, totalBuy, totalSell, asingNetFlow, dailyFlow, bandar, insidersInRange, concentration])
  const confidence = useMemo(() => computeConfidenceScore(confidenceInput), [confidenceInput])
  const narrative = useMemo(() => generateNarrativeText(confidenceInput), [confidenceInput])

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] flex flex-col">
      {/* header */}
      <div className="px-4 md:px-5 py-3 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)] shrink-0">AKTIVITAS BROKER</span>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 shrink-0">
            {DURATION_PRESETS.map((p) => {
              // Disable presets above the rounded-up best fit.
              // e.g. max=72 → best fit=90D, so disable 120D and 200D
              const bestFit = maxAvailableDays !== null
                ? (DURATION_PRESETS.find((pr) => pr.days >= maxAvailableDays)?.days ?? 200)
                : null
              const exceeds = bestFit !== null && p.days > bestFit
              return (
                <button
                  key={p.days}
                  disabled={exceeds || loading}
                  title={exceeds ? `Data tersedia: ${maxAvailableDays} hari trading` : `${p.days} hari trading`}
                  onClick={() => {
                    if (exceeds) return
                    setDays(p.days)
                    fetchAndApply(p.days, endDate)
                  }}
                  className={`font-mono text-[11px] font-bold px-2 py-1 border transition-colors ${
                    exceeds
                      ? 'bg-[#F5F5F5] text-[#CCCCCC] border-[var(--color-border)] cursor-not-allowed line-through'
                      : days === p.days
                        ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] border-[var(--color-brand)]'
                        : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-text-primary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
            {maxAvailableDays !== null && (
              <span className="font-mono text-[10px] text-[var(--color-text-ghost)] ml-1 hidden sm:inline whitespace-nowrap">
                max {maxAvailableDays}D
              </span>
            )}
          </div>
          {mounted && (
            <input
              type="date"
              value={endDate}
              onChange={(e) => { const ed = e.target.value; setEndDate(ed); fetchAndApply(days, ed) }}
              className="font-mono text-[11px] text-[var(--color-text-primary)] border border-[var(--color-border)] px-2 py-1 bg-[var(--color-bg-card)] focus:outline-none focus:border-[var(--color-text-primary)] w-[110px] hidden md:block shrink-0"
            />
          )}
          {data?.dateRange && !loading && (
            <span className="font-mono text-[11px] text-[var(--color-text-muted)] whitespace-nowrap hidden sm:inline shrink-0">
              {data.daysCount}D: {data.dateRange}
            </span>
          )}
        </div>
      </div>

      {/* body */}
      {loading ? (
        <Skeleton />
      ) : (
        <div className="flex">
          {/* ── left panel ─────────────────────────────────── */}
          <div className="flex-1 flex flex-col gap-0 border-r border-[var(--color-border)]">
            {/* summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 px-4 md:px-6 py-4 md:py-5">
              <SummaryCard
                label={`NET FLOW (${data?.daysCount ?? days}D)`}
                value={data ? `${netFlow >= 0 ? '+' : ''}${formatIDRCompact(netFlow)}` : '—'}
                sub={!data ? 'Belum ada data' : netFlow < 0 ? 'Distribusi aktif' : 'Akumulasi aktif'}
                valueClass={!data ? 'text-[var(--color-text-muted)]' : netFlow >= 0 ? 'text-emerald-600' : 'text-red-500'}
              />
              <SummaryCard
                label={`NET ASING (${data?.daysCount ?? days}D)`}
                value={dailyFlow.length > 0 ? `${asingNetFlow >= 0 ? '+' : ''}${formatIDRCompact(asingNetFlow)}` : '—'}
                sub={dailyFlow.length === 0 ? 'Belum ada data' : asingNetFlow >= 0 ? 'Masih beli — exit liquidity' : 'Net jual asing'}
                valueClass={dailyFlow.length === 0 ? 'text-[var(--color-text-muted)]' : asingNetFlow >= 0 ? 'text-emerald-600' : 'text-red-500'}
              />
              <SummaryCard
                label={`INSIDER FILING (${data?.daysCount ?? days}D)`}
                value={insidersInRange.length > 0
                  ? `${insiderSellCount > 0 ? `${insiderSellCount} SELL` : ''}${insiderSellCount > 0 && insiderBuyCount > 0 ? ' / ' : ''}${insiderBuyCount > 0 ? `${insiderBuyCount} BUY` : ''}`
                  : '—'}
                sub={insidersInRange.length === 0 ? 'Tidak ada filing dalam periode ini' :
                  insiderSellCount > 0 && insiderBuyCount === 0 ? 'Konfirmasi distribusi' :
                  insiderBuyCount > 0 && insiderSellCount === 0 ? 'Konfirmasi akumulasi' :
                  'Sinyal campuran'}
                valueClass={insidersInRange.length === 0 ? 'text-[var(--color-text-muted)]' :
                  insiderSellCount > 0 && insiderBuyCount === 0 ? 'text-red-500' :
                  insiderBuyCount > 0 && insiderSellCount === 0 ? 'text-emerald-600' : 'text-[var(--color-text-primary)]'}
              />
              <SignalSummaryCard
                signal={data ? combinedSignal : null}
                confidence={data ? confidence : null}
                narrative={data ? narrative : null}
              />
            </div>

            {/* tabs */}
            <div className="flex items-center gap-1 md:gap-2 px-4 md:px-6 pb-4 overflow-x-auto scrollbar-none">
              {TABS.map((t) => {
                const Icon = TAB_ICONS[t.key]
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`font-mono text-[11px] font-bold px-2 md:px-3 py-1.5 border transition-colors flex items-center gap-1.5 shrink-0 ${
                      activeTab === t.key
                        ? 'bg-[var(--color-bg-inset)] text-[var(--color-text-primary)] border border-[var(--color-border)] border-[#1A1A1A]'
                        : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-text-primary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                )
              })}
            </div>

            {/* tab content */}
            <div className="px-4 md:px-6 pb-4">
              {activeTab === 'daily' ? (
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] leading-relaxed hidden sm:block">
                    Net flow {dailyFlow.length > 90 ? 'mingguan (agregasi)' : 'harian'} — emas = BUMN, hijau = asing, biru = retail
                  </span>
                  <DailyFlowChart data={dailyFlow} />
                </div>
              ) : activeTab === 'cum' ? (
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] leading-relaxed hidden sm:block">
                    Kumulatif net flow (Rp juta) — kapan bandar mulai balik arah
                  </span>
                  <CumulativeFlowChart data={dailyFlow} />
                </div>
              ) : activeTab === 'identify' ? (
                <div className="flex flex-col gap-3 pb-2">
                  <BrokerIdentificationTable rows={concentration} daysCount={data?.daysCount ?? days} />
                </div>
              ) : activeTab === 'insider' ? (
                <InsiderFilingsTab rows={insiderTransactions} />
              ) : null}
            </div>

            {/* bottom info section
            <div className="px-6 py-4">
              <div className="border border-[var(--color-border)] px-5 py-4 flex flex-col gap-3">
                <span className="font-mono text-[13px] font-bold text-[var(--color-text-primary)]">
                  Keunggulan metode ini vs 1% shareholder
                </span>
                <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-1.5 border-l-2 border-[var(--color-text-primary)] pl-4">
                    <span className="font-mono text-[12px] font-bold text-[var(--color-text-primary)]">Broker summary</span>
                    <span className="font-mono text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      Real-time harian. Bisa deteksi akumulasi 2-4 minggu sebelum
                      harga bergerak. Tidak perlu tunggu disclosure bulanan.
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1.5 border-l-2 border-red-400 pl-4">
                    <span className="font-mono text-[12px] font-bold text-[var(--color-text-primary)]">Insider filing</span>
                    <span className="font-mono text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                      Konfirmasi legal. Kalau broker signal dan insider filing arahnya
                      sama, probabilitas sinyal benar sangat tinggi.
                    </span>
                  </div>
                </div>
              </div>
            </div> */}

            {/* Signal matrix — behind modal CTA */}
            {data && (
              <SignalMatrixModal
                currentBroker={brokerDirection}
                currentInsider={insiderAction}
                confidence={confidence}
              />
            )}
          </div>

          {/* ── right panel ──────────────────────────────────
          <div className="w-[480px] flex flex-col self-stretch">
            <BrokerTable buckets={topBuckets} netBrokerFlow={netFlow} />
          </div> */}
        </div>
      )}
    </div>
  )
}

/* ─── helpers ───────────────────────────────────────────────────────── */

/** Merge top buyers & sellers into a single deduplicated list sorted by absolute net value */
function mergeBuckets(data: StockBrokerSummary): StockBrokerBucket[] {
  const map = new Map<string, StockBrokerBucket>()
  const merge = (list: StockBrokerBucket[]) => {
    for (const b of list) {
      const existing = map.get(b.broker_code)
      if (!existing) {
        map.set(b.broker_code, { ...b })
      }
    }
  }
  merge(data.topBuyers)
  merge(data.topSellers)
  merge(data.topNetBuyers)
  merge(data.topNetSellers)
  return Array.from(map.values()).sort((a, b) => Math.abs(b.total_net_value) - Math.abs(a.total_net_value))
}
