'use client'

import { useState, useEffect, useRef, useCallback, use, Suspense } from 'react'
import { track } from '@/lib/analytics'
import type {
  StockHeader,
  StockMetrics,
  FinancialYear,
  QuarterlyFinancial,
  CAGRResult,
  HealthScore,
  PricePoint,
  CompanyProfileData,
  Officer,
  Shareholder,
  DataQuality,
  TechnicalSignalPoint,
  AIAnalysis,
} from '@/lib/types/api'
import type { StockBrokerSummary, InsiderTransactionRow, DailyFlowByType, BrokerConcentrationRow } from '@/lib/queries/broker'
import type { AnnualDPS } from '@/lib/queries/dividends'
import type { PeerPercentiles } from '@/lib/calculations/percentile'

import { HeroBar }                  from './widgets/HeroBar'
import { NavTabs }                  from './widgets/NavTabs'
import { AIInsightsWidget }         from './widgets/AIInsightsWidget'
import { BrokerActivityWidget }     from './widgets/BrokerActivityWidget'
import { PriceWidget }              from './widgets/PriceWidget'
import { ShareholdersWidget }       from './widgets/ShareholdersWidget'
import { FinancialStatementsWidget } from './widgets/FinancialStatementsWidget'
import { CompanyMetricsWidget }     from './widgets/CompanyMetricsWidget'
import { ValuationWidget }          from './widgets/ValuationWidget'
import { DividendWidget }           from './widgets/DividendWidget'
import { CompanyProfileWidget }     from './widgets/CompanyProfileWidget'
import { DataQualityWidget }        from './widgets/DataQualityWidget'
import { PipelineDebugWidget }      from './widgets/PipelineDebugWidget'
import { AnalystInsightWidget }     from './widgets/AnalystInsightWidget'
import { MarketPhaseWidget }        from './widgets/MarketPhaseWidget'

export interface StockPageProps {
  header:             StockHeader
  metrics:            StockMetrics | null
  series:             FinancialYear[]
  quarterly:          QuarterlyFinancial[]
  annualTable:        QuarterlyFinancial[]
  priceHistory:       PricePoint[]
  profile:            CompanyProfileData | null
  officers:           Officer[]
  shareholders:       Shareholder[]
  majorShareholders:  Shareholder[]
  shareholderHistory: Shareholder[][]
  quality:            DataQuality | null
  aiAnalysis:         AIAnalysis | null
  showDebug:          boolean
  cagr:               CAGRResult[]
  health:             HealthScore[]
  brokerSummary:      StockBrokerSummary | null
  insiderTransactions: InsiderTransactionRow[]
  dailyBrokerFlow:    DailyFlowByType[]
  brokerConcentration: BrokerConcentrationRow[]
  dividendHistory:    AnnualDPS[]
  technicalSignals:   TechnicalSignalPoint[]
  peerPercentilesPromise: Promise<PeerPercentiles | null>
  dcfFcf:             number | null
  dcfDividends:       number | null
  dcfNetIncome:       number | null
  dcfShares:          number | null
}

const SECTION_IDS = ['overview', 'valuasi', 'finansial', 'money-flow', 'teknikal', 'profil'] as const
type SectionId = typeof SECTION_IDS[number]

// ── Shared layout primitives ──────────────────────────────────────────────────

