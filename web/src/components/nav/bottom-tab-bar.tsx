'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BarChart2, Users, User } from 'lucide-react'

const TABS = [
  { href: '/',            label: 'Home',       Icon: Home     },
  { href: '/strategies',  label: 'Strategy',   Icon: BarChart2 },
  { href: '/investors',   label: 'Investors',  Icon: Users    },
  { href: '/profile',     label: 'Profile',    Icon: User     },
] as const

export function BottomTabBar() {
  const pathname = usePathname()
  if (pathname.startsWith('/admin')) return null

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    // Treat /screener as part of the Strategy tab
    if (href === '/strategies') return pathname.startsWith('/strategies') || pathname.startsWith('/screener')
    return pathname.startsWith(href)
  }

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)] pt-3 pointer-events-none">
      <nav
        className="flex items-center gap-1 px-1.5 py-1.5 rounded-[28px] pointer-events-auto"
        style={{ background: 'var(--color-tab-bar)', border: '1px solid var(--color-border)' }}
        aria-label="Main navigation"
      >
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-0.5 px-3.5 py-2 rounded-[22px] transition-colors"
              style={active ? { background: 'var(--color-tab-active-bg)' } : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={22}
                style={{ color: active ? 'var(--color-brand-text)' : 'var(--color-text-dim)' }}
                aria-hidden="true"
              />
              <span
                className="text-[9px] leading-none"
                style={{
                  color: active ? 'var(--color-brand-text)' : 'var(--color-text-muted)',
                  fontFamily: 'var(--font-inter)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[134px] h-[5px] rounded-full"
        style={{ background: 'var(--color-indicator)' }}
        aria-hidden="true"
      />
    </div>
  )
}
