import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteParams = { params: Promise<{ id: string }> }

async function assertEditable(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase
    .from('strategies')
    .select('is_editable')
    .eq('id', id)
    .single()
  if (error || !data) return 'not_found'
  if (!data.is_editable) return 'locked'
  return 'ok'
}

// PATCH /api/strategies/[id] — update name, description, and/or filters
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()

  const guard = await assertEditable(supabase, id)
  if (guard === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guard === 'locked') return NextResponse.json({ error: 'Predefined strategies cannot be modified' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name != null) updates.name = String(body.name).trim()
  if (body.description !== undefined) updates.description = body.description ? String(body.description).trim() : null
  if (body.filters != null) updates.filters = body.filters

  const { data, error } = await supabase
    .from('strategies')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/strategies/[id] — delete a strategy
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()

  const guard = await assertEditable(supabase, id)
  if (guard === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (guard === 'locked') return NextResponse.json({ error: 'Predefined strategies cannot be deleted' }, { status: 403 })

  const { error } = await supabase.from('strategies').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
