// Idempotent fallback: make sure the public.users row exists for the
// currently authenticated user. The DB trigger should already have done this
// at sign-up time; this route exists as a safety net for older accounts and
// for the rare case where trigger fires later than the first request.
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { full_name?: string; phone?: string }

  const service = createServiceClient()

  const { data: existing } = await service
    .from('users').select('id, full_name').eq('id', user.id).maybeSingle()

  if (!existing) {
    await service.from('users').insert({
      id: user.id,
      email: user.email ?? null,
      full_name: body.full_name?.trim() || null,
      phone: body.phone?.trim() || null,
    })
  } else if (!existing.full_name && body.full_name) {
    // Backfill missing name on first sign-in if the client supplied one
    await service.from('users').update({ full_name: body.full_name.trim() }).eq('id', user.id)
  }

  return NextResponse.json({ success: true })
}
