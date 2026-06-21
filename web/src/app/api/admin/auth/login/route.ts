import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME, signAdminToken } from '@/lib/admin/auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const password = String(body?.password ?? '')
    const expected = process.env.ADMIN_PASSWORD
    if (!expected) {
      return NextResponse.json(
        { ok: false, error: 'Admin auth not configured: set ADMIN_PASSWORD' },
        { status: 500 }
      )
    }
    if (!password || password !== expected) {
      return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 })
    }

    const token = signAdminToken('local-admin')
    const res = NextResponse.json({ ok: true })
    res.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

