'use client'

import { useState, useEffect, useRef, forwardRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getWatchlists,
  getActiveWatchlist,
  setActiveWatchlistId,
  createWatchlist,
  renameWatchlist,
  deleteWatchlist,
  removeTicker,
  type Watchlist,
} from '@/lib/watchlists'
import { track } from '@/lib/analytics'
import type { Strategy } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// QuickAccessBar — unified tabbed panel: Watchlists | Strategies
// ---------------------------------------------------------------------------

type Tab = 'watchlists' | 'strategies'

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
        active
          ? 'bg-blue-50 border-blue-200 text-blue-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

// ── Watchlist content ────────────────────────────────────────────────────────

interface CreateInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
}

const CreateInput = forwardRef<HTMLInputElement, CreateInputProps>(
  function CreateInput({ value, onChange, onSubmit, onCancel }, ref) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="Watchlist name..."
          className="px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 w-36"
        />
        <button onClick={onSubmit} className="px-2 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
          Add
        </button>
        <button onClick={onCancel} className="px-1.5 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Cancel
        </button>
      </div>
    )
  }
)

function WatchlistContent() {
  const [lists, setLists] = useState<Watchlist[]>([])
  const [active, setActive] = useState<Watchlist | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  function sync() {
    setLists(getWatchlists())
    setActive(getActiveWatchlist())
  }

  useEffect(() => {
    sync()
    const handler = () => sync()
    window.addEventListener('watchlist-change', handler)
    return () => window.removeEventListener('watchlist-change', handler)
  }, [])

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setEditingId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  useEffect(() => { if (creatingNew) newInputRef.current?.focus() }, [creatingNew])
  useEffect(() => { if (editingId) editInputRef.current?.focus() }, [editingId])

  if (lists.length === 0 && !creatingNew) {
    return (
      <div>
        <button onClick={() => setCreatingNew(true)} className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors">
          + Create your first watchlist
        </button>
      </div>
    )
  }

  function handleSelect(wl: Watchlist) {
    setActiveWatchlistId(wl.id)
    setDropdownOpen(false)
    setEditingId(null)
  }

  function handleCreate() {
    const name = newName.trim()
    if (!name) return
    createWatchlist(name)
    track.watchlistCreated()
    setNewName('')
    setCreatingNew(false)
  }

  function handleRename(id: string) {
    const name = editName.trim()
    if (!name) { setEditingId(null); return }
    renameWatchlist(id, name)
    setEditingId(null)
    setEditName('')
  }

  function handleDelete(id: string) {
    deleteWatchlist(id)
    setEditingId(null)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {active?.name ?? 'Select watchlist'}
            <svg className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
              {lists.map((wl) => (
                <div key={wl.id} className={`flex items-center gap-2 px-3 py-1.5 text-xs group ${wl.id === active?.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  {editingId === wl.id ? (
                    <input
                      ref={editInputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(wl.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={() => handleRename(wl.id)}
                      className="flex-1 px-1.5 py-0.5 border border-blue-300 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  ) : (
                    <>
                      <button onClick={() => handleSelect(wl)} className="flex-1 text-left font-medium text-gray-800 truncate">
                        {wl.id === active?.id && <span className="text-blue-500 mr-1.5">✓</span>}
                        {wl.name}
                        <span className="ml-1.5 text-gray-400 font-normal">({wl.tickers.length})</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setEditingId(wl.id); setEditName(wl.name) }} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 transition-opacity" aria-label="Rename">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(wl.id) }} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-opacity" aria-label="Delete">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {creatingNew ? (
          <CreateInput ref={newInputRef} value={newName} onChange={setNewName} onSubmit={handleCreate} onCancel={() => { setCreatingNew(false); setNewName('') }} />
        ) : (
          <button onClick={() => setCreatingNew(true)} className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            + New
          </button>
        )}
      </div>

      {active && active.tickers.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {active.tickers.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-medium text-gray-700 group hover:border-blue-200 transition-colors">
              <Link href={`/stock/${t}`} className="hover:text-blue-600 hover:underline">{t}</Link>
              <button onClick={() => active && removeTicker(active.id, t)} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-opacity" aria-label={`Remove ${t}`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {active && active.tickers.length === 0 && (
        <p className="text-xs text-gray-400">Star stocks from the table below to add them here.</p>
      )}
    </div>
  )
}

// ── Strategy content — list view ─────────────────────────────────────────────

interface StrategyWithCount extends Strategy {
  matchCount?: number
}

// Inline edit state for a strategy row
type EditState = { id: string; name: string; description: string } | null

// Inline create state
type CreateState = { name: string; description: string } | null

function StrategyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [strategies, setStrategies] = useState<StrategyWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditState>(null)
  const [creating, setCreating] = useState<CreateState>(null)

  const createNameRef = useRef<HTMLInputElement>(null)
  const editNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (creating) createNameRef.current?.focus() }, [creating])
  useEffect(() => { if (editing) editNameRef.current?.focus() }, [editing])

  const fetchStrategies = useCallback(async () => {
    try {
      const res = await fetch('/api/strategies')
      if (!res.ok) return
      const data: Strategy[] = await res.json()
      setStrategies(data)
      // Counts come in async — update each row as its count arrives
      data.forEach(async (s) => {
        try {
          const r = await fetch(`/api/strategies/${s.id}/count`)
          if (!r.ok) return
          const { count } = await r.json()
          setStrategies((prev) =>
            prev.map((p) => (p.id === s.id ? { ...p, matchCount: count as number } : p))
          )
        } catch { /* silent */ }
      })
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStrategies()
    const handler = () => fetchStrategies()
    window.addEventListener('strategy-change', handler)
    return () => window.removeEventListener('strategy-change', handler)
  }, [fetchStrategies])

  const activeId = searchParams.get('strategy') ?? null

  function applyStrategy(s: Strategy) {
    const filters = s.filters as Record<string, string>
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== '') params.set(k, String(v))
    }
    params.set('strategy', s.id)
    router.push(`/?${params.toString()}`)
  }

  async function handleCreate() {
    if (!creating) return
    const name = creating.name.trim()
    if (!name) return
    const filters: Record<string, string> = {}
    searchParams.forEach((v, k) => {
      if (k !== 'page' && k !== 'sort' && k !== 'dir' && k !== 'strategy') {
        filters[k] = v
      }
    })
    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: creating.description.trim() || null, filters }),
      })
      if (res.ok) {
        setCreating(null)
        fetchStrategies()
      }
    } catch { /* silent */ }
  }

  async function handleSaveEdit() {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) { setEditing(null); return }
    try {
      await fetch(`/api/strategies/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: editing.description.trim() || null }),
      })
      setEditing(null)
      fetchStrategies()
    } catch { /* silent */ }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/strategies/${id}`, { method: 'DELETE' })
      fetchStrategies()
      if (activeId === id) router.push('/')
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">
          {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'}
          {activeId && (
            <button onClick={() => router.push('/')} className="ml-2 text-blue-500 hover:text-blue-700 transition-colors">
              · clear active
            </button>
          )}
        </span>

        {creating ? null : (
          <button
            onClick={() => setCreating({ name: '', description: '' })}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
          >
            + Save current filters
          </button>
        )}
      </div>

      {/* Inline create form */}
      {creating && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="space-y-2">
            <input
              ref={createNameRef}
              type="text"
              value={creating.name}
              onChange={(e) => setCreating((s) => s && { ...s, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(null) }}
              placeholder="Strategy name (required)"
              className="w-full px-2.5 py-1.5 text-sm border border-blue-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            />
            <input
              type="text"
              value={creating.description}
              onChange={(e) => setCreating((s) => s && { ...s, description: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(null) }}
              placeholder="Short description (optional)"
              className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 bg-white text-gray-600"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={handleCreate} className="px-3 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
              Save strategy
            </button>
            <button onClick={() => setCreating(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Strategy list */}
      {strategies.length > 0 ? (
        <div className="-mx-3 divide-y divide-gray-100">
          {strategies.map((s) => {
            const isActive = s.id === activeId
            const isEditing = editing?.id === s.id

            if (isEditing) {
              return (
                <div key={s.id} className="px-3 py-3 bg-gray-50">
                  <div className="space-y-1.5">
                    <input
                      ref={editNameRef}
                      type="text"
                      value={editing.name}
                      onChange={(e) => setEditing((ed) => ed && { ...ed, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(null) }}
                      placeholder="Strategy name"
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    />
                    <input
                      type="text"
                      value={editing.description}
                      onChange={(e) => setEditing((ed) => ed && { ...ed, description: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(null) }}
                      placeholder="Short description (optional)"
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 bg-white text-gray-600"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleSaveEdit} className="px-3 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">
                      Save
                    </button>
                    <button onClick={() => setEditing(null)} className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={s.id}
                className={`group relative flex items-start gap-3 px-3 py-3 cursor-pointer transition-colors ${
                  isActive ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                }`}
                onClick={() => applyStrategy(s)}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-blue-500" />
                )}

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${isActive ? 'text-blue-800' : 'text-gray-800'}`}>
                    {s.name}
                  </div>
                  {s.description && (
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{s.description}</div>
                  )}
                  <div className="mt-1.5">
                    {s.matchCount != null ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {s.matchCount} stocks
                      </span>
                    ) : (
                      <span className="inline-block h-4 w-16 bg-gray-100 rounded-full animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Row actions — visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing({ id: s.id, name: s.name, description: s.description ?? '' })
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    aria-label="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    aria-label="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        !creating && (
          <p className="text-xs text-gray-400">
            Apply filters to the screener below, then save them as a strategy.
          </p>
        )
      )}
    </div>
  )
}

// ── Main exported component ──────────────────────────────────────────────────

export function QuickAccessBar() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('strategies')

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return (
    <div className="mb-5 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-1 mb-3">
        <TabButton active={activeTab === 'strategies'} onClick={() => setActiveTab('strategies')}>
          Strategies
        </TabButton>
        <TabButton active={activeTab === 'watchlists'} onClick={() => setActiveTab('watchlists')}>
          Watchlists
        </TabButton>
      </div>

      {activeTab === 'strategies' ? <StrategyContent /> : <WatchlistContent />}
    </div>
  )
}
