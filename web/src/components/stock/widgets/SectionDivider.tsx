interface Props {
  id:       string
  title:    string
  subtitle: string
}

export function SectionDivider({ id, title, subtitle }: Props) {
  return (
    <div id={id} className="scroll-mt-24 mt-6 mx-4 md:mx-12 border-t-2 border-[var(--color-text-primary)] pt-4 pb-2">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <h2 className="font-display text-[20px] font-bold text-[var(--color-text-primary)] tracking-[-0.5px]">{title}</h2>
        <span className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-[0.5px]">{subtitle}</span>
      </div>
    </div>
  )
}
