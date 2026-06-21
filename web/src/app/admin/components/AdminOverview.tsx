'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type FreshnessRow = {
  table: string
  lastDate: string | null
}

type RecentRun = {
  job: string
  status: string
  started_at: string
}

type FeedbackItem = {
  id: string
  tag: 'NEW' | 'WIP' | 'FIX'
  text: string
}

type FlagRow = {
  id: string
  key: string
  description: string
  enabled: boolean
}

function StatCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string
  value: string
  sublabel?: string
  tone: 'brand' | 'neutral' | 'warning'
}) {
  const toneClass =
    tone === 'brand'
      ? 'text-[var(--color-brand-text)]'
      : tone === 'warning'
        ? 'text-[var(--color-warning-text)]'
        : 'text-[var(--color-text-primary)]'

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md px-4 py-3">
      <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={cn('mt-1 text-[18px] font-semibold', toneClass)} style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif' }}>
        {value}
      </div>
      {sublabel && (
        <div className="mt-0.5 font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-dim)]">
          {sublabel}
        </div>
      )}
    </div>
  )
}

function StatusPill({ status }: { status: 'live' | 'stale' | 'error' }) {
  const map = {
    live: { label: 'LIVE', cls: 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]' },
    stale: { label: 'STALE', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]' },
    error: { label: 'ERROR', cls: 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]' },
  } as const
  const s = map[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[9px] font-bold tracking-[1px] uppercase', s.cls)}>
      {s.label}
    </span>
  )
}

function MiniToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-10 h-5 rounded-full border border-[var(--color-border)] p-0.5 transition-colors',
        enabled ? 'bg-[var(--color-brand-bg)]' : 'bg-[var(--color-bg-inset)]'
      )}
      aria-label={enabled ? 'Disable' : 'Enable'}
    >
      <span
        className={cn(
          'block h-4 w-4 rounded-full transition-transform',
          enabled ? 'translate-x-5 bg-[var(--color-brand-text)]' : 'translate-x-0 bg-[var(--color-text-muted)]'
        )}
      />
    </button>
  )
}

