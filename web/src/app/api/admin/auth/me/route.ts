import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })
  return NextResponse.json({ ok: true, subject: guard.subject })
}

