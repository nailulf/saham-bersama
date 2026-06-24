import { describe, it, expect } from 'vitest'
import { JOBS, isJobId, getJob, type JobDef } from './jobs'

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

describe('param schema', () => {
  it('broker_backfill is registered with the --broker-backfill base flag', () => {
    const job = getJob('broker_backfill')
    expect(job).not.toBeNull()
    expect(job!.flags).toEqual(['--broker-backfill'])
  })

  it('daily_light requires a token and offers a since select', () => {
    const p = getJob('daily_light')!.params ?? []
    const token = p.find((x) => x.kind === 'secret')
    const since = p.find((x) => x.kind === 'select')
    expect(token).toMatchObject({ env: 'STOCKBIT_BEARER_TOKEN', required: true })
    expect(since).toMatchObject({ flag: '--since', default: '2d' })
    expect((since as { options: readonly string[] }).options).toEqual(['today', '2d', 'gap'])
  })

  it('broker_backfill requires a token and a days number', () => {
    const p = getJob('broker_backfill')!.params ?? []
    expect(p.find((x) => x.kind === 'secret')).toMatchObject({ required: true })
    expect(p.find((x) => x.kind === 'number')).toMatchObject({ flag: '--backfill-days', default: 30, min: 1, max: 365 })
  })

  it('every param select/number flag is a real run_all flag', () => {
    const allowed = new Set(['--since', '--backfill-days'])
    for (const job of Object.values(JOBS) as JobDef[]) {
      for (const param of job.params ?? []) {
        if (param.kind === 'select' || param.kind === 'number') {
          expect(allowed.has(param.flag)).toBe(true)
        }
      }
    }
  })
})