export default function AdminOverview({ nodeId }: { nodeId: string }) {
  const [running, setRunning] = useState(false)
  const [flags, setFlags] = useState<FlagRow[]>([
    { id: 'f1', key: 'new_screener_table', description: 'Sortable / filterable screener table', enabled: true },
    { id: 'f2', key: 'wyckoff_v2_default', description: 'Use FSM detector v2 as the default phase', enabled: true },
    { id: 'f3', key: 'ai_analyst_v2', description: 'New context-builder + scoring weights', enabled: true },
    { id: 'f4', key: 'money_flow_v2', description: 'Reconciled foreign flow with broker summary', enabled: false },
    { id: 'f5', key: 'pro_install_prompt', description: 'PWA install prompt after 3 visits', enabled: false },
  ])

  const [freshness, setFreshness] = useState<FreshnessRow[]>([])
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([])

  useEffect(() => {
    let alive = true
    fetch('/api/admin/overview')
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.ok) return
        setFreshness(d.freshness)
        setRecentRuns(d.runs)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const feedback: FeedbackItem[] = useMemo(
    () => [
      { id: 'fb1', tag: 'NEW', text: 'Wyckoff phase for BBRI looks off vs the chart' },
      { id: 'fb2', tag: 'FIX', text: 'Add EPS growth column to the screener table' },
      { id: 'fb3', tag: 'WIP', text: 'Money flow “Jt” unit unclear — million or juta?' },
      { id: 'fb4', tag: 'NEW', text: 'Love the dividend calendar, super useful' },
    ],
    []
  )

  const topTickers = useMemo(
    () => [
      { t: 'BBRI', v: 84 },
      { t: 'BBCA', v: 67 },
      { t: 'GOTO', v: 41 },
      { t: 'ABRO', v: 33 },
      { t: 'TLKM', v: 22 },
    ],
    []
  )

  const completeness = useMemo(
    () => [
      { label: 'Daily Prices', v: 99, tone: 'brand' as const },
      { label: 'Financials — Annual', v: 94, tone: 'brand' as const },
      { label: 'Financials — Quarterly', v: 88, tone: 'warning' as const },
      { label: 'Money Flow', v: 86, tone: 'warning' as const },
      { label: 'Shareholders', v: 78, tone: 'warning' as const },
      { label: 'Dividends', v: 82, tone: 'warning' as const },
      { label: 'Company Profiles', v: 97, tone: 'brand' as const },
    ],
    []
  )

  const handleRunPipeline = async () => {
    if (running) return
    setRunning(true)
    await new Promise((r) => setTimeout(r, 1200))
    setRunning(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[12px] font-bold tracking-[1.2px] uppercase text-[var(--color-text-primary)]">
            OPERATIONS OVERVIEW
          </div>
          <div className="mt-1 font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
            TUE 18 JUN 2026 • 14:53 WIB • MARKET CLOSED • NODE {nodeId}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunPipeline}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--color-brand)] hover:bg-[var(--color-brand-text)] transition-colors"
          >
            <Zap className="w-4 h-4 text-[var(--color-text-on-accent)]" />
            <span className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-on-accent)]">
              {running ? 'RUNNING…' : 'RUN FULL PIPELINE'}
            </span>
          </button>
          <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--color-bg-inset)] border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors">
            <RefreshCw className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="hidden sm:inline font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
              REFRESH
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
              PIPELINE STATUS
            </div>
            <Activity className="w-4 h-4 text-[var(--color-brand-text)]" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] font-mono text-[10px] font-bold tracking-[1px] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-text)]" />
              OPERATIONAL
            </span>
          </div>
          <div className="mt-1 font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-dim)]">
            0 / 8 JOBS IN ERROR
          </div>
        </div>

        <StatCard label="LAST FULL RUN" value="14:32" sublabel="TODAY • +12M" tone="neutral" />
        <StatCard label="TOTAL DB ROWS" value="4.82M" sublabel="+38.2K TODAY" tone="brand" />
        <StatCard label="SUPABASE QUOTA" value="82%" sublabel="29% USED" tone="warning" />
        <StatCard label="API CALLS TODAY" value="2,140" sublabel="OK • 0 THROTTLE" tone="neutral" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                DATA FRESHNESS • TABLES
              </div>
              <div className="mt-0.5 font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                LATEST DATE PER TABLE
              </div>
            </div>
            <button className="inline-flex items-center gap-2 font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-brand-text)] hover:opacity-90">
              VIEW LESS <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-max w-full">
              <thead className="bg-[var(--color-bg-inset)]">
                <tr>
                  <th className="px-4 py-2 text-left font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    TABLE
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    LATEST DATE
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    STATUS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {freshness.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-mono text-[10px] text-[var(--color-text-muted)]">
                      LOADING…
                    </td>
                  </tr>
                ) : (
                  freshness.map((f) => {
                    const ageMs = f.lastDate ? Date.now() - new Date(f.lastDate).getTime() : Infinity
                    const pill: 'live' | 'stale' = ageMs < 2 * 24 * 60 * 60 * 1000 ? 'live' : 'stale'
                    return (
                      <tr key={f.table} className="hover:bg-[var(--color-bg-inset)]/40">
                        <td className="px-4 py-2 font-mono text-[11px] text-[var(--color-text-primary)] whitespace-nowrap">
                          {f.table}
                        </td>
                        <td className="px-4 py-2 font-mono text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">
                          {f.lastDate ?? '—'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <StatusPill status={pill} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {recentRuns.length > 0 && (
            <>
              <div className="px-4 py-2 border-t border-[var(--color-border)]">
                <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  RECENT RUNS
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-max w-full">
                  <thead className="bg-[var(--color-bg-inset)]">
                    <tr>
                      <th className="px-4 py-2 text-left font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">JOB</th>
                      <th className="px-4 py-2 text-left font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">STARTED</th>
                      <th className="px-4 py-2 text-left font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {recentRuns.map((r, i) => {
                      const runPill: 'live' | 'stale' | 'error' =
                        r.status === 'success' ? 'live' : r.status === 'failed' ? 'error' : 'stale'
                      return (
                        <tr key={i} className="hover:bg-[var(--color-bg-inset)]/40">
                          <td className="px-4 py-2 font-mono text-[11px] text-[var(--color-text-primary)] whitespace-nowrap">{r.job}</td>
                          <td className="px-4 py-2 font-mono text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">{r.started_at.slice(0, 16).replace('T', ' ')}</td>
                          <td className="px-4 py-2 whitespace-nowrap"><StatusPill status={runPill} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                TRAFFIC • TODAY
              </div>
              <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-brand-text)]">
                70%
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    VISITORS
                  </div>
                  <div className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif' }}>
                    38
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    PAGE VIEWS
                  </div>
                  <div className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif' }}>
                    412
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    AVG SESSION
                  </div>
                  <div className="mt-1 text-[16px] font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif' }}>
                    2:14
                  </div>
                </div>
              </div>

              <div className="pt-1">
                {topTickers.map((x) => (
                  <div key={x.t} className="flex items-center gap-3 py-1">
                    <div className="w-12 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                      {x.t}
                    </div>
                    <div className="flex-1 h-1.5 bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--color-brand)]" style={{ width: `${x.v}%` }} />
                    </div>
                    <div className="w-8 text-right font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-dim)]">
                      {x.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                FEEDBACK INDEX
              </div>
              <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                ALL
              </div>
            </div>
            <div className="p-4 space-y-2">
              {feedback.map((f) => (
                <div key={f.id} className="flex items-start gap-2">
                  <span
                    className={cn(
                      'mt-0.5 px-2 py-0.5 rounded-md font-mono text-[9px] font-bold tracking-[1px] uppercase',
                      f.tag === 'NEW'
                        ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
                        : f.tag === 'FIX'
                          ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
                          : 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]'
                    )}
                  >
                    {f.tag}
                  </span>
                  <div className="font-mono text-[10px] text-[var(--color-text-muted)]">{f.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                DATA COMPLETENESS • BY TABLE
              </div>
              <div className="mt-0.5 font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                DUMMY METRICS (UI MATCH)
              </div>
            </div>
            <button className="inline-flex items-center gap-2 font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-brand-text)] hover:opacity-90">
              FULL MATRIX <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md px-4 py-3">
                <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  OVERALL COVERAGE
                </div>
                <div className="mt-1 text-[18px] font-semibold text-[var(--color-brand-text)]" style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif' }}>
                  94.3%
                </div>
                <div className="mt-0.5 font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-dim)]">
                  MIN 5Y TARGET
                </div>
              </div>
              <div className="bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md px-4 py-3">
                <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  TICKERS WITH GAPS
                </div>
                <div className="mt-1 text-[18px] font-semibold text-[var(--color-warning-text)]" style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif' }}>
                  142
                </div>
                <div className="mt-0.5 font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-dim)]">
                  PRIORITIZE TOP-200
                </div>
              </div>
              <div className="bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md px-4 py-3">
                <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  TABLES STALE &gt; 7D
                </div>
                <div className="mt-1 text-[18px] font-semibold text-[var(--color-negative-text)]" style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif' }}>
                  3
                </div>
                <div className="mt-0.5 font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-dim)]">
                  REVIEW SCRAPERS
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {completeness.map((x) => (
                <div key={x.label} className="flex items-center gap-3">
                  <div className="w-44 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    {x.label}
                  </div>
                  <div className="flex-1 h-1.5 bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
                    <div
                      className={cn('h-full', x.tone === 'brand' ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-warning)]')}
                      style={{ width: `${x.v}%` }}
                    />
                  </div>
                  <div className="w-10 text-right font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    {x.v}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                FEATURE FLAGS • FLAGS
              </div>
              <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-brand-text)]">
                RUNNING
              </div>
            </div>
            <div className="p-4 space-y-3">
              {flags.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)] truncate">
                      {f.key}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                      {f.description}
                    </div>
                  </div>
                  <MiniToggle
                    enabled={f.enabled}
                    onToggle={() =>
                      setFlags((prev) => prev.map((x) => (x.id === f.id ? { ...x, enabled: !x.enabled } : x)))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                COST MONITOR
              </div>
              <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                LAST 30D
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">TOTAL</div>
                <div className="text-[18px] font-semibold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif' }}>
                  $42.18
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] text-[var(--color-text-muted)]">Anthropic API</div>
                  <div className="font-mono text-[10px] text-[var(--color-text-primary)]">$42.18</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] text-[var(--color-text-muted)]">Supabase</div>
                  <div className="font-mono text-[10px] text-[var(--color-brand-text)]">$0.00</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10px] text-[var(--color-text-muted)]">Vercel</div>
                  <div className="font-mono text-[10px] text-[var(--color-brand-text)]">$0.00</div>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-text)]" />
                <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  WITHIN MONTHLY BUDGET
                </div>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--color-warning-text)]" />
                <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  DUMMY VALUES
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

