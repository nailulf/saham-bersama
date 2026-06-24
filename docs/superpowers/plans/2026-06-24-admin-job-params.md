# Parameterized Admin Job Triggers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin "Run Now" collect per-job runtime parameters — a Stockbit bearer token (required for Stockbit jobs) and a date-range/days value — and stream the run's live log, so `daily_light` and the new `broker_backfill` job can run correctly from the UI.

**Architecture:** Each job declares a typed `params` schema in the registry. A pure `buildJobInvocation(job, params)` mapper turns supplied values into `{ args, env }` (the security boundary — only declared params reach `spawn`; the token only ever goes to `env`). The trigger route calls the mapper and spawns as today. The UI renders a Run form from the schema and polls the existing log-tail endpoint for live output.

**Tech Stack:** Next.js 16 (Route Handlers, `runtime='nodejs'`), React 19 client components, Node `child_process`, Vitest (pure-logic tests). Python `run_all.py` is unchanged.

**Spec:** `docs/superpowers/specs/2026-06-22-admin-job-params-design.md`

## Global Constraints

- The Stockbit token is **per-trigger**: it travels in the POST body, into that spawn's `env` only. It is **never** persisted (no DB column, no file, no `localStorage`/`sessionStorage`) and **never** logged (redacted from the audit log; absent from `admin_job_runs` and the run log file).
- **Only declared params** map to args/env — the client cannot inject flags. Undeclared body fields are ignored.
- Token is **required** for the Stockbit jobs (`daily_light`, `broker_backfill`): the run is blocked (server 400 + client-disabled button) until provided.
- Defaults: `daily_light` `since` default `2d`; `broker_backfill` `days` default `30` (range 1–365).
- SSR/format: no `toLocaleString`/`Intl` in render; numbers via `fmtNumID` from `@/lib/calculations/formatters`. Use `var(--color-*)` design tokens; no raw hex.
- Admin routes keep `export const runtime = 'nodejs'` and the `assertAdmin` guard as the first statement.
- No schema migration, no data-dictionary change.

---

## File Structure

| File | Responsibility | Task |
|------|----------------|------|
| `web/src/lib/admin/jobs.ts` (modify) | `ParamDef` type, `params` on `JobDef`, `daily_light.params`, new `broker_backfill` job | 1 |
| `web/src/lib/admin/jobs.test.ts` (modify) | allowed-flag set + param-flag validation + `broker_backfill` assertions | 1 |
| `web/src/lib/admin/jobInvocation.ts` (create) | `buildJobInvocation` pure mapper | 2 |
| `web/src/lib/admin/jobInvocation.test.ts` (create) | mapper unit tests | 2 |
| `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts` (modify) | accept `params`, call mapper, spawn with `args`+`env`, redacted audit | 3 |
| `web/src/app/admin/components/CronJobManager.tsx` (modify) | Run form (param fields, gated Run, POST params) + success-rate fix | 4 |
| `web/src/app/admin/components/CronJobManager.tsx` (modify) | live-log panel (fetch + poll while running) | 5 |

---

## Task 1: Registry param schema + `broker_backfill` job

**Files:**
- Modify: `web/src/lib/admin/jobs.ts`
- Test: `web/src/lib/admin/jobs.test.ts`

**Interfaces:**
- Produces: `ParamDef` (exported union), `JobDef.params?: ParamDef[]`, `JOBS.daily_light.params`, `JOBS.broker_backfill`. Consumed by Tasks 2 (mapper), 3 (route), 4 (UI).

- [ ] **Step 1: Extend the test (TDD)**

In `web/src/lib/admin/jobs.test.ts`, add `--since` and `--backfill-days` to the existing `allowed` set used by the "every flag is a run_all flag" test, then append these tests:

