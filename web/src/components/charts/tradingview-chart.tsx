'use client'

import { useEffect, useRef, useState } from 'react'
import { useChartTheme } from '@/lib/hooks/useChartTheme'

interface TradingViewChartProps {
  ticker: string
}

export function TradingViewChart({ ticker }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const chartTheme = useChartTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !containerRef.current) return

    // Clear any previous widget instance
    containerRef.current.innerHTML = ''

    const widgetDiv = document.createElement('div')
    widgetDiv.id = `tradingview_${ticker}`
    widgetDiv.style.height = '100%'
    widgetDiv.style.width = '100%'
    containerRef.current.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = () => {
      if (typeof window.TradingView === 'undefined') return
      new window.TradingView.widget({
        autosize: true,
        symbol: `IDX:${ticker}`,
        interval: 'D',
        timezone: 'Asia/Jakarta',
        theme: chartTheme.mode,
        style: '1',           // candlestick
        locale: 'en',
        toolbar_bg: chartTheme.cardBg,
        enable_publishing: false,
        allow_symbol_change: false,
        save_image: false,
        container_id: `tradingview_${ticker}`,
        hide_side_toolbar: false,
        studies: ['Volume@tv-basicstudies'],
      })
    }
    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [mounted, ticker, chartTheme.mode, chartTheme.cardBg])

  if (!mounted) {
    return (
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="h-4 w-24 bg-[var(--color-bg-inset)] animate-pulse" />
        </div>
        <div className="h-[500px] bg-[var(--color-bg-inset)] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <h2 className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">Live Chart</h2>
        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">Powered by TradingView</span>
      </div>
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 500 }}
      />
    </div>
  )
}
