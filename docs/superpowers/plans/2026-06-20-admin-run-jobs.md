# Admin "Run Jobs" — Make the Data Pipeline Module Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mocked `/admin` "Data Pipeline" module so the operator can trigger real `run_all.py` jobs locally, see live run status/history, and view real health/freshness — keeping scheduling in the existing cron/GH Actions (no in-app scheduler).

**Architecture:** A server-side **job registry** maps stable `jobId`s to exact `run_all.py` CLI flags. The trigger route spawns `run_all.py` via `child_process.spawn` on the local machine (same proven pattern as `/api/stocks/[ticker]/refresh/local`), streams stdout/stderr to a per-run log file, and records every run in a new `admin_job_runs` table. The React module polls run status from that table instead of rendering hardcoded arrays. All admin routes are gated by the existing `assertAdmin` HMAC-cookie session and audit-logged.

**Tech Stack:** Next.js 16 (App Router, Route Handlers, `runtime = 'nodejs'`), React 19 client components, `@supabase/supabase-js` (service-role admin client), Node `child_process`/`fs`, Python 3 (`run_all.py`, unchanged), Vitest (new, for pure-logic unit tests).

## Global Constraints

- Tickers stored/queried WITHOUT `.JK` suffix; uppercase. (Not central here but applies to any ticker filter.)
- Schema migrations: current head is **v38**; new migration MUST be `docs/schema-v39-admin-job-runs.sql`. Never edit an applied migration. Make it idempotent (`IF NOT EXISTS`). Update `docs/data_dictionary.md` in the same task.
- All admin API routes: `export const runtime = 'nodejs'` and first line of every handler is the `assertAdmin(req)` guard returning `{ ok:false }` + `guard.status` on failure.
- Admin Supabase access goes through `createAdminSupabase()` (`web/src/lib/admin/supabase.ts`) — service role, never the SSR anon client.
- SSR/number formatting: in client components use `fmtNumID()` from `@/lib/calculations/formatters` for grouped numbers — never `toLocaleString`.
- Reuse the spawn contract from `web/src/app/api/stocks/[ticker]/refresh/local/route.ts`: `PYTHON_BIN = <root>/.venv/bin/python3`, `cwd = <root>/python`, `spawn(..., { detached:true, stdio:['ignore','pipe','pipe'], env })`, `proc.unref()`.
- Confirmed `run_all.py` flags (verbatim, do not invent others): `--daily --daily-light --weekly --quarterly --full --enrich-ratios --dividends --fill-gaps --fallback-financials --broker-backfill --insider --build-ai-context --run-ai-analysis --ai-full --detect-phases --detect-wyckoff --detect-wyckoff-v2 --compute-signals --market-pulse --ticker --job-id --since --backfill-days`.
- Job model is **manual trigger + freshness only**. Do NOT build a node-cron scheduler. "stop"/"restart" are best-effort and must be labelled as such.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `web/vitest.config.ts` (create) | Minimal Vitest config for pure-logic unit tests | 1 |
| `web/package.json` (modify) | Add `test` script + vitest devDep | 1 |
| `web/src/lib/admin/auth.test.ts` (create) | Unit test for token sign/verify roundtrip | 1 |
| `web/src/app/api/admin/auth/login/route.ts` (modify) | Require `ADMIN_PASSWORD` env; drop `'admin2024'` fallback | 2 |
| `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts` (modify) | Add `assertAdmin` guard (hardening) then real spawn (Task 6) | 2, 6 |
| `docs/schema-v39-admin-job-runs.sql` (create) | `admin_job_runs` table + indexes + RLS | 3 |
| `docs/data_dictionary.md` (modify) | Document `admin_job_runs` | 3 |
| `web/src/lib/admin/jobs.ts` (create) | Job registry: `jobId → flags`, lookup/validation | 4 |
| `web/src/lib/admin/jobs.test.ts` (create) | Unit tests for registry lookup/validation | 4 |
| `web/src/lib/admin/jobRuns.ts` (create) | `admin_job_runs` CRUD helpers (create/finish/list/get) | 5 |
| `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts` (modify) | Spawn `run_all.py`, record run, stream log | 6 |
| `web/src/app/api/admin/cron-jobs/route.ts` (create) | `GET` registry + recent runs | 7 |
| `web/src/app/api/admin/cron-jobs/runs/[runId]/log/route.ts` (create) | `GET` tail of a run's log file | 7 |
| `web/src/app/admin/components/CronJobManager.tsx` (modify) | Replace mock data with real fetch + polling | 8 |
| `web/src/app/api/admin/health/route.ts` (modify) | Real DB ping + env check | 9 |
| `web/src/app/api/admin/overview/route.ts` (create) | Per-table freshness + recent runs summary | 10 |
| `web/src/app/admin/components/AdminOverview.tsx` (modify) | Render real freshness/runs instead of literals | 10 |

