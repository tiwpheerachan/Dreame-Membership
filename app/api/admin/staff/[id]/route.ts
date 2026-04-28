import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireSuperAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, role').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff || staff.role !== 'SUPER_ADMIN') return { error: 'SUPER_ADMIN only', status: 403 as const }
  return { service }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const allowed = ['name', 'role', 'channel_access', 'is_active'] as const
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) updates[k] = body[k]

  const { error } = await auth.service.from('admin_staff').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Soft-disable instead of delete (preserve audit_log FKs)
  const { error } = await auth.service.from('admin_staff').update({ is_active: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
