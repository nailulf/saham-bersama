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
