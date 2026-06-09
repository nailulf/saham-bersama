'use client'

import { useState } from 'react'

// Berita / cerita — ganti dengan integrasi umpan berita saat tersedia
const MOCK_STORIES = [
  { title: 'Hasil Q4 2025: Laba Bersih Tumbuh 8,2% YoY, Lampaui Estimasi Konsensus', source: 'Bisnis.com',  time: '2 jam lalu',  tag: 'LABA' },
  { title: 'Platform Perbankan Digital Capai 10 Juta Pengguna Aktif Bulanan',          source: 'Kontan.co.id', time: '1 hari lalu', tag: 'DIGITAL' },
  { title: 'OJK Pertahankan Persyaratan Kecukupan Modal untuk Siklus 2026',            source: 'Reuters',      time: '2 hari lalu', tag: 'REGULASI' },
  { title: 'Prospek Sektor Perbankan Indonesia: Stabil Meski Ada Risiko Penurunan Suku Bunga', source: 'Bloomberg', time: '3 hari lalu', tag: 'SEKTOR' },
]

export function StoriesWidget() {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] flex flex-col">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between w-full text-left hover:bg-[var(--color-bg-inset)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">
            BERITA &amp; NARASI UTAMA
          </span>
          <span className="font-mono text-[9px] text-[var(--color-text-muted)] border border-[var(--color-border)] px-1.5 py-0.5">
            ILUSTRASI
          </span>
        </div>
        <span
          className="font-mono text-[12px] text-[var(--color-text-muted)] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▾
        </span>
      </button>

      {/* Collapsible content */}
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: open ? '400px' : '0px' }}
      >
        <div className="flex flex-col gap-1.5 p-3">
          {MOCK_STORIES.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-[var(--color-bg-inset)] border border-[var(--color-border)] px-3 py-2.5"
            >
              <span className="font-mono text-[11px] font-bold text-[#00FF88] bg-[#00FF8818] border border-[#00FF8830] px-1.5 py-0.5 shrink-0">
                {s.tag}
              </span>
              <span className="font-mono text-[13px] text-[var(--color-text-primary)] flex-1 leading-[1.4]">{s.title}</span>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{s.source}</span>
                <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{s.time}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 pb-3">
          <span className="font-mono text-[12px] text-[var(--color-text-muted)]">* Data ilustrasi — akan diganti dengan API berita aktual saat tersedia</span>
        </div>
      </div>
    </div>
  )
}
