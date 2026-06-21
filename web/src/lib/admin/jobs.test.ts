import { describe, it, expect } from 'vitest'
import { JOBS, isJobId, getJob } from './jobs'

describe('job registry', () => {
  it('maps daily to the --daily flag', () => {
    expect(getJob('daily')?.flags).toEqual(['--daily'])
  })

  it('rejects unknown job ids', () => {
    expect(isJobId('rm-rf')).toBe(false)
    expect(getJob('rm-rf')).toBeNull()
  })

  it('every job has at least one flag and they are all run_all flags', () => {
    const allowed = new Set([
      '--daily', '--daily-light', '--weekly', '--quarterly', '--full',
      '--enrich-ratios', '--dividends', '--fill-gaps', '--fallback-financials',
      '--broker-backfill', '--insider', '--build-ai-context', '--run-ai-analysis',
      '--ai-full', '--detect-phases', '--detect-wyckoff', '--detect-wyckoff-v2',
      '--compute-signals', '--market-pulse',
    ])
    for (const def of Object.values(JOBS)) {
      expect(def.flags.length).toBeGreaterThan(0)
      for (const f of def.flags) expect(allowed.has(f)).toBe(true)
    }
  })
})
