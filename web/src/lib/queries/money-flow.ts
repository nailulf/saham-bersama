import { createClient } from '@/lib/supabase/server'
import { parseBigInt } from '@/lib/calculations/formatters'
import { BROKER_NAMES } from '@/lib/broker-constants'

// ─────────────────────────────────────────────────────────────────────────────
// Money Flow page data layer.
//
// Views 1–3 (Total / Foreign / Domestic) come from idx_stock_summary — IDX's
// OFFICIAL daily per-stock data — so the numbers reconcile exactly with IDX's
// stock-summary page. Foreign buy/sell are IDX's transaction-level figures (in
// shares); we convert to IDR with each stock's VWAP (value / volume) for
// cross-stock ranking, and derive domestic = total − foreign.
//
// Views 4–5 (broker leaderboards) come from Stockbit broker_flow via the mf_*
// RPCs (schema-v30) — the only source with a market-wide per-broker buy/sell
// split. Stockbit lags IDX by ~1 trading day, so these views resolve their own
// date independently and label the source.
// ─────────────────────────────────────────────────────────────────────────────

export interface SummaryRow {
  ticker: string
  name: string | null
  close: number | null
  change: number | null
  change_pct: number | null
  value: number | null         // total transaction value, IDR
  volume: number | null        // shares
  vwap: number | null          // value / volume, IDR per share
  foreign_buy_sh: number       // shares
  foreign_sell_sh: number
  foreign_buy_idr: number
  foreign_sell_idr: number
  foreign_net_idr: number
  domestic_buy_sh: number
  domestic_sell_sh: number
  domestic_buy_idr: number
  domestic_sell_idr: number
  domestic_net_idr: number
}

export interface BrokerFlowRow {
  broker_code: string
  broker_name: string
  broker_type: string | null
  buy_value: number
  sell_value: number
  net_value: number
  frequency: number | null
  ticker_count: number
  breakdown: BrokerBreakdownRow[]
}

export interface BrokerBreakdownRow {
  ticker: string
  name: string | null
  buy_value: number
  sell_value: number
  net_value: number
}

const brokerName = (code: string) => BROKER_NAMES[code] ?? code

// ─── Latest-date resolvers ────────────────────────────────────────────────────

export async function getLatestSummaryDate(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('idx_stock_summary')
    .select('date')
    .order('date', { ascending: false })
    .limit(1)
  return (data as any[])?.[0]?.date ?? null
}

export async function getLatestFlowDate(): Promise<string | null> {
  const supabase = await createClient()
  // bandar_signal holds exactly one row per (ticker, date) — cheaper to sort
  // than broker_flow (many rows/date).
  const { data } = await supabase
    .from('bandar_signal')
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(1)
  return (data as any[])?.[0]?.trade_date ?? null
}

// ─── Duration filter ──────────────────────────────────────────────────────────

export type Duration = '1d' | '7d' | '30d' | 'ytd'
export const DURATIONS: Duration[] = ['1d', '7d', '30d', 'ytd']
export const DURATION_LABEL: Record<Duration, string> = {
  '1d': '1D', '7d': '7D', '30d': '30D', 'ytd': 'YTD',
}

// Rank/display metric for the buy/sell leaderboards.
//   'value'  → rank by IDR (money flow; default)
//   'shares' → rank by share count (mirrors IDX's stock-summary sort)
export type RankMetric = 'value' | 'shares'
export const RANK_METRICS: RankMetric[] = ['value', 'shares']
export const RANK_LABEL: Record<RankMetric, string> = { value: 'Value', shares: 'Shares' }

