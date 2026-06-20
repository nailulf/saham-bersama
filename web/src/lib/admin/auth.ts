import crypto from 'crypto'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'sb_admin'

type AdminTokenPayload = {
  sub: string
  iat: number
  exp: number
}

function base64url(input: Buffer | string) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function fromBase64url(input: string) {
  const padded = input.replaceAll('-', '+').replaceAll('_', '/')
  const padLen = (4 - (padded.length % 4)) % 4
  return Buffer.from(padded + '='.repeat(padLen), 'base64')
}

function getSecret() {
  return (
    process.env.ADMIN_AUTH_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'dev-admin-secret'
  )
}

export function signAdminToken(subject: string, ttlSeconds = 60 * 60 * 24 * 7) {
  const now = Math.floor(Date.now() / 1000)
  const payload: AdminTokenPayload = {
    sub: subject,
    iat: now,
    exp: now + ttlSeconds,
  }
  const body = base64url(JSON.stringify(payload))
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest()
  return `${body}.${base64url(sig)}`
}

export function verifyAdminToken(token: string) {
  const parts = token.split('.')
  if (parts.length !== 2) return { ok: false as const, reason: 'malformed' as const }
  const [body, sig] = parts

  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest()
  const provided = fromBase64url(sig)
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return { ok: false as const, reason: 'bad_signature' as const }
  }

  let payload: AdminTokenPayload
  try {
    payload = JSON.parse(fromBase64url(body).toString('utf8')) as AdminTokenPayload
  } catch {
    return { ok: false as const, reason: 'bad_payload' as const }
  }

  if (!payload?.sub || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    return { ok: false as const, reason: 'bad_payload' as const }
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.exp <= now) return { ok: false as const, reason: 'expired' as const }

  return { ok: true as const, payload }
}

export function getAdminTokenFromRequest(req: NextRequest) {
  return req.cookies.get(COOKIE_NAME)?.value || null
}

export function assertAdmin(req: NextRequest) {
  const token = getAdminTokenFromRequest(req)
  if (!token) return { ok: false as const, status: 401 as const, error: 'Missing admin session' }

  const verified = verifyAdminToken(token)
  if (!verified.ok) return { ok: false as const, status: 401 as const, error: `Invalid admin session (${verified.reason})` }

  return { ok: true as const, subject: verified.payload.sub }
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME
