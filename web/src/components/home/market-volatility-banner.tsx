'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { VolatilityAlert } from '@/lib/types/api'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1] ?? ''}`
}

function chipDotColor(a: VolatilityAlert): string {
  return a.status === 'active' ? '#DC2626' : '#D97706'
}

export function MarketVolatilityBanner({ alerts }: { alerts: VolatilityAlert[] }) {
  const [dismissed, setDismissed] = useState(false)

  if (alerts.length === 0 || dismissed) return null

  const hasActive = alerts.some((a) => a.status === 'active')
  const headline = hasActive
    ? 'Volatilitas Tinggi — Window Aktif Sekarang'
    : 'Volatilitas Tinggi — Event Pasar Minggu Ini'

  return (
    <div
      role="status"
      className="mx-5 mt-3 rounded-xl px-4 py-3 flex items-start gap-3"
      style={{
        background: 'var(--color-warning-bg)',
        borderBottom: '2px solid var(--color-warning-text)',
      }}
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-[6px]"
        style={{ background: 'var(--color-warning-bg)' }}
      >
        <AlertTriangle
          size={16}
          style={{ color: 'var(--color-warning-text)' }}
          aria-hidden="true"
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <span
          className="text-[11px] font-semibold leading-snug"
          style={{ color: 'var(--color-warning-text)', fontFamily: 'var(--font-inter)' }}
        >
          {headline}
        </span>

        {/* Event chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {alerts.map((a) => (
            <span
              key={`${a.eventDate}-${a.title}`}
              className="flex items-center gap-1 rounded px-[7px] py-[2px]"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-warning-bg)',
              }}
            >
              <span
                className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                style={{ background: chipDotColor(a) }}
                aria-hidden="true"
              />
              <span
                className="text-[9px] font-medium"
                style={{ color: 'var(--color-warning-text)', fontFamily: 'var(--font-inter)' }}
              >
                {a.title} · {fmtDate(a.eventDate)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="flex-shrink-0 mt-0.5"
      >
        <X size={14} style={{ color: 'var(--color-warning-text)', opacity: 0.6 }} />
      </button>
    </div>
  )
}
