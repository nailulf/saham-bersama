'use client'

import React, { useState } from 'react'
import {
  Brain,
  Settings,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Sparkles,
  MessageSquare,
  FileText,
  Newspaper,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Zap,
  Code,
  Terminal
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types for AI Configuration
interface AIModel {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'local'
  modelId: string
  description: string
  maxTokens: number
  temperature: number
  enabled: boolean
  isDefault: boolean
  apiKeyConfigured: boolean
  lastUsed: string | null
  usageStats: {
    totalCalls: number
    totalTokens: number
    avgLatency: number
  }
}

interface UseCase {
  id: string
  name: string
  description: string
  icon: 'thesis' | 'news' | 'analysis' | 'custom'
  modelId: string | null
  systemPrompt: string
  userPromptTemplate: string
  parameters: {
    temperature: number
    maxTokens: number
    topP: number
    frequencyPenalty: number
    presencePenalty: number
  }
  enabled: boolean
  outputFormat: 'json' | 'text' | 'markdown'
  exampleOutput: string
}

interface PromptTemplate {
  id: string
  name: string
  content: string
  variables: string[]
  useCaseId: string
}

// Mock data
const mockModels: AIModel[] = [
  {
    id: 'model-gpt4',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    modelId: 'gpt-4-turbo-preview',
    description: 'Most capable GPT-4 model for complex tasks',
    maxTokens: 128000,
    temperature: 0.7,
    enabled: true,
    isDefault: true,
    apiKeyConfigured: true,
    lastUsed: '2026-06-20T10:30:00Z',
    usageStats: { totalCalls: 1245, totalTokens: 4567800, avgLatency: 1200 }
  },
  {
    id: 'model-claude',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    modelId: 'claude-3-opus-20240229',
    description: 'Anthropic\'s most intelligent model',
    maxTokens: 200000,
    temperature: 0.7,
    enabled: true,
    isDefault: false,
    apiKeyConfigured: true,
    lastUsed: '2026-06-19T15:45:00Z',
    usageStats: { totalCalls: 567, totalTokens: 2345600, avgLatency: 1800 }
  },
  {
    id: 'model-gpt35',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    modelId: 'gpt-3.5-turbo-0125',
    description: 'Fast and cost-effective for simpler tasks',
    maxTokens: 16385,
    temperature: 0.7,
    enabled: true,
    isDefault: false,
    apiKeyConfigured: true,
    lastUsed: '2026-06-20T08:15:00Z',
    usageStats: { totalCalls: 3420, totalTokens: 1234500, avgLatency: 450 }
  },
  {
    id: 'model-gemini',
    name: 'Gemini Pro',
    provider: 'google',
    modelId: 'gemini-1.5-pro-latest',
    description: 'Google\'s multimodal AI model',
    maxTokens: 1000000,
    temperature: 0.7,
    enabled: false,
    isDefault: false,
    apiKeyConfigured: false,
    lastUsed: null,
    usageStats: { totalCalls: 0, totalTokens: 0, avgLatency: 0 }
  }
]

const mockUseCases: UseCase[] = [
  {
    id: 'uc-thesis',
    name: 'Thesis Analyzer',
    description: 'Analyzes investment theses for completeness and soundness',
    icon: 'thesis',
    modelId: 'model-gpt4',
    systemPrompt: 'You are an expert investment analyst. Analyze the provided investment thesis for logical consistency, completeness of analysis, and soundness of conclusions. Identify gaps in reasoning and suggest improvements.',
    userPromptTemplate: 'Analyze this investment thesis for {{ticker}}:\n\n{{thesis}}\n\nProvide:\n1. Overall score (0-100)\n2. Strengths\n3. Weaknesses/Gaps\n4. Specific recommendations for improvement\n5. Confidence level in the thesis',
    parameters: {
      temperature: 0.3,
      maxTokens: 2000,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0
    },
    enabled: true,
    outputFormat: 'json',
    exampleOutput: '{"score": 78, "strengths": ["Strong moat analysis"], "weaknesses": ["Lacks valuation context"], "recommendations": ["Add DCF analysis"], "confidence": "medium"}'
  },
  {
    id: 'uc-news',
    name: 'News Analyzer',
    description: 'Extracts sentiment and key insights from financial news',
    icon: 'news',
    modelId: 'model-claude',
    systemPrompt: 'You are a financial news analyst. Extract key information, sentiment, and potential market impact from news articles. Focus on factual information and avoid speculation.',
    userPromptTemplate: 'Analyze this news article:\n\nTitle: {{title}}\nSource: {{source}}\nDate: {{date}}\n\nContent:\n{{content}}\n\nProvide:\n1. Key facts (bullet points)\n2. Sentiment (positive/negative/neutral with confidence)\n3. Tickers mentioned and their relevance\n4. Potential market impact\n5. Credibility assessment',
    parameters: {
      temperature: 0.2,
      maxTokens: 1500,
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0
    },
    enabled: true,
    outputFormat: 'json',
    exampleOutput: '{"key_facts": ["Earnings beat by 15%"], "sentiment": {"label": "positive", "confidence": 0.85}, "tickers": [{"symbol": "BBRI", "relevance": "primary"}], "market_impact": "likely positive"}'
  },
  {
    id: 'uc-technical',
    name: 'Technical Analysis',
    description: 'Analyzes technical indicators and chart patterns',
    icon: 'analysis',
    modelId: 'model-gpt4',
    systemPrompt: 'You are a technical analyst specializing in Indonesian stocks. Analyze price charts, volume, and technical indicators to identify patterns, support/resistance levels, and potential trading opportunities.',
    userPromptTemplate: 'Analyze the technical setup for {{ticker}}:\n\nPrice Data:\n- Current Price: {{currentPrice}}\n- 52-week High: {{high52}}\n- 52-week Low: {{low52}}\n- Volume (20d avg): {{avgVolume}}\n\nIndicators:\n- RSI (14): {{rsi}}\n- MACD: {{macd}}\n- SMA 50: {{sma50}}\n- SMA 200: {{sma200}}\n\nProvide:\n1. Trend analysis (primary and secondary)\n2. Key support and resistance levels\n3. Pattern identification (if any)\n4. Momentum assessment\n5. Trading recommendation with risk level',
    parameters: {
      temperature: 0.3,
      maxTokens: 2000,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0
    },
    enabled: true,
    outputFormat: 'json',
    exampleOutput: '{"trend": {"primary": "uptrend", "secondary": "consolidation"}, "levels": {"support": [4200, 4000], "resistance": [4800, 5000]}, "patterns": ["ascending triangle"], "momentum": "bullish", "recommendation": "buy on breakout", "risk": "medium"}'
  }
]

// Helper functions
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

// Export component
export default function AIConfigManager() {
  const [activeTab, setActiveTab] = useState<'models' | 'usecases' | 'prompts'>('models')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedUseCase, setSelectedUseCase] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const model = mockModels.find(m => m.id === selectedModel)
  const useCase = mockUseCases.find(u => u.id === selectedUseCase)

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-1">
        <div className="flex items-center gap-1">
          {(['models', 'usecases', 'prompts'] as const).map((tab) => (
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
              {tab === 'models' && <Brain className="w-4 h-4" />}
              {tab === 'usecases' && <Sparkles className="w-4 h-4" />}
              {tab === 'prompts' && <MessageSquare className="w-4 h-4" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'models' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Models List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--color-text-primary)]">AI Models</h3>
              <button className="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-brand)] text-white text-sm rounded-lg hover:bg-[var(--color-brand-text)] transition-colors">
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            
            {mockModels.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(selectedModel === m.id ? null : m.id)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all',
                  selectedModel === m.id
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand-bg)]/30'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-subtle)]'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {m.provider === 'openai' && <div className="w-6 h-6 rounded bg-[#10A37F] flex items-center justify-center text-white text-xs font-bold">O</div>}
                    {m.provider === 'anthropic' && <div className="w-6 h-6 rounded bg-[#D4A574] flex items-center justify-center text-white text-xs font-bold">C</div>}
                    {m.provider === 'google' && <div className="w-6 h-6 rounded bg-[#4285F4] flex items-center justify-center text-white text-xs font-bold">G</div>}
                    {m.provider === 'local' && <div className="w-6 h-6 rounded bg-[var(--color-neutral-text)] flex items-center justify-center text-white text-xs font-bold">L</div>}
                    <span className="font-medium text-[var(--color-text-primary)]">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {m.isDefault && (
                      <span className="px-1.5 py-0.5 bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] text-xs rounded">
                        Default
                      </span>
                    )}
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      m.enabled && m.apiKeyConfigured ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-negative)]'
                    )} />
                  </div>
                </div>
                
                <p className="text-xs text-[var(--color-text-muted)] mb-2">{m.description}</p>
                
                <div className="flex items-center gap-3 text-xs text-[var(--color-text-dim)]">
                  <span>{m.usageStats.totalCalls.toLocaleString()} calls</span>
                  <span>•</span>
                  <span>{formatNumber(m.usageStats.totalTokens)} tokens</span>
                  <span>•</span>
                  <span>{m.usageStats.avgLatency}ms avg</span>
                </div>
              </button>
            ))}
          </div>

          {/* Model Configuration */}
          <div className="lg:col-span-2">
            {model ? (
              <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-bg)] flex items-center justify-center">
                      <Brain className="w-5 h-5 text-[var(--color-brand)]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{model.name}</h3>
                      <p className="text-sm text-[var(--color-text-muted)]">{model.modelId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-brand-text)] transition-colors"
                    >
                      {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* Basic Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Temperature</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        defaultValue={model.temperature}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-50"
                      />
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">Controls creativity: 0 = deterministic, 2 = very creative</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">Max Tokens</label>
                      <input
                        type="number"
                        min="1"
                        max={model.maxTokens}
                        defaultValue={4096}
                        disabled={!isEditing}
                        className="w-full px-3 py-2 bg-[var(--color-bg-inset)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-50"
                      />
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">Maximum tokens in response (max: {model.maxTokens.toLocaleString()})</p>
                    </div>
                  </div>

                  {/* API Key Status */}
                  <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          model.apiKeyConfigured ? 'bg-[var(--color-brand-bg)]' : 'bg-[var(--color-negative-bg)]'
                        )}>
                          {model.apiKeyConfigured ? (
                            <CheckCircle2 className="w-5 h-5 text-[var(--color-brand)]" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-[var(--color-negative)]" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-[var(--color-text-primary)]">API Key</h4>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            {model.apiKeyConfigured ? 'Configured and working' : 'Not configured'}
                          </p>
                        </div>
                      </div>
                      <button
                        className="px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-brand-text)] transition-colors"
                      >
                        {model.apiKeyConfigured ? 'Update Key' : 'Configure'}
                      </button>
                    </div>
                  </div>

                  {/* Usage Statistics */}
                  <div>
                    <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Usage Statistics</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">Total API Calls</p>
                        <p className="text-xl font-bold text-[var(--color-text-primary)]">{model.usageStats.totalCalls.toLocaleString()}</p>
                      </div>
                      <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">Total Tokens</p>
                        <p className="text-xl font-bold text-[var(--color-text-primary)]">{formatNumber(model.usageStats.totalTokens)}</p>
                      </div>
                      <div className="bg-[var(--color-bg-inset)] rounded-lg p-4">
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">Avg Latency</p>
                        <p className="text-xl font-bold text-[var(--color-text-primary)]">{model.usageStats.avgLatency}ms</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                {isEditing && (
                  <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-inset)]">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-brand-text)] transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                <Brain className="w-16 h-16 text-[var(--color-border)] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">Select a Model</h3>
                <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
                  Choose an AI model from the list to view and configure its settings, API keys, and usage statistics.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'usecases' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Use Case Configuration</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Configure AI prompts and parameters for each use case</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-brand-text)] transition-colors">
              <Plus className="w-4 h-4" />
              Add Use Case
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockUseCases.map((useCase) => (
              <div
                key={useCase.id}
                className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-brand)] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-bg)] flex items-center justify-center">
                    {useCase.icon === 'thesis' && <FileText className="w-5 h-5 text-[var(--color-brand)]" />}
                    {useCase.icon === 'news' && <Newspaper className="w-5 h-5 text-[var(--color-brand)]" />}
                    {useCase.icon === 'analysis' && <TrendingUp className="w-5 h-5 text-[var(--color-brand)]" />}
                    {useCase.icon === 'custom' && <Sparkles className="w-5 h-5 text-[var(--color-brand)]" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {useCase.enabled ? (
                      <span className="px-2 py-0.5 bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] text-xs rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-[var(--color-neutral-bg)] text-[var(--color-neutral-text)] text-xs rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <h4 className="font-semibold text-[var(--color-text-primary)] mb-1">{useCase.name}</h4>
                <p className="text-sm text-[var(--color-text-muted)] mb-3">{useCase.description}</p>

                <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
                  <Brain className="w-3.5 h-3.5" />
                  <span>{mockModels.find(m => m.id === useCase.modelId)?.name || 'No model'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <MessageSquare className="w-16 h-16 text-[var(--color-border)] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">Prompt Templates</h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto mb-6">
            Manage reusable prompt templates with variables for dynamic content injection.
          </p>
          <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-brand-text)] transition-colors mx-auto">
            <Plus className="w-4 h-4" />
            Create Template
          </button>
        </div>
      )}
    </div>
  )
}

// Helper functions
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}
