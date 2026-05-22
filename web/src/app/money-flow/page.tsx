import {
  getLatestSummaryDate,
  getLatestFlowDate,
  getSummaryRange,
  topByValue,
  topBy,
  getTopBrokers,
  rangeFor,
  DURATIONS,
  RANK_METRICS,
  type Duration,
  type RankMetric,
  type SummaryRow,
} from '@/lib/queries/money-flow'
import { MostActiveTable } from '@/components/money-flow/most-active-table'
import { BuySellSection, type FlowItem } from '@/components/money-flow/buy-sell-section'
import { TopBrokersSection } from '@/components/money-flow/top-brokers-section'
import { FilterBar } from '@/components/money-flow/filter-bar'

export const metadata = { title: 'Money Flow — IDX Analyzer' }

// Revalidate hourly; data is end-of-day so intraday freshness isn't needed.
export const revalidate = 3600

const N = 12  // rows per buy/sell column

interface PageProps {
  searchParams: Promise<{ range?: string; rank?: string }>
}

// A single date for 1D, or "from → to" for a window.
function rangeLabel(from: string, to: string): string {
  return from === to ? to : `${from} → ${to}`
}

export default async function MoneyFlowPage({ searchParams }: PageProps) {
  const { range, rank: rankParam } = await searchParams
  const duration: Duration = DURATIONS.includes(range as Duration) ? (range as Duration) : '1d'
  const rank: RankMetric = RANK_METRICS.includes(rankParam as RankMetric) ? (rankParam as RankMetric) : 'value'

  // Two independent "last active day" anchors: IDX official (current) and
  // Stockbit broker flow (~1 trading day behind). Each window ends at its own
  // latest date.
  const [summaryDate, flowDate] = await Promise.all([
    getLatestSummaryDate(),
    getLatestFlowDate(),
  ])

  const sRange = summaryDate ? rangeFor(summaryDate, duration) : null
  const fRange = flowDate ? rangeFor(flowDate, duration) : null

  const [summary, topBuyBrokers, topSellBrokers] = await Promise.all([
    sRange ? getSummaryRange(sRange.from, sRange.to) : Promise.resolve([] as SummaryRow[]),
    fRange ? getTopBrokers('buy', fRange.from, fRange.to, 10) : Promise.resolve([]),
    fRange ? getTopBrokers('sell', fRange.from, fRange.to, 10) : Promise.resolve([]),
  ])

  const mostActive = topByValue(summary, 20)

  const toForeignBuy = (r: SummaryRow): FlowItem => ({ ticker: r.ticker, name: r.name, value: r.foreign_buy_idr, shares: r.foreign_buy_sh, net: r.foreign_net_idr })
  const toForeignSell = (r: SummaryRow): FlowItem => ({ ticker: r.ticker, name: r.name, value: r.foreign_sell_idr, shares: r.foreign_sell_sh, net: r.foreign_net_idr })
  const toDomesticBuy = (r: SummaryRow): FlowItem => ({ ticker: r.ticker, name: r.name, value: r.domestic_buy_idr, shares: r.domestic_buy_sh, net: r.domestic_net_idr })
  const toDomesticSell = (r: SummaryRow): FlowItem => ({ ticker: r.ticker, name: r.name, value: r.domestic_sell_idr, shares: r.domestic_sell_sh, net: r.domestic_net_idr })

  // Rank by IDR value (money flow) or share count (mirrors IDX's sort).
  const fbKey = rank === 'value' ? 'foreign_buy_idr'  : 'foreign_buy_sh'
  const fsKey = rank === 'value' ? 'foreign_sell_idr' : 'foreign_sell_sh'
  const dbKey = rank === 'value' ? 'domestic_buy_idr'  : 'domestic_buy_sh'
  const dsKey = rank === 'value' ? 'domestic_sell_idr' : 'domestic_sell_sh'

  const foreignBuy = topBy(summary, fbKey, N).map(toForeignBuy)
  const foreignSell = topBy(summary, fsKey, N).map(toForeignSell)
  const domesticBuy = topBy(summary, dbKey, N).map(toDomesticBuy)
  const domesticSell = topBy(summary, dsKey, N).map(toDomesticSell)

  const summaryLabel = sRange ? rangeLabel(sRange.from, sRange.to) : null
  const flowLabel = fRange ? rangeLabel(fRange.from, fRange.to) : null
  const noData = !summaryDate && !flowDate

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Money Flow</h1>
          <p className="text-sm text-gray-500 mt-1">
            Where money moved — total activity, foreign &amp; domestic buy/sell (IDX official),
            and the most active brokers (Stockbit).
          </p>
        </div>
        <FilterBar duration={duration} rank={rank} />
      </header>

      {noData ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
          <p className="text-sm">No money-flow data yet.</p>
          <p className="text-xs mt-2">
            Run{' '}
            <code className="bg-gray-100 px-1 rounded">python -m scrapers.idx_stock_summary</code>{' '}
            and{' '}
            <code className="bg-gray-100 px-1 rounded">python -m scrapers.money_flow</code>{' '}
            to populate data.
          </p>
        </div>
      ) : (
        <>
          {/* Top row: Most Active (40%) | Foreign + Domestic buy/sell stacked (60%) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* 1. Total — most active by transaction value */}
            <div className="lg:col-span-2">
              <MostActiveTable rows={mostActive} date={summaryLabel} />
            </div>

            {/* 2 & 3. Foreign / Domestic gross buy & sell (IDX official) */}
            <div className="lg:col-span-3 space-y-6">
              <BuySellSection
                title="Foreign Buy & Sell (IDX official)"
                subtitle="Top stocks by foreign buy and foreign sell value. Shares match IDX exactly; IDR = shares × VWAP."
                buy={foreignBuy}
                sell={foreignSell}
                date={summaryLabel}
                metric={rank}
              />
              <BuySellSection
                title="Domestic Buy & Sell (derived)"
                subtitle="Domestic = total − foreign, derived from IDX official data. IDR = shares × VWAP."
                buy={domesticBuy}
                sell={domesticSell}
                date={summaryLabel}
                metric={rank}
              />
            </div>
          </div>

          {/* 4 & 5. Top brokers market-wide, with emiten breakdown (Stockbit) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopBrokersSection
              title="Top Buy Brokers"
              subtitle="Brokers with the largest total buy value across all stocks. Tap a broker for its top emiten."
              brokers={topBuyBrokers}
              side="buy"
              date={flowLabel}
            />
            <TopBrokersSection
              title="Top Sell Brokers"
              subtitle="Brokers with the largest total sell value across all stocks. Tap a broker for its top emiten."
              brokers={topSellBrokers}
              side="sell"
              date={flowLabel}
            />
          </div>
        </>
      )}
    </main>
  )
}
