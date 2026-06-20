'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { 
  Activity, 
  Database, 
  Brain, 
  ToggleLeft,
  Terminal,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Play,
  Square,
  LogOut,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/ui/theme-toggle'

// Import module components
import CronJobManager from './components/CronJobManager'
import DataQualityMonitor from './components/DataQualityMonitor'
import AIConfigManager from './components/AIConfigManager'
import SystemLogs from './components/SystemLogs'
import AdminOverview from './components/AdminOverview'

// Node IDs mapping for system integration
const NODE_IDS = {
  CRON_JOBS: 'OgbKz',
  DATA_QUALITY: 'RHXXg',
  AI_CONFIG: 'Aj1QS',
  OVERVIEW: 'rFaVg',
  SYSTEM_LOGS: 'hjYSG'
}

const navItems = [
  { 
    id: NODE_IDS.OVERVIEW,
    label: 'OVERVIEW', 
    icon: Activity, 
    description: 'OPERATIONS OVERVIEW',
    component: AdminOverview
  },
  { 
    id: NODE_IDS.CRON_JOBS,
    label: 'DATA PIPELINE', 
    icon: ToggleLeft, 
    description: 'CRON JOBS & MANUAL RUNS',
    component: CronJobManager
  },
  { 
    id: NODE_IDS.DATA_QUALITY,
    label: 'COMPLETENESS', 
    icon: Database, 
    description: 'MONITOR COMPLETENESS & ACCURACY',
    component: DataQualityMonitor
  },
  { 
    id: NODE_IDS.AI_CONFIG,
    label: 'AI CONFIG', 
    icon: Brain, 
    description: 'MODELS, PROMPTS, USE CASES',
    component: AIConfigManager
  },
  { 
    id: NODE_IDS.SYSTEM_LOGS,
    label: 'SYSTEM LOGS', 
    icon: Terminal, 
    description: 'RUNTIME + API LOG STREAM',
    component: SystemLogs
  },
]

const ADMIN_AUTH_KEY = 'sb-admin-auth-v1'

