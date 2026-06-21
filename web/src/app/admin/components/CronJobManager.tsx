'use client'

import React, { useState, useEffect } from 'react'
import {
  Play,
  Square,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Terminal,
  Calendar,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  MoreVertical,
  History,
  Zap,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtNumID } from '@/lib/calculations/formatters'

// Types for Cron Job Management
interface CronJob {
  id: string
  name: string
  schedule: string
  description: string
  status: 'running' | 'stopped' | 'error' | 'pending'
  lastRun: string | null
  nextRun: string | null
  lastDuration: number | null
  totalRuns: number
  successRate: number
  command: string
  logRetention: number // days
}

interface JobLog {
  id: string
  jobId: string
  jobName: string
  status: 'success' | 'error' | 'running' | 'timeout'
  startTime: string
  endTime: string | null
  duration: number | null
  output: string
  errorMessage: string | null
  triggerType: 'scheduled' | 'manual' | 'api'
}

interface JobStats {
  totalJobs: number
  runningJobs: number
  failedJobs: number
  successRate: number
  avgExecutionTime: number
  totalExecutions24h: number
}

// Helper functions
function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function parseCron(cronString: string): string {
  const parts = cronString.split(' ')
  if (parts.length !== 5) return cronString
  
  const [minute, hour, day, month, weekday] = parts
  
  // Common patterns
  if (minute === '0' && hour === '*') return 'Every hour'
  if (minute === '0' && hour === '0') return 'Daily at midnight'
  if (minute === '0' && hour === '6') return 'Daily at 6:00 AM'
  if (minute === '0' && hour === '8' && weekday === '1') return 'Weekly on Monday at 8:00 AM'
  if (minute.startsWith('*/')) {
    const interval = minute.replace('*/', '')
    return `Every ${interval} minutes`
  }
  
  return cronString
}