**Out of scope (future, not in this plan):** AI Config persistence (`AIConfigManager.tsx` → `macro-context`/`scoring-config.json`), deleting/replacing the unmounted `FeatureFlagManager.tsx`, retiring the mock `web/src/app/api/admin/logs/route.ts`. Track separately.

---

## Task 1: Vitest harness + auth token unit test

**Files:**
- Create: `web/vitest.config.ts`
- Modify: `web/package.json` (scripts + devDependencies)
- Test: `web/src/lib/admin/auth.test.ts`

**Interfaces:**
- Consumes: `signAdminToken(subject, ttlSeconds?)`, `verifyAdminToken(token)` from `web/src/lib/admin/auth.ts` (already exist).
- Produces: `npm run test` runs Vitest; a working test file pattern (`*.test.ts`) other tasks reuse.

- [ ] **Step 1: Install Vitest**

Run (in `web/`): `npm install -D vitest@^2`
Expected: vitest added to `devDependencies`, no peer-dep errors.

- [ ] **Step 2: Add the test script**

Modify `web/package.json` `scripts` to add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
```

- [ ] **Step 4: Write the failing test**

Create `web/src/lib/admin/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { signAdminToken, verifyAdminToken } from './auth'

describe('admin auth token', () => {
  it('verifies a freshly signed token', () => {
    const token = signAdminToken('local-admin')
    const res = verifyAdminToken(token)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.payload.sub).toBe('local-admin')
  })

  it('rejects a tampered token', () => {
    const token = signAdminToken('local-admin')
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifyAdminToken(tampered).ok).toBe(false)
  })

  it('rejects an expired token', () => {
    const token = signAdminToken('local-admin', -10) // already expired
    const res = verifyAdminToken(token)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('expired')
  })
})
```

- [ ] **Step 5: Run the test**

Run (in `web/`): `npm run test -- src/lib/admin/auth.test.ts`
Expected: 3 passing tests (these exercise existing, already-correct code — this task proves the harness works).

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/vitest.config.ts web/src/lib/admin/auth.test.ts
git commit -m "test: add vitest harness + admin auth token tests"
```

---

## Task 2: Harden — require ADMIN_PASSWORD + guard the cron route

**Files:**
- Modify: `web/src/app/api/admin/auth/login/route.ts:10`
- Modify: `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts` (add guard only; real spawn is Task 6)

**Interfaces:**
- Consumes: `assertAdmin(req)` from `@/lib/admin/auth` (returns `{ ok:true, subject } | { ok:false, status, error }`).
- Produces: an admin-only cron route; login that refuses to run without configured secret.

- [ ] **Step 1: Make login require a configured password**

In `web/src/app/api/admin/auth/login/route.ts`, replace:

```ts
    const expected = process.env.ADMIN_PASSWORD || 'admin2024'

    if (!password || password !== expected) {
      return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 })
    }
```

with:

```ts
    const expected = process.env.ADMIN_PASSWORD
    if (!expected) {
      return NextResponse.json(
        { ok: false, error: 'Admin auth not configured: set ADMIN_PASSWORD' },
        { status: 500 }
      )
    }
    if (!password || password !== expected) {
      return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 })
    }
```

- [ ] **Step 2: Guard the cron route**

In `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts`, add the import and guard. Replace the top of `POST`:

```ts
import { NextRequest, NextResponse } from 'next/server'
```

with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'

