'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search as SearchIcon } from 'lucide-react'
import type { SearchResult } from '@/lib/types/api'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, search])

  function select(ticker: string) {
    router.push(`/stock/${ticker}`)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (results.length > 0) select(results[0].ticker)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-page)' }}>
      {/* Search header */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 h-14"
        style={{
          background: 'var(--color-bg-card)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="flex-shrink-0"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft size={22} />
        </button>

        <form onSubmit={onSubmit} className="relative flex-1">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--color-text-dim)' }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SEARCH TICKER OR COMPANY"
            className="w-full pl-9 pr-9 py-2 text-sm focus:outline-none font-mono"
            style={{
              background: 'var(--color-bg-inset)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              letterSpacing: '0.5px',
            }}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div
                className="w-3.5 h-3.5 rounded-full animate-spin"
                style={{
                  border: '2px solid var(--color-brand)',
                  borderTopColor: 'transparent',
                }}
              />
            </div>
          )}
        </form>
      </div>

      {/* Results */}
      <div className="px-4 py-2">
        {results.length > 0 && (
          <ul>
            {results.map((r) => (
              <li key={r.ticker}>
                <button
                  onClick={() => select(r.ticker)}
                  className="w-full text-left flex items-center gap-3 py-3 transition-colors"
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <span
                    className="font-display font-bold text-base w-16 flex-shrink-0"
                    style={{ color: 'var(--color-brand)', letterSpacing: '-0.5px' }}
                  >
                    {r.ticker}
                  </span>
                  <span
                    className="text-sm truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {r.name}
                  </span>
                  {r.sector && (
                    <span
                      className="ml-auto text-[10px] font-mono flex-shrink-0 uppercase"
                      style={{ color: 'var(--color-text-dim)', letterSpacing: '0.5px' }}
                    >
                      {r.sector}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {searched && !loading && results.length === 0 && (
          <p
            className="text-center py-12 text-xs font-mono uppercase"
            style={{ color: 'var(--color-text-dim)', letterSpacing: '0.5px' }}
          >
            No stocks match &ldquo;{query}&rdquo;
          </p>
        )}

        {!searched && !query && (
          <p
            className="text-center py-12 text-xs font-mono uppercase"
            style={{ color: 'var(--color-text-dim)', letterSpacing: '0.5px' }}
          >
            Search by ticker or company name
          </p>
        )}
      </div>
    </div>
  )
}
