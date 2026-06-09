'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { NetworkGraph } from '@/components/investors/network-graph'
import { InvestorPanel } from '@/components/investors/investor-panel'
import type { GraphNode, InvestorGraphData } from '@/lib/types/network'

// Shared skeleton shell — used by both the Suspense fallback and the pre-mount
// state so the page never flashes raw page background. Token-based → theme-safe.
function PageSkeleton() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <div
        className="shrink-0 h-12 animate-pulse"
        style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}
      />
      <div className="flex-1" style={{ background: 'var(--color-bg-page)' }} />
    </div>
  )
}

// Next.js requires `useSearchParams` to live under a Suspense boundary so the
// page can statically prerender without bailing out to CSR. The boundary just
// wraps the body that depends on URL params.
export default function InvestorsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvestorsPageBody />
    </Suspense>
  )
}

function InvestorsPageBody() {
  const searchParams                    = useSearchParams()
  const initialTicker                   = searchParams.get('ticker')?.toUpperCase() ?? null
  const initialInvestor                 = searchParams.get('investor') ?? null
  const [mounted, setMounted]           = useState(false)
  const [data, setData]                 = useState<InvestorGraphData | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [search, setSearch]             = useState('')
  const [view, setView]                 = useState<'graph' | 'list'>('list')

  useEffect(() => { setMounted(true) }, [])

  // Fetch graph data
  useEffect(() => {
    setLoading(true)
    setError(null)
    setSelectedNode(null)
    fetch('/api/investors/network')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: InvestorGraphData) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  // Auto-select a node when deep-linked via ?ticker=XXX or ?investor=NAME.
  // Runs once after data loads.
  useEffect(() => {
    if (!data) return
    if (!initialTicker && !initialInvestor) return
    const targetId = initialTicker
      ? `stk:${initialTicker}`
      : `inv:${initialInvestor}`
    const found = data.nodes.find((n) => n.id === targetId)
    if (found) {
      setSelectedNode(found)
      setView('graph')
    }
  }, [data, initialTicker, initialInvestor])

  // Search: find node and select it (NetworkGraph handles the zoom)
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!data || !search.trim()) return
      const q = search.trim().toLowerCase()
      const found = data.nodes.find(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          (n.stock_name ?? '').toLowerCase().includes(q)
      )
      if (found) {
        setSelectedNode(found)
        setView('graph')
      }
    },
    [data, search]
  )

  const handleSelectNode = useCallback((node: GraphNode | null) => {
    setSelectedNode(node)
    if (node) setView('graph')
    setSearch('')
  }, [])

  // Derived
  const investors = data?.nodes.filter((n) => n.type === 'investor') ?? []
  const stockCount = data?.nodes.filter((n) => n.type === 'stock').length ?? 0

  const filteredInvestors = search.trim()
    ? investors.filter((n) => n.label.toLowerCase().includes(search.toLowerCase()))
    : investors

  if (!mounted) return <PageSkeleton />

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)', background: 'var(--color-bg-page)' }}>

      {/* ── Controls bar ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-2.5 flex-wrap"
        style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}
      >

        {/* View toggle */}
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setView('list')}
            className="font-mono text-[10px] font-bold tracking-[1px] uppercase px-3 py-1.5 transition-colors"
            style={view === 'list'
              ? { background: 'var(--color-brand)', color: '#0A0A0A' }
              : { color: 'var(--color-text-muted)', background: 'transparent' }}
          >
            List
          </button>
          <button
            onClick={() => setView('graph')}
            className="font-mono text-[10px] font-bold tracking-[1px] uppercase px-3 py-1.5 transition-colors"
            style={view === 'graph'
              ? { background: 'var(--color-brand)', color: '#0A0A0A' }
              : { color: 'var(--color-text-muted)', background: 'transparent' }}
          >
            Network
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={view === 'list' ? 'Filter investors…' : 'Search investor or ticker…'}
            className="font-body text-[13px] rounded-md px-3 py-1.5 w-52 focus:outline-none focus:ring-2"
            style={{
              background: 'var(--color-bg-inset)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              ['--tw-ring-color' as string]: 'var(--color-brand)',
            }}
          />
          {view === 'graph' && (
            <button
              type="submit"
              className="font-mono text-[10px] font-bold tracking-[1px] uppercase px-3 py-1.5 rounded-md transition-opacity hover:opacity-90"
              style={{ background: 'var(--color-brand)', color: '#0A0A0A' }}
            >
              Go
            </button>
          )}
        </form>

        {/* Stats */}
        {!loading && data && (
          <div className="ml-auto flex items-center gap-4 font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            <span><span className="font-bold" style={{ color: 'var(--color-brand-text)' }}>{investors.length}</span> INVESTORS</span>
            <span><span className="font-bold" style={{ color: 'var(--color-brand-text)' }}>{stockCount}</span> STOCKS</span>
            {data.report_date && (
              <span>AS OF <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{data.report_date}</span></span>
            )}
            {data.previous_report_date && (
              <span>Δ VS <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{data.previous_report_date}</span></span>
            )}
          </div>
        )}
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--color-bg-card)' }}>
            {loading && (
              <div className="flex items-center justify-center h-40">
                <div className="flex gap-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: 'var(--color-brand)', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            {!loading && filteredInvestors.length === 0 && (
              <div className="flex items-center justify-center h-40 font-mono text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                {data ? 'NO INVESTORS MATCH YOUR FILTER.' : 'NO DATA LOADED.'}
              </div>
            )}
            {!loading && filteredInvestors.length > 0 && (
              <table className="w-full">
                <thead className="sticky top-0 z-10" style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}>
                  <tr>
                    {(['#', 'Investor', 'Type'] as const).map((h) => (
                      <th key={h} className="text-left font-mono text-[10px] font-bold tracking-[1px] uppercase px-4 py-2.5" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                    {(['Stocks', 'Total %', 'Δ Total %'] as const).map((h) => (
                      <th key={h} className="text-right font-mono text-[10px] font-bold tracking-[1px] uppercase px-4 py-2.5" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                    ))}
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredInvestors
                    .sort((a, b) => (b.stock_count ?? 0) - (a.stock_count ?? 0))
                    .map((inv, i) => (
                      <tr
                        key={inv.id}
                        className="cursor-pointer transition-colors hover:bg-[var(--color-bg-inset)]"
                        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                        onClick={() => handleSelectNode(inv)}
                      >
                        <td className="px-4 py-2.5 font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</td>
                        <td className="px-4 py-2.5 font-display text-[14px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{inv.label}</td>
                        <td className="px-4 py-2.5">
                          {inv.holder_type && (
                            <TypeBadge type={inv.holder_type} />
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-display text-[14px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {inv.stock_count}
                          <CountDelta cur={inv.stock_count ?? 0} prev={inv.prev_stock_count} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-display text-[14px]" style={{ color: 'var(--color-text-muted)' }}>{(inv.total_pct ?? 0).toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right">
                          <PctPointDelta cur={inv.total_pct ?? 0} prev={inv.prev_total_pct} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="font-mono text-[10px] font-bold tracking-[0.5px] uppercase" style={{ color: 'var(--color-brand-text)' }}>View network →</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── GRAPH VIEW ── */}
        {view === 'graph' && (
          <div className="flex-1 relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-bg-page) 80%, transparent)' }}>
                <div className="flex gap-2">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: 'var(--color-brand)', animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-mono text-[13px]" style={{ color: 'var(--color-negative-text)' }}>Error: {error}</p>
              </div>
            )}
            <NetworkGraph data={data} selectedNode={selectedNode} onNodeClick={handleSelectNode} />
          </div>
        )}

        {/* ── Detail panel ── */}
        {selectedNode && data && (
          <InvestorPanel
            node={selectedNode}
            data={data}
            onClose={() => setSelectedNode(null)}
            onSelectNode={handleSelectNode}
          />
        )}

        {/* Legend (graph view only, only when a node is selected) */}
        {view === 'graph' && selectedNode && (
          <div
            className="absolute bottom-4 left-4 backdrop-blur-sm rounded-md px-4 py-3 font-mono text-[11px] space-y-1.5 pointer-events-none"
            style={{
              background: 'color-mix(in srgb, var(--color-bg-card) 90%, transparent)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'var(--color-warning-text)' }} />Selected</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'var(--color-text-muted)' }} />Investor</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full inline-block" style={{ background: 'var(--color-brand)' }} />Stock</div>
            <p className="pt-1" style={{ color: 'var(--color-text-dim)', borderTop: '1px solid var(--color-border-subtle)' }}>Click node to explore · Drag to pan</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── delta helpers (vs previous snapshot) ─────────────────────────────────────

// Δ in %-points for an investor's total ownership. null prev → no prior data.
function PctPointDelta({ cur, prev }: { cur: number; prev: number | null | undefined }) {
  if (prev === undefined || prev === null) {
    return <span className="font-mono text-[11px]" style={{ color: 'var(--color-text-dim)' }}>—</span>
  }
  const d = cur - prev
  if (Math.abs(d) < 0.05) return <span className="font-mono text-[11px]" style={{ color: 'var(--color-text-muted)' }}>▬</span>
  const sign = d > 0 ? '+' : ''
  return (
    <span className="font-display text-[13px] font-semibold" style={{ color: d > 0 ? 'var(--color-brand-text)' : 'var(--color-negative-text)' }}>
      {sign}{d.toFixed(1)}%
    </span>
  )
}

// Δ in position count, shown inline next to the current count.
function CountDelta({ cur, prev }: { cur: number; prev: number | null | undefined }) {
  if (prev === undefined || prev === null) return null
  const d = cur - prev
  if (d === 0) return null
  const sign = d > 0 ? '+' : ''
  return (
    <span className="ml-1 font-mono text-[11px] font-semibold" style={{ color: d > 0 ? 'var(--color-brand-text)' : 'var(--color-negative-text)' }}>
      {sign}{d}
    </span>
  )
}

// ── inline badge ─────────────────────────────────────────────────────────────
// Two-tone per the Terminal design system: neutral inset chip + muted mono label.
// Holder type is conveyed by the short label, not by a rainbow of fills.

function TypeBadge({ type }: { type: string }) {
  const label: Record<string, string> = {
    government: 'GOV', institution: 'INST', individual: 'IND', public: 'PUBLIC', foreign: 'FOREIGN',
  }
  return (
    <span
      className="font-mono text-[10px] font-bold tracking-[0.5px] uppercase px-2 py-0.5 rounded"
      style={{ background: 'var(--color-bg-inset)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)' }}
    >
      {label[type] ?? type.toUpperCase()}
    </span>
  )
}
