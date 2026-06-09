'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

const STORAGE_KEY = 'sb-theme'
const COOKIE_KEY = 'sb-theme'

function persistTheme(theme: 'dark' | 'light') {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Ignore storage failures in private mode or restricted environments.
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_KEY}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    let storedTheme: string | null = null

    try {
      storedTheme = localStorage.getItem(STORAGE_KEY)
    } catch {
      // Ignore storage failures in private mode or restricted environments.
    }

    const current = document.documentElement.getAttribute('data-theme')
    const resolvedTheme =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : current === 'light'
          ? 'light'
          : 'dark'

    document.documentElement.setAttribute('data-theme', resolvedTheme)
    persistTheme(resolvedTheme)
    setTheme(resolvedTheme)
    setMounted(true)
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    persistTheme(next)
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