// System status indicator component
function SystemStatusBadge({ status }: { status: 'healthy' | 'warning' | 'error' | 'loading' }) {
  const styles = {
    healthy: 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
    error: 'bg-[var(--color-negative-bg)] text-[var(--color-negative-text)]',
    loading: 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)] animate-pulse'
  }
  
  const labels = {
    healthy: 'OPERATIONAL',
    warning: 'DEGRADED',
    error: 'CRITICAL',
    loading: 'CHECKING...'
  }
  
  return (
    <span className={cn('inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold tracking-[1px] uppercase', styles[status])}>
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'loading' && 'animate-pulse', status === 'healthy' && 'bg-current', status === 'warning' && 'bg-current', status === 'error' && 'bg-current')} />
      {labels[status]}
    </span>
  )
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(NODE_IDS.OVERVIEW)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'warning' | 'error' | 'loading'>('loading')
  const active = useMemo(() => navItems.find(item => item.id === activeTab) ?? navItems[0], [activeTab])

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/auth/me')
        if (res.ok) {
          setIsAuthenticated(true)
          return
        }
      } catch {
        // ignore
      }
      try {
        localStorage.removeItem(ADMIN_AUTH_KEY)
      } catch {
        // ignore
      }
      setIsAuthenticated(false)
    }
    checkSession()
  }, [])

  // Check system status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/admin/health')
        if (response.ok) {
          const data = await response.json()
          setSystemStatus(data.status || 'healthy')
        } else {
          setSystemStatus('error')
        }
      } catch {
        setSystemStatus('warning')
      }
    }
    
    checkStatus()
    const interval = setInterval(checkStatus, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Invalid password')
        return
      }
      try {
        localStorage.setItem(ADMIN_AUTH_KEY, '1')
      } catch {
        // ignore
      }
      setIsAuthenticated(true)
    } catch {
      alert('Login failed')
    }
  }

  const handleLogout = async () => {
    try {
      localStorage.removeItem(ADMIN_AUTH_KEY)
    } catch {
      // ignore
    }
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    setIsAuthenticated(false)
    setPassword('')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-page)] flex items-center justify-center p-6">
        <div className="w-full max-w-[420px] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md">
          <div className="px-6 py-5 border-b border-[var(--color-border)] flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 flex items-center justify-center bg-[var(--color-brand-bg)] border border-[var(--color-border)] rounded-md">
                <Settings className="w-4 h-4 text-[var(--color-brand-text)]" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-bold tracking-[1.2px] uppercase text-[var(--color-text-primary)]">
                  ADMIN ACCESS
                </div>
                <div className="font-mono text-[10px] tracking-[0.8px] uppercase text-[var(--color-text-muted)]">
                  LOCAL OPERATIONS CONSOLE
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <ThemeToggle />
            </div>
          </div>

          <form onSubmit={handleLogin} className="px-6 py-6 space-y-4">
            <div className="space-y-2">
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                PASSWORD
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ENTER PASSWORD…"
                className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-md font-mono text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              />
            </div>

            <button
              type="submit"
              className="w-full px-3 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-text)] rounded-md font-mono text-[11px] font-bold tracking-[1.2px] uppercase text-[var(--color-text-on-accent)] transition-colors"
            >
              UNLOCK DASHBOARD
            </button>
          </form>
        </div>
      </div>
    )
  }

  const ActiveComponent = active.component

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] flex sm:w-screen sm:relative sm:left-1/2 sm:right-1/2 sm:-ml-[50vw] sm:-mr-[50vw]">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-[var(--color-bg-card)] border-r border-[var(--color-border)] transition-all duration-200 ease-out',
          sidebarOpen ? 'w-[280px]' : 'w-[76px]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-[var(--color-border)]">
          <div className={cn('flex items-center gap-3 min-w-0', !sidebarOpen && 'justify-center w-full')}>
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--color-brand-bg)] border border-[var(--color-border)] shrink-0">
              <Settings className="w-4 h-4 text-[var(--color-brand-text)]" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <div className="font-mono text-[10px] font-bold tracking-[1.2px] uppercase text-[var(--color-text-primary)] truncate">
                  ADMIN CONSOLE
                </div>
                <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)] truncate">
                  SAHAM BERSAMA
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-md hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] transition-colors"
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <span className="font-mono text-[10px] font-bold">←</span> : <span className="font-mono text-[10px] font-bold">→</span>}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors group',
                  isActive
                    ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
                    : 'hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]',
                  !sidebarOpen && 'justify-center'
                )}
                title={!sidebarOpen ? `${item.label} (${item.id})` : undefined}
              >
                <Icon className={cn('w-5 h-5 shrink-0', isActive && 'text-[var(--color-brand-text)]')} />
                {sidebarOpen && (
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase truncate">{item.label}</div>
                    <div className="font-mono text-[9px] tracking-[0.8px] uppercase opacity-80 truncate">{item.description}</div>
                  </div>
                )}
                {isActive && sidebarOpen && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-text)] shrink-0" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[var(--color-border)]">
          <div className={cn('flex items-center gap-3', !sidebarOpen && 'justify-center')}>
            <SystemStatusBadge status={systemStatus} />
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="ml-auto p-2 rounded-md hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 transition-all duration-200 min-h-screen min-w-0',
          sidebarOpen ? 'ml-[280px]' : 'ml-[76px]'
        )}
      >
        {/* Top Bar */}
        {activeTab !== NODE_IDS.OVERVIEW && (
          <header className="sticky top-0 z-30 bg-[var(--color-bg-card)] border-b border-[var(--color-border)]">
            <div className="h-12 px-6 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-bold tracking-[1.2px] uppercase text-[var(--color-text-primary)] truncate">
                  {active.label}
                </div>
                <div className="font-mono text-[9px] tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  NODE: <span className="text-[var(--color-brand-text)]">{activeTab}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-inset)] hover:bg-[var(--color-border)] rounded-md transition-colors"
                  title="Reload admin"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <span className="hidden sm:inline font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                    REFRESH
                  </span>
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Page Content */}
        <div className="p-6 min-w-0 max-w-full">
          <ActiveComponent nodeId={activeTab} />
        </div>
      </main>
    </div>
  )
}
