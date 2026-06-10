import type { CompanyProfileData, Officer } from '@/lib/types/api'

function roleOrder(role: string | null): number {
  if (role === 'director')     return 0
  if (role === 'commissioner') return 1
  return 2
}

interface Props {
  profile: CompanyProfileData | null
  officers: Officer[]
}

export function CompanyProfileWidget({ profile, officers }: Props) {
  const hasData = profile || officers.length > 0
  if (!hasData) return null

  const sorted = [...officers].sort((a, b) => roleOrder(a.role) - roleOrder(b.role))

  return (
    <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] flex flex-col">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">PROFIL PERUSAHAAN</span>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* About */}
        {profile && (
          <div className="flex flex-col gap-2">
            {profile.description && (
              <p className="font-mono text-[13px] text-[var(--color-text-muted)] leading-[1.5]">{profile.description}</p>
            )}
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {profile.website && (
                <span className="font-mono text-[12px]">
                  <span className="text-[var(--color-text-muted)]">Situs Web: </span>
                  <a
                    href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-brand-text)] hover:underline"
                  >
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                </span>
              )}
              {profile.address && (
                <span className="font-mono text-[12px] text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-text-muted)]">Alamat: </span>{profile.address}
                </span>
              )}
              {profile.phone && (
                <span className="font-mono text-[12px] text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-text-muted)]">Telepon: </span>{profile.phone}
                </span>
              )}
              {profile.email && (
                <span className="font-mono text-[12px] text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-text-muted)]">Email: </span>{profile.email}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Management */}
        {sorted.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="font-mono text-[12px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] uppercase">Manajemen</span>
            <div className="grid grid-cols-2 gap-2">
              {sorted.map((o, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 bg-[var(--color-bg-inset)] px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-[13px] font-semibold text-[var(--color-text-primary)] truncate">{o.name}</span>
                    <span className="font-mono text-[12px] text-[var(--color-text-muted)]">{o.title ?? o.role}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {o.is_independent && (
                      <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] border border-[var(--color-brand)]">
                        Independen
                      </span>
                    )}
                    {o.role && (
                      <span className={`font-mono text-[11px] px-1.5 py-0.5 capitalize ${
                        o.role === 'director'
                          ? 'bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] border border-[var(--color-brand)]'
                          : 'bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                      }`}>
                        {o.role}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
