import Link from 'next/link'
import { getMarketPulse } from '@/lib/queries/market-pulse'
import { fmtNumID, formatIDR, formatPercent } from '@/lib/calculations/formatters'
import type { MarketIndicator } from '@/lib/types/api'

// ─── Grouping ─────────────────────────────────────────────────────────────────

type Group = 'IDX' | 'Global Markets' | 'Energy' | 'Metals' | 'Tech Metals' | 'Agriculture' | 'Fertilizers' | 'Other'

const GROUP_ORDER: Group[] = [
  'IDX', 'Global Markets', 'Energy', 'Metals', 'Tech Metals', 'Agriculture', 'Fertilizers', 'Other',
]

const KEY_GROUP: Record<string, Group> = {
  ihsg: 'IDX', usd_idr: 'IDX',
  sp500: 'Global Markets', dow: 'Global Markets', nasdaq: 'Global Markets',
  gold: 'Metals', silver: 'Metals', nickel_hma: 'Metals',
  brent: 'Energy', wti: 'Energy',
}

const TE_ENERGY = new Set([
  'te_coal', 'te_coking_coal', 'te_natural_gas', 'te_brent_crude_oil',
  'te_crude_oil', 'te_heating_oil', 'te_ttf_gas', 'te_uk_gas',
  'te_bitumen', 'te_carbon', 'te_gasoline', 'te_rbob_gasoline', 'te_lng',
])
const TE_METALS = new Set([
  'te_nickel', 'te_aluminum', 'te_tin', 'te_zinc', 'te_cobalt', 'te_lead',
  'te_copper', 'te_steel', 'te_iron_ore', 'te_gold', 'te_silver',
  'te_platinum', 'te_palladium', 'te_rhodium', 'te_molybden', 'te_soda_ash',
])
const TE_TECH = new Set([
  'te_lithium', 'te_cobalt_hydroxide', 'te_gallium', 'te_germanium',
  'te_manganese', 'te_neodymium', 'te_tellurium', 'te_indium',
])
const TE_AGRI = new Set([
  'te_corn', 'te_soybeans', 'te_wheat', 'te_palm_oil', 'te_coffee',
  'te_cocoa', 'te_sugar', 'te_cotton', 'te_lumber', 'te_oats',
  'te_canola', 'te_barley', 'te_milk', 'te_cheese', 'te_butter',
  'te_beef', 'te_poultry', 'te_rice', 'te_salmon', 'te_orange_juice', 'te_rubber',
])
const TE_FERT = new Set([
  'te_urea', 'te_ammonia', 'te_dap', 'te_potash', 'te_sulfur', 'te_phosphate',
])

function getGroup(ind: MarketIndicator): Group {
  const k = ind.indicatorKey
  if (KEY_GROUP[k]) return KEY_GROUP[k]
  if (TE_ENERGY.has(k)) return 'Energy'
  if (TE_METALS.has(k)) return 'Metals'
  if (TE_TECH.has(k)) return 'Tech Metals'
  if (TE_AGRI.has(k)) return 'Agriculture'
  if (TE_FERT.has(k)) return 'Fertilizers'
  if (ind.category === 'energy') return 'Energy'
  if (ind.category === 'metal' || ind.category === 'minerba') return 'Metals'
  if (ind.category === 'fx' || ind.category === 'index_id') return 'IDX'
  if (ind.category === 'index_us') return 'Global Markets'
  return 'Other'
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function CommodityCard({ ind }: { ind: MarketIndicator }) {
  const positive = ind.changePct !== null ? ind.changePct >= 0 : null

  const value = ind.value === null ? '—'
    : ind.category === 'fx' ? formatIDR(ind.value)
    : fmtNumID(ind.value, 2)

  const change = ind.changePct === null ? null
    : `${ind.changePct >= 0 ? '+' : ''}${formatPercent(ind.changePct, 2)}`

  return (
    <div
      className="flex flex-col gap-2 rounded-lg p-3"
      style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Label + unit */}
      <div className="flex items-start justify-between gap-1">
        <span
          className="font-mono text-[10px] font-semibold tracking-[0.5px] uppercase leading-tight"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {ind.label}
        </span>
        {ind.unit && (
          <span
            className="font-mono text-[9px] shrink-0"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {ind.unit}
          </span>
        )}
      </div>

      {/* Value */}
      <span
        className="font-mono text-[15px] font-bold tabular-nums"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {value}
      </span>

      {/* Change row */}
      <div className="flex items-center justify-between">
        {positive !== null && change ? (
          <span
            className="font-mono text-[10px] font-semibold tabular-nums"
            style={{ color: positive ? 'var(--color-brand)' : 'var(--color-negative)' }}
          >
            {positive ? '▲ ' : '▼ '}{change}
          </span>
        ) : (
          <span />
        )}
        {ind.asOf && (
          <span
            className="font-mono text-[9px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {ind.asOf}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({ label, indicators }: { label: string; indicators: MarketIndicator[] }) {
  if (!indicators.length) return null
  return (
    <section className="flex flex-col gap-3">
      <h2
        className="font-mono text-[10px] font-bold tracking-[1.5px] uppercase"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {label}
      </h2>
      <div className="grid grid-cols-3 gap-2.5">
        {indicators.map((ind) => (
          <CommodityCard key={ind.indicatorKey} ind={ind} />
        ))}
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = { title: 'Commodities — IDX Analyzer' }

export default async function CommoditiesPage() {
  const { indicators } = await getMarketPulse()

  const grouped = Object.fromEntries(
    GROUP_ORDER.map((g) => [g, [] as MarketIndicator[]])
  ) as Record<Group, MarketIndicator[]>

  for (const ind of indicators) {
    grouped[getGroup(ind)].push(ind)
  }

  return (
    <main
      className="min-h-screen flex flex-col gap-6 px-5 pt-5 pb-10"
      style={{ background: 'var(--color-bg-page)' }}
    >
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 w-fit font-mono text-[10px] font-semibold tracking-[0.5px] uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Back
        </Link>
        <div className="flex flex-col gap-0.5">
          <h1
            className="font-mono text-[18px] font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Commodities
          </h1>
          <p
            className="font-mono text-[10px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {indicators.length} indicators
          </p>
        </div>
      </header>

      {GROUP_ORDER.map((group) => (
        <GroupSection key={group} label={group} indicators={grouped[group]} />
      ))}
    </main>
  )
}
