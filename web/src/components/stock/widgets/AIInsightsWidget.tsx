'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles, RefreshCw, ShieldCheck, Shield, ShieldX,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Target, ArrowDownCircle, OctagonX, AlertCircle,
} from 'lucide-react'
import type { AIAnalysis } from '@/lib/types/api'

interface Props { ticker: string }

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
          <span className="block px-3 py-2.5 rounded-xl bg-[#0F1C35] text-slate-300 text-[12px] font-mono leading-[1.6] w-[280px] text-left shadow-2xl border border-[#1E3357]/80">
            {text}
          </span>
          <span className="block w-0 h-0 mx-auto border-[6px] border-transparent border-t-[#0F1C35]" style={{ marginTop: '-1px' }} />
        </span>,
        document.body,
      )}
    </span>
  )
}

// ── Classification badges ─────────────────────────────────────────────────────

const LYNCH_META: Record<string, { label: string; style: string }> = {
  stalwart:    { label: 'Stalwart',    style: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  slow_grower: { label: 'Slow Grower', style: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
  fast_grower: { label: 'Fast Grower', style: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  cyclical:    { label: 'Cyclical',    style: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  turnaround:  { label: 'Turnaround',  style: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
  asset_play:  { label: 'Asset Play',  style: 'bg-teal-500/10 text-teal-300 border-teal-500/20' },
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
  const m = LYNCH_META[category] ?? { label: category, style: 'bg-slate-500/10 text-slate-300 border-slate-500/20' }
  return (
    <Tooltip text={LYNCH_TIPS[category] ?? 'Kategori saham (Peter Lynch).'}>
      <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wide px-3 py-1 border rounded-full ${m.style}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
        {m.label}
      </span>
    </Tooltip>
  )
}

const MOAT_TIPS = {
  wide:   'Wide Moat (Buffett): Keunggulan kompetitif kuat dan tahan lama — pricing power, switching cost tinggi, network effect.',
  narrow: 'Narrow Moat: Ada keunggulan kompetitif tapi terbatas. Bisa terkikis seiring waktu.',
  none:   'No Moat: Tidak ada keunggulan kompetitif. Bersaing di harga — margin bisa tertekan kapan saja.',
}

function MoatBadge({ moat }: { moat: string }) {
  const cfg: Record<string, { icon: React.ReactNode; style: string; label: string }> = {
    wide:   { icon: <ShieldCheck size={11} />, style: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', label: 'Wide Moat' },
    narrow: { icon: <Shield size={11} />,      style: 'bg-amber-500/10 text-amber-300 border-amber-500/20',       label: 'Narrow Moat' },
    none:   { icon: <ShieldX size={11} />,     style: 'bg-red-500/10 text-red-400 border-red-500/20',             label: 'No Moat' },
  }
  const c = cfg[moat] ?? cfg.none
  return (
    <Tooltip text={MOAT_TIPS[moat as keyof typeof MOAT_TIPS] ?? ''}>
      <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-wide px-3 py-1 border rounded-full ${c.style}`}>
        {c.icon}
        {c.label}
      </span>
    </Tooltip>
  )
}

// ── Verdict badge ─────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  const cfg: Record<string, { icon: React.ReactNode; style: string; label: string }> = {
    strong_buy:   { icon: <TrendingUp size={12} />,   style: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 shadow-emerald-500/10 shadow-md', label: 'Strong Buy' },
    buy:          { icon: <TrendingUp size={12} />,   style: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',                                  label: 'Buy' },
    hold:         { icon: <Minus size={12} />,        style: 'bg-amber-500/10 text-amber-300 border-amber-500/25',                                        label: 'Hold' },
    avoid:        { icon: <TrendingDown size={12} />, style: 'bg-red-500/10 text-red-400 border-red-500/25',                                              label: 'Avoid' },
    strong_avoid: { icon: <TrendingDown size={12} />, style: 'bg-red-500/20 text-red-200 border-red-500/40 shadow-red-500/10 shadow-md',                   label: 'Strong Avoid' },
  }
  const c = cfg[verdict] ?? cfg.hold
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-mono text-[12px] font-bold tracking-wide ${c.style}`}>
      {c.icon}
      {c.label.toUpperCase()}
    </span>
  )
}

// ── Re-analyze control ────────────────────────────────────────────────────────

function ReanalyzeControl({ isStale, lastDataChangeAt, generatedAt, generating, onClick }: {
  isStale: boolean; lastDataChangeAt: string | null; generatedAt: string | null
  generating: boolean; onClick: () => void
}) {
  if (generating) return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
      <RefreshCw size={11} className="animate-spin" />
      Analyzing…
    </span>
  )
  if (isStale) {
    const since = lastDataChangeAt ? new Date(lastDataChangeAt) : null
    return (
      <Tooltip text={since ? `Data baru tersedia sejak ${since.toLocaleDateString()}. Klik untuk re-analyze.` : 'Data baru tersedia.'}>
        <button onClick={onClick} className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-3 py-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
          <RefreshCw size={11} />
          Re-analyze
        </button>
      </Tooltip>
    )
  }
  const label = generatedAt ? new Date(generatedAt).toLocaleDateString() : '—'
  return (
    <Tooltip text={`Belum ada data baru sejak ${label}. Re-analyze aktif saat pipeline mendeteksi periode baru.`}>
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 rounded-full border border-[#1E3357] text-slate-600 cursor-not-allowed">
        <RefreshCw size={11} />
        Re-analyze
      </span>
    </Tooltip>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return `Rp ${n.toLocaleString('en')}`
}

function Divider() {
  return <div className="mx-5 md:mx-7 h-px bg-[#1E3357]/50" />
}

// ── Conclusion + Thesis (integrated) ─────────────────────────────────────────

function ProbabilityPill({ probability }: { probability: string }) {
  const s: Record<string, string> = {
    high:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    low:    'bg-red-500/15 text-red-400 border-red-500/25',
  }
  return (
    <span className={`font-mono text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full border uppercase ${s[probability] ?? s.low}`}>
      {probability}
    </span>
  )
}

function ScenarioCard({ label, borderColor, icon, scenario, drivers, priceLabel, priceValue, timeframe, probability, signals }: {
  label: string; borderColor: string; icon: React.ReactNode; scenario: string
  drivers: string[]; priceLabel: string; priceValue: string
  timeframe: string; probability: string; signals: string[]
}) {
  return (
    <div className={`border rounded-xl bg-[#1C2E4A]/60 overflow-hidden ${borderColor}`}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#1E3357]/40">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-mono text-[12px] font-bold tracking-wide text-slate-200">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <ProbabilityPill probability={probability} />
          <span className="font-mono text-[11px] text-slate-500">{timeframe}</span>
        </div>
      </div>
      <div className="px-4 py-4 flex flex-col gap-3">
        <p className="font-display text-[14px] text-slate-300 leading-[1.75]">{scenario}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-slate-500">{priceLabel}:</span>
          <span className="font-mono text-[15px] font-bold text-slate-100">{priceValue}</span>
        </div>
        {drivers.length > 0 && (
          <div>
            <div className="font-mono text-[10px] font-bold tracking-widest text-slate-600 uppercase mb-2">Faktor Pendorong</div>
            <ul className="flex flex-col gap-1.5">
              {drivers.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-slate-600 mt-1 shrink-0 text-[9px]">●</span>
                  <span className="font-display text-[13px] text-slate-400 leading-[1.5]">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {signals.length > 0 && (
          <div>
            <div className="font-mono text-[10px] font-bold tracking-widest text-slate-600 uppercase mb-2">Tanda Awal</div>
            <ul className="flex flex-col gap-1.5">
              {signals.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5 shrink-0">▸</span>
                  <span className="font-display text-[13px] text-slate-400 leading-[1.5]">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function ConclusionWithThesis({ bull, neutral, bear }: {
  bull: AIAnalysis['bullCase']; neutral: AIAnalysis['neutralCase']; bear: AIAnalysis['bearCase']
}) {
  const [showScenarios, setShowScenarios] = useState(false)
  if (!bull && !neutral && !bear) return null

  const cards = [
    {
      label: 'Target Harga',
      icon: <Target size={15} className="text-emerald-400" />,
      value: bull?.price_target ? fmtPrice(bull.price_target) : '—',
      sub: bull?.timeframe,
      bg: 'bg-emerald-500/[0.10]',
      border: 'border-emerald-500/25',
      valueColor: 'text-emerald-300',
    },
    {
      label: 'Zona Masuk',
      icon: <ArrowDownCircle size={15} className="text-blue-400" />,
      value: neutral?.price_range_low ? fmtPrice(neutral.price_range_low) : '—',
      sub: neutral?.price_range_high ? `s/d ${fmtPrice(neutral.price_range_high)}` : undefined,
      bg: 'bg-blue-500/[0.10]',
      border: 'border-blue-500/25',
      valueColor: 'text-blue-300',
    },
    {
      label: 'Stop Loss',
      icon: <OctagonX size={15} className="text-red-400" />,
      value: bear?.price_target ? fmtPrice(bear.price_target) : '—',
      sub: bear?.timeframe,
      bg: 'bg-red-500/[0.10]',
      border: 'border-red-500/25',
      valueColor: 'text-red-300',
    },
  ]

  return (
    <div className="px-5 md:px-7 py-6">
      <div className="font-mono text-[11px] font-bold tracking-widest text-slate-500 uppercase mb-4">
        Ringkasan Keputusan
      </div>

      {/* 3 colored price cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-xl border px-5 py-4 ${c.bg} ${c.border}`}>
            <div className="flex items-center gap-2 mb-3">
              {c.icon}
              <span className="font-mono text-[10px] font-bold tracking-widest text-slate-500 uppercase">{c.label}</span>
            </div>
            <div className={`font-mono text-[26px] font-bold leading-none mb-1.5 ${c.valueColor}`}>{c.value}</div>
            {c.sub && <div className="font-mono text-[12px] text-slate-500">{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Expand scenarios inline */}
      <button
        onClick={() => setShowScenarios(v => !v)}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#1E3357] text-slate-500 hover:text-slate-300 hover:border-[#2A4570] hover:bg-white/[0.02] transition-colors font-mono text-[12px] font-semibold tracking-wide"
      >
        {showScenarios ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showScenarios ? 'Sembunyikan skenario' : 'Lihat detail skenario'}
      </button>

      {showScenarios && (
        <div className="flex flex-col gap-3 mt-4">
          {bull && (
            <ScenarioCard
              label="Bull Case" borderColor="border-emerald-500/20"
              icon={<TrendingUp size={13} className="text-emerald-400" />}
              scenario={bull.scenario} drivers={bull.drivers ?? []}
              priceLabel="Target" priceValue={fmtPrice(bull.price_target)}
              timeframe={bull.timeframe ?? ''} probability={bull.probability ?? 'low'}
              signals={bull.early_signs ?? []}
            />
          )}
          {neutral && (
            <ScenarioCard
              label="Neutral — Most Likely" borderColor="border-[#1E3357]"
              icon={<Minus size={13} className="text-slate-400" />}
              scenario={neutral.scenario} drivers={neutral.drivers ?? []}
              priceLabel="Range" priceValue={`${fmtPrice(neutral.price_range_low)} – ${fmtPrice(neutral.price_range_high)}`}
              timeframe={neutral.timeframe ?? ''} probability={neutral.probability ?? 'high'}
              signals={neutral.what_breaks_it ?? []}
            />
          )}
          {bear && (
            <ScenarioCard
              label="Bear Case" borderColor="border-red-500/20"
              icon={<TrendingDown size={13} className="text-red-400" />}
              scenario={bear.scenario} drivers={bear.drivers ?? []}
              priceLabel="Target" priceValue={fmtPrice(bear.price_target)}
              timeframe={bear.timeframe ?? ''} probability={bear.probability ?? 'medium'}
              signals={bear.early_signs ?? []}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Collapsible caveats ───────────────────────────────────────────────────────

function CaveatsSection({ caveats, dataGaps }: { caveats: string[]; dataGaps: string[] }) {
  const [open, setOpen] = useState(false)
  if (caveats.length === 0 && dataGaps.length === 0) return null
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 md:px-7 py-4 hover:bg-white/[0.015] transition-colors group"
      >
        <div className="flex items-center gap-2">
          <AlertCircle size={13} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
          <span className="font-mono text-[11px] font-bold tracking-widest text-slate-500 uppercase group-hover:text-slate-400 transition-colors">
            Catatan &amp; Keterbatasan Data
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
      </button>
      {open && (
        <div className="px-5 md:px-7 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          {caveats.length > 0 && (
            <div>
              <div className="font-mono text-[10px] font-bold tracking-widest text-slate-600 uppercase mb-2.5">Catatan</div>
              <ul className="flex flex-col gap-2">
                {caveats.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-slate-700 mt-1.5 shrink-0 text-[8px]">●</span>
                    <p className="font-display text-[13px] text-slate-500 leading-[1.6]">{c}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dataGaps.length > 0 && (
            <div>
              <div className="font-mono text-[10px] font-bold tracking-widest text-slate-600 uppercase mb-2.5">Keterbatasan Data</div>
              <ul className="flex flex-col gap-2">
                {dataGaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-slate-700 mt-1.5 shrink-0 text-[8px]">●</span>
                    <p className="font-display text-[13px] text-slate-500 leading-[1.6]">{g}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function AIInsightsWidget({ ticker }: Props) {
  const [data, setData] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/ai-analysis`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [ticker])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setGenStatus('Memulai pipeline...')
    // Capture the current analysis timestamp so the poll can detect a genuinely
    // new result — without this, the old analysis (which already has analystVerdict)
    // would immediately satisfy the poll condition and stop the loop too early.
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

          // New analysis written — success
          const isNew = analysisData?.analystVerdict && (
            prevGeneratedAt === null ||
            (analysisData.generatedAt && new Date(analysisData.generatedAt) > new Date(prevGeneratedAt))
          )
          if (isNew) {
            clearInterval(interval); setData(analysisData); setGenStatus(null); setGenerating(false); return
          }

          // Job reached a terminal state — check for errors
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
      <div className="px-4 md:px-12 py-2">
        <div className="bg-[#162540] rounded-2xl border border-[#1E3357]/60 p-7 animate-pulse">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[#1C2E4A]" />
            <div className="h-3 w-32 rounded bg-[#1C2E4A]" />
          </div>
          <div className="h-4 bg-[#1C2E4A] rounded w-full mb-2.5" />
          <div className="h-4 bg-[#1C2E4A] rounded w-5/6 mb-2.5" />
          <div className="h-4 bg-[#1C2E4A] rounded w-3/5" />
        </div>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="px-4 md:px-12 py-2">
        <div className="bg-[#162540] rounded-2xl border border-[#1E3357]/60 p-7">
          <div className="flex items-center gap-2.5 mb-6">
            <Sparkles size={16} className="text-indigo-400" />
            <span className="font-mono text-[14px] font-bold tracking-widest text-slate-200 uppercase">AI Analysis</span>
          </div>
          {generating ? (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="font-display text-[14px] text-slate-400 text-center">{genStatus}</p>
            </div>
          ) : genStatus ? (
            <div className="flex flex-col gap-3">
              <pre className="font-mono text-[12px] text-amber-400/80 whitespace-pre-wrap break-all bg-amber-500/5 rounded-xl p-4 border border-amber-500/20">{genStatus}</pre>
              <button onClick={handleGenerate} className="self-start font-mono text-[12px] font-semibold px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-colors border border-[#1E3357]">
                Coba Lagi
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 gap-5">
              <p className="font-display text-[15px] text-slate-400 text-center max-w-md leading-[1.75]">
                Analisis AI belum tersedia untuk saham ini. Generate analisis investasi lengkap dengan 3 skenario (bull/neutral/bear), klasifikasi Lynch, dan rekomendasi strategi.
              </p>
              <button onClick={handleGenerate} className="font-display font-semibold text-[15px] px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white hover:from-indigo-400 hover:to-blue-400 transition-all shadow-lg shadow-indigo-500/20">
                <span className="flex items-center gap-2">
                  <Sparkles size={16} />
                  Generate AI Analysis
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 md:px-12 py-2">
      {/*
        Card structure:
          • bg-[#162540]  — card body (lighter navy, comfortable to read)
          • bg-[#0F1C35]  — header band (darker, makes it stand out)
          • bg-[#111E30]  — footer band
          • bg-[#1C2E4A]  — surface cards (strategy, watchlist)
      */}
      <div className="bg-[#162540] rounded-2xl border border-[#1E3357]/60 overflow-hidden shadow-xl shadow-black/20">

        {/* ══════════════════════════════════════════════════════════════
            HEADER — darker band, all meta in one clean row
        ══════════════════════════════════════════════════════════════ */}
        <div className="bg-[#0F1C35] px-5 md:px-7 py-5 flex flex-col sm:flex-row sm:items-center gap-4 border-b border-[#1E3357]/60">

          {/* Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Sparkles size={15} className="text-indigo-400" />
            </div>
            <div>
              <div className="font-mono text-[13px] font-bold tracking-widest text-slate-200 uppercase">AI Analysis</div>
              <div className="font-mono text-[11px] text-slate-600 mt-0.5">
                Confidence {data.confidenceLevel}/10 · {data.modelUsed}
              </div>
            </div>
          </div>

          {/* All badges in one streamlined row */}
          <div className="flex items-center gap-2 flex-wrap">
            <LynchBadge category={data.lynchCategory} />
            {data.buffettMoat && <MoatBadge moat={data.buffettMoat} />}
            <div className="w-px h-5 bg-[#1E3357] mx-1 hidden sm:block" />
            <VerdictBadge verdict={data.analystVerdict} />
            <ReanalyzeControl
              isStale={data.isStale}
              lastDataChangeAt={data.lastDataChangeAt}
              generatedAt={data.generatedAt}
              generating={generating}
              onClick={handleGenerate}
            />
          </div>
        </div>

        {/* Re-analysis status */}
        {(generating || genStatus) && (
          <div className="mx-5 md:mx-7 mt-4 mb-0 px-4 py-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 flex items-start gap-2.5">
            {generating && <RefreshCw size={13} className="text-emerald-400 animate-spin mt-0.5 shrink-0" />}
            <pre className="font-mono text-[12px] text-emerald-300/80 whitespace-pre-wrap break-words flex-1">{genStatus ?? 'Re-analyzing…'}</pre>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            NARRATIVE — font-display for comfortable prose reading
        ══════════════════════════════════════════════════════════════ */}
        {data.businessNarrative && (
          <>
            <div className="px-5 md:px-7 py-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-indigo-500/50" />
                <span className="font-mono text-[11px] font-bold tracking-widest text-slate-500 uppercase">Ringkasan Analisis</span>
              </div>
              <p className="font-display text-[15px] md:text-[16px] text-slate-300 leading-[1.85]">
                {data.businessNarrative}
              </p>
            </div>
            <Divider />
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CONCLUSION + THESIS (integrated — scenarios expand inline)
        ══════════════════════════════════════════════════════════════ */}
        <ConclusionWithThesis bull={data.bullCase} neutral={data.neutralCase} bear={data.bearCase} />

        {(data.bullCase || data.neutralCase || data.bearCase) && <Divider />}

        {/* ══════════════════════════════════════════════════════════════
            STRATEGY + WHAT TO WATCH
        ══════════════════════════════════════════════════════════════ */}
        {(data.strategyFit || (data.whatToWatch && data.whatToWatch.length > 0)) && (
          <>
            <div className="px-5 md:px-7 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">

              {data.strategyFit && (
                <div className="bg-[#1C2E4A] rounded-xl border border-[#1E3357]/60 p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[10px] font-bold tracking-widest text-slate-600 uppercase mb-1.5">Strategi</div>
                      <div className="font-display text-[14px] font-semibold text-slate-200 leading-[1.4]">
                        {data.strategyFit.primary.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                    </div>
                    <span className={`shrink-0 font-mono text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border ${
                      data.strategyFit.position_sizing === 'full_position'     ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
                      data.strategyFit.position_sizing === 'half_position'     ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' :
                      data.strategyFit.position_sizing === 'small_speculative' ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' :
                      'bg-red-500/15 text-red-400 border-red-500/25'
                    }`}>
                      {data.strategyFit.position_sizing.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="font-display text-[13px] text-slate-400 leading-[1.65]">
                    {data.strategyFit.ideal_investor}
                  </p>
                </div>
              )}

              {data.whatToWatch && data.whatToWatch.length > 0 && (
                <div className="bg-[#1C2E4A] rounded-xl border border-[#1E3357]/60 p-5">
                  <div className="font-mono text-[10px] font-bold tracking-widest text-slate-600 uppercase mb-3.5">Yang Perlu Dipantau</div>
                  <ol className="flex flex-col gap-3">
                    {data.whatToWatch.slice(0, 4).map((w, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="font-mono text-[11px] font-bold text-slate-600 mt-0.5 shrink-0 w-4 text-right">{i + 1}.</span>
                        <span className="font-display text-[14px] text-slate-300 leading-[1.5]">{w}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
            <Divider />
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            CAVEATS (collapsible)
        ══════════════════════════════════════════════════════════════ */}
        <CaveatsSection caveats={data.caveats ?? []} dataGaps={data.dataGapsAcknowledged ?? []} />

        {/* ══════════════════════════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════════════════════════ */}
        <div className="bg-[#111E30] px-5 md:px-7 py-3.5 border-t border-[#1E3357]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div className="min-w-0 overflow-hidden">
            {data.lynchRationale && (
              <span className="font-display text-[12px] text-slate-600 italic truncate hidden sm:block">
                &ldquo;{data.lynchRationale}&rdquo;
              </span>
            )}
          </div>
          <span className="font-mono text-[11px] text-slate-600 shrink-0">
            {data.generatedAt
              ? new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : ''}
          </span>
        </div>

      </div>
    </div>
  )
}
