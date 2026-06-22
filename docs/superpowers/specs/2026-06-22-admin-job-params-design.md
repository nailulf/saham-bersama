# Parameterized Admin Job Triggers — Design

**Date:** 2026-06-22
**Status:** Approved (brainstorming) — ready for implementation plan
**Depends on:** the admin "Run Jobs" feature (`docs/superpowers/plans/2026-06-20-admin-run-jobs.md`), already merged.

## Problem

The admin `/admin` DATA PIPELINE module triggers `run_all.py` jobs with **fixed** flags only. Some jobs need runtime input that the UI cannot currently supply:

- **`daily_light`** shows an interactive `--since` menu ("Which dates to fetch? 1/2/3") when run by hand. When the admin route spawns it, stdin is `/dev/null`, so `_choose_daily_light_mode` (run_all.py) silently defaults to `2d` — the operator never gets to choose `today`/`gap`.
- **`daily_light`** and **`broker_backfill`** crawl Stockbit via `money_flow` ([money_flow.py:292](../../python/scrapers/money_flow.py)), which **requires a Stockbit bearer token** (`StockbitClient` → `token_manager` → `STOCKBIT_BEARER_TOKEN`). Without a fresh token, `broker_flow` silently goes stale (observed: `broker_flow` 1 day behind while public `daily_prices`/`idx_stock_summary` were current) — the run still reports success.
- After triggering, the operator gets **no live feedback** on what the job is doing.

## Goals

1. Let each job **declare the parameters it needs**; the Run UI renders the right fields and the trigger route validates + maps them to CLI flags / env.
2. Supply a **Stockbit bearer token per-trigger**, never stored, **required** for the Stockbit jobs so a tokenless half-stale run can't happen by accident.
3. Show the run's **live log** in the UI while it runs.

Non-goals: storing/caching tokens server-side; adding `fallback_financials`/`insider` jobs (not requested); in-app scheduling; any schema change (nothing new is persisted).

## Architecture overview

```
CronJobManager (Run form)
  └─ POST /api/admin/cron-jobs/[jobId]/trigger  { params: {token, since|days, ...} }
        └─ buildJobInvocation(job, params)  ── pure, unit-tested
              → { args: ['--daily-light','--since','today'], env: { STOCKBIT_BEARER_TOKEN } }  | { error }
        └─ spawn(python, [RUN_ALL, ...args], { env: {...process.env, ...env} })  (existing flow)
CronJobManager (Log panel)
  └─ GET /api/admin/cron-jobs/runs/[runId]/log  (existing Task-7 endpoint) — polled while running
```

No new endpoints. No new tables. One new pure module (`buildJobInvocation`), registry additions, route wiring, and UI.

## 1. Registry param schema (`web/src/lib/admin/jobs.ts`)

Add an optional `params` array to `JobDef`. A discriminated union of three kinds:

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

- `select` → appends `flag value` (value must be one of `options`).
- `number` → appends `flag <int>` (coerced + clamped to `[min,max]`).
- `secret` → sets `env[env] = value`; **never** an argv element. `required:true` blocks the run when absent.

### Job param mappings

**`daily_light`** (base flags `['--daily-light']`):
```ts
params: [
  { name: 'token', label: 'Stockbit Bearer Token', kind: 'secret', env: 'STOCKBIT_BEARER_TOKEN', required: true },
  { name: 'since', label: 'Date range', kind: 'select', options: ['today', '2d', 'gap'], default: '2d', flag: '--since' },
]
```

**`broker_backfill`** — NEW job (base flags `['--broker-backfill']`):
```ts
params: [
  { name: 'token', label: 'Stockbit Bearer Token', kind: 'secret', env: 'STOCKBIT_BEARER_TOKEN', required: true },
  { name: 'days', label: 'Backfill days', kind: 'number', default: 30, min: 1, max: 365, flag: '--backfill-days' },
]
```

(Note for later, out of scope now: `daily` and `full` also run `money_flow` and would benefit from the same token param.)

## 2. The mapper — `buildJobInvocation` (new pure function, `web/src/lib/admin/jobInvocation.ts`)

```ts
export function buildJobInvocation(
  job: JobDef,
  params: Record<string, unknown>
): { ok: true; args: string[]; env: Record<string, string>; provided: string[] }
 | { ok: false; error: string }
```

Algorithm:
1. `args = [...job.flags]`, `env = {}`, `provided = []`.
2. For each `def` in `job.params ?? []`:
   - **secret:** `v = params[def.name]`. If empty/missing → if `def.required` return `{ ok:false, error: \`${def.label} is required\` }`, else skip. If present → `env[def.env] = String(v)`, `provided.push(def.name)`.
   - **select:** `v = (params[def.name] as string) ?? def.default`. If `!def.options.includes(v)` → `{ ok:false, error: \`Invalid ${def.label}\` }`. Else `args.push(def.flag, v)`.
   - **number:** `n = Math.round(Number(params[def.name] ?? def.default))`; if `NaN` → `n = def.default`; clamp to `[min,max]`; `args.push(def.flag, String(n))`.
