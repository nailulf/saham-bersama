'use client'

import React, { useState } from 'react'
import {
  Terminal,
  Search,
  Filter,
  Download,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Bug,
  Server,
  Database,
  Activity,
  MoreVertical,
  Copy,
  X,
  FileText,
  Calendar,
  Zap,
  Brain
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types for System Logs
interface LogEntry {
  id: string
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  source: string
  message: string
  details?: Record<string, unknown>
  stackTrace?: string
  requestId?: string
  userId?: string
  duration?: number
  metadata?: {
    method?: string
    path?: string
    statusCode?: number
    userAgent?: string
    ip?: string
  }
}

interface LogFilter {
  level?: string[]
  source?: string[]
  timeRange?: '1h' | '24h' | '7d' | '30d' | 'custom'
  searchQuery?: string
}

// Mock data
const mockLogs: LogEntry[] = [
  {
    id: 'log-001',
    timestamp: '2026-06-20T10:30:45.123Z',
    level: 'info',
    source: 'api',
    message: 'GET /api/stocks/BBRI request completed',
    requestId: 'req-123456',
    duration: 245,
    metadata: {
      method: 'GET',
      path: '/api/stocks/BBRI',
      statusCode: 200,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  },
  {
    id: 'log-002',
    timestamp: '2026-06-20T10:30:42.456Z',
    level: 'warn',
    source: 'database',
    message: 'Slow query detected on daily_prices table',
    details: {
      query: 'SELECT * FROM daily_prices WHERE ticker = $1 AND date >= $2',
      executionTime: 2300,
      rowCount: 1250
    },
    duration: 2300
  },
  {
    id: 'log-003',
    timestamp: '2026-06-20T10:30:38.789Z',
    level: 'error',
    source: 'scraper',
    message: 'Failed to fetch financial data for ticker BBRI',
    requestId: 'req-123455',
    stackTrace: `Error: Request failed with status 503
    at IDXClient.fetchFinancials (/app/scrapers/idx_client.js:145:11)
    at processTicksAndRejections (internal/process/task_queues.js:97:5)`,
    details: {
      ticker: 'BBRI',
      year: 2026,
      quarter: 1,
      retryCount: 3
    }
  },
  {
    id: 'log-004',
    timestamp: '2026-06-20T10:30:35.012Z',
    level: 'info',
    source: 'ai-analyst',
    message: 'AI analysis completed for ticker TLKM',
    duration: 12500,
    details: {
      ticker: 'TLKM',
      modelUsed: 'gpt-4-turbo',
      tokensUsed: 3450,
      score: 78
    }
  },
  {
    id: 'log-005',
    timestamp: '2026-06-20T10:30:30.345Z',
    level: 'debug',
    source: 'cache',
    message: 'Cache hit for key: stock_data:BBRI:daily',
    details: {
      cacheKey: 'stock_data:BBRI:daily',
      ttl: 300,
      size: 45230
    }
  },
  {
    id: 'log-006',
    timestamp: '2026-06-20T10:30:28.678Z',
    level: 'fatal',
    source: 'database',
    message: 'Database connection pool exhausted',
    stackTrace: `FatalError: Connection pool exhausted
    at Pool.acquire (/app/node_modules/pg-pool/index.js:154:13)
    at processTicksAndRejections (internal/process/task_queues.js:97:5)`,
    details: {
      poolSize: 20,
      activeConnections: 20,
      waitingClients: 15
    }
  }
]

// Helper functions
function getLevelColor(level: string): string {
  switch (level) {
    case 'debug': return 'bg-[var(--color-cat-blue-bg)] text-[var(--color-cat-blue)]'
    case 'info': return 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
    case 'warn': return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
    case 'error': return 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]'
    case 'fatal': return 'bg-[var(--color-negative)] text-[var(--color-text-on-accent)]'
    default: return 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]'
  }
}

function getLevelIcon(level: string) {
  switch (level) {
    case 'debug': return <Bug className="w-4 h-4" />
    case 'info': return <Info className="w-4 h-4" />
    case 'warn': return <AlertCircle className="w-4 h-4" />
    case 'error': return <XCircle className="w-4 h-4" />
    case 'fatal': return <XCircle className="w-4 h-4" />
    default: return <Info className="w-4 h-4" />
  }
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'api': return <Server className="w-4 h-4" />
    case 'database': return <Database className="w-4 h-4" />
    case 'scraper': return <Activity className="w-4 h-4" />
    case 'cache': return <Zap className="w-4 h-4" />
    case 'ai-analyst': return <Brain className="w-4 h-4" />
    default: return <Terminal className="w-4 h-4" />
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0')
}