export const runtime = 'nodejs'
```

and immediately after `export async function POST(request: NextRequest, { params }: RouteParams) {` and its `try {`, add as the first statement inside `try`:

```ts
    const guard = assertAdmin(request)
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
```

- [ ] **Step 3: Verify the guard (manual)**

Start dev server: `cd web && npm run dev` (separate terminal).
Run: `curl -s -X POST http://localhost:3000/api/admin/cron-jobs/daily/trigger -o /dev/null -w "%{http_code}\n"`
Expected: `401` (no admin cookie). Before this change it returned `200`.

- [ ] **Step 4: Verify login refuses without env (manual)**

With `ADMIN_PASSWORD` unset in `web/.env.local`, run:
`curl -s -X POST http://localhost:3000/api/admin/auth/login -H 'content-type: application/json' -d '{"password":"x"}' -w "\n%{http_code}\n"`
Expected: body contains `Admin auth not configured`, status `500`. Then set `ADMIN_PASSWORD=<your-password>` in `web/.env.local` for the rest of the work.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/admin/auth/login/route.ts web/src/app/api/admin/cron-jobs/'[jobId]'/'[action]'/route.ts
git commit -m "fix(admin): require ADMIN_PASSWORD and gate cron route with assertAdmin"
```

---

## Task 3: Schema v39 — `admin_job_runs`

**Files:**
- Create: `docs/schema-v39-admin-job-runs.sql`
- Modify: `docs/data_dictionary.md`

**Interfaces:**
- Produces: table `admin_job_runs(id uuid pk, job text, status text, pid int, started_at timestamptz, finished_at timestamptz, exit_code int, triggered_by text, log_path text)` consumed by `jobRuns.ts` (Task 5).

- [ ] **Step 1: Write the migration**

Create `docs/schema-v39-admin-job-runs.sql`:

```sql
-- =============================================================================
-- schema-v39-admin-job-runs.sql
-- Tracks manual /admin "Run Job" executions of run_all.py (status + history)
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_job_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job          TEXT NOT NULL,                 -- registry job id (e.g. 'daily')
  status       TEXT NOT NULL DEFAULT 'running', -- running | success | failed | stopped
  pid          INTEGER,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  exit_code    INTEGER,
  triggered_by TEXT NOT NULL,                 -- assertAdmin subject
  log_path     TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_job_runs_started_at ON admin_job_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_job_runs_job ON admin_job_runs (job, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_job_runs_status ON admin_job_runs (status);

ALTER TABLE admin_job_runs ENABLE ROW LEVEL SECURITY;
-- Access is via service-role key (admin API only); no anon policies by design.
```

- [ ] **Step 2: Apply it**

Apply via the Supabase SQL editor (manual, per project convention). Then verify:
Run: `psql "$SUPABASE_DB_URL" -c "\d admin_job_runs"` (or check in the Supabase dashboard).
Expected: table exists with the 9 columns above.

- [ ] **Step 3: Document it**

In `docs/data_dictionary.md`, add a row/section describing `admin_job_runs` and each column (mirror the wording of the `admin_audit_log` entry added in v38).

- [ ] **Step 4: Commit**

```bash
git add docs/schema-v39-admin-job-runs.sql docs/data_dictionary.md
git commit -m "feat(schema): v39 admin_job_runs table for manual job runs"
```

---

## Task 4: Job registry

**Files:**
- Create: `web/src/lib/admin/jobs.ts`
- Test: `web/src/lib/admin/jobs.test.ts`

**Interfaces:**
- Produces:
  - `type JobId` (string union of registry keys)
  - `interface JobDef { id: JobId; label: string; description: string; flags: string[] }`
  - `const JOBS: Record<JobId, JobDef>`
  - `function isJobId(value: string): value is JobId`
  - `function getJob(id: string): JobDef | null`
- Consumed by: Task 6 (trigger route), Task 7 (`GET /api/admin/cron-jobs`).

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/admin/jobs.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm failure**

Run (in `web/`): `npm run test -- src/lib/admin/jobs.test.ts`
Expected: FAIL — cannot resolve `./jobs`.

- [ ] **Step 3: Implement the registry**

Create `web/src/lib/admin/jobs.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to confirm pass**

Run (in `web/`): `npm run test -- src/lib/admin/jobs.test.ts`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/admin/jobs.ts web/src/lib/admin/jobs.test.ts
git commit -m "feat(admin): job registry mapping job ids to run_all flags"
```

---

## Task 5: `admin_job_runs` data helpers

**Files:**
- Create: `web/src/lib/admin/jobRuns.ts`

**Interfaces:**
- Consumes: `createAdminSupabase()` from `@/lib/admin/supabase`.
- Produces:
  - `interface JobRun { id: string; job: string; status: 'running'|'success'|'failed'|'stopped'; pid: number|null; started_at: string; finished_at: string|null; exit_code: number|null; triggered_by: string; log_path: string|null }`
  - `async function createJobRun(run: { id: string; job: string; pid: number|null; triggeredBy: string; logPath: string }): Promise<void>`
  - `async function finishJobRun(id: string, result: { status: 'success'|'failed'|'stopped'; exitCode: number|null }): Promise<void>`
  - `async function listRecentRuns(limit?: number): Promise<JobRun[]>`
  - `async function findRunningRun(job: string): Promise<JobRun | null>`
- Consumed by: Tasks 6, 7, 10.

- [ ] **Step 1: Implement the helpers**

Create `web/src/lib/admin/jobRuns.ts`:

```ts
import { createAdminSupabase } from '@/lib/admin/supabase'

export interface JobRun {
  id: string
  job: string
  status: 'running' | 'success' | 'failed' | 'stopped'
  pid: number | null
  started_at: string
  finished_at: string | null
  exit_code: number | null
  triggered_by: string
  log_path: string | null
}

export async function createJobRun(run: {
  id: string
  job: string
  pid: number | null
  triggeredBy: string
  logPath: string
}): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase.from('admin_job_runs').insert({
    id: run.id,
    job: run.job,
    status: 'running',
    pid: run.pid,
    triggered_by: run.triggeredBy,
    log_path: run.logPath,
  })
  if (error) throw new Error(`createJobRun failed: ${error.message}`)
}

export async function finishJobRun(
  id: string,
  result: { status: 'success' | 'failed' | 'stopped'; exitCode: number | null }
): Promise<void> {
  const supabase = createAdminSupabase()
  const { error } = await supabase
    .from('admin_job_runs')
    .update({
      status: result.status,
      exit_code: result.exitCode,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(`finishJobRun failed: ${error.message}`)
}

export async function listRecentRuns(limit = 20): Promise<JobRun[]> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('admin_job_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`listRecentRuns failed: ${error.message}`)
  return (data ?? []) as JobRun[]
}

export async function findRunningRun(job: string): Promise<JobRun | null> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('admin_job_runs')
    .select('*')
    .eq('job', job)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`findRunningRun failed: ${error.message}`)
  return (data as JobRun) ?? null
}
```

- [ ] **Step 2: Type-check**

Run (in `web/`): `npx tsc --noEmit`
Expected: no errors from `jobRuns.ts` (pre-existing unrelated errors, if any, are out of scope — confirm none mention `jobRuns`).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/admin/jobRuns.ts
git commit -m "feat(admin): admin_job_runs data helpers (create/finish/list/find)"
```

---

## Task 6: Real spawn in the trigger route

**Files:**
- Modify: `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts` (full rewrite of the body; keep the file path)

**Interfaces:**
- Consumes: `assertAdmin` (Task 2), `getJob`/`isJobId` (Task 4), `createJobRun`/`finishJobRun`/`findRunningRun` (Task 5), `writeAuditLog`/`getClientIp` from `../../data-quality/_shared` is NOT reachable cross-folder — instead import audit from a shared location. Use `writeAuditLog` by relative import `@/app/api/admin/data-quality/_shared` is allowed via the `@` alias.
- Produces: `POST` returns `{ success:true, runId, jobId, action, pid }` for `trigger`; `{ success:true, stopped }` for `stop`.

> Note on the audit import: `_shared.ts` lives under `data-quality/`. Import it with the alias: `import { writeAuditLog, getClientIp } from '@/app/api/admin/data-quality/_shared'`. (It only depends on `createAdminSupabase`, so cross-folder reuse is safe.)

- [ ] **Step 1: Replace the route file**

Overwrite `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { createWriteStream, mkdirSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { assertAdmin } from '@/lib/admin/auth'
import { getJob } from '@/lib/admin/jobs'
import { createJobRun, finishJobRun, findRunningRun } from '@/lib/admin/jobRuns'
import { writeAuditLog, getClientIp } from '@/app/api/admin/data-quality/_shared'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ jobId: string; action: string }>
}

const PROJECT_ROOT = path.join(process.cwd(), '..')
const PYTHON_BIN = path.join(PROJECT_ROOT, '.venv', 'bin', 'python3')
const RUN_ALL = path.join(PROJECT_ROOT, 'python', 'run_all.py')
const LOG_DIR = path.join(PROJECT_ROOT, 'python', 'data', 'admin-logs')

const VALID_ACTIONS = ['trigger', 'start', 'stop', 'restart'] as const

export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = assertAdmin(request)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { jobId, action } = await params

  if (!VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
    return NextResponse.json(
      { ok: false, error: `Invalid action: ${action}. Valid: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 }
    )
  }

  const job = getJob(jobId)
  if (!job) {
    return NextResponse.json({ ok: false, error: `Unknown job: ${jobId}` }, { status: 400 })
  }

  // best-effort stop: kill the most recent running process for this job
  if (action === 'stop') {
    const running = await findRunningRun(jobId)
    if (!running?.pid) {
      return NextResponse.json({ ok: true, stopped: false, message: 'No running process found' })
    }
    try {
      process.kill(-running.pid) // detached → kill the process group
    } catch {
      try { process.kill(running.pid) } catch { /* already gone */ }
    }
    await finishJobRun(running.id, { status: 'stopped', exitCode: null })
    return NextResponse.json({ ok: true, stopped: true, runId: running.id })
  }

  // trigger / start / restart all mean "run it now"
  const runId = crypto.randomUUID()
  const logPath = path.join(LOG_DIR, `${runId}.log`)
  mkdirSync(LOG_DIR, { recursive: true })

  const args = [RUN_ALL, ...job.flags, '--job-id', '0'] // --job-id 0 = no UI refresh-job tracking

  try {
    const logStream = createWriteStream(logPath, { flags: 'a' })
    logStream.write(`# job=${jobId} flags=${job.flags.join(' ')} started=${new Date().toISOString()}\n`)

    const proc = spawn(PYTHON_BIN, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: path.join(PROJECT_ROOT, 'python'),
    })

    proc.stdout?.on('data', (c: Buffer) => logStream.write(c))
    proc.stderr?.on('data', (c: Buffer) => logStream.write(c))

    proc.on('exit', (code) => {
      logStream.write(`\n# exit=${code} finished=${new Date().toISOString()}\n`)
      logStream.end()
      finishJobRun(runId, {
        status: code === 0 ? 'success' : 'failed',
        exitCode: code ?? null,
      }).catch((e) => console.error('[cron-jobs] finishJobRun failed:', e))
    })

    proc.unref()

    await createJobRun({ id: runId, job: jobId, pid: proc.pid ?? null, triggeredBy: guard.subject, logPath })

    await writeAuditLog({
      actor: guard.subject,
      action: 'cron.trigger',
      route: `/api/admin/cron-jobs/${jobId}/${action}`,
      query: { jobId, flags: job.flags, runId, pid: proc.pid },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => null)

    return NextResponse.json({ ok: true, success: true, runId, jobId, action, pid: proc.pid })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to spawn job' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Manual end-to-end verification**

Prereq: dev server running, `ADMIN_PASSWORD` set, logged in once via the UI (so the browser has the `sb_admin` cookie) — or capture the cookie:

```bash
# get an admin cookie into a jar
curl -s -c /tmp/admin.jar -X POST http://localhost:3000/api/admin/auth/login \
  -H 'content-type: application/json' -d "{\"password\":\"$ADMIN_PASSWORD\"}"

# trigger the lightest job
curl -s -b /tmp/admin.jar -X POST http://localhost:3000/api/admin/cron-jobs/enrich_ratios/trigger | tee /tmp/run.json
```

Expected: JSON `{ "ok": true, "success": true, "runId": "...", "pid": <number> }`.

- [ ] **Step 3: Confirm the run was recorded and completed**

```bash
RUNID=$(python3 -c "import json;print(json.load(open('/tmp/run.json'))['runId'])")
ls -la "python/data/admin-logs/$RUNID.log"          # log file exists and grows
```

Then query Supabase (SQL editor or psql): `select job,status,exit_code,pid from admin_job_runs order by started_at desc limit 1;`
Expected: a row for `enrich_ratios` that transitions `running` → `success` (or `failed` with a real exit code) once the Python process exits. Tail the log to see real `run_all.py` output.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/admin/cron-jobs/'[jobId]'/'[action]'/route.ts
git commit -m "feat(admin): trigger route spawns run_all.py and records admin_job_runs"
```

---

## Task 7: Read endpoints — registry + recent runs, and run log tail

**Files:**
- Create: `web/src/app/api/admin/cron-jobs/route.ts`
- Create: `web/src/app/api/admin/cron-jobs/runs/[runId]/log/route.ts`

**Interfaces:**
- Consumes: `assertAdmin`, `JOBS` (Task 4), `listRecentRuns` (Task 5).
- Produces:
  - `GET /api/admin/cron-jobs` → `{ ok:true, jobs: JobDef[], runs: JobRun[] }`
  - `GET /api/admin/cron-jobs/runs/<runId>/log` → `{ ok:true, runId, log: string }` (last ~500 lines)

- [ ] **Step 1: Create the list endpoint**

Create `web/src/app/api/admin/cron-jobs/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { JOBS } from '@/lib/admin/jobs'
import { listRecentRuns } from '@/lib/admin/jobRuns'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  try {
    const runs = await listRecentRuns(30)
    return NextResponse.json({ ok: true, jobs: Object.values(JOBS), runs })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to list jobs' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Create the log-tail endpoint**

Create `web/src/app/api/admin/cron-jobs/runs/[runId]/log/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import path from 'path'
import { assertAdmin } from '@/lib/admin/auth'
import { createAdminSupabase } from '@/lib/admin/supabase'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ runId: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: RouteParams) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { runId } = await params
  if (!UUID_RE.test(runId)) {
    return NextResponse.json({ ok: false, error: 'Invalid runId' }, { status: 400 })
  }

  // Resolve log_path from the DB row — never build a path from raw input.
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('admin_job_runs')
    .select('log_path')
    .eq('id', runId)
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!data?.log_path) return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 })

  // Defense in depth: ensure the stored path stays inside the admin-logs dir.
  const logDir = path.join(process.cwd(), '..', 'python', 'data', 'admin-logs')
  const resolved = path.resolve(data.log_path)
  if (!resolved.startsWith(path.resolve(logDir))) {
    return NextResponse.json({ ok: false, error: 'Invalid log path' }, { status: 400 })
  }

  let log = ''
  try {
    log = readFileSync(resolved, 'utf8').split('\n').slice(-500).join('\n')
  } catch {
    log = '(log not available yet)'
  }
  return NextResponse.json({ ok: true, runId, log })
}
```

- [ ] **Step 3: Manual verification**

```bash
curl -s -b /tmp/admin.jar http://localhost:3000/api/admin/cron-jobs | python3 -m json.tool | head -40
curl -s -b /tmp/admin.jar "http://localhost:3000/api/admin/cron-jobs/runs/$RUNID/log" | python3 -m json.tool | head -20
```

Expected: first returns `jobs` (the registry) + `runs` (recent rows incl. your Task 6 run); second returns real log lines from that run.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/admin/cron-jobs/route.ts web/src/app/api/admin/cron-jobs/runs
git commit -m "feat(admin): GET cron-jobs registry+runs and run log tail"
```

---

## Task 8: Wire `CronJobManager` to real data

**Files:**
- Modify: `web/src/app/admin/components/CronJobManager.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/cron-jobs`, `POST /api/admin/cron-jobs/[jobId]/trigger|stop`, `GET /api/admin/cron-jobs/runs/[runId]/log`.
- Produces: a module rendered from live state; no `mock*` arrays remain.

This task replaces the data layer of the component (its mock arrays and handlers) while keeping the existing JSX/markup. Apply each edit exactly.

- [ ] **Step 1: Delete the mock data**

In `CronJobManager.tsx`, delete the three top-level constants `mockJobs` (`const mockJobs: CronJob[] = [ ... ]`), `mockLogs` (`const mockLogs: JobLog[] = [ ... ]`), and `mockStats` (`const mockStats: JobStats = { ... }`). Keep the `CronJob` / `JobLog` / `JobStats` interfaces and the helper functions (`formatDuration`, `formatTimeAgo`, `parseCron`).

- [ ] **Step 2: Add real state + fetch at the top of the component**

Immediately after `export default function CronJobManager() {`, before the existing `useState` lines, insert:

```tsx
  type RegistryJob = { id: string; label: string; description: string; flags: string[] }
  type RunRow = {
    id: string
    job: string
    status: 'running' | 'success' | 'failed' | 'stopped'
    started_at: string
    finished_at: string | null
    exit_code: number | null
  }

  const [registry, setRegistry] = useState<RegistryJob[]>([])
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadJobs = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cron-jobs')
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to load jobs')
      setRegistry(data.jobs)
      setRuns(data.runs)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load jobs')
    }
  }, [])

  useEffect(() => {
    loadJobs()
    const t = setInterval(loadJobs, 5000) // poll status/history
    return () => clearInterval(t)
  }, [loadJobs])

  const lastRunFor = (jobId: string) => runs.find((r) => r.job === jobId) ?? null