3. Params not matching any declared `def.name` are ignored.
4. Return `{ ok:true, args, env, provided }`.

This is the security boundary: only declared flags/values reach `spawn`; the token only ever goes to `env`.

## 3. Trigger route changes (`web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts`)

- Parse `params` from the POST body: `const body = await request.json().catch(() => ({})); const params = body?.params ?? {}`.
- After `getJob`, call `buildJobInvocation(job, params)`. On `{ ok:false }` → `return NextResponse.json({ ok:false, error }, { status:400 })`.
- Spawn args become `[RUN_ALL, ...result.args]` (replacing today's `[RUN_ALL, ...job.flags]`).
- Spawn env becomes `{ ...process.env, ...result.env }` (replacing today's `{ ...process.env }`).
- **Audit-log redaction:** log `query: { jobId, args: result.args, secretsProvided: result.provided }` — `args` already excludes secrets (they go to env), and we log only the *names* of provided secrets, never values. Never log `params` raw (it holds the token) or `env`.
- The existing duplicate-run 409, one-shot finish guard, log-stream handling, and `stop` path are unchanged.

## 4. UI — Run form (`web/src/app/admin/components/CronJobManager.tsx`)

- Job cards already expand. In the expanded body of a job **with `params`**, render a field per param:
  - `select` → `<select>` with `options`, `default` preselected.
  - `number` → `<input type="number">` with `min`/`max`/`defaultValue`.
  - `secret` → `<input type="password">`, placeholder `def.label`, autoComplete off.
- Param values live in local component state keyed by `jobId.paramName`. **Never** written to `localStorage`/`sessionStorage`; cleared after a successful trigger.
- The "Run Now" button for a parameterized job is **disabled** while any `required` secret is empty (client-side mirror of the server check).
- On click → `POST .../trigger` with `{ params: collected }`, then `loadJobs()` as today.
- Jobs **without** `params` keep the current one-click behavior unchanged.
- Tokens / fields use existing `var(--color-*)` tokens; reading copy ≥12px per the design system.

## 5. UI — Live log panel (`web/src/app/admin/components/CronJobManager.tsx`)

- Reuse the existing `GET /api/admin/cron-jobs/runs/[runId]/log` (Task 7; returns last 500 lines).
- When a run row is selected (or the job's latest run is `running`), show its log tail in a `<pre>` (mono, scrollable, `var(--color-bg-inset)`).
- Poll the log endpoint every **3s while** the selected run's status is `running`; stop when it finishes. Clean up the interval on unmount / deselect (no setState-after-unmount).
- This is additive to the existing run-rows table.

## 6. Security

- Token is **per-trigger**: travels in the POST body over localhost, into that spawn's `env` only.
- Token is **never** persisted (no DB column, no file, no browser storage) and **never** logged (redacted from audit log; absent from `admin_job_runs` and the run log file, which only captures `run_all.py` stdout/stderr — `run_all` reads the token from env, never echoes it).
- Server-side validation is authoritative; the client cannot inject flags (only declared params map to args).

## 7. Testing

- **Unit (`web/src/lib/admin/jobInvocation.test.ts`):** `buildJobInvocation`:
  - `daily_light` + `{token:'X', since:'today'}` → `args` ends `['--daily-light','--since','today']`, `env.STOCKBIT_BEARER_TOKEN==='X'`, `provided` includes `token`.
  - `daily_light` + `{since:'2d'}` (no token) → `{ ok:false, error:/required/ }`.
  - `daily_light` + `{token:'X'}` (no since) → `--since 2d` (default applied).
  - `broker_backfill` + `{token:'X', days:9999}` → `--backfill-days 365` (clamped); `days:0` → clamped to `1`.
  - `select` with an out-of-range value → `{ ok:false }`.
  - undeclared param (`{token:'X', evil:'--rm'}`) → ignored, not in `args`.
- **Unit (`web/src/lib/admin/jobs.test.ts`):** extend the allowed-flag set with `--since`, `--backfill-days`, `--broker-backfill`; assert `broker_backfill` exists and its base flag is allowed.
- **Manual:** spawn + UI form + live-log streaming (needs the live machine + a real token), per the existing manual-verification pattern.

## Files affected

| File | Change |
|------|--------|
| `web/src/lib/admin/jobs.ts` | `ParamDef` type, `params` on `JobDef`, `daily_light.params`, new `broker_backfill` job |
| `web/src/lib/admin/jobInvocation.ts` (new) | `buildJobInvocation` pure mapper |
| `web/src/lib/admin/jobInvocation.test.ts` (new) | mapper unit tests |
| `web/src/lib/admin/jobs.test.ts` | allowed-flag set + broker_backfill assertions |
| `web/src/app/api/admin/cron-jobs/[jobId]/[action]/route.ts` | accept `params`, use mapper, redacted audit log |
| `web/src/app/admin/components/CronJobManager.tsx` | param Run form + live-log panel |

No migration, no data-dictionary change.
