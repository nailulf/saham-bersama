'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { SearchBar } from './search-bar'

const NAV_LINKS = [
  { href: '/',            label: 'Screener' },
  { href: '/money-flow',  label: 'Money Flow' },
  { href: '/compare',     label: 'Compare' },
  { href: '/investors',   label: 'Investors' },
]

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E5E4E1] shadow-[0_1px_6px_rgba(26,25,24,0.04)]">
      <div className="max-w-7xl mx-auto px-4 lg:px-10 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-bold text-[#1A1918] tracking-tight">IDX</span>
          <span className="text-xs font-semibold text-[#3D8A5A] bg-[#C8F0D8] px-2 py-0.5 rounded-lg">Analyzer</span>
        </Link>

        <div className="flex-1 max-w-sm">
          <SearchBar />
        </div>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-[#6D6C6A]">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[#1A1918] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Mobile burger button */}
        <button
          className="sm:hidden flex items-center justify-center w-9 h-9 text-[#6D6C6A] hover:text-[#1A1918] transition-colors flex-shrink-0"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-[#E5E4E1] bg-white">
          <nav className="flex flex-col py-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-6 py-3.5 text-sm font-medium text-[#6D6C6A] hover:text-[#1A1918] hover:bg-[#F5F4F1] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
