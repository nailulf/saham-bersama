// Server-side registry mapping stable job ids to run_all.py CLI flags.
// Flags are verbatim run_all.py argparse options. Never accept arbitrary flags
// from the client — the action route only ever runs flags from this table.

export interface JobDef {
  id: string
  label: string
  description: string
  flags: string[]
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
