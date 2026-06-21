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
  const { data, error } = await supabase
    .from('admin_job_runs')
    .update({
      status: result.status,
      exit_code: result.exitCode,
      finished_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
  if (error) throw new Error(`finishJobRun failed: ${error.message}`)
  if (!data || data.length === 0) throw new Error(`finishJobRun: no run found with id=${id}`)
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
