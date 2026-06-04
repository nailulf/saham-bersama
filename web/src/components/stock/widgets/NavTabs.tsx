'use client'

const TABS = [
  { id: 'overview',   label: 'OVERVIEW'    },
  { id: 'ai',         label: 'AI'          },
  { id: 'valuasi',    label: 'VALUASI'     },
  { id: 'finansial',  label: 'FINANSIAL'   },
  { id: 'money-flow', label: 'MONEY FLOW'  },
  { id: 'teknikal',   label: 'TEKNIKAL'    },
  { id: 'profil',     label: 'PROFIL'      },
]

interface Props {
  active: string
  onTabChange: (id: string) => void
}

export function NavTabs({ active, onTabChange }: Props) {
  return (
    <div
      className="sticky top-0 z-20 overflow-x-auto scrollbar-none"
      style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}
    >
      <div className="flex px-2 min-w-max">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="px-4 py-[11px] font-mono text-[11px] font-bold tracking-[1px] transition-colors cursor-pointer whitespace-nowrap"
              style={{
                color: isActive ? 'var(--color-brand)' : 'var(--color-text-muted)',
                borderBottom: isActive ? '2px solid var(--color-brand)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