/** Uniform outer wrapper for every widget card in the page. */
function WidgetWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-3 md:px-4 py-3 ${className ?? ''}`}>
      {children}
    </div>
  )
}

function SectionSep({ label }: { label: string }) {
  return (
    <div className="px-3 md:px-4 pt-4 pb-1" style={{ borderTop: '6px solid var(--color-border-subtle)' }}>
      <span className="font-mono text-[9px] font-bold tracking-[1.5px] uppercase" style={{ color: 'var(--color-text-ghost)' }}>
        {label}
      </span>
    </div>
  )
}

// ── Deferred peer metrics (streamed via Suspense) ─────────────────────────────

/** Unwraps the streamed peer-percentiles promise and renders the metrics widget. */
function CompanyMetricsResolver({
  promise, ticker, metrics, latestYear, cagr, health,
}: {
  promise: Promise<PeerPercentiles | null>
  ticker: string
  metrics: StockMetrics | null
  latestYear: FinancialYear | null
  cagr: CAGRResult[]
  health: HealthScore[]
}) {
  const peerPercentiles = use(promise)
  return (
    <CompanyMetricsWidget
      ticker={ticker}
      metrics={metrics}
      latestYear={latestYear}
      cagr={cagr}
      health={health}
      peerPercentiles={peerPercentiles}
    />
  )
}

/** Skeleton shown while peer percentiles stream in. */
function PeerMetricsSkeleton() {
  return (
    <div
      className="rounded-xl animate-pulse h-64"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}
    />
  )
}

// ── Main client ───────────────────────────────────────────────────────────────

export function StockPageClient({
  header, metrics, series, quarterly, annualTable, priceHistory,
  profile, officers, shareholders, majorShareholders, shareholderHistory,
  quality, aiAnalysis, showDebug, cagr, health, brokerSummary, insiderTransactions, dailyBrokerFlow,
  brokerConcentration, dividendHistory, technicalSignals, peerPercentilesPromise,
  dcfFcf, dcfDividends, dcfNetIncome, dcfShares,
}: StockPageProps) {
  const latestYear    = series.at(-1) ?? null
  const latestPrice   = priceHistory.at(-1)?.close ?? metrics?.price ?? null
  const defaultGrowth = cagr.find((c) => c.metric === 'revenue')?.cagr_3yr ?? 10
  const displayedShareholders = majorShareholders.length > 0 ? majorShareholders : shareholders

  const stickyRef = useRef<HTMLDivElement>(null)
  const [stickyHeight, setStickyHeight] = useState(200)
  const [activeTab, setActiveTab] = useState<SectionId>('overview')

  // Measure sticky header height (hero + tabs)
  useEffect(() => {
    const measure = () => {
      if (stickyRef.current) setStickyHeight(stickyRef.current.offsetHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (stickyRef.current) ro.observe(stickyRef.current)
    return () => ro.disconnect()
  }, [])

  // Scroll-spy: track which section is at top of visible area
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost section that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActiveTab(visible[0].target.id as SectionId)
      },
      {
        rootMargin: `-${stickyHeight + 8}px 0px -60% 0px`,
        threshold: 0,
      },
    )
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [stickyHeight])

  const handleTabChange = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - stickyHeight
    window.scrollTo({ top, behavior: 'smooth' })
  }, [stickyHeight])

  useEffect(() => {
    track.stockViewed(header.ticker)
  }, [header.ticker])

  const sectionStyle = { scrollMarginTop: stickyHeight }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-page)' }}>

      {/* ── Sticky shell: hero + tabs ───────────────────────────────── */}
      <div ref={stickyRef} className="sticky top-0 z-30">
        <HeroBar header={header} metrics={metrics} priceHistory={priceHistory} cagr={cagr} />
        <NavTabs active={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* ═══ OVERVIEW ══════════════════════════════════════════════════ */}
      <section id="overview" style={sectionStyle}>
        <WidgetWrap>
          <AIInsightsWidget ticker={header.ticker} currentPrice={latestPrice} initialData={aiAnalysis} />
        </WidgetWrap>
        <WidgetWrap>
          <AnalystInsightWidget ticker={header.ticker} />
        </WidgetWrap>
      </section>

      {/* ═══ VALUASI ═══════════════════════════════════════════════════ */}
      <section id="valuasi" style={sectionStyle}>
        <SectionSep label="VALUASI" />
        <WidgetWrap>
          <ValuationWidget
            eps={metrics?.eps ?? null}
            bvps={metrics?.book_value_per_share ?? null}
            fcf={dcfFcf}
            dividends={dcfDividends}
            netIncome={dcfNetIncome}
            currentPrice={latestPrice}
            shares={dcfShares}
            defaultGrowthRate={defaultGrowth}
            peRatio={metrics?.pe_ratio ?? null}
            pbRatio={metrics?.pbv_ratio ?? null}
            annualHistory={annualTable}
          />
        </WidgetWrap>
      </section>

      {/* ═══ FINANSIAL ═════════════════════════════════════════════════ */}
      <section id="finansial" style={sectionStyle}>
        <SectionSep label="FINANSIAL" />
        <WidgetWrap>
          <FinancialStatementsWidget annual={annualTable} quarterly={quarterly} />
        </WidgetWrap>
        <WidgetWrap>
          <Suspense fallback={<PeerMetricsSkeleton />}>
            <CompanyMetricsResolver
              promise={peerPercentilesPromise}
              ticker={header.ticker}
              metrics={metrics}
              latestYear={latestYear}
              cagr={cagr}
              health={health}
            />
          </Suspense>
        </WidgetWrap>
        <WidgetWrap>
          <DividendWidget
            dividendHistory={dividendHistory}
            series={series}
            dividendYield={metrics?.dividend_yield ?? null}
            price={metrics?.price ?? latestPrice}
          />
        </WidgetWrap>
      </section>

      {/* ═══ MONEY FLOW ════════════════════════════════════════════════ */}
      <section id="money-flow" style={sectionStyle}>
        <SectionSep label="MONEY FLOW" />
        <WidgetWrap>
          <BrokerActivityWidget
            ticker={header.ticker}
            initialData={brokerSummary}
            insiderTransactions={insiderTransactions}
            dailyBrokerFlow={dailyBrokerFlow}
            brokerConcentration={brokerConcentration}
          />
        </WidgetWrap>
      </section>

      {/* ═══ TEKNIKAL ══════════════════════════════════════════════════ */}
      <section id="teknikal" style={sectionStyle}>
        <SectionSep label="TEKNIKAL" />
        <PriceWidget ticker={header.ticker} priceHistory={priceHistory} />
        <WidgetWrap>
          <MarketPhaseWidget
            ticker={header.ticker}
            priceHistory={priceHistory}
            technicalSignals={technicalSignals}
          />
        </WidgetWrap>
      </section>

      {/* ═══ PROFIL ════════════════════════════════════════════════════ */}
      <section id="profil" style={sectionStyle}>
        <SectionSep label="PROFIL" />
        <WidgetWrap className="flex flex-col gap-4">
          <CompanyProfileWidget profile={profile} officers={officers} />
          <ShareholdersWidget
            shareholders={displayedShareholders}
            shareholderHistory={shareholderHistory}
            ticker={header.ticker}
          />
          {/* Debug-only: data inspection surfaces, hidden in production */}
          {showDebug && (
            <>
              <DataQualityWidget quality={quality} ticker={header.ticker} />
              <PipelineDebugWidget ticker={header.ticker} subsector={header.subsector ?? null} />
            </>
          )}
        </WidgetWrap>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 mt-4 mb-20 sm:mb-0"
        style={{ background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border)' }}
      >
        <p className="font-mono text-[10px] leading-[1.5]" style={{ color: 'var(--color-text-muted)' }}>
          // DISCLAIMER: INI BUKAN SARAN KEUANGAN. DATA DISAJIKAN HANYA UNTUK TUJUAN INFORMASI.
          KINERJA MASA LALU TIDAK MENJAMIN HASIL DI MASA DEPAN.
        </p>
        <span className="font-mono text-[10px] tracking-[0.5px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          IDX ANALYZER
        </span>
      </div>
    </div>
  )
}
