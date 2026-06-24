import { describe, it, expect } from 'vitest'
import { buildJobInvocation } from './jobInvocation'
import { getJob } from './jobs'

const daily = getJob('daily_light')!
const broker = getJob('broker_backfill')!

describe('buildJobInvocation', () => {
  it('builds args + env for daily_light with token and since', () => {
    const r = buildJobInvocation(daily, { token: 'TKN', since: 'today' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.args).toEqual(['--daily-light', '--since', 'today'])
      expect(r.env).toEqual({ STOCKBIT_BEARER_TOKEN: 'TKN' })
      expect(r.provided).toContain('token')
    }
  })

  it('errors when a required secret is missing', () => {
    const r = buildJobInvocation(daily, { since: '2d' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/required/i)
  })

  it('applies the select default when omitted', () => {
    const r = buildJobInvocation(daily, { token: 'X' })
    expect(r.ok && r.args).toEqual(['--daily-light', '--since', '2d'])
  })

  it('rejects an out-of-range select value', () => {
    const r = buildJobInvocation(daily, { token: 'X', since: 'yesterday' })
    expect(r.ok).toBe(false)
  })

  it('clamps a number param to its range', () => {
    const hi = buildJobInvocation(broker, { token: 'X', days: 9999 })
    expect(hi.ok && hi.args).toEqual(['--broker-backfill', '--backfill-days', '365'])
    const lo = buildJobInvocation(broker, { token: 'X', days: 0 })
    expect(lo.ok && lo.args).toEqual(['--broker-backfill', '--backfill-days', '1'])
  })

  it('falls back to the number default for non-numeric input', () => {
    const r = buildJobInvocation(broker, { token: 'X', days: 'abc' })
    expect(r.ok && r.args).toEqual(['--broker-backfill', '--backfill-days', '30'])
  })

  it('ignores undeclared params (no flag injection)', () => {
    const r = buildJobInvocation(daily, { token: 'X', evil: '--rm-rf' })
    expect(r.ok && r.args.includes('--rm-rf')).toBe(false)
  })
})
