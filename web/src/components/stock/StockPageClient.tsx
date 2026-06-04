'use client'

import { useState, useEffect } from 'react'
import { track } from '@/lib/analytics'
import { formatPercent, formatMultiple, fmtNumID, formatIDRCompact } from '@/lib/calculations/formatters'
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
import { FinancialHighlightsWidget } from './widgets/FinancialHighlightsWidget'
import { FinancialChartsWidget }    from './widgets/FinancialChartsWidget'
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
  cagr:               CAGRResult[]
  health:             HealthScore[]
  brokerSummary:      StockBrokerSummary | null
  insiderTransactions: InsiderTransactionRow[]
  dailyBrokerFlow:    DailyFlowByType[]
  brokerConcentration: BrokerConcentrationRow[]
  dividendHistory:    AnnualDPS[]
  technicalSignals:   TechnicalSignalPoint[]
  peerPercentiles:    PeerPercentiles | null
  dcfFcf:             number | null
  dcfDividends:       number | null
  dcfNetIncome:       number | null
  dcfShares:          number | null
}

// ── OVERVIEW tab: Metric groups ───────────────────────────────────────────────

interface MetricRow {
  label: string
  value: string
  sub?: string
}

function MetricGroupCard({ title, rows }: { title: string; rows: MetricRow[] }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}
    >
      <div
        className="px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <span
          className="font-mono text-[9px] font-bold tracking-[1px]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {title}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-2.5"
          >
            <span
              className="font-mono text-[11px] font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {row.label}
            </span>
            <div className="flex flex-col items-end gap-0.5">
              <span
                className="font-display text-[13px] font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {row.value}
              </span>
              {row.sub && (
                <span
                  className="font-mono text-[9px]"
                  style={{ color: 'var(--color-text-dim)' }}
                >
                  {row.sub}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricGroups({
  metrics,
  latestYear,
  cagr,
}: {
  metrics: StockMetrics | null
  latestYear: FinancialYear | null
  cagr: CAGRResult[]
}) {
  const epsGrowth = cagr.find((c) => c.metric === 'net_income')?.cagr_3yr ?? null
  const peg =
    metrics?.pe_ratio != null && epsGrowth != null && epsGrowth > 0
      ? metrics.pe_ratio / epsGrowth
      : null

  const fmt = (v: number | null, fn: (x: number) => string) => (v != null ? fn(v) : '—')

  const valuasiRows: MetricRow[] = [
    { label: 'P/E',       value: fmt(metrics?.pe_ratio ?? null, formatMultiple) },
    { label: 'P/B',       value: fmt(metrics?.pbv_ratio ?? null, formatMultiple) },
    { label: 'PEG',       value: peg != null ? fmtNumID(peg, 2) : '—', sub: epsGrowth != null ? `EPS CAGR 3Y: ${formatPercent(epsGrowth)}` : undefined },
    { label: 'DIV YIELD', value: fmt(metrics?.dividend_yield ?? null, formatPercent) },
  ]

  const profitabilitasRows: MetricRow[] = [
    { label: 'ROE',         value: fmt(latestYear?.roe ?? null, formatPercent) },
    { label: 'ROA',         value: fmt(latestYear?.roa ?? null, formatPercent) },
    { label: 'NET MARGIN',  value: fmt(latestYear?.net_margin ?? null, formatPercent) },
    { label: 'GROSS MARGIN',value: fmt(latestYear?.gross_margin ?? null, formatPercent) },
  ]

  const lainnyaRows: MetricRow[] = [
    { label: 'D/E RATIO',     value: fmt(latestYear?.debt_to_equity ?? null, (v) => fmtNumID(v, 2)) },
    { label: 'CURRENT RATIO', value: fmt(latestYear?.current_ratio ?? null, (v) => fmtNumID(v, 2)) },
    { label: 'FREE CASH FLOW',value: latestYear?.free_cash_flow != null ? formatIDRCompact(latestYear.free_cash_flow) : '—' },
    { label: 'KAS',           value: latestYear?.cash_and_equivalents != null ? formatIDRCompact(latestYear.cash_and_equivalents) : '—' },
  ]

  return (
    <div className="px-4 md:px-8 py-4 flex flex-col gap-3">
      <MetricGroupCard title="VALUASI" rows={valuasiRows} />
      <MetricGroupCard title="PROFITABILITAS" rows={profitabilitasRows} />
      <MetricGroupCard title="LAINNYA" rows={lainnyaRows} />
    </div>
  )
}

// ── Main client ───────────────────────────────────────────────────────────────

export function StockPageClient({
  header,
  metrics,
  series,
  quarterly,
  annualTable,
  priceHistory,
  profile,
  officers,
  shareholders,
  majorShareholders,
  shareholderHistory,
  quality,
  cagr,
  health,
  brokerSummary,
  insiderTransactions,
  dailyBrokerFlow,
  brokerConcentration,
  dividendHistory,
  technicalSignals,
  peerPercentiles,
  dcfFcf,
  dcfDividends,
  dcfNetIncome,
  dcfShares,
}: StockPageProps) {
  const latestYear    = series.at(-1) ?? null
  const latestPrice   = priceHistory.at(-1)?.close ?? metrics?.price ?? null
  const defaultGrowth = cagr.find((c) => c.metric === 'revenue')?.cagr_3yr ?? 10
  const displayedShareholders = majorShareholders.length > 0 ? majorShareholders : shareholders

  const [activeTab, setActiveTab] = useState('overview')
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['overview']))

  function handleTabChange(id: string) {
    setActiveTab(id)
    setMountedTabs((prev) => { const next = new Set(prev); next.add(id); return next })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    track.stockViewed(header.ticker)
  }, [header.ticker])

  return (
    <div className="min-h-screen max-w-[1400px] mx-auto" style={{ background: 'var(--color-bg-page)' }}>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <HeroBar header={header} metrics={metrics} priceHistory={priceHistory} cagr={cagr} />

      {/* ── Tab bar ────────────────────────────────────────────────── */}
      <NavTabs active={activeTab} onTabChange={handleTabChange} />

      {/* ── Tab panels ─────────────────────────────────────────────── */}

      {/* OVERVIEW ─────────────────────────────────── */}
      {mountedTabs.has('overview') && (
        <div hidden={activeTab !== 'overview'} className="pb-24 sm:pb-8">
          <MetricGroups metrics={metrics} latestYear={latestYear} cagr={cagr} />
          <div className="px-4 md:px-8 py-2">
            <AnalystInsightWidget ticker={header.ticker} />
          </div>
        </div>
      )}

      {/* AI ────────────────────────────────────────── */}
      {mountedTabs.has('ai') && (
        <div hidden={activeTab !== 'ai'} className="pb-24 sm:pb-8">
          <AIInsightsWidget ticker={header.ticker} />
        </div>
      )}

      {/* VALUASI ───────────────────────────────────── */}
      {mountedTabs.has('valuasi') && (
        <div hidden={activeTab !== 'valuasi'} className="pb-24 sm:pb-8">
          <div className="px-4 md:px-8 py-4">
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
          </div>
        </div>
      )}

      {/* FINANSIAL ─────────────────────────────────── */}
      {mountedTabs.has('finansial') && (
        <div hidden={activeTab !== 'finansial'} className="pb-24 sm:pb-8">
          <FinancialChartsWidget series={series} />
          <FinancialHighlightsWidget quarterly={quarterly} annual={annualTable} />
          <FinancialStatementsWidget annual={annualTable} quarterly={quarterly} />
          <CompanyMetricsWidget
            ticker={header.ticker}
            metrics={metrics}
            latestYear={latestYear}
            cagr={cagr}
            health={health}
            peerPercentiles={peerPercentiles}
          />
          <div className="px-4 md:px-8 py-2">
            <DividendWidget
              dividendHistory={dividendHistory}
              series={series}
              dividendYield={metrics?.dividend_yield ?? null}
              price={metrics?.price ?? latestPrice}
            />
          </div>
        </div>
      )}

      {/* MONEY FLOW ────────────────────────────────── */}
      {mountedTabs.has('money-flow') && (
        <div hidden={activeTab !== 'money-flow'} className="pb-24 sm:pb-8">
          <div className="px-4 md:px-8 py-4">
            <BrokerActivityWidget
              ticker={header.ticker}
              initialData={brokerSummary}
              insiderTransactions={insiderTransactions}
              dailyBrokerFlow={dailyBrokerFlow}
              brokerConcentration={brokerConcentration}
            />
          </div>
        </div>
      )}

      {/* TEKNIKAL ──────────────────────────────────── */}
      {mountedTabs.has('teknikal') && (
        <div hidden={activeTab !== 'teknikal'} className="pb-24 sm:pb-8">
          <PriceWidget ticker={header.ticker} priceHistory={priceHistory} />
          <div className="px-4 md:px-8 py-2">
            <MarketPhaseWidget
              ticker={header.ticker}
              priceHistory={priceHistory}
              technicalSignals={technicalSignals}
            />
          </div>
        </div>
      )}

      {/* PROFIL ────────────────────────────────────── */}
      {mountedTabs.has('profil') && (
        <div hidden={activeTab !== 'profil'} className="pb-24 sm:pb-8">
          <div className="px-4 md:px-8 py-4 flex flex-col gap-4">
            <CompanyProfileWidget profile={profile} officers={officers} />
            <ShareholdersWidget
              shareholders={displayedShareholders}
              shareholderHistory={shareholderHistory}
              ticker={header.ticker}
            />
            <DataQualityWidget quality={quality} ticker={header.ticker} />
            <PipelineDebugWidget ticker={header.ticker} subsector={header.subsector ?? null} />
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 md:px-8 py-4 mt-4"
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
