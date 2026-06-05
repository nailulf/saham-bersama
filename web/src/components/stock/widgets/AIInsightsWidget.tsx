'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles, RefreshCw, ShieldCheck, Shield, ShieldX,
  TrendingUp, TrendingDown, Minus, AlertCircle,
} from 'lucide-react'
import type { AIAnalysis } from '@/lib/types/api'
import { fmtNumID } from '@/lib/calculations/formatters'

interface Props { ticker: string; currentPrice?: number | null }

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
    <span ref={ref} className="inline-block cursor-help" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && mounted && createPortal(
        <span className="fixed z-[9999] pointer-events-none" style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)' }}>
          <span className="block px-3 py-2.5 rounded-xl bg-[var(--color-bg-inset)] text-[var(--color-text-dim)] text-[12px] font-mono leading-[1.6] w-[280px] text-left shadow-2xl border border-[var(--color-border)]">
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
  stalwart:    { label: 'Stalwart',    style: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  slow_grower: { label: 'Slow Grower', style: 'bg-slate-500/10 text-[var(--color-text-muted)] border-slate-500/20' },
  fast_grower: { label: 'Fast Grower', style: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  cyclical:    { label: 'Cyclical',    style: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  turnaround:  { label: 'Turnaround',  style: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  asset_play:  { label: 'Asset Play',  style: 'bg-teal-500/10 text-teal-500 border-teal-500/20' },
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
  const m = LYNCH_META[category] ?? { label: category, style: 'bg-slate-500/10 text-[var(--color-text-dim)] border-slate-500/20' }
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
    wide:   { icon: <ShieldCheck size={10} />, style: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', label: 'Wide Moat' },
    narrow: { icon: <Shield size={10} />,      style: 'bg-amber-500/10 text-amber-600 border-amber-500/20',      label: 'Narrow Moat' },
    none:   { icon: <ShieldX size={10} />,     style: 'bg-red-500/10 text-red-500 border-red-500/20',            label: 'No Moat' },
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

function probNum(p: number | string | undefined): number {
  if (typeof p === 'number') return Math.min(100, Math.max(0, p))
  if (p === 'high')   return 70
  if (p === 'medium') return 45
  if (p === 'low')    return 20
  const n = parseFloat(p ?? '')
  return isNaN(n) ? 45 : n
}

function upsideLabel(target: number, current: number | null | undefined): string | null {
  if (!current) return null
  const pct = ((target - current) / current) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

type WatchRaw = string | { label: string; priority: 'high' | 'normal' }
function watchLabel(item: WatchRaw): string   { return typeof item === 'string' ? item : item.label }
function watchPriority(item: WatchRaw): 'high' | 'normal' { return typeof item === 'string' ? 'normal' : item.priority }

function activeCaseKey(verdict: string): 'bull' | 'neutral' | 'bear' {
  if (verdict === 'strong_buy' || verdict === 'buy') return 'bull'
  if (verdict === 'avoid'      || verdict === 'strong_avoid') return 'bear'
  return 'neutral'
}

// ── Case card themes ──────────────────────────────────────────────────────────

const CASE_THEME = {
  bull: {
    dot:       'var(--color-brand)',
    label:     'BULL CASE',
    activeBg:  'var(--color-brand-bg)',
    border:    'var(--color-brand)',
    textColor: 'var(--color-brand-text)',
    divider:   '#BBF7D0',
    dotColor:  '#86EFAC',
    bodyText:  '#374151',
    footBorder:'#D1FAE5',
    probBg:    '#D1FAE5',
    probFill:  'var(--color-brand-text)',
    inactiveBg:'var(--color-brand-bg)',
    inactiveBorder:'var(--color-brand)',
  },
  neutral: {
    dot:       'var(--color-warning-text)',
    label:     'NEUTRAL',
    activeBg:  'var(--color-warning-bg)',
    border:    'var(--color-warning-text)',
    textColor: 'var(--color-warning-text)',
    divider:   '#FDE68A',
    dotColor:  '#FDE68A',
    bodyText:  '#374151',
    footBorder:'#FEF3C7',
    probBg:    '#FEF3C7',
    probFill:  'var(--color-warning-text)',
    inactiveBg:'var(--color-warning-bg)',
    inactiveBorder:'var(--color-warning-text)',
  },
  bear: {
    dot:       'var(--color-negative-text)',
    label:     'BEAR CASE',
    activeBg:  'var(--color-negative-bg)',
    border:    'var(--color-negative)',
    textColor: 'var(--color-negative-text)',
    divider:   '#FECACA',
    dotColor:  '#FECACA',
    bodyText:  '#374151',
    footBorder:'#FEE2E2',
    probBg:    '#FEE2E2',
    probFill:  'var(--color-negative-text)',
    inactiveBg:'var(--color-negative-bg)',
    inactiveBorder:'var(--color-negative)',
  },
}

// ── CompactCaseCard — top row, click to make it the selected/expanded case ────

function CompactCaseCard({ tier, target, targetLow, targetHigh, probability, currentPrice, onClick }: {
  tier: 'bull' | 'neutral' | 'bear'
  target?: number | null
  targetLow?: number | null
  targetHigh?: number | null
  probability: number | string | undefined
  currentPrice?: number | null
  onClick: () => void
}) {
  const t = CASE_THEME[tier]
  const prob = probNum(probability)
  const displayTarget = target ?? targetHigh ?? null
  const upside = displayTarget ? upsideLabel(displayTarget, currentPrice) : null

  return (
    <button
      onClick={onClick}
      className="rounded-[10px] p-3 flex flex-col gap-1.5 text-left w-full transition-all active:scale-[0.98]"
      style={{ background: t.inactiveBg, border: `1px solid ${t.inactiveBorder}` }}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.dot }} />
        <span className="font-mono text-[9px] font-bold tracking-[0.5px]" style={{ color: t.textColor }}>{t.label}</span>
        <span className="font-mono text-[9px] ml-auto" style={{ color: 'var(--color-text-muted)' }}>{prob}%</span>
      </div>
      {displayTarget != null && (
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Rp {fmtNumID(displayTarget)}
          </span>
          {upside && (
            <span className="font-body text-[9px]" style={{ color: t.textColor }}>{upside}</span>
          )}
        </div>
      )}
    </button>
  )
}

// ── ExpandedCaseCard — always shown at bottom, driven by selectedCase state ───

function ExpandedCaseCard({ tier, scenario, drivers, signals, signalLabel, probability, currentPrice, target, targetLow, targetHigh, isVerdictActive }: {
  tier: 'bull' | 'neutral' | 'bear'
  scenario: string
  drivers: string[]
  signals: string[]
  signalLabel: string
  probability: number | string | undefined
  currentPrice?: number | null
  target?: number | null
  targetLow?: number | null
  targetHigh?: number | null
  isVerdictActive: boolean
}) {
  const t = CASE_THEME[tier]
  const prob = probNum(probability)
  const displayTarget = target ?? targetHigh ?? null
  const upside = displayTarget ? upsideLabel(displayTarget, currentPrice) : null

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: t.activeBg, border: `1.5px solid ${t.border}` }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.dot }} />
          <span className="font-mono text-[10px] font-bold tracking-[0.5px]" style={{ color: t.textColor }}>{t.label}</span>
          {isVerdictActive && (
            <span className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: t.textColor, color: 'white' }}>
              AKTIF
            </span>
          )}
        </div>
        {displayTarget != null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.5)', border: `1px solid ${t.border}` }}>
            <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Rp {fmtNumID(displayTarget)}
            </span>
            {upside && (
              <span className="font-mono text-[10px] font-semibold" style={{ color: t.textColor }}>{upside}</span>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: t.divider }} />

      {/* Scenario text */}
      {scenario && (
        <div className="px-4 pt-3 pb-0">
          <p className="font-body text-[11px] leading-[1.6]" style={{ color: t.bodyText }}>{scenario}</p>
        </div>
      )}

      {/* Drivers */}
      {drivers.length > 0 && (
        <div className="px-4 py-3 flex flex-col gap-2">
          {drivers.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: t.dotColor }} />
              <span className="font-body text-[10px] leading-[1.45]" style={{ color: t.bodyText }}>{d}</span>
            </div>
          ))}
        </div>
      )}

      {/* Early signs / what breaks it */}
      {signals.length > 0 && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          <div className="font-mono text-[8px] font-bold tracking-[0.8px] mb-1" style={{ color: t.textColor }}>
            {signalLabel}
          </div>
          {signals.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono text-[9px] mt-0.5 shrink-0" style={{ color: t.textColor }}>▸</span>
              <span className="font-body text-[10px] leading-[1.45]" style={{ color: t.bodyText }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Probability footer */}
      <div className="px-4 pt-2.5 pb-3.5 flex flex-col gap-1.5"
        style={{ borderTop: `1px solid ${t.footBorder}` }}>
        <div className="flex items-center justify-between">
          <span className="font-body text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Probabilitas Skenario</span>
          <span className="font-mono text-[13px] font-bold" style={{ color: t.textColor }}>{prob}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: t.probBg }}>
          <div className="h-full rounded-full" style={{ width: `${prob}%`, background: t.probFill }} />
        </div>
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function AIInsightsWidget({ ticker, currentPrice }: Props) {
  const [data, setData] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState<string | null>(null)
  const [timeAgo, setTimeAgo] = useState<string>('')
  const [selectedCase, setSelectedCase] = useState<'bull' | 'neutral' | 'bear' | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/ai-analysis`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [ticker])

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
            <p className="font-body text-[13px] text-[var(--color-text-muted)] text-center">{genStatus}</p>
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
            <p className="font-body text-[13px] text-[var(--color-text-muted)] text-center max-w-sm leading-[1.7]">
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

  // ── Derive verdict key and selected viewing case ────────────────────────────
  const d = data   // non-null: early returns above guarantee this
  const verdictKey = activeCaseKey(d.analystVerdict)
  const viewKey = selectedCase ?? verdictKey
  const compactKeys = (['bull', 'neutral', 'bear'] as const).filter(k => k !== viewKey)

  function getCaseProps(k: 'bull' | 'neutral' | 'bear') {
    if (k === 'bull' && d.bullCase) return {
      scenario: d.bullCase.scenario,
      drivers:  d.bullCase.drivers,
      signals:  d.bullCase.early_signs ?? [],
      signalLabel: 'TANDA AWAL',
      target:   d.bullCase.price_target,
      prob:     d.bullCase.probability,
    }
    if (k === 'neutral' && d.neutralCase) return {
      scenario: d.neutralCase.scenario,
      drivers:  d.neutralCase.drivers,
      signals:  d.neutralCase.what_breaks_it ?? [],
      signalLabel: 'PEMICU PERUBAHAN',
      targetLow:  d.neutralCase.price_range_low,
      targetHigh: d.neutralCase.price_range_high,
      prob:       d.neutralCase.probability,
    }
    if (k === 'bear' && d.bearCase) return {
      scenario: d.bearCase.scenario,
      drivers:  d.bearCase.drivers,
      signals:  d.bearCase.early_signs ?? [],
      signalLabel: 'TANDA AWAL',
      target:   d.bearCase.price_target,
      prob:     d.bearCase.probability,
    }
    return null
  }

  const viewProps = getCaseProps(viewKey)

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
            <div className="font-mono text-[8px] font-bold tracking-[0.8px] mb-2" style={{ color: 'var(--color-text-ghost)' }}>
              INVESTMENT THESIS
            </div>
            <p className="font-body text-[11px] leading-[1.55]" style={{ color: 'var(--color-text-muted)' }}>
              {d.businessNarrative}
            </p>
          </div>
        )}

        {/* 2. Classification badges */}
        <div className="flex flex-wrap gap-1.5">
          <LynchBadge category={d.lynchCategory} />
          {d.buffettMoat && d.buffettMoat !== 'none' && <MoatBadge moat={d.buffettMoat} />}
        </div>

        {/* 3. Compact case cards (always the 2 non-selected cases) — tap to switch */}
        {compactKeys.filter(k => getCaseProps(k)).length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {compactKeys.map(k => {
              const p = getCaseProps(k)
              if (!p) return null
              return (
                <CompactCaseCard
                  key={k}
                  tier={k}
                  target={'target' in p ? (p as { target: number }).target : undefined}
                  targetLow={'targetLow' in p ? (p as { targetLow: number }).targetLow : undefined}
                  targetHigh={'targetHigh' in p ? (p as { targetHigh: number }).targetHigh : undefined}
                  probability={p.prob}
                  currentPrice={currentPrice}
                  onClick={() => setSelectedCase(k)}
                />
              )
            })}
          </div>
        )}

        {/* 4. Expanded case card (always the selected/viewed case) */}
        {viewProps && (
          <ExpandedCaseCard
            tier={viewKey}
            scenario={viewProps.scenario}
            drivers={viewProps.drivers}
            signals={viewProps.signals}
            signalLabel={viewProps.signalLabel}
            probability={viewProps.prob}
            currentPrice={currentPrice}
            target={'target' in viewProps ? (viewProps as { target: number }).target : undefined}
            targetLow={'targetLow' in viewProps ? (viewProps as { targetLow: number }).targetLow : undefined}
            targetHigh={'targetHigh' in viewProps ? (viewProps as { targetHigh: number }).targetHigh : undefined}
            isVerdictActive={viewKey === verdictKey}
          />
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
