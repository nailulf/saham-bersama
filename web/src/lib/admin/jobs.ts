// Server-side registry mapping stable job ids to run_all.py CLI flags.
// Flags are verbatim run_all.py argparse options. Never accept arbitrary flags
// from the client — the action route only ever runs flags from this table.

export type ParamDef =
  | { name: string; label: string; kind: 'select'; options: readonly string[]; default: string; flag: string }
  | { name: string; label: string; kind: 'number'; default: number; min: number; max: number; flag: string }
  | { name: string; label: string; kind: 'secret'; env: string; required: boolean }

export interface JobDef {
  id: string
  label: string
  description: string
  flags: string[]
  params?: ParamDef[]
}

export const JOBS = {
  daily: {
    id: 'daily',
    label: 'Daily Refresh',
    description: 'Daily prices + money flow (run_all --daily)',
    flags: ['--daily'],
  },
  daily_light: {
    id: 'daily_light',
    label: 'Daily (Light)',
    description: 'Light daily refresh — recent prices, 2d mode (run_all --daily-light)',
    flags: ['--daily-light'],
    params: [
      { name: 'token', label: 'Stockbit Bearer Token', kind: 'secret', env: 'STOCKBIT_BEARER_TOKEN', required: true },
      { name: 'since', label: 'Date range', kind: 'select', options: ['today', '2d', 'gap'], default: '2d', flag: '--since' },
    ],
  },
  weekly: {
    id: 'weekly',
    label: 'Weekly Universe',
    description: 'Stock universe + listing metadata (run_all --weekly)',
    flags: ['--weekly'],
  },
  quarterly: {
    id: 'quarterly',
    label: 'Quarterly Financials',
    description: 'Financials, profiles, documents, events (run_all --quarterly)',
    flags: ['--quarterly'],
  },
  dividends: {
    id: 'dividends',
    label: 'Dividends',
    description: 'Dividend history (run_all --dividends)',
    flags: ['--dividends'],
  },
  enrich_ratios: {
    id: 'enrich_ratios',
    label: 'Enrich Ratios',
    description: 'Computed ratios + CAGR rollups (run_all --enrich-ratios)',
    flags: ['--enrich-ratios'],
  },
  detect_phases: {
    id: 'detect_phases',
    label: 'Market Phases',
    description: 'Market phase detection (run_all --detect-phases)',
    flags: ['--detect-phases'],
  },
  detect_wyckoff_v2: {
    id: 'detect_wyckoff_v2',
    label: 'Wyckoff v2',
    description: 'FSM Wyckoff phase detection (run_all --detect-wyckoff-v2)',
    flags: ['--detect-wyckoff-v2'],
  },
  compute_signals: {
    id: 'compute_signals',
    label: 'Technical Signals',
    description: 'Price/volume technical signals (run_all --compute-signals)',
    flags: ['--compute-signals'],
  },
  market_pulse: {
    id: 'market_pulse',
    label: 'Market Pulse',
    description: 'Market-wide pulse snapshot (run_all --market-pulse)',
    flags: ['--market-pulse'],
  },
  broker_backfill: {
    id: 'broker_backfill',
    label: 'Broker Backfill',
    description: 'Stockbit broker flow + bandar signals backfill (run_all --broker-backfill)',
    flags: ['--broker-backfill'],
    params: [
      { name: 'token', label: 'Stockbit Bearer Token', kind: 'secret', env: 'STOCKBIT_BEARER_TOKEN', required: true },
      { name: 'days', label: 'Backfill days', kind: 'number', default: 30, min: 1, max: 365, flag: '--backfill-days' },
    ],
  },
  full: {
    id: 'full',
    label: 'Full Pipeline',
    description: 'Everything (run_all --full) — long running',
    flags: ['--full'],
  },
} as const satisfies Record<string, JobDef>

export type JobId = keyof typeof JOBS

export function isJobId(value: string): value is JobId {
  return Object.prototype.hasOwnProperty.call(JOBS, value)
}

export function getJob(id: string): JobDef | null {
  return isJobId(id) ? JOBS[id] : null
}
