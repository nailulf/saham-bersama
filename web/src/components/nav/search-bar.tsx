'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { SearchResult } from '@/lib/types/api'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  function select(ticker: string) {
    setQuery('')
    setOpen(false)
    router.push(`/stock/${ticker}`)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search ticker or company…"
        aria-label="Search ticker or company"
        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 focus:border-[var(--color-brand)]"
      />
      {loading && (
        <div className="absolute right-3 top-2">
          <div className="w-3 h-3 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-[0_4px_24px_rgba(26,25,24,0.08)] overflow-hidden">
          {results.map((r) => (
            <li key={r.ticker}>
              <button
                className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-inset)] flex items-center gap-3 transition-colors"
                onMouseDown={() => select(r.ticker)}
              >
                <span className="font-mono font-bold text-sm text-[var(--color-brand-text)] w-16 flex-shrink-0">{r.ticker}</span>
                <span className="text-sm text-[var(--color-text-primary)] truncate">{r.name}</span>
                {r.sector && <span className="ml-auto text-xs text-[var(--color-text-muted)] flex-shrink-0">{r.sector}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
