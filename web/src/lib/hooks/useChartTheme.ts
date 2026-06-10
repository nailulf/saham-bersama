'use client'

import { useEffect, useState } from 'react'

/**
 * Resolved chart colors for charting libs that can't read CSS vars directly
 * (lightweight-charts, Recharts, the TradingView embed). Values are read from the
 * design tokens on `<html data-theme>` and refreshed when the theme toggles.
 *
 * Use inside a `mounted`-guarded chart only — the SSR/first-paint value is the light
 * fallback; the real theme resolves in an effect after mount.
 */
export interface ChartTheme {
  mode: 'dark' | 'light'
  cardBg: string      // --color-bg-card    (chart background / dot halo / toolbar)
  axisText: string    // --color-text-muted (axis ticks, labels)
  axisLine: string    // --color-border     (axis lines, reference lines, tooltip border)
  grid: string        // --color-border-subtle (gridlines)
  brand: string       // --color-brand      (positive series)
  negative: string    // --color-negative   (negative series)
  textPrimary: string // --color-text-primary (crosshair labels, emphasis)
}

const LIGHT_FALLBACK: ChartTheme = {
  mode: 'light',
  cardBg: '#FFFFFF',
  axisText: '#6B7280',
  axisLine: '#E5E7EB',
  grid: '#ECF0F5',
  brand: '#10B981',
  negative: '#EF4444',
  textPrimary: '#0D0D0D',
}

function readChartTheme(): ChartTheme {
  if (typeof window === 'undefined') return LIGHT_FALLBACK
  const root = document.documentElement
  const cs = getComputedStyle(root)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    mode: root.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    cardBg: v('--color-bg-card', LIGHT_FALLBACK.cardBg),
    axisText: v('--color-text-muted', LIGHT_FALLBACK.axisText),
    axisLine: v('--color-border', LIGHT_FALLBACK.axisLine),
    grid: v('--color-border-subtle', LIGHT_FALLBACK.grid),
    brand: v('--color-brand', LIGHT_FALLBACK.brand),
    negative: v('--color-negative', LIGHT_FALLBACK.negative),
    textPrimary: v('--color-text-primary', LIGHT_FALLBACK.textPrimary),
  }
}

export function useChartTheme(): ChartTheme {
  // Constant initial value keeps server + first client render identical; the real
  // theme resolves in the effect below (charts render behind a mounted guard, so the
  // fallback is never painted).
  const [theme, setTheme] = useState<ChartTheme>(LIGHT_FALLBACK)

  useEffect(() => {
    setTheme(readChartTheme())
    const observer = new MutationObserver(() => setTheme(readChartTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return theme
}
