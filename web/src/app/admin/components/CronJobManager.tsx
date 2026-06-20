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

// Mock data - replace with real API calls
const mockJobs: CronJob[] = [
  {
    id: 'job-001',
    name: 'Daily Price Update',
    schedule: '0 6 * * *',
    description: 'Fetches daily OHLCV data for all stocks from Yahoo Finance',
    status: 'running',
    lastRun: '2026-06-20T06:00:00Z',
    nextRun: '2026-06-21T06:00:00Z',
    lastDuration: 245,
    totalRuns: 156,
    successRate: 98.7,
    command: 'python scripts/daily_prices.py --all',
    logRetention: 30
  },
  {
    id: 'job-002',
    name: 'Financial Data Sync',
    schedule: '0 8 * * 1',
    description: 'Syncs quarterly financial reports from IDX and Stockbit',
    status: 'stopped',
    lastRun: '2026-06-16T08:00:00Z',
    nextRun: '2026-06-23T08:00:00Z',
    lastDuration: 1823,
    totalRuns: 24,
    successRate: 91.7,
    command: 'python scripts/financials.py --sync-all',
    logRetention: 90
  },
  {
    id: 'job-003',
    name: 'Wyckoff Analysis',
    schedule: '*/30 * * * *',
    description: 'Runs Wyckoff phase detection on price data',
    status: 'running',
    lastRun: '2026-06-20T10:30:00Z',
    nextRun: '2026-06-20T11:00:00Z',
    lastDuration: 45,
    totalRuns: 1248,
    successRate: 99.8,
    command: 'python scripts/analysis/wyckoff_detector_v2.py',
    logRetention: 14
  },
  {
    id: 'job-004',
    name: 'AI Analyst Pipeline',
    schedule: '0 */6 * * *',
    description: 'Runs AI analysis on stocks with significant signal changes',
    status: 'error',
    lastRun: '2026-06-20T06:00:00Z',
    nextRun: '2026-06-20T12:00:00Z',
    lastDuration: null,
    totalRuns: 89,
    successRate: 87.6,
    command: 'python scripts/scoring/ai_analyst.py --batch',
    logRetention: 30
  },
  {
    id: 'job-005',
    name: 'Money Flow Update',
    schedule: '0 17 * * 1-5',
    description: 'Updates foreign flow and broker summary data from IDX',
    status: 'running',
    lastRun: '2026-06-19T17:00:00Z',
    nextRun: '2026-06-20T17:00:00Z',
    lastDuration: 120,
    totalRuns: 112,
    successRate: 98.2,
    command: 'python scripts/money_flow.py --daily',
    logRetention: 60
  }
]

const mockLogs: JobLog[] = [
  {
    id: 'log-001',
    jobId: 'job-001',
    jobName: 'Daily Price Update',
    status: 'success',
    startTime: '2026-06-20T06:00:00Z',
    endTime: '2026-06-20T06:04:05Z',
    duration: 245,
    output: 'Fetched 890 stocks\nUpdated price data for 890 tickers\nSkipped 0 tickers\nCompleted successfully',
    errorMessage: null,
    triggerType: 'scheduled'
  },
  {
    id: 'log-002',
    jobId: 'job-003',
    jobName: 'Wyckoff Analysis',
    status: 'success',
    startTime: '2026-06-20T10:30:00Z',
    endTime: '2026-06-20T10:30:45Z',
    duration: 45,
    output: 'Analyzed 890 stocks\nDetected phase changes: 23\nAccumulation: 12\nMarkup: 8\nDistribution: 3\nMarkdown: 0',
    errorMessage: null,
    triggerType: 'scheduled'
  },
  {
    id: 'log-003',
    jobId: 'job-004',
    jobName: 'AI Analyst Pipeline',
    status: 'error',
    startTime: '2026-06-20T06:00:00Z',
    endTime: '2026-06-20T06:02:30Z',
    duration: 150,
    output: 'Starting AI analysis batch...\nProcessing 45 stocks with signal changes\nError at stock #23 (BBRI)',
    errorMessage: 'OpenAI API rate limit exceeded. Please retry after 60 seconds.',
    triggerType: 'scheduled'
  }
]

const mockStats: JobStats = {
  totalJobs: 5,
  runningJobs: 3,
  failedJobs: 1,
  successRate: 94.8,
  avgExecutionTime: 156,
  totalExecutions24h: 47
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
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)

  // Filter jobs
  const filteredJobs = mockJobs.filter(job => {
    const matchesStatus = filterStatus === 'all' || job.status === filterStatus
    const matchesSearch = job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Filter logs for selected job
  const jobLogs = selectedJob 
    ? mockLogs.filter(log => log.jobId === selectedJob)
    : mockLogs.slice(0, 10)

  // Handle job actions
  const handleJobAction = async (jobId: string, action: 'start' | 'stop' | 'trigger') => {
    setIsActionLoading(`${action}-${jobId}`)
    
    try {
      const response = await fetch(`/api/admin/cron-jobs/${jobId}/${action}`, {
        method: 'POST'
      })
      
      if (!response.ok) throw new Error(`Failed to ${action} job`)
      
      // Refresh job status (in real implementation)
      console.log(`${action} job ${jobId} successful`)
    } catch (error) {
      console.error(`Error ${action}ing job:`, error)
      alert(`Failed to ${action} job. Please try again.`)
    } finally {
      setIsActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Total Jobs</span>
            <Activity className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{mockStats.totalJobs}</div>
        </div>

        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Running</span>
            <Zap className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{mockStats.runningJobs}</div>
        </div>

        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Failed</span>
            <AlertCircle className="w-4 h-4 text-[var(--color-negative)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{mockStats.failedJobs}</div>
        </div>

        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--color-brand)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{mockStats.successRate}%</div>
        </div>

        <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-muted)]">24h Executions</span>
            <History className="w-4 h-4 text-[var(--color-cat-blue)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{mockStats.totalExecutions24h}</div>
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
                      {job.totalRuns.toLocaleString()}
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
                  {selectedJob ? `Showing logs for ${mockJobs.find(j => j.id === selectedJob)?.name}` : 'Recent job executions'}
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
