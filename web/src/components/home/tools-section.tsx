import Link from 'next/link'
import { Coins, Calculator, Scale, GitCompareArrows, type LucideIcon } from 'lucide-react'

// ─── Tools & Features (mobile only) ───────────────────────────────────────────
// Quick-access tools. Most are not enabled yet (rendered dimmed + SOON tag);
// Compare is live and redirects to the stock-vs-stock comparison page.

interface Tool {
  key: string
  label: string
  Icon: LucideIcon
  href?: string // present → enabled link; absent → coming soon
}

const TOOLS: Tool[] = [
  { key: 'dividend', label: 'Dividen',  Icon: Coins },
  { key: 'dcf',      label: 'DCF',      Icon: Calculator },
  { key: 'graham',   label: 'Graham',   Icon: Scale },
  { key: 'compare',  label: 'Compare',  Icon: GitCompareArrows, href: '/compare' },
]

function ToolPill({ tool }: { tool: Tool }) {
  const { label, Icon, href } = tool
  const enabled = Boolean(href)

  const inner = (
    <>
      {/* Icon chip */}
      <span
        className="flex items-center justify-center rounded-lg"
        style={{
          width: 28,
          height: 28,
          background: enabled ? 'var(--color-brand-bg)' : 'var(--color-neutral-bg)',
        }}
      >
        <Icon
          size={15}
          strokeWidth={2}
          style={{ color: enabled ? 'var(--color-brand-text)' : 'var(--color-text-dim)' }}
        />
      </span>

      {/* Label */}
      <span
        className="font-mono text-[10px] font-bold uppercase tracking-[0.5px] whitespace-nowrap"
        style={{ color: enabled ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
      >
        {label}
      </span>

      {/* Coming-soon tag */}
      {!enabled && (
        <span
          className="font-mono text-[9px] font-bold uppercase tracking-[0.5px] rounded px-1 py-0.5"
          style={{ background: 'var(--color-neutral-bg)', color: 'var(--color-text-muted)' }}
        >
          Soon
        </span>
      )}
    </>
  )

  const baseClass =
    'flex-shrink-0 flex items-center gap-2 rounded-[10px] pl-2 pr-3.5 py-2 no-underline'
  const baseStyle = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
  } as const

  if (enabled) {
    return (
      <Link href={href!} className={baseClass} style={baseStyle} aria-label={label}>
        {inner}
      </Link>
    )
  }

  return (
    <div
      className={baseClass}
      style={{ ...baseStyle, opacity: 0.6 }}
      aria-disabled="true"
      aria-label={`${label} — coming soon`}
    >
      {inner}
    </div>
  )
}

export function ToolsSection() {
  return (
    <section className="sm:hidden flex flex-col gap-2 pt-4" aria-label="Tools">
      <div className="px-5">
        <span className="section-label">Tools</span>
      </div>

      {/* Horizontal scroll — never wraps */}
      <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none scroll-fade-right pb-1">
        {TOOLS.map((tool) => (
          <ToolPill key={tool.key} tool={tool} />
        ))}
      </div>
    </section>
  )
}
