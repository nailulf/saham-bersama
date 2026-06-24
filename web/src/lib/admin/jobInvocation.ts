import type { JobDef } from './jobs'

export type Invocation =
  | { ok: true; args: string[]; env: Record<string, string>; provided: string[] }
  | { ok: false; error: string }

// Turn supplied param values into spawn args + env. This is the security
// boundary: only flags declared in the job's params reach the process, and
// secrets only ever go to env (never an argv element, never logged).
export function buildJobInvocation(job: JobDef, params: Record<string, unknown>): Invocation {
  const args = [...job.flags]
  const env: Record<string, string> = {}
  const provided: string[] = []

  for (const def of job.params ?? []) {
    const raw = params[def.name]

    if (def.kind === 'secret') {
      const v = raw == null ? '' : String(raw).trim()
      if (!v) {
        if (def.required) return { ok: false, error: `${def.label} is required` }
        continue
      }
      env[def.env] = v
      provided.push(def.name)
    } else if (def.kind === 'select') {
      const v = raw == null || raw === '' ? def.default : String(raw)
      if (!def.options.includes(v)) {
        return { ok: false, error: `Invalid ${def.label}: ${v}` }
      }
      args.push(def.flag, v)
    } else {
      let n = Math.round(Number(raw ?? def.default))
      if (!Number.isFinite(n)) n = def.default
      n = Math.min(def.max, Math.max(def.min, n))
      args.push(def.flag, String(n))
    }
  }

  return { ok: true, args, env, provided }
}
