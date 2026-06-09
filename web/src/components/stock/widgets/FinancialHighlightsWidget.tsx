'use client'

import { useState } from 'react'
import type { QuarterlyFinancial } from '@/lib/types/api'
import { QuarterlyTable } from '@/components/stock/quarterly-table'

interface Props {
  quarterly: QuarterlyFinancial[]
  annual: QuarterlyFinancial[]
}

export function FinancialHighlightsWidget({ quarterly, annual }: Props) {
  const [open, setOpen] = useState(false)

  if (quarterly.length === 0 && annual.length === 0) return null

  return (
    <div className="px-4 md:px-12 py-2">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] flex flex-col">
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className={['flex items-center justify-between px-5 py-3 w-full text-left', open && 'border-b border-[var(--color-border)]'].filter(Boolean).join(' ')}
        >
          <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">
            SOROTAN KEUANGAN
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#888888"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={['transition-transform duration-200', open && 'rotate-180'].filter(Boolean).join(' ')}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open && (
          <div className="p-5">
            <QuarterlyTable quarterlyData={quarterly} annualData={annual} />
          </div>
        )}
      </div>
    </div>
  )
}