```

(Ensure `React`, `useState`, `useEffect` are imported — they already are at the top of the file.)

- [ ] **Step 3: Derive the rendered jobs from the registry**

Replace the existing `const filteredJobs = mockJobs.filter(...)` block with a mapping from registry + latest run:

```tsx
  const derivedJobs: CronJob[] = registry.map((j) => {
    const last = lastRunFor(j.id)
    return {
      id: j.id,
      name: j.label,
      schedule: '—', // scheduling lives in external cron, not the app
      description: j.description,
      status: last?.status === 'running' ? 'running' : last?.status === 'failed' ? 'error' : 'stopped',
      lastRun: last?.started_at ?? null,
      nextRun: null,
      lastDuration:
        last?.finished_at && last?.started_at
          ? Math.round((new Date(last.finished_at).getTime() - new Date(last.started_at).getTime()) / 1000)
          : null,
      totalRuns: runs.filter((r) => r.job === j.id).length,
      successRate: 0,
      command: `run_all.py ${j.flags.join(' ')}`,
      logRetention: 0,
    }
  })

  const filteredJobs = derivedJobs.filter((job) => {
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus
    const matchesSearch =
      job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })
```

- [ ] **Step 4: Replace the stats cards source**

Replace every `mockStats.X` reference in the stats grid with derived values. Add above the `return (`:

```tsx
  const stats = {
    totalJobs: registry.length,
    runningJobs: runs.filter((r) => r.status === 'running').length,
    failedJobs: runs.filter((r) => r.status === 'failed').length,
    totalExecutions24h: runs.filter(
      (r) => Date.now() - new Date(r.started_at).getTime() < 86400000
    ).length,
  }
```

Then change `mockStats.totalJobs` → `stats.totalJobs`, `mockStats.runningJobs` → `stats.runningJobs`, `mockStats.failedJobs` → `stats.failedJobs`, `mockStats.totalExecutions24h` → `stats.totalExecutions24h`. Delete the "Success Rate" stat card (no real value yet) OR set it to `'—'`.

- [ ] **Step 5: Make actions hit the real endpoint and refresh**

Replace the body of `handleJobAction` with:

```tsx
  const handleJobAction = async (jobId: string, action: 'start' | 'stop' | 'trigger') => {
    setIsActionLoading(`${action}-${jobId}`)
    try {
      const response = await fetch(`/api/admin/cron-jobs/${jobId}/${action}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || `Failed to ${action} job`)
      await loadJobs() // immediate refresh; interval keeps polling
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action} job.`)
    } finally {
      setIsActionLoading(null)
    }
  }
```

- [ ] **Step 6: Point the logs panel at real runs**

Replace `const jobLogs = selectedJob ? mockLogs.filter(...) : mockLogs.slice(0, 10)` with:

```tsx
  const jobLogs: JobLog[] = (selectedJob ? runs.filter((r) => r.job === selectedJob) : runs)
    .slice(0, 20)
    .map((r) => ({
      id: r.id,
      jobId: r.job,
      jobName: registry.find((j) => j.id === r.job)?.label ?? r.job,
      status: r.status === 'success' ? 'success' : r.status === 'running' ? 'running' : 'error',
      startTime: r.started_at,
      endTime: r.finished_at,
      duration:
        r.finished_at
          ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)
          : null,
      output: '',
      errorMessage: r.status === 'failed' ? `exit ${r.exit_code}` : null,
      triggerType: 'manual',
    }))
