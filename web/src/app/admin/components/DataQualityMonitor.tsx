'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code,
  Database,
  Download,
  RefreshCw,
  Search,
  TerminalSquare,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TableMeta = {
  name: string
  tickerCol: string
  dateCol: string | null
}

type QueryResponse = {
  ok: true
  table: string
  meta: { tickerCol: string; dateCol: string | null }
  rows: Record<string, unknown>[]
  count: number | null
  offset: number
  limit: number
}

type ValidationIssue = {
  id: string
  severity: 'info' | 'warning' | 'error'
  category: string
  title: string
  detail: string
  table?: string
  column?: string
}

type ValidationResponse = {
  ok: true
  ticker: string
  summary: { issues_total: number; errors: number; warnings: number }
  issues: ValidationIssue[]
  raw: Record<string, unknown>
}

function formatCell(v: unknown) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return JSON.stringify(v)
}

function severityPill(sev: ValidationIssue['severity']) {
  if (sev === 'error') return 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]'
  if (sev === 'warning') return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
  return 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]'
}

export default function DataQualityMonitor({ nodeId }: { nodeId: string }) {
  const [tables, setTables] = useState<TableMeta[]>([])
  const [table, setTable] = useState<string>('v_data_completeness')
  const [ticker, setTicker] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [orderBy, setOrderBy] = useState<string>('')
  const [orderDir, setOrderDir] = useState<'asc' | 'desc'>('desc')
  const [sortForTable, setSortForTable] = useState<string>('v_data_completeness')
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(50)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [validateTicker, setValidateTicker] = useState<string>('')
  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const [sql, setSql] = useState<string>("select * from v_data_completeness where ticker = 'BBRI' limit 50")
  const [sqlRows, setSqlRows] = useState<Record<string, unknown>[]>([])
  const [sqlError, setSqlError] = useState<string | null>(null)
  const [sqlLoading, setSqlLoading] = useState(false)

  const meta = useMemo(() => tables.find((t) => t.name === table) ?? null, [tables, table])
  const derivedColumns = useMemo(() => {
    const keys = new Set<string>()
    for (const r of rows) Object.keys(r || {}).forEach((k) => keys.add(k))
    return Array.from(keys)
  }, [rows])

  const loadTables = useCallback(async () => {
    const res = await fetch('/api/admin/data-quality/tables')
    if (!res.ok) throw new Error('Failed to load tables')
    const data = await res.json()
    setTables((data?.tables || []) as TableMeta[])
  }, [])

  const loadQuery = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('table', table)
      if (ticker.trim()) params.set('ticker', ticker.trim().toUpperCase())
      if (meta?.dateCol) {
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
      }
      if (orderBy && sortForTable === table) params.set('orderBy', orderBy)
      params.set('orderDir', orderDir)
      params.set('offset', String(offset))
      params.set('limit', String(limit))
      const res = await fetch(`/api/admin/data-quality/query?${params.toString()}`)
      const data = (await res.json().catch(() => null)) as QueryResponse | { ok: false; error: string }
      if (!res.ok || !data || (data as any).ok === false) throw new Error((data as any)?.error || 'Query failed')
      setRows((data as QueryResponse).rows)
      setCount((data as QueryResponse).count)
    } catch (e) {
      setRows([])
      setCount(null)
      setError(e instanceof Error ? e.message : 'Query failed')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, limit, meta?.dateCol, offset, orderBy, orderDir, sortForTable, table, ticker])

  const runValidation = useCallback(async () => {
    const t = validateTicker.trim().toUpperCase()
    if (!t) return
    setValidationLoading(true)
    setValidationError(null)
    try {
      const res = await fetch(`/api/admin/data-quality/validate?ticker=${encodeURIComponent(t)}`)
      const data = (await res.json().catch(() => null)) as ValidationResponse | { ok: false; error: string }
      if (!res.ok || !data || (data as any).ok === false) throw new Error((data as any)?.error || 'Validation failed')
      setValidation(data as ValidationResponse)
    } catch (e) {
      setValidation(null)
      setValidationError(e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setValidationLoading(false)
    }
  }, [validateTicker])

  const runSql = useCallback(async () => {
    setSqlLoading(true)
    setSqlError(null)
    setSqlRows([])
    try {
      const res = await fetch('/api/admin/data-quality/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || data.ok === false) throw new Error(data?.error || 'SQL failed')
      setSqlRows((data.rows || []) as Record<string, unknown>[])
    } catch (e) {
      setSqlError(e instanceof Error ? e.message : 'SQL failed')
    } finally {
      setSqlLoading(false)
    }
  }, [sql])

  useEffect(() => {
    loadTables().catch(() => null)
  }, [loadTables])

  useEffect(() => {
    setOffset(0)
  }, [table, ticker, dateFrom, dateTo, orderBy, orderDir, limit])

  useEffect(() => {
    if (!meta) return
    loadQuery()
  }, [loadQuery, meta])

  useEffect(() => {
    if (!live) return
    const t = setInterval(() => {
      if (!loading) loadQuery()
    }, 15000)
    return () => clearInterval(t)
  }, [live, loading, loadQuery])

  const canUseDate = Boolean(meta?.dateCol)
  const totalLabel = count == null ? 'COUNT: —' : `COUNT: ${String(count)}`
  const pageLabel = `OFFSET: ${String(offset)}  LIMIT: ${String(limit)}`
  const sortLabel = orderBy && sortForTable === table ? `SORT: ${orderBy} ${orderDir.toUpperCase()}` : 'SORT: DEFAULT'

  const toggleSort = useCallback(
    (col: string) => {
      setExpanded(null)
      setSortForTable(table)
      setOrderBy((prev) => {
        if (prev === col) {
          setOrderDir((d) => (d === 'asc' ? 'desc' : 'asc'))
          return prev
        }
        setOrderDir('desc')
        return col
      })
    },
    [setExpanded, table]
  )

  return (
    <div className="space-y-4">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md">
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-[var(--color-brand-bg)] border border-[var(--color-border)] flex items-center justify-center">
              <Database className="w-4 h-4 text-[var(--color-brand-text)]" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-bold tracking-[1.2px] uppercase text-[var(--color-text-primary)] truncate">
                DATA QUALITY INSPECTOR
              </div>
              <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)] truncate">
                RAW TABLE VIEW + VALIDATION + EXPORT • NODE {nodeId}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLive((v) => !v)}
              className={cn(
                'px-3 py-2 rounded-md border font-mono text-[10px] font-bold tracking-[1px] uppercase transition-colors',
                live
                  ? 'bg-[var(--color-brand-bg)] border-[var(--color-border)] text-[var(--color-brand-text)]'
                  : 'bg-[var(--color-bg-inset)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
              )}
            >
              {live ? 'LIVE' : 'PAUSED'}
            </button>
            <button
              onClick={loadQuery}
              className="px-3 py-2 rounded-md bg-[var(--color-bg-inset)] border border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4 text-[var(--color-text-muted)]', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4">
            <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)] mb-1">
              TABLE
            </div>
            <select
              value={table}
              onChange={(e) => {
                const next = e.target.value
                setExpanded(null)
                setOrderBy('')
                setOrderDir('desc')
                setSortForTable(next)
                setOffset(0)
                setTable(next)
              }}
              className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md font-mono text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            >
              {tables.length === 0 && <option value="v_data_completeness">v_data_completeness</option>}
              {tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)] mb-1">
              TICKER
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)]" />
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="BBRI"
                className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md font-mono text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              />
            </div>
          </div>

          <div className={cn('lg:col-span-4 grid grid-cols-2 gap-3', !canUseDate && 'opacity-50')}>
            <div>
              <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)] mb-1">
                DATE FROM
              </div>
              <input
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={!canUseDate}
                placeholder={meta?.dateCol ? 'YYYY-MM-DD' : '—'}
                className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md font-mono text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)] mb-1">
                DATE TO
              </div>
              <input
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={!canUseDate}
                placeholder={meta?.dateCol ? 'YYYY-MM-DD' : '—'}
                className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md font-mono text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)] mb-1">
              LIMIT
            </div>
            <input
              value={String(limit)}
              onChange={(e) => setLimit(Math.max(1, Math.min(500, parseInt(e.target.value || '50', 10) || 50)))}
              className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md font-mono text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
          </div>
        </div>

        <div className="px-4 pb-4 flex flex-wrap items-center gap-2 justify-between">
          <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
            {totalLabel}  •  {pageLabel}  •  {sortLabel}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-2 rounded-md bg-[var(--color-bg-inset)] border border-[var(--color-border)] hover:bg-[var(--color-border)] disabled:opacity-50 disabled:cursor-not-allowed font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]"
            >
              PREV
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              className="px-3 py-2 rounded-md bg-[var(--color-bg-inset)] border border-[var(--color-border)] hover:bg-[var(--color-border)] font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]"
            >
              NEXT
            </button>
            <a
              href={`/api/admin/data-quality/export?table=${encodeURIComponent(table)}&format=csv${ticker.trim() ? `&ticker=${encodeURIComponent(ticker.trim().toUpperCase())}` : ''}${canUseDate && dateFrom ? `&dateFrom=${encodeURIComponent(dateFrom)}` : ''}${canUseDate && dateTo ? `&dateTo=${encodeURIComponent(dateTo)}` : ''}&limit=1000`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--color-brand)] hover:bg-[var(--color-brand-text)] transition-colors"
            >
              <Download className="w-4 h-4 text-[var(--color-text-on-accent)]" />
              <span className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-on-accent)]">
                EXPORT
              </span>
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-[var(--color-negative-bg)] border border-[var(--color-border)] rounded-md px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--color-negative-text)]" />
            <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-negative-text)]">
              {error}
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden w-full max-w-full min-w-0">
        <div className="overflow-x-auto w-full max-w-full min-w-0">
          <table className="min-w-max">
            <thead className="bg-[var(--color-bg-inset)]">
              <tr>
                <th className="px-3 py-2 text-left font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)] w-10" />
                {derivedColumns.slice(0, 24).map((c) => (
                  <th
                    key={c}
                    className="px-3 py-2 text-left whitespace-nowrap"
                  >
                    {(() => {
                      const isSorted = sortForTable === table && orderBy === c
                      return (
                    <button
                      onClick={() => toggleSort(c)}
                      className={cn(
                        'inline-flex items-center gap-1.5 font-mono text-[9px] font-bold tracking-[1px] uppercase transition-colors',
                        isSorted
                          ? 'text-[var(--color-text-primary)]'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                      )}
                      title={`Sort by ${c}`}
                    >
                      <span>{c}</span>
                      {isSorted ? (
                        orderDir === 'asc' ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 opacity-30" />
                      )}
                    </button>
                      )
                    })()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {rows.map((r, idx) => {
                const key = String((r as any)?.id ?? (r as any)?.ticker ?? idx)
                const isOpen = expanded === key
                return (
                  <React.Fragment key={key}>
                    <tr className="hover:bg-[var(--color-bg-inset)]/50">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setExpanded(isOpen ? null : key)}
                          className="p-1 rounded-md hover:bg-[var(--color-bg-inset)] border border-[var(--color-border)]"
                        >
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                          )}
                        </button>
                      </td>
                      {derivedColumns.slice(0, 24).map((c) => (
                        <td key={c} className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-primary)] whitespace-nowrap">
                          <span className="inline-block max-w-[280px] truncate">{formatCell(r[c])}</span>
                        </td>
                      ))}
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={25} className="px-3 py-3 bg-[var(--color-bg-inset)]">
                          <pre className="overflow-x-auto max-w-full text-[11px] leading-[1.4] font-mono text-[var(--color-text-primary)]">
                            {JSON.stringify(r, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={25} className="px-4 py-10 text-center">
                    <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                      NO ROWS
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={25} className="px-4 py-10 text-center">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-text-muted)]" />
                      <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                        LOADING…
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TerminalSquare className="w-4 h-4 text-[var(--color-brand-text)]" />
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                VALIDATION (TICKER BUNDLE)
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)] mb-1">
                  TICKER
                </div>
                <input
                  value={validateTicker}
                  onChange={(e) => setValidateTicker(e.target.value)}
                  placeholder="BBRI"
                  className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md font-mono text-[11px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={runValidation}
                  disabled={validationLoading || !validateTicker.trim()}
                  className="w-full px-3 py-2 rounded-md bg-[var(--color-brand)] hover:bg-[var(--color-brand-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-on-accent)]">
                    {validationLoading ? 'RUNNING…' : 'RUN'}
                  </span>
                </button>
              </div>
            </div>

            {validationError && (
              <div className="bg-[var(--color-negative-bg)] border border-[var(--color-border)] rounded-md px-3 py-2">
                <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-negative-text)]">
                  {validationError}
                </div>
              </div>
            )}

            {validation && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    {`TICKER: ${validation.ticker}`}
                  </span>
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    {`ISSUES: ${String(validation.summary.issues_total)}`}
                  </span>
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    {`ERRORS: ${String(validation.summary.errors)}`}
                  </span>
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    {`WARNINGS: ${String(validation.summary.warnings)}`}
                  </span>
                </div>

                <div className="space-y-2">
                  {validation.issues.length === 0 && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-text)]" />
                      <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                        NO ISSUES DETECTED
                      </div>
                    </div>
                  )}

                  {validation.issues.slice(0, 12).map((i) => (
                    <div key={i.id} className="flex items-start gap-2">
                      {i.severity === 'error' && <XCircle className="w-4 h-4 text-[var(--color-negative-text)] mt-0.5" />}
                      {i.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-[var(--color-warning-text)] mt-0.5" />}
                      {i.severity === 'info' && <CheckCircle2 className="w-4 h-4 text-[var(--color-neutral-text)] mt-0.5" />}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn('px-2 py-0.5 rounded-md font-mono text-[9px] font-bold tracking-[1px] uppercase', severityPill(i.severity))}>
                            {i.severity}
                          </span>
                          <span className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                            {i.title}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-[var(--color-text-muted)]">
                          {i.detail}
                        </div>
                        {(i.table || i.column) && (
                          <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-dim)]">
                            {i.table ? `TABLE: ${i.table}` : ''}{i.column ? `  COL: ${i.column}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <details className="bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md p-3">
                  <summary className="cursor-pointer font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    RAW BUNDLE JSON
                  </summary>
                  <pre className="mt-3 overflow-x-auto text-[11px] leading-[1.4] font-mono text-[var(--color-text-primary)]">
                    {JSON.stringify(validation.raw, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-[var(--color-brand-text)]" />
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                SQL (SELECT-ONLY, LIMITED)
              </div>
            </div>
            <button
              onClick={runSql}
              disabled={sqlLoading || !sql.trim()}
              className="px-3 py-2 rounded-md bg-[var(--color-brand)] hover:bg-[var(--color-brand-text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-on-accent)]">
                {sqlLoading ? 'RUNNING…' : 'RUN'}
              </span>
            </button>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md font-mono text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
            {sqlError && (
              <div className="bg-[var(--color-negative-bg)] border border-[var(--color-border)] rounded-md px-3 py-2">
                <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-negative-text)]">
                  {sqlError}
                </div>
              </div>
            )}
            {sqlRows.length > 0 && (
              <details className="bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md p-3" open>
                <summary className="cursor-pointer font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  RESULT ({String(sqlRows.length)} ROWS)
                </summary>
                <pre className="mt-3 overflow-x-auto text-[11px] leading-[1.4] font-mono text-[var(--color-text-primary)]">
                  {JSON.stringify(sqlRows, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
