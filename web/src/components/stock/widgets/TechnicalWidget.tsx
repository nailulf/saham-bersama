// Data teknikal — ganti dengan integrasi penyedia data pasar
const LEVELS = [
  { label: 'RESISTANCE 2', type: 'resistance' as const },
  { label: 'RESISTANCE 1', type: 'resistance' as const },
  { label: 'HARGA SAAT INI', type: 'current'    as const },
  { label: 'SUPPORT 1',    type: 'support'     as const },
  { label: 'SUPPORT 2',    type: 'support'     as const },
]

const MA_INDICATORS = ['MA 20', 'MA 50', 'MA 200', 'RSI (14)', 'MACD']

const TYPE_COLOR: Record<string, string> = {
  resistance: 'text-red-400',
  current:    'text-[#00FF88]',
  support:    'text-[#3B82F6]',
}

export function TechnicalWidget() {
  return (
    <div className="px-4 md:px-12 py-2">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] p-5 flex flex-col gap-4">
        <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">
          LEVEL TEKNIKAL &amp; AKSI HARGA
        </span>

        {/* Support / Resistance levels */}
        <div className="flex flex-col">
          {LEVELS.map((lv) => (
            <div
              key={lv.label}
              className={`flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] last:border-0 ${
                lv.type === 'current' ? 'bg-[#00FF8818]' : ''
              }`}
            >
              <span className={`font-mono text-[12px] font-medium tracking-[0.5px] ${TYPE_COLOR[lv.type]}`}>
                {lv.label}
              </span>
              <span className="font-mono text-[13px] font-semibold text-[var(--color-text-muted)]">—</span>
            </div>
          ))}
        </div>

        {/* Moving averages + indicators row */}
        <div className="flex items-center justify-between bg-[var(--color-bg-inset)] border border-[var(--color-border)] px-3 py-2.5">
          {MA_INDICATORS.map((ma) => (
            <div key={ma} className="flex flex-col items-center gap-0.5">
              <span className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-[0.5px]">{ma}</span>
              <span className="font-mono text-[13px] font-semibold text-[var(--color-text-muted)]">—</span>
            </div>
          ))}
        </div>

        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
          * Data teknikal segera hadir — hubungkan penyedia data pasar
        </span>
      </div>
    </div>
  )
}