```ts
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
    expect((since as { options: string[] }).options).toEqual(['today', '2d', 'gap'])
  })

  it('broker_backfill requires a token and a days number', () => {
    const p = getJob('broker_backfill')!.params ?? []
    expect(p.find((x) => x.kind === 'secret')).toMatchObject({ required: true })
    expect(p.find((x) => x.kind === 'number')).toMatchObject({ flag: '--backfill-days', default: 30, min: 1, max: 365 })
  })

  it('every param select/number flag is a real run_all flag', () => {
    const allowed = new Set(['--since', '--backfill-days'])
    for (const job of Object.values(JOBS)) {
      for (const param of job.params ?? []) {
        if (param.kind === 'select' || param.kind === 'number') {
          expect(allowed.has(param.flag)).toBe(true)
        }
      }
    }
  })
})
```

- [ ] **Step 2: Run it to confirm failure**

Run (in `web/`): `npm run test -- src/lib/admin/jobs.test.ts`
Expected: FAIL — `getJob('broker_backfill')` is null and `params` is undefined.

- [ ] **Step 3: Add the type + params + job in `jobs.ts`**

Replace the `JobDef` interface block:

```ts
export interface JobDef {
  id: string
  label: string
  description: string
  flags: string[]
}
```

with:

```ts
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
```

In the `daily_light` entry, add a `params` field (after its `flags` line):

```ts
    flags: ['--daily-light'],
    params: [
      { name: 'token', label: 'Stockbit Bearer Token', kind: 'secret', env: 'STOCKBIT_BEARER_TOKEN', required: true },
      { name: 'since', label: 'Date range', kind: 'select', options: ['today', '2d', 'gap'], default: '2d', flag: '--since' },
    ],
```

Add a new `broker_backfill` entry immediately before the `full` entry:

```ts
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
```

- [ ] **Step 4: Run the tests to confirm pass**

