'use client'

import React, { useState } from 'react'
import {
  ToggleLeft,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Search,
  Filter,
  Tag,
  Calendar,
  User,
  GitBranch,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Rocket,
  Zap,
  Shield,
  Globe,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types for Feature Flag Management
interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string
  enabled: boolean
  environment: 'development' | 'staging' | 'production' | 'all'
  type: 'boolean' | 'percentage' | 'user_segment' | 'gradual_rollout'
  rolloutPercentage?: number
  targetUsers?: string[]
  targetSegments?: string[]
  metadata: {
    createdAt: string
    updatedAt: string
    createdBy: string
    updatedBy: string
    version: number
    tags: string[]
  }
  conditions?: {
    startDate?: string
    endDate?: string
    timeWindow?: {
      start: string
      end: string
    }
  }
  dependencies?: string[]
  linkedFlags?: string[]
}

interface FlagHistory {
  id: string
  flagId: string
  action: 'created' | 'updated' | 'enabled' | 'disabled' | 'deleted' | 'rolled_out'
  performedBy: string
  performedAt: string
  changes: {
    field: string
    oldValue: unknown
    newValue: unknown
  }[]
  notes?: string
}

// Mock data
const mockFlags: FeatureFlag[] = [
  {
    id: 'flag-001',
    key: 'new_stock_detail_page',
    name: 'New Stock Detail Page',
    description: 'Redesigned stock detail page with better charting and analysis tools',
    enabled: true,
    environment: 'production',
    type: 'gradual_rollout',
    rolloutPercentage: 75,
    metadata: {
      createdAt: '2026-05-15T10:00:00Z',
      updatedAt: '2026-06-18T14:30:00Z',
      createdBy: 'admin@example.com',
      updatedBy: 'admin@example.com',
      version: 5,
      tags: ['ui', 'stock-page', 'redesign']
    },
    conditions: {
      startDate: '2026-06-01T00:00:00Z'
    }
  },
  {
    id: 'flag-002',
    key: 'ai_analyst_v2',
    name: 'AI Analyst V2',
    description: 'Enhanced AI analyst with better context understanding and reasoning',
    enabled: true,
    environment: 'production',
    type: 'user_segment',
    targetSegments: ['premium_users', 'beta_testers'],
    metadata: {
      createdAt: '2026-04-20T08:00:00Z',
      updatedAt: '2026-06-19T16:45:00Z',
      createdBy: 'admin@example.com',
      updatedBy: 'admin@example.com',
      version: 8,
      tags: ['ai', 'analyst', 'premium']
    },
    dependencies: ['flag-003']
  },
  {
    id: 'flag-003',
    key: 'new_scoring_engine',
    name: 'New Scoring Engine',
    description: 'Improved fundamental scoring with sector-relative metrics',
    enabled: true,
    environment: 'production',
    type: 'boolean',
    metadata: {
      createdAt: '2026-03-10T12:00:00Z',
      updatedAt: '2026-05-25T09:15:00Z',
      createdBy: 'admin@example.com',
      updatedBy: 'admin@example.com',
      version: 3,
      tags: ['scoring', 'fundamentals']
    }
  },
  {
    id: 'flag-004',
    key: 'realtime_data_stream',
    name: 'Real-time Data Stream',
    description: 'Live price updates via WebSocket connection',
    enabled: false,
    environment: 'staging',
    type: 'percentage',
    rolloutPercentage: 10,
    metadata: {
      createdAt: '2026-06-01T10:00:00Z',
      updatedAt: '2026-06-15T14:30:00Z',
      createdBy: 'admin@example.com',
      updatedBy: 'admin@example.com',
      version: 2,
      tags: ['realtime', 'websocket', 'experimental']
    }
  },
  {
    id: 'flag-005',
    key: 'advanced_charting',
    name: 'Advanced Charting Tools',
    description: 'Professional-grade charts with indicators and drawing tools',
    enabled: false,
    environment: 'development',
    type: 'user_segment',
    targetSegments: ['beta_testers'],
    metadata: {
      createdAt: '2026-05-20T09:00:00Z',
      updatedAt: '2026-06-10T11:45:00Z',
      createdBy: 'admin@example.com',
      updatedBy: 'admin@example.com',
      version: 4,
      tags: ['charts', 'technical-analysis', 'beta']
    }
  }
]

const mockHistory: FlagHistory[] = [
  {
    id: 'hist-001',
    flagId: 'flag-001',
    action: 'rolled_out',
    performedBy: 'admin@example.com',
    performedAt: '2026-06-18T14:30:00Z',
    changes: [{ field: 'rolloutPercentage', oldValue: 50, newValue: 75 }],
    notes: 'Increased rollout to 75% after successful monitoring'
  },
  {
    id: 'hist-002',
    flagId: 'flag-002',
    action: 'enabled',
    performedBy: 'admin@example.com',
    performedAt: '2026-06-19T16:45:00Z',
    changes: [{ field: 'enabled', oldValue: false, newValue: true }]
  },
  {
    id: 'hist-003',
    flagId: 'flag-004',
    action: 'created',
    performedBy: 'admin@example.com',
    performedAt: '2026-06-01T10:00:00Z',
    changes: []
  }
]

