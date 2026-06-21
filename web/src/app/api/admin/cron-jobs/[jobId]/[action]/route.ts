import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { createWriteStream, mkdirSync, type WriteStream } from 'fs'
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
    let killed = true
    try {
      process.kill(-running.pid) // detached → kill the process group
    } catch {
      try {
        process.kill(running.pid)
      } catch {
        killed = false // already gone
        console.warn(`[cron-jobs] stop: process ${running.pid} for run ${running.id} was not reachable`)
      }
    }
    await finishJobRun(running.id, { status: 'stopped', exitCode: null })
    await writeAuditLog({
      actor: guard.subject,
      action: 'cron.stop',
      route: `/api/admin/cron-jobs/${jobId}/${action}`,
      query: { jobId, runId: running.id, pid: running.pid, killed },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => null)
    return NextResponse.json({ ok: true, stopped: true, runId: running.id, killed })
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

  // trigger / start / restart all mean "run it now"
  const runId = crypto.randomUUID()
  const logPath = path.join(LOG_DIR, `${runId}.log`)

  let logStream: WriteStream | null = null
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    logStream = createWriteStream(logPath, { flags: 'a' })
    const stream = logStream
    stream.write(`# job=${jobId} flags=${job.flags.join(' ')} started=${new Date().toISOString()}\n`)

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

    proc.stdout?.on('data', (c: Buffer) => stream.write(c))
    proc.stderr?.on('data', (c: Buffer) => stream.write(c))

    // Node may emit BOTH 'error' and 'exit' on a failed spawn — guard so the
    // run is finished (status written, stream closed) exactly once.
    let finished = false
    const finish = (status: 'success' | 'failed', exitCode: number | null, note: string) => {
      if (finished) return
      finished = true
      stream.write(`\n# ${note} finished=${new Date().toISOString()}\n`)
      stream.end()
      finishJobRun(runId, { status, exitCode }).catch((e) =>
        console.error('[cron-jobs] finishJobRun failed:', e)
      )
    }

    proc.on('error', (err) => finish('failed', null, `error=${err.message}`))
    proc.on('exit', (code) => finish(code === 0 ? 'success' : 'failed', code ?? null, `exit=${code}`))

    // Record the run. If the DB write fails, kill the process we just started
    // so we never leave an untracked orphan, then surface a 500 via catch.
    // (run_all jobs take seconds+ to exit, far longer than this insert, so the
    // exit handler never fires before the row exists in practice.)
    try {
      await createJobRun({ id: runId, job: jobId, pid: proc.pid ?? null, triggeredBy: guard.subject, logPath })
    } catch (e) {
      try {
        if (proc.pid) process.kill(-proc.pid)
      } catch {
        try {
          if (proc.pid) process.kill(proc.pid)
        } catch {
          /* already gone */
        }
      }
      throw e
    }

    proc.unref()

    await writeAuditLog({
      actor: guard.subject,
      action: 'cron.trigger',
      route: `/api/admin/cron-jobs/${jobId}/${action}`,
      query: { jobId, flags: job.flags, runId, pid: proc.pid },
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    }).catch(() => null)

    return NextResponse.json({ ok: true, runId, jobId, action, pid: proc.pid })
  } catch (e) {
    if (logStream && !logStream.closed) logStream.destroy()
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to spawn job' },
      { status: 500 }
    )
  }
}
