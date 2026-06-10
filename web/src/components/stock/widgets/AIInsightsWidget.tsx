'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles, RefreshCw, ShieldCheck, Shield, ShieldX,
  TrendingUp, TrendingDown, Minus, AlertCircle,
} from 'lucide-react'
import type { AIAnalysis } from '@/lib/types/api'
import { ScenarioCards, type ScenarioCaseData, type ScenarioTier } from '@/components/ui/ScenarioCards'

interface Props { ticker: string; currentPrice?: number | null; initialData?: AIAnalysis | null }

// ── Tooltip ───────────────────────────────────────────────────────────────────

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const handleEnter = useCallback(() => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      setCoords({ top: r.top + window.scrollY - 8, left: r.left + r.width / 2 })
    }
    setShow(true)
  }, [])

  return (
    <span ref={ref} className="inline-flex items-center cursor-help" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && mounted && createPortal(
        <span className="fixed z-[9999] pointer-events-none" style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)' }}>
          <span className="block px-3 py-2.5 rounded-xl bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] text-[13px] font-mono leading-[1.6] w-[280px] text-left shadow-2xl border border-[var(--color-border)]">
            {text}
          </span>
        </span>,
        document.body,
      )}
    </span>
  )
}

// ── Classification badges ─────────────────────────────────────────────────────

const LYNCH_META: Record<string, { label: string; style: string }> = {
  stalwart:    { label: 'Stalwart',    style: 'bg-[var(--color-cat-blue-bg)] text-[var(--color-cat-blue)] border-[var(--color-cat-blue)]' },
  slow_grower: { label: 'Slow Grower', style: 'bg-[var(--color-neutral-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]' },
  fast_grower: { label: 'Fast Grower', style: 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] border-[var(--color-brand)]' },
  cyclical:    { label: 'Cyclical',    style: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-text)]' },
  turnaround:  { label: 'Turnaround',  style: 'bg-[var(--color-cat-purple-bg)] text-[var(--color-cat-purple)] border-[var(--color-cat-purple)]' },
  asset_play:  { label: 'Asset Play',  style: 'bg-[var(--color-cat-teal-bg)] text-[var(--color-cat-teal)] border-[var(--color-cat-teal)]' },
}
const LYNCH_TIPS: Record<string, string> = {
  stalwart:    'Stalwart (Lynch): Perusahaan besar berkualitas, tumbuh 10-12%. Tahan resesi, cocok sebagai core holding.',
  slow_grower: 'Slow Grower (Lynch): Perusahaan matang, tumbuh 2-4%. Dibeli untuk dividen.',
  fast_grower: 'Fast Grower (Lynch): Pertumbuhan 20%+. Potensi keuntungan tinggi tapi berisiko.',
  cyclical:    'Cyclical (Lynch): Naik-turun ikuti siklus ekonomi/komoditas. Timing lebih penting dari valuasi.',
  turnaround:  'Turnaround (Lynch): Dalam krisis atau pemulihan. Hasil bisa binary.',
  asset_play:  'Asset Play (Lynch): Aset berharga belum tercermin di harga saham.',
}

function LynchBadge({ category }: { category: string }) {
  const m = LYNCH_META[category] ?? { label: category, style: 'bg-[var(--color-neutral-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]' }
  return (
    <Tooltip text={LYNCH_TIPS[category] ?? 'Kategori saham (Peter Lynch).'}>
      <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wide px-2.5 py-1 border rounded-full ${m.style}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
        {m.label}
      </span>
    </Tooltip>
  )
}