```

In the logs table, replace the `mockJobs.find(...)` reference (panel subtitle) with `registry.find(j => j.id === selectedJob)?.label`.

- [ ] **Step 7: Fix the banned `toLocaleString`**

Replace `{job.totalRuns.toLocaleString()}` with `{fmtNumID(job.totalRuns)}` and add the import at the top: `import { fmtNumID } from '@/lib/calculations/formatters'`. Grep the file for any remaining `toLocaleString` and replace likewise.

- [ ] **Step 8: Show the load error (optional but cheap)**

Right after `<div className="space-y-6">` in the `return`, add:

```tsx
      {loadError && (
        <div className="bg-[var(--color-negative-bg)] text-[var(--color-negative-text)] text-sm rounded-lg px-4 py-2">
          {loadError}
        </div>
      )}
```

- [ ] **Step 9: Verify in the browser**

Run: `cd web && npm run build` → Expected: compiles with no type errors in `CronJobManager.tsx`.
Then with `npm run dev`: log in at `/admin`, open **DATA PIPELINE**, click **Run Now** on "Enrich Ratios". Expected: the job row flips to running, a new execution-log row appears, and within seconds (after the Python process exits) it shows success/error — all from real data. Refresh the page; history persists (it's in Supabase).

- [ ] **Step 10: Commit**

```bash
git add web/src/app/admin/components/CronJobManager.tsx
git commit -m "feat(admin): wire CronJobManager to real job registry, runs, and triggers"
```

---

## Task 9: Real health check

**Files:**
- Modify: `web/src/app/api/admin/health/route.ts`

**Interfaces:**
- Consumes: `createAdminSupabase()`.
- Produces: `GET /api/admin/health` → `{ status:'healthy'|'degraded'|'error', checks:{ database, env } }` with a real DB round-trip.

- [ ] **Step 1: Replace the stubbed checks**

Overwrite `web/src/app/api/admin/health/route.ts` with:

```ts
import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/admin/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {}

  // env presence
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
    (k) => !process.env[k]
  )
  checks.env = missing.length
    ? { status: 'unhealthy', detail: `missing: ${missing.join(', ')}` }
    : { status: 'healthy' }

  // real DB round-trip
  try {
    const supabase = createAdminSupabase()
    const started = Date.now()
    const { error } = await supabase.from('stocks').select('ticker', { count: 'estimated', head: true })
    checks.database = error
      ? { status: 'unhealthy', detail: error.message }
      : { status: 'healthy', detail: `${Date.now() - started}ms` }
  } catch (e) {
    checks.database = { status: 'unhealthy', detail: e instanceof Error ? e.message : 'error' }
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy')
  return NextResponse.json(
    { status: allHealthy ? 'healthy' : 'degraded', timestamp: new Date().toISOString(), checks },
    { status: allHealthy ? 200 : 503 }
  )
}
```

- [ ] **Step 2: Verify**

`curl -s http://localhost:3000/api/admin/health | python3 -m json.tool`
Expected: `database.status:"healthy"` with a real latency string when Supabase env is set; flip a key to confirm it reports `degraded`/`unhealthy`. The sidebar badge in `page.tsx` now reflects reality (it already reads `data.status`).

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/admin/health/route.ts
git commit -m "feat(admin): real health check (DB round-trip + env presence)"
```

---

## Task 10: Real Overview freshness

**Files:**
- Create: `web/src/app/api/admin/overview/route.ts`
- Modify: `web/src/app/admin/components/AdminOverview.tsx`

**Interfaces:**
- Consumes: `assertAdmin`, `createAdminSupabase`, `listRecentRuns`.
- Produces: `GET /api/admin/overview` → `{ ok:true, freshness: { table:string; lastDate:string|null }[], runs: JobRun[] }`.

- [ ] **Step 1: Create the overview endpoint**

Create `web/src/app/api/admin/overview/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { createAdminSupabase } from '@/lib/admin/supabase'
import { listRecentRuns } from '@/lib/admin/jobRuns'

