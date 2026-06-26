/**
 * route.test.ts — spawn guard tests
 *
 * 1. 400-before-spawn: proves the route returns 400 and never calls spawn
 *    when the mapper rejects (e.g. a required Stockbit token is missing).
 * 2. Positive force-flag: proves that when a token is supplied, spawn is
 *    called once and the env contains STOCKBIT_TOKEN_FORCE_ENV=1 +
 *    STOCKBIT_BEARER_TOKEN equal to the supplied token value.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChildProcess } from 'child_process'

// --- module mocks (must be declared before any import that pulls the target) ---

vi.mock('@/lib/admin/auth', () => ({
  assertAdmin: () => ({ ok: true, subject: 'test-admin' }),
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

// jobRuns.ts imports createAdminSupabase at module load — stub the whole module
vi.mock('@/lib/admin/jobRuns', () => ({
  createJobRun: vi.fn(),
  finishJobRun: vi.fn(),
  findRunningRun: vi.fn().mockResolvedValue(null),
}))

// _shared imports next/server + createAdminSupabase — stub it
vi.mock('@/app/api/admin/data-quality/_shared', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

// fs — prevent any disk writes during the test
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
      closed: false,
    }),
  }
})

// Now import the route AFTER mocks are set up
import { POST } from './route'
import { spawn } from 'child_process'
import { createJobRun, findRunningRun } from '@/lib/admin/jobRuns'

// ── helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Request
}

/** Minimal fake ChildProcess that satisfies the route's stdout/stderr/on/unref calls. */
function makeFakeProc(pid = 12345): ChildProcess {
  return {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    unref: vi.fn(),
    pid,
  } as unknown as ChildProcess
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('POST /api/admin/cron-jobs/[jobId]/[action] — 400-before-spawn', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockClear()
  })

  it('returns 400 and never calls spawn when required token is missing', async () => {
    // daily_light declares token as required:true — omitting it must cause a 400
    const req = makeRequest({ params: { since: 'today' } }) // no token
    const routeParams = Promise.resolve({ jobId: 'daily_light', action: 'trigger' })

    const res = await POST(req as unknown as import('next/server').NextRequest, { params: routeParams })

    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/required/i)

    expect(spawn).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/cron-jobs/[jobId]/[action] — positive force-flag', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockClear()
    vi.mocked(findRunningRun).mockResolvedValue(null)
    vi.mocked(createJobRun).mockResolvedValue(undefined)
    // Return a fake child process so the route doesn't blow up on proc.stdout etc.
    vi.mocked(spawn).mockReturnValue(makeFakeProc())
  })

  it('calls spawn once and sets force-env flags when token is supplied', async () => {
    const req = makeRequest({ params: { token: 'TKN', since: 'today' } })
    const routeParams = Promise.resolve({ jobId: 'daily_light', action: 'trigger' })

    const res = await POST(req as unknown as import('next/server').NextRequest, { params: routeParams })

    // Should succeed (200)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    // spawn must have been called exactly once
    expect(spawn).toHaveBeenCalledOnce()

    // The env passed to spawn must carry both force-flag keys
    const spawnEnv = vi.mocked(spawn).mock.calls[0][2]?.env as Record<string, string>
    expect(spawnEnv).toBeDefined()
    expect(spawnEnv['STOCKBIT_TOKEN_FORCE_ENV']).toBe('1')
    expect(spawnEnv['STOCKBIT_BEARER_TOKEN']).toBe('TKN')
  })
})