// Export component
export default function SystemLogs() {
  const [selectedLog, setSelectedLog] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [isRealTime, setIsRealTime] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const log = mockLogs.find(l => l.id === selectedLog)

  // Filter logs
  const filteredLogs = mockLogs.filter(l => {
    const matchesSearch = l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         l.source.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLevel = filterLevel === 'all' || l.level === filterLevel
    return matchesSearch && matchesLevel
  })

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)]" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              showFilters
                ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
                : 'bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="fatal">Fatal</option>
          </select>

          <button
            onClick={() => setIsRealTime(!isRealTime)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isRealTime
                ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
                : 'bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)]'
            )}
          >
            <Activity className={cn('w-4 h-4', isRealTime && 'animate-pulse')} />
            {isRealTime ? 'Live' : 'Paused'}
          </button>

          <div className="h-6 w-px bg-[var(--color-border)]" />

          <button className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-inset)] hover:bg-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-muted)] transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>

          <button className="flex items-center gap-2 px-3 py-2 bg-[var(--color-negative-bg)] hover:bg-[var(--color-negative-bg)]/80 text-[var(--color-negative)] rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-dim)] mb-1">Time Range</label>
              <select className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)]">
                <option>Last 1 hour</option>
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Custom range</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-dim)] mb-1">Source</label>
              <select className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)]">
                <option value="">All Sources</option>
                <option value="api">API</option>
                <option value="database">Database</option>
                <option value="scraper">Scraper</option>
                <option value="cache">Cache</option>
                <option value="ai-analyst">AI Analyst</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-dim)] mb-1">Request ID</label>
              <input
                type="text"
                placeholder="Filter by request ID..."
                className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-dim)] mb-1">User ID</label>
              <input
                type="text"
                placeholder="Filter by user ID..."
                className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-bg-inset)] sticky top-0 z-10">
              <tr>
                <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3 w-24">Time</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3 w-24">Level</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3 w-28">Source</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3">Message</th>
                <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-4 py-3 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr 
                    className={cn(
                      'hover:bg-[var(--color-bg-inset)]/50 cursor-pointer transition-colors',
                      selectedLog === log.id && 'bg-[var(--color-brand-bg)]/20'
                    )}
                    onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-[var(--color-text-muted)]">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', getLevelColor(log.level))}>
                        {getLevelIcon(log.level)}
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        {getSourceIcon(log.source)}
                        {log.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[var(--color-text-primary)] truncate max-w-md">{log.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLog(selectedLog === log.id ? null : log.id)
                          }}
                          className="p-1.5 hover:bg-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
                        >
                          {selectedLog === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(JSON.stringify(log, null, 2))
                          }}
                          className="p-1.5 hover:bg-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] transition-colors"
                          title="Copy JSON"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded Details */}
                  {selectedLog === log.id && (
                    <tr className="bg-[var(--color-bg-inset)]">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="space-y-4">
                          {/* Request Details */}
                          {(log.requestId || log.userId || log.duration) && (
                            <div className="flex flex-wrap gap-4">
                              {log.requestId && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-[var(--color-text-dim)]">Request ID:</span>
                                  <code className="px-2 py-0.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded text-xs font-mono text-[var(--color-text-primary)]">
                                    {log.requestId}
                                  </code>
                                </div>
                              )}
                              {log.userId && (
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-[var(--color-text-dim)]">User ID:</span>
                                  <code className="px-2 py-0.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded text-xs font-mono text-[var(--color-text-primary)]">
                                    {log.userId}
                                  </code>
                                </div>
                              )}
                              {log.duration !== undefined && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="w-3.5 h-3.5 text-[var(--color-text-dim)]" />
                                  <span className="text-[var(--color-text-dim)]">Duration:</span>
                                  <span className="font-mono text-[var(--color-text-primary)]">
                                    {log.duration < 1000 ? `${log.duration}ms` : `${(log.duration / 1000).toFixed(2)}s`}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Metadata */}
                          {log.metadata && (
                            <div className="bg-[var(--color-bg-card)] rounded-lg p-3 border border-[var(--color-border)]">
                              <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Request Metadata</h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                {log.metadata.method && (
                                  <div>
                                    <span className="text-[var(--color-text-dim)]">Method:</span>{' '}
                                    <span className="font-mono text-[var(--color-brand)]">{log.metadata.method}</span>
                                  </div>
                                )}
                                {log.metadata.path && (
                                  <div>
                                    <span className="text-[var(--color-text-dim)]">Path:</span>{' '}
                                    <span className="font-mono text-[var(--color-text-primary)]">{log.metadata.path}</span>
                                  </div>
                                )}
                                {log.metadata.statusCode && (
                                  <div>
                                    <span className="text-[var(--color-text-dim)]">Status:</span>{' '}
                                    <span className={cn(
                                      'font-mono',
                                      log.metadata.statusCode < 400 ? 'text-[var(--color-brand)]' : 'text-[var(--color-negative)]'
                                    )}>
                                      {log.metadata.statusCode}
                                    </span>
                                  </div>
                                )}
                                {log.metadata.ip && (
                                  <div>
                                    <span className="text-[var(--color-text-dim)]">IP:</span>{' '}
                                    <span className="font-mono text-[var(--color-text-primary)]">{log.metadata.ip}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Details */}
                          {log.details && (
                            <div>
                              <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Details</h5>
                              <pre className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto">
                                <code className="text-xs font-mono text-[var(--color-text-primary)]">
                                  {JSON.stringify(log.details, null, 2)}
                                </code>
                              </pre>
                            </div>
                          )}

                          {/* Stack Trace */}
                          {log.stackTrace && (
                            <div>
                              <h5 className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Stack Trace</h5>
                              <pre className="bg-[var(--color-negative-bg)]/30 border border-[var(--color-negative)]/20 rounded-lg p-3 overflow-x-auto">
                                <code className="text-xs font-mono text-[var(--color-negative)]">
                                  {log.stackTrace}
                                </code>
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4">
        <div className="text-sm text-[var(--color-text-muted)]">
          Showing <span className="font-medium text-[var(--color-text-primary)]">1</span> to <span className="font-medium text-[var(--color-text-primary)]">{Math.min(50, filteredLogs.length)}</span> of <span className="font-medium text-[var(--color-text-primary)]">{filteredLogs.length}</span> logs
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-[var(--color-bg-inset)] hover:bg-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-muted)] transition-colors disabled:opacity-50" disabled>
            Previous
          </button>
          <button className="px-3 py-1.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-text)] text-[var(--color-text-on-accent)] rounded-lg text-sm font-medium transition-colors">
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
