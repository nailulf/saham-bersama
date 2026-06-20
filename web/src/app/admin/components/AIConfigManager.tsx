'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Archive,
  Brain,
  CheckCircle2,
  ChevronRight,
  Copy,
  Database,
  GitBranch,
  PenSquare,
  Play,
  Plus,
  Save,
  Search,
  ServerCog,
  Sparkles,
  TriangleAlert,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type UseCaseTab = 'stock_thesis' | 'news_sentiment'

type ModelCard = {
  id: string
  name: string
  slug: string
  pitch: string
  tier: string
  price: string
  perf: string
  workflowFit: string
}

type PromptVersion = {
  id: string
  label: string
  date: string
  note: string
  status: 'active' | 'restore'
}

type PromptArchiveRow = {
  id: string
  name: string
  project: string
  created: string
  uses: string
  status: 'active' | 'archived'
}

type PipelineNode = {
  id: string
  label: string
  type: 'source' | 'transform' | 'context' | 'output'
  status: 'healthy' | 'warning'
}

const STOCK_THESIS_PROMPT = `You are Daisy, a buy-side equity analyst covering Indonesian (IDX) stocks. Given the structured context bundle - financials, ratios, peer percentiles, market phase, Wyckoff state, and macro regime - produce:

1. A concise investment thesis in Bahasa Indonesia.
2. Three bull drivers and three key risks.
3. Bull / base / bear scenarios with price implications.
4. A final BUY / HOLD / SELL verdict with a 0-10 conviction score.

Use specific numbers from the bundle. Never invent data not present. Explicitly flag low-confidence or missing fields.`

const NEWS_PROMPT = `You are a market analyst focused on Indonesian equities. Summarize company-specific news, classify sentiment, identify affected tickers, and explain the likely impact on valuation, momentum, and smart money positioning.

Return a short factual summary, top catalysts, risks, and a confidence score.`

const CONTEXT_CHIPS = [
  'Financials',
  'Ratios',
  'Peer Percentiles',
  'Market Phase',
  'Wyckoff State',
  'Macro Context',
  'Sector Template',
  'Insider Flow',
]

const MODELS: Record<UseCaseTab, ModelCard[]> = {
  stock_thesis: [
    {
      id: 'opus-4.8',
      name: 'Claude Opus 4.8',
      slug: 'claude-opus-4-8',
      pitch: 'Deep narrative + highest quality',
      tier: 'ANALYST PIPELINE',
      price: '$15 / $75 per 1M tok',
      perf: 'DEP DIVE',
      workflowFit: 'Best for thesis synthesis, scenario framing, and risk articulation',
    },
    {
      id: 'sonnet-4.6',
      name: 'Claude Sonnet 4.6',
      slug: 'claude-sonnet-4-6',
      pitch: 'Balanced cost & quality',
      tier: 'BATCH RUNS',
      price: '$3 / $15 per 1M tok',
      perf: 'FAST EDITS',
      workflowFit: 'Best for iterative prompt tuning and medium-depth stock reviews',
    },
    {
      id: 'haiku-4.5',
      name: 'Claude Haiku 4.5',
      slug: 'claude-haiku-4-5',
      pitch: 'Fast + cheap + screener tier',
      tier: 'BULK / SCREENER',
      price: '$1 / $5 per 1M tok',
      perf: 'LOW LAT',
      workflowFit: 'Best for fast preview runs and low-cost tagging workflows',
    },
  ],
  news_sentiment: [
    {
      id: 'sonnet-news',
      name: 'Claude Sonnet 4.6',
      slug: 'claude-sonnet-4-6',
      pitch: 'Balanced fact extraction + tone grading',
      tier: 'NEWS PIPELINE',
      price: '$3 / $15 per 1M tok',
      perf: 'FAST PARSE',
      workflowFit: 'Primary model for sentiment, catalyst extraction, and summarization',
    },
    {
      id: 'haiku-news',
      name: 'Claude Haiku 4.5',
      slug: 'claude-haiku-4-5',
      pitch: 'Cheap stream processing',
      tier: 'BULK ALERTS',
      price: '$1 / $5 per 1M tok',
      perf: 'LOW LAT',
      workflowFit: 'Best for news triage, alert routing, and low-cost tagging',
    },
    {
      id: 'opus-news',
      name: 'Claude Opus 4.8',
      slug: 'claude-opus-4-8',
      pitch: 'Deep narrative synthesis',
      tier: 'SPECIAL CASES',
      price: '$15 / $75 per 1M tok',
      perf: 'FULL READ',
      workflowFit: 'Best for complex thematic situations and long-form market wrapups',
    },
  ],
}