function MoatBadge({ moat }: { moat: string }) {
  const cfg: Record<string, { icon: React.ReactNode; style: string; label: string }> = {
    wide:   { icon: <ShieldCheck size={10} />, style: 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] border-[var(--color-brand)]',         label: 'Wide Moat' },
    narrow: { icon: <Shield size={10} />,      style: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-text)]', label: 'Narrow Moat' },
    none:   { icon: <ShieldX size={10} />,     style: 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)] border-[var(--color-negative)]',  label: 'No Moat' },
  }
  const c = cfg[moat] ?? cfg.none
  const tips: Record<string, string> = {
    wide:   'Wide Moat (Buffett): Keunggulan kompetitif kuat dan tahan lama.',
    narrow: 'Narrow Moat: Ada keunggulan kompetitif tapi terbatas.',
    none:   'No Moat: Tidak ada keunggulan kompetitif. Bersaing di harga.',
  }
  return (
    <Tooltip text={tips[moat] ?? ''}>
      <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wide px-2.5 py-1 border rounded-full ${c.style}`}>
        {c.icon}
        {c.label}
      </span>
    </Tooltip>
  )
}

// ── Re-analyze control ────────────────────────────────────────────────────────

function ReanalyzeControl({ isStale, lastDataChangeAt, generating, onClick }: {
  isStale: boolean; lastDataChangeAt: string | null
  generating: boolean; onClick: () => void
}) {
  if (generating) return (
    <span className="inline-flex items-center gap-1.5 font-body text-[9px] font-medium px-2 py-1 rounded-md"
      style={{ background: 'var(--color-brand-bg)', color: 'var(--color-brand-text)', border: '1px solid var(--color-brand)' }}>
      <RefreshCw size={9} className="animate-spin" />
      Menganalisis…
    </span>
  )
  if (isStale) {
    const since = lastDataChangeAt ? new Date(lastDataChangeAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : null
    return (
      <Tooltip text={since ? `Data baru tersedia sejak ${since}. Klik untuk re-analyze.` : 'Data baru tersedia.'}>
        <button onClick={onClick}
          className="inline-flex items-center gap-1.5 font-body text-[9px] font-medium px-2 py-1 rounded-md transition-colors"
          style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', border: '1px solid var(--color-warning-text)' }}>
          <RefreshCw size={9} />
          Data baru
        </button>
      </Tooltip>
    )
  }
  return null
}

// ── Utility helpers ───────────────────────────────────────────────────────────

type WatchRaw = string | { label: string; priority: 'high' | 'normal' }
function watchLabel(item: WatchRaw): string   { return typeof item === 'string' ? item : item.label }
function watchPriority(item: WatchRaw): 'high' | 'normal' { return typeof item === 'string' ? 'normal' : item.priority }

function activeCaseKey(verdict: string): ScenarioTier {
  if (verdict === 'strong_buy' || verdict === 'buy') return 'bull'
  if (verdict === 'avoid'      || verdict === 'strong_avoid') return 'bear'
  return 'neutral'
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function AIInsightsWidget({ ticker, currentPrice, initialData = null }: Props) {
  const [data, setData] = useState<AIAnalysis | null>(initialData)
  // Seeded server-side → render immediately (this paragraph is the page's LCP).
  const [loading, setLoading] = useState(initialData == null)
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState<string | null>(null)
  const [timeAgo, setTimeAgo] = useState<string>('')

  useEffect(() => {
    // Already have server-rendered analysis — skip the mount fetch entirely.
    if (initialData) return
    fetch(`/api/stocks/${ticker}/ai-analysis`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [ticker, initialData])

  useEffect(() => {
    if (!data?.generatedAt) return
    const mins = Math.floor((Date.now() - new Date(data.generatedAt).getTime()) / 60000)
    if (mins < 60)    setTimeAgo(`${mins}m lalu`)
    else if (mins < 1440) setTimeAgo(`${Math.floor(mins / 60)}j lalu`)
    else setTimeAgo(`${Math.floor(mins / 1440)}h lalu`)
  }, [data?.generatedAt])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setGenStatus('Memulai pipeline...')
    const prevGeneratedAt = data?.generatedAt ?? null
    try {
      const res = await fetch(`/api/stocks/${ticker}/trigger-ai-analysis`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setGenStatus(`Gagal: ${body.error ?? 'unknown'}`); setGenerating(false); return }
      if (body.dispatch_ok === false) {
        setGenStatus(body.manual_command ? `Jalankan manual:\n${body.manual_command}` : `Dispatch gagal: ${body.dispatch_error ?? 'unknown'}`)
        setGenerating(false); return
      }
      const jobId: number = body.job_id
      setGenStatus('Pipeline berjalan via GitHub Actions — estimasi 3–7 menit...')
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        if (attempts > 42) {
          clearInterval(interval)
          setGenStatus('Timeout — jalankan manual:\npython run_all.py --ai-full --ticker ' + ticker)
          setGenerating(false); return
        }
        try {
          const [analysisRes, jobRes] = await Promise.all([
            fetch(`/api/stocks/${ticker}/ai-analysis`),
            fetch(`/api/stocks/${ticker}/refresh/${jobId}`),
          ])
          const [analysisData, jobData] = await Promise.all([
            analysisRes.ok ? analysisRes.json() : null,
            jobRes.ok ? jobRes.json() : null,
          ])
          const isNew = analysisData?.analystVerdict && (
            prevGeneratedAt === null ||
            (analysisData.generatedAt && new Date(analysisData.generatedAt) > new Date(prevGeneratedAt))
          )
          if (isNew) { clearInterval(interval); setData(analysisData); setGenStatus(null); setGenerating(false); return }
          if (jobData?.status === 'failed') {
            clearInterval(interval)
            setGenStatus(`Pipeline gagal: ${jobData.error_message ?? 'unknown error'}`)
            setGenerating(false); return
          }
          if (jobData?.status === 'done') {
            const failedScraper = (jobData.progress ?? []).find((p: { status: string; scraper: string; error_msg: string | null }) => p.status === 'failed')
            clearInterval(interval)
            setGenStatus(failedScraper
              ? `${failedScraper.scraper} gagal: ${failedScraper.error_msg ?? 'unknown error'}`
              : 'Pipeline selesai tapi analisis baru tidak ditemukan. Coba lagi atau jalankan manual.')
            setGenerating(false); return
          }
          if (attempts > 6) setGenStatus(`Pipeline berjalan... (${attempts * 10}s)`)
        } catch { /* ignore */ }
      }, 10000)
    } catch (e) {
      setGenStatus(`Error: ${e instanceof Error ? e.message : 'unknown'}`); setGenerating(false)
    }
  }, [ticker, data?.generatedAt])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5 animate-pulse">
        <div className="h-3 w-36 rounded bg-[var(--color-bg-inset)] mb-4" />
        <div className="h-3 bg-[var(--color-bg-inset)] rounded w-full mb-2" />
        <div className="h-3 bg-[var(--color-bg-inset)] rounded w-5/6 mb-2" />
        <div className="h-3 bg-[var(--color-bg-inset)] rounded w-3/5 mb-4" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-14 rounded-[10px] bg-[var(--color-bg-inset)]" />
          <div className="h-14 rounded-[10px] bg-[var(--color-bg-inset)]" />
        </div>
      </div>
    )
  }

  // ── Empty / generate state ─────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={15} className="text-[var(--color-brand)]" />
          <span className="font-mono text-[12px] font-bold tracking-[1px] text-[var(--color-text-primary)]">SKENARIO & RISIKO</span>
        </div>
        {generating ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-7 h-7 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
            <p className="font-body text-[13px] md:text-[14px] text-[var(--color-text-muted)] text-center">{genStatus}</p>
          </div>
        ) : genStatus ? (
          <div className="flex flex-col gap-3">
            <pre className="font-mono text-[11px] text-[var(--color-warning-text)] whitespace-pre-wrap break-all bg-[var(--color-warning-bg)] rounded-lg p-3 border border-[var(--color-warning-text)]">{genStatus}</pre>
            <button onClick={handleGenerate}
              className="self-start font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--color-bg-inset)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 gap-4">
            <p className="font-body text-[13px] md:text-[14px] text-[var(--color-text-muted)] text-center max-w-sm leading-[1.7]">
              Analisis AI belum tersedia. Generate 3 skenario investasi (bull/neutral/bear), klasifikasi Lynch, dan rekomendasi strategi.
            </p>
            <button onClick={handleGenerate}
              className="font-body font-semibold text-[13px] px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
              style={{ background: 'var(--color-brand-bg)', color: 'var(--color-brand-text)', border: '1px solid var(--color-brand)' }}>
              <Sparkles size={14} />
              Generate Analisis
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Derive verdict key and scenario cases ───────────────────────────────────
  const d = data   // non-null: early returns above guarantee this
  const verdictKey = activeCaseKey(d.analystVerdict)

  const cases: ScenarioCaseData[] = [
    d.bullCase && {
      tier: 'bull' as ScenarioTier,
      scenario: d.bullCase.scenario,
      drivers:  d.bullCase.drivers,
      signals:  d.bullCase.early_signs ?? [],
      signalLabel: 'TANDA AWAL',
      target:   d.bullCase.price_target,
      probability: d.bullCase.probability,
    },
    d.neutralCase && {
      tier: 'neutral' as ScenarioTier,
      scenario: d.neutralCase.scenario,
      drivers:  d.neutralCase.drivers,
      signals:  d.neutralCase.what_breaks_it ?? [],
      signalLabel: 'PEMICU PERUBAHAN',
      targetLow:  d.neutralCase.price_range_low,
      targetHigh: d.neutralCase.price_range_high,
      probability: d.neutralCase.probability,
    },
    d.bearCase && {
      tier: 'bear' as ScenarioTier,
      scenario: d.bearCase.scenario,
      drivers:  d.bearCase.drivers,
      signals:  d.bearCase.early_signs ?? [],
      signalLabel: 'TANDA AWAL',
      target:   d.bearCase.price_target,
      probability: d.bearCase.probability,
    },
  ].filter(Boolean) as ScenarioCaseData[]

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">

      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="font-display text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Skenario &amp; Risiko
        </span>
        <div className="flex items-center gap-2">
          <ReanalyzeControl
            isStale={d.isStale}
            lastDataChangeAt={d.lastDataChangeAt}
            generating={generating}
            onClick={handleGenerate}
          />
          {!generating && timeAgo && (
            <div className="flex items-center gap-1 font-body text-[9px] px-2 py-1 rounded-md"
              style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)' }}>
              <RefreshCw size={9} />
              {timeAgo}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3">

        {/* 1. Investment Thesis */}
        {d.businessNarrative && (
          <div className="rounded-lg p-3.5" style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)' }}>
            <div className="font-mono text-[9px] font-bold tracking-[0.8px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
              INVESTMENT THESIS
            </div>
            <p className="font-body text-[13px] md:text-[14px] leading-[1.55]" style={{ color: 'var(--color-text-primary)' }}>
              {d.businessNarrative}
            </p>
          </div>
        )}

        {/* 2. Classification badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <LynchBadge category={d.lynchCategory} />
          {d.buffettMoat && d.buffettMoat !== 'none' && <MoatBadge moat={d.buffettMoat} />}
        </div>

        {/* 3. Bull / Neutral / Bear scenario cards — collapsed by default,
              one-active expand/collapse (reflow on desktop, accordion on mobile) */}
        {cases.length > 0 && (
          <ScenarioCards cases={cases} currentPrice={currentPrice} activeTier={verdictKey} />
        )}

        {/* 5. PANTAU TERUS */}
        {d.whatToWatch.length > 0 && (
          <div>
            <div className="font-mono text-[9px] font-bold tracking-[0.8px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
              PANTAU TERUS
            </div>
            <div className="flex flex-wrap gap-1.5">
              {d.whatToWatch.map((item, i) => {
                const label = watchLabel(item)
                const priority = watchPriority(item)
                const isHigh = priority === 'high'
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 font-body text-[10px] px-2.5 py-1 rounded-md"
                    style={isHigh ? {
                      background: 'var(--color-warning-bg)',
                      color: 'var(--color-warning-text)',
                      border: '1px solid var(--color-warning-text)',
                    } : {
                      background: 'var(--color-bg-inset)',
                      color: 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {isHigh && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-warning-text)' }} />}
                    {label}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* 6. Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg p-2.5"
          style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)' }}>
          <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--color-text-ghost)' }} />
          <p className="font-body text-[9px] leading-[1.5]" style={{ color: 'var(--color-text-muted)' }}>
            Untuk tujuan edukasi saja. Bukan saran investasi. Selalu lakukan riset mandiri.
          </p>
        </div>

      </div>
    </div>
  )
}
