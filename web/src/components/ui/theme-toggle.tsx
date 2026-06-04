'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

const STORAGE_KEY = 'sb-theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Read the attribute that the anti-FOUC script already set
    const current = document.documentElement.getAttribute('data-theme') as 'dark' | 'light'
    setTheme(current === 'light' ? 'light' : 'dark')
    setMounted(true)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
  }

  // Render placeholder during SSR to avoid layout shift
  if (!mounted) {
    return <div className="w-6 h-6" aria-hidden="true" />
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark'
        ? <Sun  size={22} style={{ color: 'var(--color-text-muted)' }} />
        : <Moon size={22} style={{ color: 'var(--color-text-muted)' }} />
      }
    </button>
  )
}