// Helper functions
function getEnvironmentColor(env: string): string {
  switch (env) {
    case 'production': return 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]'
    case 'staging': return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
    case 'development': return 'bg-[var(--color-cat-blue-bg)] text-[var(--color-cat-blue)]'
    default: return 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)]'
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'boolean': return <ToggleLeft className="w-4 h-4" />
    case 'percentage': return <RefreshCw className="w-4 h-4" />
    case 'user_segment': return <User className="w-4 h-4" />
    case 'gradual_rollout': return <Rocket className="w-4 h-4" />
    default: return <Zap className="w-4 h-4" />
  }
}

// Export component
export default function FeatureFlagManager() {
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'flags' | 'history' | 'settings'>('flags')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterEnv, setFilterEnv] = useState<string>('all')
  const [isCreating, setIsCreating] = useState(false)

  const flag = mockFlags.find(f => f.id === selectedFlag)

  // Filter flags
  const filteredFlags = mockFlags.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         f.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         f.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesEnv = filterEnv === 'all' || f.environment === filterEnv
    return matchesSearch && matchesEnv
  })

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-1">
        <div className="flex items-center gap-1">
          {(['flags', 'history', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-inset)]'
              )}
            >
              {tab === 'flags' && <ToggleLeft className="w-4 h-4" />}
              {tab === 'history' && <Clock className="w-4 h-4" />}
              {tab === 'settings' && <Settings className="w-4 h-4" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'flags' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Flags List */}
          <div className="lg:col-span-1 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="p-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-dim)]" />
                  <input
                    type="text"
                    placeholder="Search flags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  />
                </div>
                <button
                  onClick={() => setIsCreating(true)}
                  className="p-2 bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-text)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <select
                value={filterEnv}
                onChange={(e) => setFilterEnv(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none"
              >
                <option value="all">All Environments</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>
            </div>
            
            <div className="divide-y divide-[var(--color-border)] max-h-[500px] overflow-y-auto">
              {filteredFlags.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFlag(selectedFlag === f.id ? null : f.id)}
                  className={cn(
                    'w-full text-left p-4 transition-colors',
                    selectedFlag === f.id
                      ? 'bg-[var(--color-brand-bg)]/30'
                      : 'hover:bg-[var(--color-bg-inset)]'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {f.enabled ? (
                        <div className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-[var(--color-text-dim)]" />
                      )}
                      <span className="font-medium text-[var(--color-text-primary)] text-sm">{f.name}</span>
                    </div>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', getEnvironmentColor(f.environment))}>
                      {f.environment}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] truncate mb-2">{f.key}</p>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-dim)]">
                    <span className="flex items-center gap-1">
                      {getTypeIcon(f.type)}
                      {f.type.replace('_', ' ')}
                    </span>
                    {f.rolloutPercentage !== undefined && (
                      <span>{f.rolloutPercentage}% rollout</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Flag Details */}
          <div className="lg:col-span-2">
            {flag ? (
              <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      flag.enabled ? 'bg-[var(--color-brand-bg)]' : 'bg-[var(--color-neutral-bg)]'
                    )}>
                      <ToggleLeft className={cn('w-5 h-5', flag.enabled ? 'text-[var(--color-brand)]' : 'text-[var(--color-neutral-text)]')} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{flag.name}</h3>
                      <p className="text-sm text-[var(--color-text-muted)]">{flag.key}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {}}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-inset)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] text-sm font-medium rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {}}
                      className="p-2 bg-[var(--color-negative-bg)] hover:bg-[var(--color-negative-bg)]/80 text-[var(--color-negative)] rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* Status & Environment */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                      <p className="text-xs text-[var(--color-text-dim)] mb-1">Status</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {}}
                          className={cn(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2',
                            flag.enabled ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-neutral-bg)]'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                              flag.enabled ? 'translate-x-6' : 'translate-x-1'
                            )}
                          />
                        </button>
                        <span className={cn('font-medium', flag.enabled ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-muted)]')}>
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                      <p className="text-xs text-[var(--color-text-dim)] mb-1">Environment</p>
                      <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', getEnvironmentColor(flag.environment))}>
                        <Globe className="w-3 h-3" />
                        {flag.environment.charAt(0).toUpperCase() + flag.environment.slice(1)}
                      </span>
                    </div>

                    <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                      <p className="text-xs text-[var(--color-text-dim)] mb-1">Type</p>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-primary)]">
                        {getTypeIcon(flag.type)}
                        {flag.type.replace('_', ' ').charAt(0).toUpperCase() + flag.type.replace('_', ' ').slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Description</h4>
                    <p className="text-sm text-[var(--color-text-muted)]">{flag.description}</p>
                  </div>

                  {/* Rollout Configuration */}
                  {(flag.type === 'percentage' || flag.type === 'gradual_rollout') && (
                    <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                      <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Rollout Configuration</h4>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-[var(--color-text-muted)]">Rollout Percentage</span>
                            <span className="text-lg font-bold text-[var(--color-brand)]">{flag.rolloutPercentage}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={flag.rolloutPercentage}
                            onChange={() => {}}
                            className="w-full h-2 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-[var(--color-brand)]"
                          />
                          <div className="flex justify-between text-xs text-[var(--color-text-dim)] mt-1">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Targeting Rules */}
                  {flag.type === 'user_segment' && (
                    <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                      <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Target Segments</h4>
                      <div className="flex flex-wrap gap-2">
                        {flag.targetSegments?.map((segment) => (
                          <span
                            key={segment}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] text-sm rounded-full"
                          >
                            <User className="w-3.5 h-3.5" />
                            {segment.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Metadata</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-[var(--color-text-dim)] mb-1">Version</p>
                        <p className="font-medium text-[var(--color-text-primary)]">v{flag.metadata.version}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-dim)] mb-1">Created</p>
                        <p className="font-medium text-[var(--color-text-primary)]">{new Date(flag.metadata.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-dim)] mb-1">Updated</p>
                        <p className="font-medium text-[var(--color-text-primary)]">{new Date(flag.metadata.updatedAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-dim)] mb-1">Author</p>
                        <p className="font-medium text-[var(--color-text-primary)]">{flag.metadata.createdBy.split('@')[0]}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {flag.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] rounded-full"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                <ToggleLeft className="w-16 h-16 text-[var(--color-border)] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">Select a Feature Flag</h3>
                <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
                  Choose a feature flag from the list to view and configure its settings, rollout rules, and targeting.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <h3 className="font-semibold text-[var(--color-text-primary)]">Change History</h3>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-inset)] hover:bg-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-muted)] transition-colors">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-[var(--color-bg-inset)] sticky top-0">
                <tr>
                  <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-5 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-5 py-3">Flag</th>
                  <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-5 py-3">Changes</th>
                  <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-5 py-3">User</th>
                  <th className="text-left text-xs font-medium text-[var(--color-text-muted)] uppercase px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {mockHistory.map((entry) => {
                  const flag = mockFlags.find(f => f.id === entry.flagId)
                  return (
                    <tr key={entry.id} className="hover:bg-[var(--color-bg-inset)]/50">
                      <td className="px-5 py-3">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          entry.action === 'enabled' && 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]',
                          entry.action === 'disabled' && 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]',
                          entry.action === 'created' && 'bg-[var(--color-cat-blue-bg)] text-[var(--color-cat-blue)]',
                          entry.action === 'rolled_out' && 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
                        )}>
                          {entry.action === 'enabled' && <CheckCircle2 className="w-3 h-3" />}
                          {entry.action === 'disabled' && <XCircle className="w-3 h-3" />}
                          {entry.action === 'created' && <Plus className="w-3 h-3" />}
                          {entry.action === 'rolled_out' && <Rocket className="w-3 h-3" />}
                          {entry.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{flag?.name || 'Unknown'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-1">
                          {entry.changes.map((change, idx) => (
                            <div key={idx} className="text-xs">
                              <span className="text-[var(--color-text-dim)]">{change.field}:</span>{' '}
                              <span className="text-[var(--color-negative)]">{String(change.oldValue)}</span>{' '}
                              <span className="text-[var(--color-text-dim)]">→</span>{' '}
                              <span className="text-[var(--color-brand)]">{String(change.newValue)}</span>
                            </div>
                          ))}
                          {entry.changes.length === 0 && (
                            <span className="text-xs text-[var(--color-text-dim)]">No changes recorded</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--color-brand-bg)] flex items-center justify-center">
                            <span className="text-xs font-medium text-[var(--color-brand)]">
                              {entry.performedBy.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-[var(--color-text-muted)]">{entry.performedBy.split('@')[0]}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-[var(--color-text-muted)]">{formatTimeAgo(entry.performedAt)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-8">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Feature Flag Settings</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              Configure global settings for feature flag management, including audit logging, approval workflows, and default environments.
            </p>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[var(--color-bg-inset)] rounded-lg">
                <div>
                  <h4 className="font-medium text-[var(--color-text-primary)]">Audit Logging</h4>
                  <p className="text-sm text-[var(--color-text-muted)]">Log all feature flag changes for compliance</p>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-[var(--color-brand)] transition-colors">
                  <span className="inline-block h-4 w-4 transform translate-x-6 rounded-full bg-white transition-transform" />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[var(--color-bg-inset)] rounded-lg">
                <div>
                  <h4 className="font-medium text-[var(--color-text-primary)]">Require Approval</h4>
                  <p className="text-sm text-[var(--color-text-muted)]">Require approval for production changes</p>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-[var(--color-neutral-bg)] transition-colors">
                  <span className="inline-block h-4 w-4 transform translate-x-1 rounded-full bg-white transition-transform" />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-[var(--color-bg-inset)] rounded-lg">
                <div>
                  <h4 className="font-medium text-[var(--color-text-primary)]">Default Environment</h4>
                  <p className="text-sm text-[var(--color-text-muted)]">Default environment for new flags</p>
                </div>
                <select className="px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)]">
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper functions
function formatTimeAgo(dateString: string): string {
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
