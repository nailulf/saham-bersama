import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GraphNode, GraphLink, InvestorGraphData } from '@/lib/types/network'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sector = searchParams.get('sector') ?? null

  const supabase = await createClient()

  // 1. Get the two most recent report dates (latest + previous for delta).
  //    Use the snapshots view, which returns one row per distinct report_date.
  //    (Querying shareholders_major directly and de-duping client-side fails
  //    silently: a single snapshot can have 7k+ rows, so any row LIMIT only
  //    ever sees the latest date and `previousReportDate` comes back null.)
  const { data: dateRows, error: dateError } = await supabase
    .from('v_shareholders_major_snapshots')
    .select('report_date')
    .order('report_date', { ascending: false })
    .limit(2)

  if (dateError) {
    // Surface the real error — most likely cause: schema-v7 migration not applied yet
    console.error('[investors/network] date query failed:', dateError)
    return NextResponse.json(
      { error: dateError.message, hint: 'Have you applied docs/schema-v7-shareholders-major.sql in Supabase?' },
      { status: 500 }
    )
  }

  const distinctDates = ((dateRows ?? []) as any[]).map((r) => r.report_date as string)

  if (distinctDates.length === 0) {
    return NextResponse.json<InvestorGraphData>({ nodes: [], links: [], report_date: null })
  }

  const reportDate: string                 = distinctDates[0]
  const previousReportDate: string | null  = distinctDates[1] ?? null

  // 2. Fetch all holder rows for this date — paginate to bypass PostgREST max_rows cap
  const BATCH = 1000
  const allHolders: any[] = []
  let from = 0

  while (true) {
    const { data: batch, error: batchError } = await supabase
      .from('shareholders_major')
      .select('holder_name, holder_type, ticker, percentage, shares_held')
      .eq('report_date', reportDate)
      .range(from, from + BATCH - 1)

    if (batchError) {
      console.error('[investors/network] holders query failed:', batchError)
      return NextResponse.json({ error: batchError.message }, { status: 500 })
    }

    if (!batch || batch.length === 0) break
    allHolders.push(...batch)
    if (batch.length < BATCH) break
    from += BATCH
  }

  const holders = allHolders

  if (holders.length === 0) {
    return NextResponse.json<InvestorGraphData>({ nodes: [], links: [], report_date: reportDate })
  }

  // 2b. Fetch previous snapshot's rows (if any) for delta computation.
  const prevHolder = new Map<string, { pct: number; shares: number }>()  // key = `${invName}|${ticker}`
  if (previousReportDate) {
    let pfrom = 0
    while (true) {
      const { data: pbatch, error: pErr } = await supabase
        .from('shareholders_major')
        .select('holder_name, ticker, percentage, shares_held')
        .eq('report_date', previousReportDate)
        .range(pfrom, pfrom + BATCH - 1)

      if (pErr) {
        // Previous snapshot is optional — log and continue without deltas
        console.warn('[investors/network] previous-snapshot query failed:', pErr)
        break
      }
      if (!pbatch || pbatch.length === 0) break
      for (const r of pbatch as any[]) {
        prevHolder.set(`${r.holder_name}|${r.ticker}`, {
          pct: Number(r.percentage),
          shares: Number(r.shares_held ?? 0),
        })
      }
      if (pbatch.length < BATCH) break
      pfrom += BATCH
    }
  }

  // 3. Fetch stock metadata separately (name + sector) for all tickers in this snapshot
  const tickers = [...new Set((holders as any[]).map((h) => h.ticker as string))]

  const { data: stockRows, error: stocksError } = await supabase
    .from('stocks')
    .select('ticker, name, sector')
    .in('ticker', tickers)
    .range(0, 1999)

  if (stocksError) {
    console.error('[investors/network] stocks query failed:', stocksError)
    // Non-fatal — we'll just show nodes without name/sector
  }

  const stockMeta = new Map<string, { name: string | null; sector: string | null }>()
  for (const s of (stockRows ?? []) as any[]) {
    stockMeta.set(s.ticker, { name: s.name ?? null, sector: s.sector ?? null })
  }

  // 4. Build graph
  const investorMap = new Map<string, {
    holder_type: string | null
    stock_count: number
    total_pct: number
  }>()

  const stockMap = new Map<string, {
    name: string | null
    sector: string | null
    investor_count: number
  }>()

  const links: GraphLink[] = []

  for (const h of holders as any[]) {
    const invName: string = h.holder_name
    const ticker: string  = h.ticker
    const pct: number     = Number(h.percentage)
    const shares: number  = Number(h.shares_held ?? 0)
    const meta            = stockMeta.get(ticker) ?? { name: null, sector: null }

    if (sector && meta.sector !== sector) continue

    if (!investorMap.has(invName)) {
      investorMap.set(invName, { holder_type: h.holder_type ?? null, stock_count: 0, total_pct: 0 })
    }
    const inv = investorMap.get(invName)!
    inv.stock_count++
    inv.total_pct = Math.round((inv.total_pct + pct) * 10000) / 10000

    if (!stockMap.has(ticker)) {
      stockMap.set(ticker, { name: meta.name, sector: meta.sector, investor_count: 0 })
    }
    stockMap.get(ticker)!.investor_count++

    const prev = prevHolder.get(`${invName}|${ticker}`)
    links.push({
      source: `inv:${invName}`,
      target: `stk:${ticker}`,
      percentage: pct,
      prevPercentage: prev?.pct ?? null,
      shares,
      prevShares: prev?.shares ?? null,
    })
  }

  // Also surface investors/stocks that were in the previous snapshot but
  // disappeared this quarter — these become "exited" rows in the panel.
  // We don't add them as nodes (no current link to anchor them), but we
  // do attach them as ghost links so the panel can render the loss.
  if (previousReportDate) {
    const currentKeys = new Set<string>()
    for (const lk of links) {
      const src = typeof lk.source === 'string' ? lk.source : (lk.source as any).id
      const tgt = typeof lk.target === 'string' ? lk.target : (lk.target as any).id
      currentKeys.add(`${src}->${tgt}`)
    }
    for (const [key, prev] of prevHolder.entries()) {
      const [invName, ticker] = key.split('|')
      const linkKey = `inv:${invName}->stk:${ticker}`
      if (currentKeys.has(linkKey)) continue
      // Only include if at least one side (investor or stock) still exists
      // in the current graph — otherwise the row is unanchored.
      if (!investorMap.has(invName) && !stockMap.has(ticker)) continue
      links.push({
        source: `inv:${invName}`,
        target: `stk:${ticker}`,
        percentage: 0,
        prevPercentage: prev.pct,
        shares: 0,
        prevShares: prev.shares,
      })
    }
  }

  // Per-investor aggregates from the previous snapshot — used for the List
  // view's ownership-change columns and the panel header deltas.
  const prevInvAgg = new Map<string, { total_pct: number; stock_count: number }>()
  for (const [key, prev] of prevHolder.entries()) {
    const [invName, ticker] = key.split('|')
    if (sector) {
      const meta = stockMeta.get(ticker)
      if (!meta || meta.sector !== sector) continue  // can't place prev-only ticker in this sector
    }
    if (!prevInvAgg.has(invName)) prevInvAgg.set(invName, { total_pct: 0, stock_count: 0 })
    const agg = prevInvAgg.get(invName)!
    agg.total_pct = Math.round((agg.total_pct + prev.pct) * 10000) / 10000
    agg.stock_count++
  }

  const nodes: GraphNode[] = [
    ...Array.from(investorMap.entries()).map(([name, d]): GraphNode => {
      const prev = prevInvAgg.get(name)
      return {
        id: `inv:${name}`, label: name, type: 'investor',
        holder_type: d.holder_type, stock_count: d.stock_count, total_pct: d.total_pct,
        prev_total_pct: prev?.total_pct ?? null,
        prev_stock_count: prev?.stock_count ?? null,
      }
    }),
    ...Array.from(stockMap.entries()).map(([ticker, d]): GraphNode => ({
      id: `stk:${ticker}`, label: ticker, type: 'stock',
      sector: d.sector, stock_name: d.name, investor_count: d.investor_count,
    })),
  ]

  console.log(`[investors/network] ${nodes.length} nodes, ${links.length} links, date=${reportDate}, prev=${previousReportDate}`)

  return NextResponse.json<InvestorGraphData>({
    nodes,
    links,
    report_date: reportDate,
    previous_report_date: previousReportDate,
  })
}