// Resolve a duration to an inclusive [from, to] window ending at `latest`
// (the last available data date — NOT today, to absorb crawler lag).
export function rangeFor(latest: string, duration: Duration): { from: string; to: string } {
  const to = latest
  if (duration === '1d') return { from: latest, to }
  if (duration === 'ytd') return { from: `${latest.slice(0, 4)}-01-01`, to }
  const days = duration === '7d' ? 6 : 29 // inclusive window
  const d = new Date(`${latest}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return { from: d.toISOString().slice(0, 10), to }
}

// ─── IDX summary over a range (powers Total / Foreign / Domestic) ─────────────
// Aggregated server-side by mf_summary_range → ≤ ~960 rows (one per ticker)
// regardless of window length. All derived metrics computed here.

export async function getSummaryRange(from: string, to: string): Promise<SummaryRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('mf_summary_range', { p_from: from, p_to: to })
  if (error || !data || data.length === 0) return []

  return (data as any[]).map((r) => {
    const close = parseBigInt(r.close)
    const change = parseBigInt(r.change)
    const prev = parseBigInt(r.prev_close)
    const value = parseBigInt(r.value)
    const volume = parseBigInt(r.volume)
    const fBuySh = parseBigInt(r.foreign_buy) ?? 0
    const fSellSh = parseBigInt(r.foreign_sell) ?? 0
    const vwap = value != null && volume ? value / volume : null

    const toIdr = (sh: number) => (vwap != null ? Math.round(sh * vwap) : 0)
    // Total buy shares = total sell shares = volume (matched market).
    const dBuySh = volume != null ? Math.max(0, volume - fBuySh) : 0
    const dSellSh = volume != null ? Math.max(0, volume - fSellSh) : 0

    const foreign_buy_idr = toIdr(fBuySh)
    const foreign_sell_idr = toIdr(fSellSh)
    const domestic_buy_idr = toIdr(dBuySh)
    const domestic_sell_idr = toIdr(dSellSh)

    return {
      ticker: r.ticker,
      name: r.name ?? null,
      close,
      change,
      change_pct: change != null && prev ? (change / prev) * 100 : null,
      value,
      volume,
      vwap,
      foreign_buy_sh: fBuySh,
      foreign_sell_sh: fSellSh,
      foreign_buy_idr,
      foreign_sell_idr,
      foreign_net_idr: foreign_buy_idr - foreign_sell_idr,
      domestic_buy_sh: dBuySh,
      domestic_sell_sh: dSellSh,
      domestic_buy_idr,
      domestic_sell_idr,
      domestic_net_idr: domestic_buy_idr - domestic_sell_idr,
    }
  })
}

// ─── Ranking helpers (pure) ───────────────────────────────────────────────────

export function topByValue(rows: SummaryRow[], n = 20): SummaryRow[] {
  return [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, n)
}

export function topBy(rows: SummaryRow[], key: keyof SummaryRow, n = 12): SummaryRow[] {
  return [...rows]
    .filter((r) => (r[key] as number) > 0)
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, n)
}

// ─── 4 & 5. Top brokers market-wide + their top-10 emiten (Stockbit) ──────────

export async function getTopBrokers(
  dir: 'buy' | 'sell',
  from: string,
  to: string,
  topN = 10,
  breakdownN = 10,
): Promise<BrokerFlowRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('mf_top_brokers', {
    p_from: from, p_to: to, p_dir: dir, p_limit: topN,
  })
  if (error || !data || data.length === 0) return []

  const brokers = (data as any[]).map((r) => ({
    broker_code: r.broker_code as string,
    broker_name: brokerName(r.broker_code),
    broker_type: r.broker_type ?? null,
    buy_value: Number(r.buy_value),
    sell_value: Number(r.sell_value),
    net_value: Number(r.net_value),
    frequency: r.frequency != null ? Number(r.frequency) : null,
    ticker_count: Number(r.ticker_count),
  }))

  const breakdowns = await Promise.all(
    brokers.map(async (b) => {
      const { data: rows } = await supabase.rpc('mf_broker_top_tickers', {
        p_from: from, p_to: to, p_broker: b.broker_code, p_dir: dir, p_limit: breakdownN,
      })
      return (rows as any[] ?? []).map((r) => ({
        ticker: r.ticker,
        name: r.name ?? null,
        buy_value: Number(r.buy_value),
        sell_value: Number(r.sell_value),
        net_value: Number(r.net_value),
      })) as BrokerBreakdownRow[]
    }),
  )

  return brokers.map((b, i) => ({ ...b, breakdown: breakdowns[i] }))
}