export const runtime = 'nodejs'

// (table, dateColumn) pairs to report freshness for.
const FRESHNESS: Array<[string, string]> = [
  ['daily_prices', 'date'],
  ['ai_analysis', 'generated_at'],
]

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  try {
    const supabase = createAdminSupabase()
    const freshness = await Promise.all(
      FRESHNESS.map(async ([table, col]) => {
        const { data } = await supabase
          .from(table)
          .select(col)
          .order(col, { ascending: false })
          .limit(1)
          .maybeSingle()
        return { table, lastDate: (data as Record<string, string> | null)?.[col] ?? null }
      })
    )
    const runs = await listRecentRuns(10)
    return NextResponse.json({ ok: true, freshness, runs })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to load overview' },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: Replace the static jobs array in AdminOverview**

In `AdminOverview.tsx`, replace the hardcoded `const jobs: PipelineJob[] = useMemo(() => [ ... ], [])` with fetched freshness state. Add near the other hooks:

```tsx
  const [freshness, setFreshness] = useState<{ table: string; lastDate: string | null }[]>([])
  const [recentRuns, setRecentRuns] = useState<{ job: string; status: string; started_at: string }[]>([])

  useEffect(() => {
    let alive = true
    fetch('/api/admin/overview')
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.ok) return
        setFreshness(d.freshness)
        setRecentRuns(d.runs)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
```

Then render `freshness` and `recentRuns` where the static `jobs` list was previously mapped (reuse the existing `StatusPill`/row markup; map `lastDate` to LIVE/STALE by age: `<2 days` → live, else stale). Remove the now-unused `jobs` `useMemo` and the `PipelineJob` literal data. Keep `useMemo` import only if still used; otherwise drop it to avoid an unused-import lint error.

- [ ] **Step 3: Verify**

`npm run build` → no type errors. In the browser, open **OVERVIEW**: the freshness rows show real latest dates from Supabase and the recent-runs list reflects Task 6/8 runs.

- [ ] **Step 4: Commit**

```bash
git add web/src/app/api/admin/overview/route.ts web/src/app/admin/components/AdminOverview.tsx
git commit -m "feat(admin): overview shows real table freshness + recent runs"
```

---

## Self-Review

**Spec coverage:**
- "Run the job for real" → Tasks 3–8 (registry → spawn → record → UI). ✓
- "Manual trigger + freshness, no scheduler" → trigger route + Overview freshness; `schedule` shown as `—`. ✓
- Harden the open/unauthed cron route + hardcoded password (raised earlier + by security review) → Task 2. ✓
- Real health (was always-healthy stub) → Task 9. ✓
- Mock Overview → Task 10. ✓
- Already-real Completeness module → untouched by design. ✓
- AI Config / Feature Flags / mock logs route → explicitly deferred (out of scope), not silently dropped. ✓

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" — each step has concrete code or an exact command + expected output. Stop/restart are explicitly defined as best-effort, not hand-waved.

**Type consistency:** `JobRun` shape is defined once in `jobRuns.ts` (Task 5) and reused verbatim in routes (Tasks 6, 7, 10) and as `RunRow`/`RegistryJob` mirrors in the component (Task 8). `getJob`/`isJobId`/`JOBS` names match across Tasks 4, 6, 7. `createJobRun`/`finishJobRun`/`findRunningRun`/`listRecentRuns` signatures match their call sites. The trigger response uses `runId` consistently (route → component → log endpoint).

**Known caveats called out in-plan:** detached-process "stop" is best-effort; success-rate stat dropped until enough history exists; `--job-id 0` is passed so admin runs don't collide with UI single-ticker refresh-job tracking.
