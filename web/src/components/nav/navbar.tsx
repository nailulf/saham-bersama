'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Bell } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const NAV_LINKS = [
  { href: '/',            label: 'Home' },
  { href: '/strategies',  label: 'Strategy' },
  { href: '/money-flow',  label: 'Money Flow' },
  { href: '/compare',     label: 'Compare' },
  { href: '/investors',   label: 'Investors' },
]

export function Navbar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    if (href === '/strategies') return pathname.startsWith('/strategies') || pathname.startsWith('/screener')
    return pathname.startsWith(href)
  }

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between px-5 h-14 w-full sm:max-w-[1280px] sm:mx-auto">
        {/* Logo */}
        <Link
          href="/"
          className="logo-text font-bold flex-shrink-0"
          style={{ fontSize: 18, color: 'var(--color-brand)' }}
        >
          Saham Bersama
        </Link>

        {/* Desktop nav links — hidden on mobile */}
        <nav aria-label="Primary" className="hidden sm:flex items-center gap-5">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? 'page' : undefined}
              className="font-mono transition-colors"
              style={{
                fontSize: 12,
                fontWeight: isActive(l.href) ? 600 : 400,
                color: isActive(l.href) ? 'var(--color-brand-text)' : 'var(--color-text-muted)',
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right icons */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/search" aria-label="Search" style={{ color: 'var(--color-text-muted)' }}>
            <Search size={22} />
          </Link>
          <button aria-label="Notifications" style={{ color: 'var(--color-text-muted)' }}>
            <Bell size={22} />
          </button>
        </div>
      </div>
    </header>
  )
}