const VERSION_HISTORY: Record<UseCaseTab, PromptVersion[]> = {
  stock_thesis: [
    { id: 'v12', label: 'v12', date: '19 JUN 2026', note: 'Added scenario price implications', status: 'active' },
    { id: 'v11', label: 'v11', date: '18 JUN 2026', note: 'Tightened low-confidence flagging', status: 'restore' },
    { id: 'v10', label: 'v10', date: '12 MAY 2026', note: 'Switched thesis to Bahasa Indonesia', status: 'restore' },
    { id: 'v09', label: 'v09', date: '02 MAY 2026', note: 'Added peer percentile citations', status: 'restore' },
  ],
  news_sentiment: [
    { id: 'v08', label: 'v08', date: '19 JUN 2026', note: 'Added catalyst severity field', status: 'active' },
    { id: 'v07', label: 'v07', date: '15 JUN 2026', note: 'Improved sentiment confidence wording', status: 'restore' },
    { id: 'v06', label: 'v06', date: '04 JUN 2026', note: 'Added ticker relevance ranking', status: 'restore' },
    { id: 'v05', label: 'v05', date: '28 MAY 2026', note: 'Normalized summary output keys', status: 'restore' },
  ],
}

const PROMPT_ARCHIVE: PromptArchiveRow[] = [
  { id: 'p1', name: 'Stock Thesis Core', project: 'IDX Analyst', created: '19 JUN 2026', uses: '248 RUNS', status: 'active' },
  { id: 'p2', name: 'Banking Deep Dive', project: 'Sector Pack', created: '16 JUN 2026', uses: '96 RUNS', status: 'active' },
  { id: 'p3', name: 'Macro Overlay', project: 'Context Layer', created: '11 JUN 2026', uses: '64 RUNS', status: 'archived' },
  { id: 'p4', name: 'News Sentiment Base', project: 'Headline Stream', created: '04 JUN 2026', uses: '181 RUNS', status: 'active' },
  { id: 'p5', name: 'Turnaround Thesis', project: 'Special Situations', created: '29 MAY 2026', uses: '22 RUNS', status: 'archived' },
]

const PIPELINE_NODES: Record<UseCaseTab, PipelineNode[]> = {
  stock_thesis: [
    { id: 'src-prices', label: 'PRICE FEED', type: 'source', status: 'healthy' },
    { id: 'src-fund', label: 'FUNDAMENTALS', type: 'source', status: 'healthy' },
    { id: 'src-ai', label: 'AI CACHE', type: 'source', status: 'warning' },
    { id: 'tr-normalize', label: 'CONTEXT BUILDER', type: 'transform', status: 'healthy' },
    { id: 'ctx-sector', label: 'SECTOR TEMPLATE', type: 'context', status: 'healthy' },
    { id: 'ctx-macro', label: 'MACRO CONTEXT', type: 'context', status: 'healthy' },
    { id: 'out-thesis', label: 'THESIS JSON', type: 'output', status: 'healthy' },
  ],
  news_sentiment: [
    { id: 'src-news', label: 'NEWS FEED', type: 'source', status: 'healthy' },
    { id: 'src-map', label: 'TICKER MAP', type: 'source', status: 'healthy' },
    { id: 'src-price', label: 'PRICE SNAPSHOT', type: 'source', status: 'healthy' },
    { id: 'tr-clean', label: 'ARTICLE CLEANER', type: 'transform', status: 'healthy' },
    { id: 'ctx-sector-news', label: 'SECTOR NOTES', type: 'context', status: 'warning' },
    { id: 'out-sentiment', label: 'SENTIMENT JSON', type: 'output', status: 'healthy' },
  ],
}

function estimateTokens(text: string) {
  return Math.max(256, Math.ceil(text.length / 3.9))
}

function formatInt(value: number) {
  const raw = String(Math.round(value))
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function getCostTier(cost: number) {
  if (cost >= 1.5) return 'high'
  if (cost >= 0.5) return 'medium'
  return 'low'
}

function costTone(cost: number) {
  const tier = getCostTier(cost)
  if (tier === 'high') return 'text-[var(--color-negative-text)]'
  if (tier === 'medium') return 'text-[var(--color-warning-text)]'
  return 'text-[var(--color-brand-text)]'
}

function PipelineBadge({ status }: { status: 'healthy' | 'warning' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[9px] font-bold tracking-[1px] uppercase',
        status === 'healthy'
          ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
          : 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status === 'healthy' ? 'SYNC' : 'CHECK'}
    </span>
  )
}

