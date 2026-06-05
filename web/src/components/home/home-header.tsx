import { Search, Bell } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export function HomeHeader() {
  return (
    <header
      className="sm:hidden flex items-center justify-between px-5 h-[52px] w-full"
      style={{ background: 'var(--color-bg-card)' }}
    >
      <Link href="/" aria-label="Saham Bersama home">
        <span
          className="logo-text text-[15px] font-bold"
          style={{ color: 'var(--color-brand)' }}
        >
          Saham Bersama
        </span>
      </Link>

      <div className="flex items-center gap-4">
        <ThemeToggle />
        <Link href="/search" aria-label="Search stocks">
          <Search size={22} style={{ color: 'var(--color-text-muted)' }} />
        </Link>
        <button aria-label="Notifications" type="button">
          <Bell size={22} style={{ color: 'var(--color-text-muted)' }} />
        </button>
      </div>
    </header>
  )
}
