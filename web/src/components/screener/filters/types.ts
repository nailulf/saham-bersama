// Shared filter keys, state shape, and option constants for the screener
// filter panel. Mirrors the keys honored by applyScreenerFilters() and the
// /api/strategies/count + /screener URL params.

export const FILTER_KEYS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxMktCap', 'maxPhaseDays',
  'sector', 'board', 'phase',
  'minRsi', 'maxRsi', 'macdCross', 'maxMacdCrossDays', 'minVolChangePct', 'maxVolChangePct', 'minVolAvg',
  'wyckoffEvent', 'wyckoffPhase', 'maxWyckoffDays', 'minWyckoffConf',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2', 'maxWyckoffDaysV2', 'minWyckoffConfV2',
  'bandarAccdist',
] as const

export type FilterKey = typeof FILTER_KEYS[number]
export type FilterState = Record<FilterKey, string>
export const EMPTY_FILTERS: FilterState =
  Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])) as FilterState

/** Seed a FilterState from a record (URL params or saved strategy.filters). */
export function filtersFromRecord(src: Record<string, unknown> | null | undefined): FilterState {
  const f = { ...EMPTY_FILTERS }
  if (!src) return f
  for (const key of FILTER_KEYS) {
    const v = src[key]
    if (v != null && v !== '') f[key] = String(v)
  }
  return f
}

// Sector values as stored in DB (label = Indonesian, value = DB string)
export const SECTOR_CHIPS = [
  { label: 'Perbankan',  value: 'Financials' },
  { label: 'Energi',     value: 'Energy' },
  { label: 'Teknologi',  value: 'Technology' },
  { label: 'Properti',   value: 'Property & Real Estate' },
  { label: 'Konsumer',   value: 'Barang Konsumen Primer' },
  { label: 'Telko',      value: 'Infrastructure' },
  { label: 'Industri',   value: 'Industrials' },
  { label: 'Kesehatan',  value: 'Healthcare' },
] as const

// Board values as stored in DB
export const BOARD_CHIPS = [
  { label: 'Utama',        value: 'Main' },
  { label: 'Pengembangan', value: 'Development' },
  { label: 'Akselerasi',   value: 'Acceleration' },
] as const

// Market phase (current_phase). Multi-select → comma-joined string.
export const PHASE_CHIPS = [
  { label: 'Uptrend',    value: 'uptrend',          color: 'var(--color-brand)' },
  { label: 'Downtrend',  value: 'downtrend',        color: 'var(--color-negative)' },
  { label: 'Sideways ↑', value: 'sideways_bullish', color: 'var(--color-warning-text)' },
  { label: 'Sideways ↓', value: 'sideways_bearish', color: 'var(--color-text-muted)' },
] as const

export const WYCKOFF_PHASE_CHIPS = [
  { label: 'Accumulation', value: 'accumulation', color: 'var(--color-warning-text)' },
  { label: 'Markup',       value: 'markup',       color: 'var(--color-brand)' },
  { label: 'Distribution', value: 'distribution', color: 'var(--color-negative)' },
  { label: 'Markdown',     value: 'markdown',     color: 'var(--color-negative)' },
] as const

export const MACD_CHIPS = [
  { label: 'Semua',             value: '' },
  { label: 'Bullish Crossover', value: 'golden_cross' },
  { label: 'Bearish Crossover', value: 'death_cross' },
] as const

// Bandar signal chip → bandar_accdist (denorm from bandar_signal.broker_accdist, v33)
export const BANDAR_CHIPS = [
  { label: 'Semua',      value: '' },
  { label: 'Akumulasi',  value: 'Acc' },
  { label: 'Distribusi', value: 'Dist' },
] as const

// Market cap range chip → sets minMktCap + maxMktCap (values in trillions IDR)
export type MktCapChip = 'all' | 'lt1' | '1to10' | '10to100' | 'gt100'
export function getMktCapChip(min: string, max: string): MktCapChip {
  if (!min && !max) return 'all'
  if (!min && max === '1') return 'lt1'
  if (min === '1' && max === '10') return '1to10'
  if (min === '10' && max === '100') return '10to100'
  if (min === '100' && !max) return 'gt100'
  return 'all'
}
export const MKT_CAP_CHIPS: { label: string; id: MktCapChip; min: string; max: string }[] = [
  { label: 'Semua',    id: 'all',     min: '',    max: '' },
  { label: '< 1T',     id: 'lt1',     min: '',    max: '1' },
  { label: '1T–10T',   id: '1to10',   min: '1',   max: '10' },
  { label: '10T–100T', id: '10to100', min: '10',  max: '100' },
  { label: '> 100T',   id: 'gt100',   min: '100', max: '' },
]
