'use client'

import { useState, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { FinancialYear } from '@/lib/types/api'
import { CHART_COLORS } from '@/lib/constants'
import { formatIDRCompact } from '@/lib/calculations/formatters'
import { ChartSkeleton } from '@/components/ui/loading-skeleton'

// ─── Metric definitions ───────────────────────────────────────────────────────

type FmtType = 'idr' | 'pct' | 'ratio' | 'eps'

interface MetricDef {
  key: string
  label: string
  color: string
  type: 'bar' | 'line'
  fmt: FmtType
}

interface MetricGroup {
  id: string
  label: string
  defaultFmt: FmtType
  metrics: MetricDef[]
}

const GROUPS: MetricGroup[] = [
  {
    id: 'is',
    label: 'Income Statement',
    defaultFmt: 'idr',
    metrics: [
      { key: 'revenue',          label: 'Revenue',      color: CHART_COLORS.blue,   type: 'bar',  fmt: 'idr' },
      { key: 'gross_profit',     label: 'Gross Profit', color: CHART_COLORS.amber,  type: 'bar',  fmt: 'idr' },
      { key: 'operating_income', label: 'EBIT',         color: CHART_COLORS.teal,   type: 'bar',  fmt: 'idr' },
      { key: 'net_income',       label: 'Net Income',   color: CHART_COLORS.green,  type: 'bar',  fmt: 'idr' },
    ],
  },
  {
    id: 'margins',
    label: 'Margins',
    defaultFmt: 'pct',
    metrics: [
      { key: 'gross_margin',     label: 'Gross Margin',     color: CHART_COLORS.blue,   type: 'line', fmt: 'pct' },
      { key: 'operating_margin', label: 'Operating Margin', color: CHART_COLORS.purple, type: 'line', fmt: 'pct' },
      { key: 'net_margin',       label: 'Net Margin',       color: CHART_COLORS.green,  type: 'line', fmt: 'pct' },
    ],
  },
  {
    id: 'per_share',
    label: 'Per Share',
    defaultFmt: 'eps',
    metrics: [
      { key: 'eps', label: 'EPS', color: CHART_COLORS.blue, type: 'bar', fmt: 'eps' },
    ],
  },
  {
    id: 'cashflow',
    label: 'Cash Flow',
    defaultFmt: 'idr',
    metrics: [
      { key: 'operating_cash_flow', label: 'Operating CF', color: CHART_COLORS.blue,  type: 'bar', fmt: 'idr' },
      { key: 'free_cash_flow',      label: 'Free CF',      color: CHART_COLORS.green, type: 'bar', fmt: 'idr' },
      { key: 'capex',               label: 'Capex',        color: CHART_COLORS.red,   type: 'bar', fmt: 'idr' },
    ],
  },
  {
    id: 'balance',
    label: 'Balance Sheet',
    defaultFmt: 'idr',
    metrics: [
      { key: 'total_equity',         label: 'Total Equity',       color: CHART_COLORS.green, type: 'bar', fmt: 'idr' },
      { key: 'total_debt',           label: 'Total Debt',         color: CHART_COLORS.red,   type: 'bar', fmt: 'idr' },
      { key: 'cash_and_equivalents', label: 'Cash & Equivalents', color: CHART_COLORS.blue,  type: 'bar', fmt: 'idr' },
    ],
  },
  {
    id: 'ratios',
    label: 'Ratios',
    defaultFmt: 'pct',
    metrics: [
      { key: 'roe',            label: 'ROE',          color: CHART_COLORS.blue,   type: 'line', fmt: 'pct'   },
      { key: 'roa',            label: 'ROA',          color: CHART_COLORS.green,  type: 'line', fmt: 'pct'   },
      { key: 'current_ratio',  label: 'Current Ratio',color: CHART_COLORS.amber,  type: 'line', fmt: 'ratio' },
      { key: 'debt_to_equity', label: 'D/E Ratio',    color: CHART_COLORS.red,    type: 'line', fmt: 'ratio' },
    ],
  },
]

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtYTick(fmt: FmtType) {
  switch (fmt) {
    case 'idr':
    case 'eps':   return (v: number) => formatIDRCompact(v)
    case 'pct':   return (v: number) => `${v.toFixed(1)}%`
    case 'ratio': return (v: number) => v.toFixed(2)
  }
}

function fmtTooltip(value: number, fmt: FmtType): string {
  switch (fmt) {
    case 'idr':
    case 'eps':   return formatIDRCompact(value) ?? '—'
    case 'pct':   return `${Number(value).toFixed(1)}%`
    case 'ratio': return Number(value).toFixed(2)
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { data: FinancialYear[] }

export function FinancialMetricChart({ data }: Props) {
  const [mounted, setMounted] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState(GROUPS[0].id)
  const [activeKeys, setActiveKeys] = useState<Set<string>>(
    () => new Set(GROUPS[0].metrics.map((m) => m.key))
  )

  useEffect(() => setMounted(true), [])

  const activeGroup = GROUPS.find((g) => g.id === activeGroupId) ?? GROUPS[0]

  function switchGroup(groupId: string) {
    const g = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0]
    setActiveGroupId(g.id)
    setActiveKeys(new Set(g.metrics.map((m) => m.key)))
  }

  function toggleKey(key: string) {
    setActiveKeys((prev) => {
      if (prev.has(key) && prev.size === 1) return prev // always keep ≥1
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (!mounted) return <ChartSkeleton height={360} />
  if (!data.length) return (
    <div className="flex items-center justify-center h-64 text-[#9C9B99] text-sm">No data available</div>
  )

  const chartData = data.map((d) => ({
    ...d,
    label: d.is_ttm ? `${d.year} (TTM)` : String(d.year),
  }))

  const activeMetrics = activeGroup.metrics.filter((m) => activeKeys.has(m.key))

  // Determine Y-axis format: for ratios group with mixed pct/ratio metrics, use ratio (unitless)
  const yFmt: FmtType = activeGroup.id === 'ratios'
    ? activeMetrics.every((m) => m.fmt === 'pct') ? 'pct'
    : activeMetrics.every((m) => m.fmt === 'ratio') ? 'ratio'
    : 'ratio'
    : activeGroup.defaultFmt

  return (
    <div className="space-y-3">
      {/* Group tabs */}
      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => switchGroup(g.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              g.id === activeGroupId
                ? 'bg-[#1A1918] text-white'
                : 'bg-[#F5F4F1] text-[#6B6A68] hover:bg-[#EDECEA] hover:text-[#1A1918]'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Series toggle chips */}
      {activeGroup.metrics.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {activeGroup.metrics.map((m) => {
            const on = activeKeys.has(m.key)
            return (
              <button
                key={m.key}
                onClick={() => toggleKey(m.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                  on
                    ? 'border-transparent text-white'
                    : 'border-[#E5E4E1] bg-white text-[#9C9B99] hover:border-[#C4C3BF] hover:text-[#1A1918]'
                }`}
                style={on ? { backgroundColor: m.color } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: on ? 'rgba(255,255,255,0.75)' : m.color }}
                />
                {m.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F4F1" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={fmtYTick(yFmt)}
            tick={{ fontSize: 11 }}
            width={65}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(value, name) => {
              const m = activeGroup.metrics.find((m) => m.label === name)
              return [fmtTooltip(Number(value), m?.fmt ?? 'idr'), name]
            }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend />
          {activeMetrics.map((m) =>
            m.type === 'bar' ? (
              <Bar
                key={m.key}
                dataKey={m.key}
                name={m.label}
                fill={m.color}
                radius={[3, 3, 0, 0]}
              />
            ) : (
              <Line
                key={m.key}
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                type="monotone"
                connectNulls
              />
            )
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
