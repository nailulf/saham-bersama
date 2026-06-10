'use client'

import Link from 'next/link'

export default function StockError({ reset }: { reset: () => void }) {
  return (
    <main className="max-w-7xl mx-auto px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Something went wrong</h1>
      <p className="text-[var(--color-text-muted)] mb-6">Failed to load stock data.</p>
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="px-4 py-2 bg-[var(--color-brand)] text-[#0A0A0A] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">Retry</button>
        <Link href="/" className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-inset)] transition-colors">Back to home</Link>
      </div>
    </main>
  )
}