function MetricBar({
  label,
  value,
  max = 1,
}: {
  label: string
  value: number
  max?: number
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
          {label === 'MAX TOKENS' ? formatInt(value) : value.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border-subtle)]">
        <div className="h-full bg-[var(--color-brand)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function HeaderButton({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string
  tone?: 'neutral' | 'brand'
  icon?: React.ReactNode
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[10px] font-bold tracking-[1px] uppercase transition-colors',
        tone === 'brand'
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-brand-text)] hover:border-[var(--color-brand-text)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export default function AIConfigManager({ nodeId }: { nodeId: string }) {
  const [useCase, setUseCase] = useState<UseCaseTab>('stock_thesis')
  const [selectedModelId, setSelectedModelId] = useState(MODELS.stock_thesis[0].id)
  const [promptText, setPromptText] = useState(STOCK_THESIS_PROMPT)
  const [temperature] = useState(0.4)
  const [topP] = useState(0.9)
  const [maxTokens] = useState(4096)
  const [ticker, setTicker] = useState('BBRI')
  const [archiveQuery, setArchiveQuery] = useState('')
  const [archiveSort, setArchiveSort] = useState<'date' | 'usage' | 'project'>('date')
  const [autosaveLabel, setAutosaveLabel] = useState('SYNCED 12S AGO')
  const [savePulse, setSavePulse] = useState(false)
  const [testRunCount, setTestRunCount] = useState(42)

  useEffect(() => {
    if (useCase === 'stock_thesis') {
      setPromptText(STOCK_THESIS_PROMPT)
      setSelectedModelId(MODELS.stock_thesis[0].id)
    } else {
      setPromptText(NEWS_PROMPT)
      setSelectedModelId(MODELS.news_sentiment[0].id)
    }
    setAutosaveLabel('SYNCED JUST NOW')
  }, [useCase])

  useEffect(() => {
    setAutosaveLabel('AUTOSAVING…')
    setSavePulse(true)
    const timer = setTimeout(() => {
      setAutosaveLabel('SYNCED JUST NOW')
      setSavePulse(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [promptText, selectedModelId])

  const models = MODELS[useCase]
  const selectedModel = models.find((item) => item.id === selectedModelId) ?? models[0]
  const versions = VERSION_HISTORY[useCase]
  const pipelineNodes = PIPELINE_NODES[useCase]
  const promptTokens = useMemo(() => estimateTokens(promptText), [promptText])
  const testInputTokens = useMemo(() => Math.max(1800, promptTokens + 3200), [promptTokens])
  const estCost = useMemo(() => {
    if (selectedModel.id.includes('opus')) return (testInputTokens / 1000000) * 15 + (maxTokens / 1000000) * 75
    if (selectedModel.id.includes('haiku')) return (testInputTokens / 1000000) * 1 + (maxTokens / 1000000) * 5
    return (testInputTokens / 1000000) * 3 + (maxTokens / 1000000) * 15
  }, [maxTokens, selectedModel.id, testInputTokens])

  const recentUsage = useMemo(
    () => ({
      lastDayCost: useCase === 'stock_thesis' ? '$42.18' : '$11.62',
      monthlyCost: useCase === 'stock_thesis' ? '$318.44' : '$84.12',
      sessions: useCase === 'stock_thesis' ? '124 SESSIONS' : '336 RUNS',
      tokens: `${formatInt(useCase === 'stock_thesis' ? 1824000 : 946000)} TOK`,
    }),
    [useCase]
  )

  const filteredArchive = useMemo(() => {
    const q = archiveQuery.trim().toLowerCase()
    const rows = PROMPT_ARCHIVE.filter((item) => {
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.project.toLowerCase().includes(q) ||
        item.created.toLowerCase().includes(q)
      )
    })

    const sorted = [...rows]
    if (archiveSort === 'date') sorted.sort((a, b) => (a.created < b.created ? 1 : -1))
    if (archiveSort === 'usage') sorted.sort((a, b) => (a.uses < b.uses ? 1 : -1))
    if (archiveSort === 'project') sorted.sort((a, b) => (a.project > b.project ? 1 : -1))
    return sorted
  }, [archiveQuery, archiveSort])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)]">
            AI Analyst Configuration
          </div>
          <div className="mt-1 font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
            MODEL SWITCHER • PROMPT SETUP • PARAMETERS • TEST RUN • NODE {nodeId}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeaderButton label="DISCARD" />
          <HeaderButton label="SAVE CONFIG" tone="brand" icon={<Save className="h-4 w-4" />} />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setUseCase('stock_thesis')}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-[10px] font-bold tracking-[1px] uppercase transition-colors',
              useCase === 'stock_thesis'
                ? 'border-[var(--color-brand)] text-[var(--color-brand-text)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <Brain className="h-4 w-4" />
            Stock Thesis
          </button>
          <button
            onClick={() => setUseCase('news_sentiment')}
            className={cn(
              'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-[10px] font-bold tracking-[1px] uppercase transition-colors',
              useCase === 'news_sentiment'
                ? 'border-[var(--color-brand)] text-[var(--color-brand-text)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            )}
          >
            <Sparkles className="h-4 w-4" />
            News + Sentiment
          </button>
        </div>
        <HeaderButton label="ADD USE CASE" icon={<Plus className="h-4 w-4" />} />
      </div>

      <div className="space-y-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <div className="space-y-1">
          <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
            ACTIVE MODEL • {selectedModel.tier}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {models.map((model) => {
              const active = model.id === selectedModelId
              return (
                <button
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={cn(
                    'rounded-md border px-4 py-4 text-left transition-colors',
                    active
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand-bg)]/10'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-inset)]'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                        {model.name}
                      </div>
                      <div className="mt-1 font-mono text-[9px] tracking-[1px] text-[var(--color-brand-text)]">
                        {model.slug}
                      </div>
                    </div>
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 font-mono text-[9px] font-bold tracking-[1px] uppercase',
                        active
                          ? 'bg-[var(--color-brand)] text-[var(--color-text-on-accent)]'
                          : 'bg-[var(--color-bg-inset)] text-[var(--color-text-dim)]'
                      )}
                    >
                      {active ? 'ACTIVE' : 'SELECT'}
                    </span>
                  </div>
                  <div className="mt-3 font-mono text-[10px] text-[var(--color-text-muted)]">
                    {model.pitch}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                        PRICE
                      </div>
                      <div className="mt-1 font-mono text-[9px] text-[var(--color-text-primary)]">{model.price}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                        USE FOR
                      </div>
                      <div className="mt-1 font-mono text-[9px] text-[var(--color-text-primary)]">{model.perf}</div>
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[9px] text-[var(--color-text-dim)]">
                    {model.workflowFit}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                  System Prompt
                </div>
                <div className="mt-1 font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                  Rich editor mock • autosave • syntax-highlight style shell
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-brand-text)]">
                  RESET DEFAULT
                </button>
                <span
                  className={cn(
                    'rounded-md px-2 py-1 font-mono text-[9px] font-bold tracking-[1px] uppercase',
                    savePulse
                      ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
                      : 'bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]'
                  )}
                >
                  {autosaveLabel}
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-code)] p-4">
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="min-h-[220px] w-full resize-none bg-transparent font-mono text-[11px] leading-6 text-[var(--color-text-code)] outline-none"
                  spellCheck={false}
                />
              </div>
              <div className="mt-4">
                <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                  Context Inputs
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CONTEXT_CHIPS.map((chip, idx) => (
                    <span
                      key={chip}
                      className={cn(
                        'rounded-md border px-2 py-1 font-mono text-[9px] font-bold tracking-[1px] uppercase',
                        idx < 7
                          ? 'border-[var(--color-border)] bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
                          : 'border-[var(--color-border)] bg-[var(--color-bg-inset)] text-[var(--color-text-dim)]'
                      )}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Prompt Tokens
                  </div>
                  <div className="mt-1 text-[20px] font-semibold text-[var(--color-text-primary)]">
                    {formatInt(promptTokens)}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Est. Test Input
                  </div>
                  <div className="mt-1 text-[20px] font-semibold text-[var(--color-text-primary)]">
                    {formatInt(testInputTokens)}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Est. API Cost
                  </div>
                  <div className={cn('mt-1 text-[20px] font-semibold', costTone(estCost))}>
                    ${estCost.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                Parameters
              </div>
              <div className="mt-4 space-y-4">
                <MetricBar label="Temperature" value={temperature} max={1} />
                <MetricBar label="Top-P" value={topP} max={1} />
                <MetricBar label="Max Tokens" value={maxTokens} max={8192} />
              </div>
              <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Output Format
                  </span>
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-brand-text)]">
                    JSON SCHEMA
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Cache TTL
                  </span>
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    24 HOURS
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Max Retries
                  </span>
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    2 • BACKOFF
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Fallback Model
                  </span>
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    {useCase === 'stock_thesis' ? 'HAIKU 4.5' : 'SONNET 4.6'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                  Historical Usage
                </div>
                <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)]">
                  LAST 30D
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Last Day Cost
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-[var(--color-text-primary)]">
                    {recentUsage.lastDayCost}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Monthly Cost
                  </div>
                  <div className="mt-1 text-[18px] font-semibold text-[var(--color-text-primary)]">
                    {recentUsage.monthlyCost}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Sessions
                  </div>
                  <div className="mt-1 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    {recentUsage.sessions}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Tokens
                  </div>
                  <div className="mt-1 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    {recentUsage.tokens}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                  Prompt Versions • {versions.length} Saved
                </div>
                <HeaderButton label="NEW VERSION" icon={<Plus className="h-4 w-4" />} />
              </div>
              <div className="mt-4 space-y-3">
                {versions.map((version) => (
                  <div key={version.id} className="flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3 last:border-b-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                          {version.label}
                        </span>
                        <span className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                          {version.date}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">
                        {version.note}
                      </div>
                    </div>
                    <button
                      className={cn(
                        'rounded-md px-2 py-1 font-mono text-[9px] font-bold tracking-[1px] uppercase',
                        version.status === 'active'
                          ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
                          : 'bg-[var(--color-bg-inset)] text-[var(--color-text-muted)]'
                      )}
                    >
                      {version.status === 'active' ? 'ACTIVE' : 'RESTORE'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                  Prompt Simulation + Testing
                </div>
                <div className="mt-1 font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                  Sandbox • benchmark • debug • not saved
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-2 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  placeholder="BBRI"
                />
                <button
                  onClick={() => setTestRunCount((value) => value + 1)}
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--color-brand)] bg-[var(--color-brand)] px-3 py-2 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-on-accent)] transition-colors hover:border-[var(--color-brand-text)] hover:bg-[var(--color-brand-text)]"
                >
                  <Play className="h-4 w-4" />
                  RUN TEST
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-brand)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-on-accent)]">
                    Verdict
                  </div>
                  <div className="mt-1 text-[24px] font-semibold text-[var(--color-text-on-accent)]">
                    BUY
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Conviction
                  </div>
                  <div className="mt-1 text-[24px] font-semibold text-[var(--color-brand-text)]">
                    7.8
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Latency
                  </div>
                  <div className="mt-1 text-[24px] font-semibold text-[var(--color-text-primary)]">
                    4.2s
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Tokens
                  </div>
                  <div className="mt-1 text-[24px] font-semibold text-[var(--color-text-primary)]">
                    18.4K
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-code)] p-4">
                <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                  Thesis Preview
                </div>
                <div className="mt-2 text-[13px] leading-6 text-[var(--color-text-code)]">
                  BBRI menunjukkan fundamental solid dengan ROE 19,0% dan NIM yang stabil. Valuasi P/E 11,2x berada di bawah rata-rata 5 tahun, sementara fase Wyckoff mengindikasikan akumulasi. Aliran dana asing positif 3 minggu berturut-turut mendukung tesis akumulasi jangka menengah.
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Dataset
                  </div>
                  <div className="mt-1 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    HISTORICAL SNAPSHOT
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Benchmark
                  </div>
                  <div className="mt-1 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    98.2% SCHEMA PASS
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                    Test Runs
                  </div>
                  <div className="mt-1 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    {formatInt(testRunCount)} RUNS
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
              Pipeline Builder
            </div>
            <div className="mt-1 font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
              Visual workflow for prompt data inputs
            </div>
            <div className="mt-4 space-y-3">
              {pipelineNodes.map((node, index) => (
                <div key={node.id} className="relative rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)]">
                        {node.type === 'source' && <Database className="h-4 w-4 text-[var(--color-text-muted)]" />}
                        {node.type === 'transform' && <Workflow className="h-4 w-4 text-[var(--color-text-muted)]" />}
                        {node.type === 'context' && <ServerCog className="h-4 w-4 text-[var(--color-text-muted)]" />}
                        {node.type === 'output' && <GitBranch className="h-4 w-4 text-[var(--color-text-muted)]" />}
                      </span>
                      <div>
                        <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                          {node.label}
                        </div>
                        <div className="mt-1 font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                          {node.type}
                        </div>
                      </div>
                    </div>
                    <PipelineBadge status={node.status} />
                  </div>
                  {index < pipelineNodes.length - 1 && (
                    <div className="ml-4 mt-3 h-4 border-l border-dashed border-[var(--color-border)]" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-md border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)]/20 px-3 py-3">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 text-[var(--color-warning-text)]" />
                <div>
                  <div className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-warning-text)]">
                    Data Pipeline Warning
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[var(--color-text-muted)]">
                    {useCase === 'stock_thesis'
                      ? 'AI CACHE freshness is 47 minutes behind latest context build.'
                      : 'SECTOR NOTES feed last refresh is older than the article ingestion stream.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                  Prompt History Repository
                </div>
                <div className="mt-1 font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                  Search • filter • duplicate • archive
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-dim)]" />
                  <input
                    value={archiveQuery}
                    onChange={(e) => setArchiveQuery(e.target.value)}
                    placeholder="Search prompts"
                    className="w-40 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] py-2 pl-9 pr-3 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  />
                </div>
                <select
                  value={archiveSort}
                  onChange={(e) => setArchiveSort(e.target.value as 'date' | 'usage' | 'project')}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-2 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                >
                  <option value="date">DATE</option>
                  <option value="usage">USAGE</option>
                  <option value="project">PROJECT</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[var(--color-bg-inset)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                      Prompt
                    </th>
                    <th className="px-4 py-2 text-left font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                      Project
                    </th>
                    <th className="px-4 py-2 text-left font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                      Created
                    </th>
                    <th className="px-4 py-2 text-left font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                      Uses
                    </th>
                    <th className="px-4 py-2 text-right font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                  {filteredArchive.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                          {row.name}
                        </div>
                        <div
                          className={cn(
                            'mt-1 inline-flex rounded-md px-2 py-0.5 font-mono text-[8px] font-bold tracking-[1px] uppercase',
                            row.status === 'active'
                              ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)]'
                              : 'bg-[var(--color-bg-inset)] text-[var(--color-text-dim)]'
                          )}
                        >
                          {row.status}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-text-muted)]">{row.project}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-text-muted)]">{row.created}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-text-muted)]">{row.uses}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]">
                            <PenSquare className="h-4 w-4" />
                          </button>
                          <button className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]">
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <div className="font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
              Error Handling + Readiness
            </div>
            <div className="mt-1 font-mono text-[8px] font-bold tracking-[1px] uppercase text-[var(--color-text-dim)]">
              Accessibility + API safeguards
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-brand-text)]" />
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    Model Compatibility
                  </span>
                </div>
                <div className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">
                  {selectedModel.name} supports long-context stock thesis workflows and JSON outputs.
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--color-warning-text)]" />
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    Cost Threshold
                  </span>
                </div>
                <div className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">
                  {getCostTier(estCost) === 'high'
                    ? 'High-cost run detected. Suggest switching to Sonnet for iterative editing.'
                    : getCostTier(estCost) === 'medium'
                      ? 'Medium-cost run. Safe for analyst review loops.'
                      : 'Low-cost run. Suitable for experimentation and bulk tests.'}
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                <div className="flex items-center gap-2">
                  <ServerCog className="h-4 w-4 text-[var(--color-text-primary)]" />
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    API Guardrails
                  </span>
                </div>
                <div className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">
                  Retries, cache TTL, fallback model, and schema validation are visible here before deployment.
                </div>
              </div>

              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-[var(--color-text-primary)]" />
                  <span className="font-mono text-[9px] font-bold tracking-[1px] uppercase text-[var(--color-text-primary)]">
                    Accessibility
                  </span>
                </div>
                <div className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">
                  Keyboard focus, high-contrast token usage, and tablet-friendly stacking are built into the layout.
                </div>
              </div>

              <button
                onClick={() => setTestRunCount((value) => value + 1)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-inset)] px-3 py-2 font-mono text-[10px] font-bold tracking-[1px] uppercase text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
              >
                <ChevronRight className="h-4 w-4" />
                Simulate Error Recovery
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
