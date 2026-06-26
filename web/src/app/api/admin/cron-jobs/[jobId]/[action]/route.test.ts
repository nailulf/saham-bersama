/**
 * route.test.ts — 400-before-spawn guard
 *
 * Proves that the route returns 400 and never calls spawn when the mapper
 * rejects (e.g. a required Stockbit token is missing).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

// ── helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): Request {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Request
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