Run (in `web/`): `npm run test -- src/lib/admin/jobs.test.ts`
Expected: all tests pass (the original 3 + the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/admin/jobs.ts web/src/lib/admin/jobs.test.ts
git commit -m "feat(admin): param schema on JobDef + broker_backfill job

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `buildJobInvocation` mapper

**Files:**
- Create: `web/src/lib/admin/jobInvocation.ts`
- Test: `web/src/lib/admin/jobInvocation.test.ts`

**Interfaces:**
- Consumes: `JobDef`, `ParamDef` from `./jobs` (Task 1).
- Produces: `buildJobInvocation(job: JobDef, params: Record<string, unknown>): { ok:true; args:string[]; env:Record<string,string>; provided:string[] } | { ok:false; error:string }`. Consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/admin/jobInvocation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm failure**

Run (in `web/`): `npm run test -- src/lib/admin/jobInvocation.test.ts`
Expected: FAIL — cannot resolve `./jobInvocation`.

- [ ] **Step 3: Implement the mapper**

Create `web/src/lib/admin/jobInvocation.ts`:

```ts
import type { JobDef } from './jobs'

export type Invocation =
  | { ok: true; args: string[]; env: Record<string, string>; provided: string[] }
  | { ok: false; error: string }

// Turn supplied param values into spawn args + env. This is the security
// boundary: only flags declared in the job's params reach the process, and
// secrets only ever go to env (never an argv element, never logged).
export function buildJobInvocation(job: JobDef, params: Record<string, unknown>): Invocation {
  const args = [...job.flags]
  const env: Record<string, string> = {}
  const provided: string[] = []

  for (const def of job.params ?? []) {
    const raw = params[def.name]

    if (def.kind === 'secret') {
      const v = raw == null ? '' : String(raw).trim()
      if (!v) {
        if (def.required) return { ok: false, error: `${def.label} is required` }
        continue
      }
      env[def.env] = v
      provided.push(def.name)
    } else if (def.kind === 'select') {
      const v = raw == null || raw === '' ? def.default : String(raw)
      if (!def.options.includes(v)) {
        return { ok: false, error: `Invalid ${def.label}: ${v}` }
      }
      args.push(def.flag, v)
    } else {
      let n = Math.round(Number(raw ?? def.default))
      if (!Number.isFinite(n)) n = def.default
      n = Math.min(def.max, Math.max(def.min, n))
      args.push(def.flag, String(n))
    }
  }

  return { ok: true, args, env, provided }
}
```

- [ ] **Step 4: Run the tests to confirm pass**

Run (in `web/`): `npm run test -- src/lib/admin/jobInvocation.test.ts`
Expected: 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/admin/jobInvocation.ts web/src/lib/admin/jobInvocation.test.ts
git commit -m "feat(admin): buildJobInvocation maps params to spawn args + env

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Trigger route accepts params

**Files:**
- Modify: `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts`

**Interfaces:**
- Consumes: `buildJobInvocation` (Task 2), existing `getJob`/`createJobRun`/`writeAuditLog`/spawn.
- Produces: `POST` accepts `{ params }` in the body; 400 on invalid/missing-required params.

- [ ] **Step 1: Add the import**

After the existing imports, add:

```ts
import { buildJobInvocation } from '@/lib/admin/jobInvocation'
```

- [ ] **Step 2: Parse the body and run the mapper before the duplicate-run check**

Replace this block (the duplicate-run guard):

```ts
  // One running process per job: reject a duplicate trigger so 'stop' stays
  // unambiguous and two runs never race the same tables.
  const existing = await findRunningRun(jobId)
  if (existing) {
    return NextResponse.json(
      { ok: false, error: `Job '${jobId}' is already running`, runId: existing.id },
      { status: 409 }
    )
  }
```

with:

```ts
  // Validate runtime params (token / since / days) before anything else.
  const body = (await request.json().catch(() => ({}))) as { params?: Record<string, unknown> }
  const inv = buildJobInvocation(job, body?.params ?? {})
  if (!inv.ok) {
    return NextResponse.json({ ok: false, error: inv.error }, { status: 400 })
  }

  // One running process per job: reject a duplicate trigger so 'stop' stays
  // unambiguous and two runs never race the same tables.
  const existing = await findRunningRun(jobId)
  if (existing) {
    return NextResponse.json(
      { ok: false, error: `Job '${jobId}' is already running`, runId: existing.id },
      { status: 409 }
    )
  }
```

- [ ] **Step 3: Use the mapper's args + env in the spawn**

Replace:

```ts
    // Only registry flags reach python — no client-supplied or sentinel flags.
    // (Deliberately no --job-id: run_all.py defaults job_id to None = no UI
    // refresh-job tracking. Passing --job-id 0 would fall through run_all's
    // `args.job_id or _detect_job(...)` to auto-detection — fragile.)
    const args = [RUN_ALL, ...job.flags]

    const proc = spawn(PYTHON_BIN, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      cwd: path.join(PROJECT_ROOT, 'python'),
    })
```

with:

```ts
    // Only registry flags + declared param values reach python (see
    // buildJobInvocation). Secrets (the bearer token) go to env, never argv.
    // (Deliberately no --job-id: run_all.py defaults job_id to None.)
    const args = [RUN_ALL, ...inv.args]

    const proc = spawn(PYTHON_BIN, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...inv.env },
      cwd: path.join(PROJECT_ROOT, 'python'),
    })
```

Also update the log-stream header line (it references `job.flags`):

```ts
    stream.write(`# job=${jobId} flags=${job.flags.join(' ')} started=${new Date().toISOString()}\n`)
```

→

```ts
    stream.write(`# job=${jobId} args=${inv.args.join(' ')} started=${new Date().toISOString()}\n`)
```

- [ ] **Step 4: Redact the audit log**

Replace the trigger `writeAuditLog` `query`:

```ts
      query: { jobId, flags: job.flags, runId, pid: proc.pid },
```

with (logs the resolved args — which never contain secrets — plus only the *names* of provided secrets):

```ts
      query: { jobId, args: inv.args, secretsProvided: inv.provided, runId, pid: proc.pid },
```

- [ ] **Step 5: Type-check**

Run (in `web/`): `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Manual smoke (deferred to live machine)**

With dev server + a real token, `POST /api/admin/cron-jobs/daily_light/trigger` with `{"params":{"token":"<real>","since":"today"}}` → run row appears, log header shows `args=--daily-light --since today`, and the token does NOT appear in the log file or `admin_audit_log.query`. POST with no token → `400 {ok:false,error:/required/}`. (Note in report that this step is environment-bound and not run by the implementer.)

- [ ] **Step 7: Commit**

```bash
git add "web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts"
git commit -m "feat(admin): trigger route accepts per-job params (token via env, redacted audit)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Run form + success-rate fix (`CronJobManager.tsx`)

**Files:**
- Modify: `web/src/app/admin/components/CronJobManager.tsx`

**Interfaces:**
- Consumes: `ParamDef` type from `@/lib/admin/jobs`; `GET /api/admin/cron-jobs` (returns jobs with `params`); `POST .../trigger` with `{ params }`.
- Produces: param Run form on parameterized jobs; real per-job success rate.

First read the current file in full. Apply these edits exactly.

- [ ] **Step 1: Import the ParamDef type and extend RegistryJob**

Add to the imports at the top:

```tsx
import type { ParamDef } from '@/lib/admin/jobs'
```

Find the local `RegistryJob` type (declared inside the component, currently `{ id: string; label: string; description: string; flags: string[] }`) and add `params`:

```tsx
  type RegistryJob = { id: string; label: string; description: string; flags: string[]; params?: ParamDef[] }
```

- [ ] **Step 2: Add the param-values state**

Immediately after the `const [loadError, setLoadError] = useState<string | null>(null)` line, add:

```tsx
  // Per-job param inputs (jobId → paramName → string). NEVER persisted — the
  // bearer token lives only here in memory and is cleared after a trigger.
  const [paramValues, setParamValues] = useState<Record<string, Record<string, string>>>({})

  const setParam = (jobId: string, name: string, value: string) =>
    setParamValues((prev) => ({ ...prev, [jobId]: { ...prev[jobId], [name]: value } }))

  const requiredMissing = (job?: RegistryJob) =>
    (job?.params ?? []).some(
      (p) => p.kind === 'secret' && p.required && !(paramValues[job!.id]?.[p.name]?.trim())
    )
```

- [ ] **Step 3: Add the `JobParamFields` presentational component**

Above `export default function CronJobManager()`, add:

```tsx
function JobParamFields({
  params,
  values,
  onChange,
}: {
  params: ParamDef[]
  values: Record<string, string>
  onChange: (name: string, value: string) => void
}) {
  return (
    <div className="space-y-3">
      {params.map((p) => {
        const v = values[p.name] ?? (p.kind === 'select' ? p.default : p.kind === 'number' ? String(p.default) : '')
        return (
          <div key={p.name} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">
              {p.label}
              {p.kind === 'secret' && p.required && <span className="text-[var(--color-negative)]"> *</span>}
            </label>
            {p.kind === 'select' && (
              <select
                value={v}
                onChange={(e) => onChange(p.name, e.target.value)}
                className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              >
                {p.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
            {p.kind === 'number' && (
              <input
                type="number"
                value={v}
                min={p.min}
                max={p.max}
                onChange={(e) => onChange(p.name, e.target.value)}
                className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              />
            )}
            {p.kind === 'secret' && (
              <input
                type="password"
                value={v}
                autoComplete="off"
                placeholder={p.label}
                onChange={(e) => onChange(p.name, e.target.value)}
                className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Render the form in the expanded card (before the Quick Actions buttons)**

In the `{selectedJob === job.id && ( ... )}` expanded block, immediately before the "Quick Actions" buttons row (the `<div className="flex items-center gap-3 mt-4">` that holds Run Now / Stop), insert:

```tsx
                    {(() => {
                      const reg = registry.find((j) => j.id === job.id)
                      return reg?.params?.length ? (
                        <div
                          className="mt-4 bg-[var(--color-bg-inset)] rounded-lg p-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Parameters</h4>
                          <JobParamFields
                            params={reg.params}
                            values={paramValues[job.id] ?? {}}
                            onChange={(name, value) => setParam(job.id, name, value)}
                          />
                        </div>
                      ) : null
                    })()}
```

(The `stopPropagation` keeps clicks/typing in the form from collapsing the card, whose outer `div` toggles selection on click.)

- [ ] **Step 5: Gate the Run Now button on required params**

In the same expanded block, find the Run Now `<button>` (the one calling `handleJobAction(job.id, 'trigger')`). Add a disabled guard for required-missing and stop click propagation. Change its opening so the `disabled` and `onClick` read:

```tsx
                      <button
                        onClick={(e) => { e.stopPropagation(); handleJobAction(job.id, 'trigger') }}
                        disabled={isActionLoading === `trigger-${job.id}` || requiredMissing(registry.find((j) => j.id === job.id))}
                        title={requiredMissing(registry.find((j) => j.id === job.id)) ? 'Enter required parameters first' : undefined}
```

Keep the rest of the button (its className with `disabled:opacity-50 disabled:cursor-not-allowed`, the spinner/Play icon, "Run Now" label) unchanged. Also add `e.stopPropagation()` to the Stop button's `onClick` the same way: `onClick={(e) => { e.stopPropagation(); handleJobAction(job.id, 'stop') }}`.

- [ ] **Step 6: Send params from `handleJobAction`, clear the token after**

Replace the whole `handleJobAction` function with:

```tsx
  const handleJobAction = async (jobId: string, action: 'start' | 'stop' | 'trigger') => {
    setIsActionLoading(`${action}-${jobId}`)
    try {
      const reg = registry.find((j) => j.id === jobId)
      const sendParams = action === 'trigger' && reg?.params?.length
      const response = await fetch(`/api/admin/cron-jobs/${jobId}/${action}`, {
        method: 'POST',
        ...(sendParams
          ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ params: paramValues[jobId] ?? {} }) }
          : {}),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || `Failed to ${action} job`)
      // Clear secret values after a successful trigger so the token never lingers.
      if (sendParams && reg?.params?.some((p) => p.kind === 'secret')) {
        setParamValues((prev) => {
          const next = { ...(prev[jobId] ?? {}) }
          for (const p of reg!.params!) if (p.kind === 'secret') delete next[p.name]
          return { ...prev, [jobId]: next }
        })
      }
      await loadJobs()
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action} job.`)
    } finally {
      setIsActionLoading(null)
    }
  }
```

- [ ] **Step 7: Compute a real success rate**

Find the `derivedJobs` mapping (`const derivedJobs: CronJob[] = registry.map((j) => { ... })`). It currently sets `successRate: 0`. Replace that single line with:

```tsx
      successRate: (() => {
        const finished = runs.filter((r) => r.job === j.id && (r.status === 'success' || r.status === 'failed'))
        return finished.length ? (finished.filter((r) => r.status === 'success').length / finished.length) * 100 : 0
      })(),
```

Then in the per-job card's Success Rate cell, find `{job.successRate.toFixed(1)}%` and replace it with a dash when nothing has finished:

```tsx
                      {(() => {
                        const finished = runs.filter((r) => r.job === job.id && (r.status === 'success' || r.status === 'failed')).length
                        return finished === 0 ? '—' : `${job.successRate.toFixed(1)}%`
                      })()}
```

- [ ] **Step 8: Verify**

Run (in `web/`): `npx tsc --noEmit` → exit 0; then `npm run build` → compiles. Grep the file: no `toLocaleString`, no raw hex introduced.

- [ ] **Step 9: Commit**

```bash
git add web/src/app/admin/components/CronJobManager.tsx
git commit -m "feat(admin): per-job param Run form + real success rate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Live-log panel (`CronJobManager.tsx`)

**Files:**
- Modify: `web/src/app/admin/components/CronJobManager.tsx`

**Interfaces:**
- Consumes: existing `GET /api/admin/cron-jobs/runs/[runId]/log` (returns `{ ok, runId, log }`); existing `runs`/`jobLogs` state.
- Produces: a log panel that streams a selected run's output, polling every 3s while it runs.

- [ ] **Step 1: Add the `RunLogPanel` component**

Above `export default function CronJobManager()`, add:

```tsx
function RunLogPanel({ runId, isRunning }: { runId: string; isRunning: boolean }) {
  const [log, setLog] = useState('Loading…')
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/cron-jobs/runs/${runId}/log`)
        const data = await res.json()
        if (alive && data.ok) setLog(data.log || '(empty)')
      } catch {
        /* keep previous content */
      }
    }
    load()
    const t = isRunning ? setInterval(load, 3000) : null
    return () => {
      alive = false
      if (t) clearInterval(t)
    }
  }, [runId, isRunning])

  return (
    <pre className="mt-3 max-h-[320px] overflow-auto bg-[var(--color-bg-inset)] rounded-lg p-3 text-[11px] leading-relaxed font-mono text-[var(--color-text-muted)] whitespace-pre-wrap">
      {log}
    </pre>
  )
}
```

(`useState`/`useEffect` are already imported at the top of the file.)

- [ ] **Step 2: Add selected-run state**

After the `paramValues` state added in Task 4, add:

```tsx
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
```

- [ ] **Step 3: Make run rows selectable and render the panel**

In the logs panel (`{showLogs && ( ... )}`), the execution-log `<tbody>` maps `jobLogs` to `<tr>` rows. Add an `onClick` + selected styling to each row's `<tr>`:

```tsx
                    <tr
                      key={log.id}
                      onClick={() => setSelectedRunId(selectedRunId === log.id ? null : log.id)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        selectedRunId === log.id ? 'bg-[var(--color-bg-inset)]' : 'hover:bg-[var(--color-bg-inset)]/50'
                      )}
                    >
```

Then, immediately after the `</table>` that closes the execution-log table (still inside the `showLogs` panel, in its scroll container), render the panel for the selected run:

```tsx
                  {selectedRunId && (
                    <div className="px-4 pb-4">
                      <RunLogPanel
                        runId={selectedRunId}
                        isRunning={runs.find((r) => r.id === selectedRunId)?.status === 'running'}
                      />
                    </div>
                  )}
```

- [ ] **Step 4: Verify**

Run (in `web/`): `npx tsc --noEmit` → exit 0; `npm run build` → compiles.

- [ ] **Step 5: Manual smoke (deferred to live machine)**

Trigger `daily_light` with a token, open View Logs, click the running row → log streams and updates every ~3s, showing the "DAILY-LIGHT — data freshness" / `[n/958]` lines; stops polling once the row finishes. (Environment-bound; note in report it wasn't run by the implementer.)

- [ ] **Step 6: Commit**

```bash
git add web/src/app/admin/components/CronJobManager.tsx
git commit -m "feat(admin): live run-log panel polled while a job runs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §1 registry param schema → Task 1. §2 mapper → Task 2. §3 trigger route → Task 3. §4 Run form → Task 4. §5 live-log → Task 5. §6 security (token env-only, redacted, never stored) → Tasks 2 (env-only), 3 (redacted audit), 4 (no persistence + cleared after trigger). §7 testing → Tasks 1, 2 (unit) + manual notes in 3, 5. Success-rate fix (user add-on) → Task 4. All covered.

**Placeholder scan:** No TBD/TODO. Every code step has complete code; the two manual smoke steps are explicitly env-bound and labelled, with exact requests + expected outputs.

**Type consistency:** `ParamDef` union defined in Task 1 is consumed verbatim by `buildJobInvocation` (Task 2), the route via the mapper (Task 3), and `JobParamFields`/`RegistryJob` (Task 4). `buildJobInvocation` return shape (`{ok,args,env,provided}` | `{ok:false,error}`) matches its use in Task 3 (`inv.args`, `inv.env`, `inv.provided`, `inv.error`). `paramValues`/`setParam`/`requiredMissing` defined in Task 4 are reused by Task 5's sibling edits. The log endpoint shape `{ok,log}` matches Task 5's `RunLogPanel`.

**Known scoped-out:** `daily`/`full` also call `money_flow` (need a token) but are not parameterized here (not requested); noted for a follow-up.
