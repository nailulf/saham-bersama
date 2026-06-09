import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getStockHeader } from '@/lib/queries/stocks'
import {
  getFinancialSeries,
  getLatestMetrics,
  getQuarterlySeries,
  getAnnualSeriesForTable,
} from '@/lib/queries/financials'
import { getPriceHistory } from '@/lib/queries/prices'
import { getTechnicalSignals } from '@/lib/queries/technical-signals'
import {
  getCompanyProfile,
  getOfficers,
  getShareholders,
  getMajorShareholders,
  getMajorShareholderHistory,
} from '@/lib/queries/company'
import { getDataQuality } from '@/lib/queries/completeness'
import { getDividendHistory } from '@/lib/queries/dividends'
import { getStockBrokerSummary, getInsiderTransactions, getDailyBrokerFlowByType, getBrokerConcentration } from '@/lib/queries/broker'
import { computeCAGR } from '@/lib/calculations/cagr'
import { computeHealthScores } from '@/lib/calculations/health-score'
import { getSubsectorPeers, getPeerCAGR } from '@/lib/queries/sector'
import { computePeerPercentiles, computeGrowthPercentiles } from '@/lib/calculations/percentile'
import { getAIAnalysis } from '@/lib/queries/ai-analysis'
import { StockPageClient } from '@/components/stock/StockPageClient'

/**
 * Trim text to a clean meta-description length (~155 chars) on a word boundary,
 * collapsing internal whitespace so the snippet reads cleanly in search results.
 */
function toMetaDescription(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, '')}…`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>
}): Promise<Metadata> {
  const { ticker } = await params
  const t = ticker.toUpperCase()
  const [header, analysis] = await Promise.all([getStockHeader(t), getAIAnalysis(t).catch(() => null)])

  if (!header) {
    return { title: { absolute: 'Saham Tidak Ditemukan — Saham Bersama' } }
  }

  const name = header.name ?? t
  const sectorBits = [header.subsector ?? header.sector].filter(Boolean).join(' · ')
  const title = `${t} — ${name} | Analisis Saham IDX`
  // Prefer the AI business narrative (descriptive, per-stock, no buy/sell calls)
  // as the search snippet; fall back to a generic templated description.
  const description = analysis?.businessNarrative
    ? toMetaDescription(analysis.businessNarrative)
    : `Analisis saham ${t} (${name})${
        sectorBits ? ` di sektor ${sectorBits}` : ''
      }: valuasi, fundamental, dividen, money flow, dan sinyal teknikal di Bursa Efek Indonesia.`
  const canonical = `/stock/${t}`

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Saham Bersama',
      type: 'website',
      locale: 'id_ID',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params
  const t = ticker.toUpperCase()

  const [
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
    brokerSummary,
    insiderTransactions,
    dailyBrokerFlow,
    brokerConcentration,
    dividendHistory,
    technicalSignals,
  ] = await Promise.all([
    getStockHeader(t),
    getLatestMetrics(t),
    getFinancialSeries(t),
    getQuarterlySeries(t),
    getAnnualSeriesForTable(t),
    getPriceHistory(t, 252),
    getCompanyProfile(t),
    getOfficers(t),
    getShareholders(t),
    getMajorShareholders(t),
    getMajorShareholderHistory(t),
    getStockBrokerSummary(t, 30),
    getInsiderTransactions(t),
    getDailyBrokerFlowByType(t, 30),
    getBrokerConcentration(t, 30),
    getDividendHistory(t),
    getTechnicalSignals(t, 252),
  ])

  if (!header) notFound()

  // Debug-only surfaces (Kualitas Data + AI Data Pipeline widgets) are for local/dev
  // data inspection. Skip the query and the render entirely in production.
  const showDebug =
    process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEBUG === '1'

  // Data quality fetched separately so a missing view row doesn't block the page
  const quality = showDebug ? await getDataQuality(t).catch(() => null) : null

  const cagr   = computeCAGR(series)
  const latest = series.at(-1) ?? null
  const health = latest ? computeHealthScores(latest) : []

  // Sector peer percentiles
  const subsectorLabel = header.subsector ?? header.sector ?? 'Unknown'
  const [sectorPeers, peerCAGR] = await Promise.all([
    getSubsectorPeers(header.subsector, header.sector),
    getPeerCAGR(header.subsector, header.sector),
  ])
  const peerPercentiles = computePeerPercentiles(t, sectorPeers, subsectorLabel)

  // Merge growth percentiles into peerPercentiles (if we have peer CAGR data)
  if (peerPercentiles && peerCAGR.size > 0) {
    peerPercentiles.growth = computeGrowthPercentiles(t, cagr, peerCAGR, subsectorLabel)
  }

  // Pre-compute DCF inputs server-side for reliable serialization
  const latestPrice = priceHistory.at(-1)?.close ?? metrics?.price ?? null
  const dcfFcf = latest?.free_cash_flow
    ?? (latest?.operating_cash_flow != null
      ? latest.operating_cash_flow - Math.abs(latest.capex ?? 0)
      : null)
  const dcfShares = header?.listed_shares
    ?? (header?.market_cap && latestPrice && latestPrice > 0
      ? header.market_cap / latestPrice
      : null)
    ?? (metrics?.eps && metrics.eps > 0 && latest?.net_income
      ? Math.round(latest.net_income / metrics.eps)
      : null)

  // Structured data so search engines can index this as a company/stock entity.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Corporation',
    name: header.name ?? t,
    tickerSymbol: t,
    ...(header.sector ? { industry: header.subsector ?? header.sector } : {}),
    subjectOf: {
      '@type': 'WebPage',
      name: `Analisis Saham ${t}`,
      url: `/stock/${t}`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    <StockPageClient
      header={header}
      metrics={metrics}
      series={series}
      quarterly={quarterly}
      annualTable={annualTable}
      priceHistory={priceHistory}
      profile={profile}
      officers={officers}
      shareholders={shareholders}
      majorShareholders={majorShareholders}
      shareholderHistory={shareholderHistory}
      quality={quality}
      showDebug={showDebug}
      cagr={cagr}
      health={health}
      brokerSummary={brokerSummary}
      insiderTransactions={insiderTransactions}
      dailyBrokerFlow={dailyBrokerFlow}
      brokerConcentration={brokerConcentration}
      dividendHistory={dividendHistory}
      technicalSignals={technicalSignals}
      peerPercentiles={peerPercentiles}
      dcfFcf={dcfFcf}
      dcfDividends={(() => {
        // Latest year (TTM) often has null dividends — fall back to most recent year with data
        const divRow = [...series].reverse().find((r) => r.dividends_paid != null)
        return divRow?.dividends_paid != null ? Math.abs(divRow.dividends_paid) : null
      })()}
      dcfNetIncome={latest?.net_income ?? null}
      dcfShares={dcfShares}
    />
    </>
  )
}
