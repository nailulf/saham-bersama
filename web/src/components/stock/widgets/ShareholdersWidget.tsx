'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Shareholder } from '@/lib/types/api'

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`
}

function typeLabel(t: string | null): string {
  switch (t) {
    case 'government':  return 'PEM'
    case 'institution': return 'INST'
    case 'individual':  return 'IND'
    case 'public':      return 'PUBLIK'
    default:            return t?.toUpperCase() ?? '—'
  }
}

function typeBg(t: string | null): string {
  switch (t) {
    case 'government':  return 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] border-[var(--color-brand)]'
    case 'institution': return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-text)]'
    case 'individual':  return 'bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] border-[var(--color-border)]'
    default:            return 'bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] border-[var(--color-border)]'
  }
}

interface Props {
  shareholders: Shareholder[]
  shareholderHistory?: Shareholder[][]
  ticker?: string
}

export function ShareholdersWidget({ shareholders, shareholderHistory = [], ticker }: Props) {
  const historyDates = shareholderHistory
    .map((snap) => snap[0]?.report_date ?? null)
    .filter(Boolean) as string[]

  const [selectedIdx, setSelectedIdx] = useState(0)

  const displayed =
    shareholderHistory.length > 0
      ? (shareholderHistory[selectedIdx] ?? shareholders)
      : shareholders

  const snapshotDate = displayed[0]?.report_date ?? null
  const total = displayed.reduce((sum, s) => sum + (s.percentage ?? 0), 0)

  if (displayed.length === 0) {
    return (
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] px-5 py-4">
        <span className="font-mono text-[13px] text-[var(--color-text-muted)]">Tidak ada data pemegang saham</span>
      </div>
    )
  }

  return (
    <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex flex-col gap-0.5">
          {ticker ? (
            <Link
              href={`/investors?ticker=${ticker}`}
              className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)] hover:text-[var(--color-brand)] hover:underline underline-offset-2"
              title="Lihat jaringan pemegang saham"
            >
              PEMEGANG SAHAM →
            </Link>
          ) : (
            <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">PEMEGANG SAHAM</span>
          )}
          {snapshotDate && (
            <span className="font-mono text-[11px] text-[var(--color-text-muted)]">Per tanggal {fmtDate(snapshotDate)}</span>
          )}
        </div>
        {historyDates.length > 1 && (
          <select
            value={selectedIdx}
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            className="font-mono text-[12px] border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-dim)] bg-[var(--color-bg-card)] focus:outline-none"
          >
            {historyDates.map((d, i) => (
              <option key={d} value={i}>
                {fmtDate(d)}{i === 0 ? ' (terbaru)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Column headers */}
      <div className="flex items-center bg-[var(--color-bg-inset)] px-3 py-2">
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] flex-1">PEMEGANG SAHAM</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] w-14">TIPE</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] w-14 text-right">%</span>
      </div>

      {/* Rows — max 8 visible, scroll for rest */}
      <div className="max-h-[360px] overflow-y-auto">
        {displayed.map((s, i) => (
          <div key={i} className="px-3 py-2 border-b border-[var(--color-border)] last:border-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[13px] text-[var(--color-text-primary)] flex-1 truncate">{s.holder_name}</span>
              {s.holder_type && (
                <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 border ${typeBg(s.holder_type)}`}>
                  {typeLabel(s.holder_type)}
                </span>
              )}
              <span className="font-mono text-[13px] font-semibold text-[var(--color-text-primary)] w-14 text-right">
                {s.percentage != null ? `${s.percentage.toFixed(2)}%` : '—'}
              </span>
            </div>
            {s.percentage != null && (
              <div className="h-1 bg-[#E0E0E5]">
                <div
                  className="h-full bg-[#00FF88]"
                  style={{ width: `${Math.min(s.percentage, 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between bg-[var(--color-bg-inset)] px-3 py-2.5">
        <span className="font-mono text-[12px] text-[var(--color-text-muted)]">{displayed.length} pemegang saham ditampilkan (≥1%)</span>
        <span className="font-mono text-[12px] font-semibold text-[var(--color-text-primary)]">
          Ditampilkan: {total.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}