// Main component export
export default function CronJobManager() {
  // Step 2: real state + fetch
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
    const t = setInterval(loadJobs, 5000)
    return () => clearInterval(t)
  }, [loadJobs])

  const lastRunFor = (jobId: string) =>
    runs
      .filter((r) => r.job === jobId)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0] ?? null

  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)

  // Step 3: derive jobs from registry + runs
  const derivedJobs: CronJob[] = registry.map((j) => {
    const last = lastRunFor(j.id)
    return {
      id: j.id,
      name: j.label,
      schedule: '—',
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

  // Step 6: logs from real runs
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

  // Step 5: real action handler
  const handleJobAction = async (jobId: string, action: 'start' | 'stop' | 'trigger') => {
    setIsActionLoading(`${action}-${jobId}`)
    try {
      const response = await fetch(`/api/admin/cron-jobs/${jobId}/${action}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || `Failed to ${action} job`)
      await loadJobs()
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${action} job.`)
    } finally {
      setIsActionLoading(null)
    }
  }

  // Step 4: derived stats
  const stats = {
    totalJobs: registry.length,
    runningJobs: derivedJobs.filter((j) => j.status === 'running').length,
    failedJobs: derivedJobs.filter((j) => j.status === 'error').length,
    totalExecutions24h: runs.filter(
      (r) => Date.now() - new Date(r.started_at).getTime() < 86400000
    ).length,
  }

  return (
    <div className="space-y-6">
      {/* Step 8: load-error banner */}
      {loadError && (
        <div className="bg-[var(--color-negative-bg)] text-[var(--color-negative-text)] text-sm rounded-lg px-4 py-2">
          {loadError}
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Total Jobs</span>
            <Activity className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.totalJobs}</div>
        </div>

        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Running</span>
            <Zap className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.runningJobs}</div>
        </div>

        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Failed</span>
            <AlertCircle className="w-4 h-4 text-[var(--color-negative)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.failedJobs}</div>
        </div>

        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">24h Executions</span>
            <History className="w-4 h-4 text-[var(--color-cat-blue)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.totalExecutions24h}</div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[var(--color-text-dim)]" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none"
          />
        </div>
        
        <div className="h-6 w-px bg-[var(--color-border)]" />
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="error">Error</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="h-6 w-px bg-[var(--color-border)]" />

        <button
          onClick={() => setShowLogs(!showLogs)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            showLogs
              ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
              : 'bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
          )}
        >
          <Terminal className="w-4 h-4" />
          {showLogs ? 'Hide Logs' : 'View Logs'}
        </button>
      </div>

      {/* Jobs Grid */}
      <div className={cn('grid gap-4', showLogs ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1')}>  
        {/* Jobs List */}
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
              className={cn(
                'bg-[var(--color-bg-card)] rounded-xl border transition-all cursor-pointer',
                selectedJob === job.id
                  ? 'border-[var(--color-brand)] ring-1 ring-[var(--color-brand)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-border-subtle)]'
              )}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      job.status === 'running' && 'bg-[var(--color-brand-bg)]',
                      job.status === 'stopped' && 'bg-[var(--color-neutral-bg)]',
                      job.status === 'error' && 'bg-[var(--color-negative-bg)]',
                      job.status === 'pending' && 'bg-[var(--color-warning-bg)]'
                    )}>
                      {job.status === 'running' && <RotateCw className="w-5 h-5 text-[var(--color-brand)] animate-spin" />}
                      {job.status === 'stopped' && <Square className="w-5 h-5 text-[var(--color-neutral-text)]" />}
                      {job.status === 'error' && <XCircle className="w-5 h-5 text-[var(--color-negative)]" />}
                      {job.status === 'pending' && <Clock className="w-5 h-5 text-[var(--color-warning)]" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{job.name}</h3>
                      <p className="text-sm text-[var(--color-text-muted)]">{job.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                      job.status === 'running' && 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]',
                      job.status === 'stopped' && 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]',
                      job.status === 'error' && 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]',
                      job.status === 'pending' && 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
                    )}>
                      {job.status}
                    </span>
                  </div>
                </div>

                {/* Job Metrics */}
                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div>
                    <p className="text-xs text-[var(--color-text-dim)] mb-1">Schedule</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {parseCron(job.schedule)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-dim)] mb-1">Last Run</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {formatTimeAgo(job.lastRun)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-dim)] mb-1">Success Rate</p>
                    <p className={cn(
                      'text-sm font-medium',
                      job.successRate >= 95 ? 'text-[var(--color-brand)]' :
                      job.successRate >= 80 ? 'text-[var(--color-warning)]' :
                      'text-[var(--color-negative)]'
                    )}>
                      {job.successRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-dim)] mb-1">Total Runs</p>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {fmtNumID(job.totalRuns)}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedJob === job.id && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Command</h4>
                        <code className="block text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-card)] p-3 rounded border border-[var(--color-border)]">
                          {job.command}
                        </code>
                      </div>
                      <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Configuration</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Cron Expression</span>
                            <code className="font-mono text-[var(--color-text-primary)]">{job.schedule}</code>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Log Retention</span>
                            <span className="text-[var(--color-text-primary)]">{job.logRetention} days</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Next Run</span>
                            <span className="text-[var(--color-text-primary)]">{formatTimeAgo(job.nextRun)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() => handleJobAction(job.id, 'trigger')}
                        disabled={isActionLoading === `trigger-${job.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-text)] text-[var(--color-text-on-accent)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isActionLoading === `trigger-${job.id}` ? (
                          <RotateCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Run Now
                      </button>
                      
                      {job.status === 'running' ? (
                        <button
                          onClick={() => handleJobAction(job.id, 'stop')}
                          disabled={isActionLoading === `stop-${job.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-negative-bg)] hover:bg-[var(--color-negative-bg)]/80 text-[var(--color-negative-text)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isActionLoading === `stop-${job.id}` ? (
                            <RotateCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJobAction(job.id, 'start')}
                          disabled={isActionLoading === `start-${job.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-bg)] hover:bg-[var(--color-brand-bg)]/80 text-[var(--color-brand-text)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isActionLoading === `start-${job.id}` ? (
                            <RotateCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Start
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Logs Panel (shown when toggled) */}
        {showLogs && (
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-semibold text-[var(--color-text-primary)]">Execution Logs</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {selectedJob ? `Showing logs for ${registry.find(j => j.id === selectedJob)?.label}` : 'Recent job executions'}
                </p>
              </div>
              <button
                onClick={() => { setSelectedJob(null); setShowLogs(false) }}
                className="p-2 rounded-lg hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-bg-inset)] sticky top-0">
                  <tr>
                    <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3">Time</th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3">Job</th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3">Duration</th>
                    <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3">Trigger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {jobLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--color-bg-inset)]/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                        {formatTimeAgo(log.startTime)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{log.jobName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          log.status === 'success' && 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]',
                          log.status === 'error' && 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]',
                          log.status === 'running' && 'bg-[var(--color-cat-blue-bg)] text-[var(--color-cat-blue)]',
                          log.status === 'timeout' && 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
                        )}>
                          {log.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                          {log.status === 'error' && <XCircle className="w-3 h-3" />}
                          {log.status === 'running' && <RotateCw className="w-3 h-3 animate-spin" />}
                          {log.status === 'timeout' && <Clock className="w-3 h-3" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                        {formatDuration(log.duration)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded-full',
                          log.triggerType === 'scheduled' && 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]',
                          log.triggerType === 'manual' && 'bg-[var(--color-cat-purple-bg)] text-[var(--color-cat-purple)]',
                          log.triggerType === 'api' && 'bg-[var(--color-cat-teal-bg)] text-[var(--color-cat-teal)]'
                        )}>
                          {log.triggerType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
