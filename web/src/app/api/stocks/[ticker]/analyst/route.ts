import { NextRequest, NextResponse } from 'next/server'

/**
 * Analyst consensus for an IDX ticker, served directly from Yahoo Finance.
 *
 * This previously shelled out to `python utils/yfinance_analyst_cli.py`, which
 * only worked on the owner's machine — Vercel has no Python runtime, so the
 * spawn failed with `ENOENT`. We now call Yahoo's quoteSummary HTTP endpoint
 * directly (the same data yfinance reads under the hood), which runs anywhere.
 *
 * The response shape is intentionally identical to the old CLI output so the
 * AnalystInsightWidget needs no changes.
 */

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const QUOTE_SUMMARY_MODULES = [
  'financialData',
  'recommendationTrend',
  'upgradeDowngradeHistory',
  'price',
].join(',')

const FETCH_TIMEOUT_MS = 30_000

/* ── Yahoo crumb + cookie handshake ───────────────────────────────────────
 * Yahoo's quoteSummary endpoint requires a `crumb` query param that is bound
 * to a session cookie. Cache both at module scope (per serverless instance)
 * so we only perform the handshake occasionally instead of on every request. */

let cachedAuth: { crumb: string; cookie: string; expires: number } | null = null
const AUTH_TTL_MS = 30 * 60 * 1000 // 30 min

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function getYahooAuth(): Promise<{ crumb: string; cookie: string }> {
  if (cachedAuth && cachedAuth.expires > Date.now()) {
    return { crumb: cachedAuth.crumb, cookie: cachedAuth.cookie }
  }

  // Step 1 — obtain a session cookie. fc.yahoo.com 404s but sets the cookie.
  const cookieRes = await fetchWithTimeout('https://fc.yahoo.com/', {
    headers: { 'User-Agent': USER_AGENT },
  })
  const setCookies = cookieRes.headers.getSetCookie?.() ?? []
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ')
  if (!cookie) {
    throw new Error('Could not obtain Yahoo session cookie')
  }

  // Step 2 — exchange the cookie for a crumb.
  const crumbRes = await fetchWithTimeout(
    'https://query1.finance.yahoo.com/v1/test/getcrumb',
    { headers: { 'User-Agent': USER_AGENT, Cookie: cookie } },
  )
  const crumb = (await crumbRes.text()).trim()
  if (!crumb || crumb.includes('<')) {
    throw new Error('Could not obtain Yahoo crumb')
  }

  cachedAuth = { crumb, cookie, expires: Date.now() + AUTH_TTL_MS }
  return { crumb, cookie }
}

/* ── Field extraction helpers ─────────────────────────────────────────────
 * Yahoo wraps numeric fields as { raw, fmt, longFmt }; pull out `.raw`. */

type YahooNum = number | { raw?: number } | null | undefined

function num(v: YahooNum): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v.raw === 'number') return Number.isFinite(v.raw) ? v.raw : null
  return null
}

function int(v: YahooNum): number {
  const n = num(v)
  return n == null ? 0 : Math.round(n)
}

interface RecommendationTrendRow {
  period?: string
  strongBuy?: number
  buy?: number
  hold?: number
  sell?: number
  strongSell?: number
}

interface UpgradeHistoryRow {
  epochGradeDate?: number
  firm?: string
  toGrade?: string
  fromGrade?: string
  action?: string
}

interface QuoteSummaryResult {
  financialData?: Record<string, YahooNum | string>
  price?: Record<string, YahooNum>
  recommendationTrend?: { trend?: RecommendationTrendRow[] }
  upgradeDowngradeHistory?: { history?: UpgradeHistoryRow[] }
}

async function fetchQuoteSummary(symbol: string, forceFresh: boolean): Promise<Response> {
  if (forceFresh) cachedAuth = null
  const { crumb, cookie } = await getYahooAuth()
  const url =
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}` +
    `?modules=${QUOTE_SUMMARY_MODULES}&crumb=${encodeURIComponent(crumb)}`
  return fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT, Cookie: cookie } })
}

async function fetchAnalystData(ticker: string) {
  const t = ticker.toUpperCase()
  const symbol = `${t}.JK`

  // A stale crumb/cookie (401/403) or a rate-limited handshake (429) is worth
  // one retry with a fresh handshake before giving up.
  let res = await fetchQuoteSummary(symbol, false)
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    cachedAuth = null
    res = await fetchQuoteSummary(symbol, true)
  }

  if (res.status === 429) {
    throw new Error('Yahoo Finance is rate-limiting requests right now. Please try again shortly.')
  }
  if (!res.ok) {
    throw new Error(`Yahoo Finance returned HTTP ${res.status}`)
  }

  const body = await res.json()
  if (body?.quoteSummary?.error) {
    throw new Error(String(body.quoteSummary.error.description ?? body.quoteSummary.error))
  }

  const result: QuoteSummaryResult | undefined = body?.quoteSummary?.result?.[0]
  const fd = result?.financialData ?? {}
  const price = result?.price ?? {}

  const recommendationsSummary = (result?.recommendationTrend?.trend ?? []).map((row) => ({
    period: row.period ?? '',
    strongBuy: int(row.strongBuy),
    buy: int(row.buy),
    hold: int(row.hold),
    sell: int(row.sell),
    strongSell: int(row.strongSell),
  }))

  // Yahoo returns history most-recent-first; the widget shows the first rows
  // under "UPGRADE / DOWNGRADE TERBARU", so keep that order.
  const upgradesDowngrades = (result?.upgradeDowngradeHistory?.history ?? [])
    .slice(0, 10)
    .map((row) => ({
      GradeDate:
        typeof row.epochGradeDate === 'number'
          ? new Date(row.epochGradeDate * 1000).toISOString()
          : undefined,
      Firm: row.firm,
      ToGrade: row.toGrade,
      FromGrade: row.fromGrade,
      Action: row.action,
    }))

  return {
    ticker: t,
    symbol,
    current_price: num(fd.currentPrice as YahooNum) ?? num(price.regularMarketPrice),
    target_high: num(fd.targetHighPrice as YahooNum),
    target_low: num(fd.targetLowPrice as YahooNum),
    target_mean: num(fd.targetMeanPrice as YahooNum),
    target_median: num(fd.targetMedianPrice as YahooNum),
    recommendation_key: typeof fd.recommendationKey === 'string' ? fd.recommendationKey : null,
    recommendation_mean: num(fd.recommendationMean as YahooNum),
    number_of_analysts: num(fd.numberOfAnalystOpinions as YahooNum),
    recommendations_summary: recommendationsSummary,
    upgrades_downgrades: upgradesDowngrades,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params

  try {
    const data = await fetchAnalystData(ticker)
    return NextResponse.json(data, {
      // Analyst consensus changes slowly — let the CDN cache briefly to keep
      // Yahoo request volume (and rate-limit risk) down.
      headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
