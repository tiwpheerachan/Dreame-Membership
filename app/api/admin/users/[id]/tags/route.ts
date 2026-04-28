import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  if (Array.isArray(body.tags))     updates.tags = body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
  if (typeof body.is_vip === 'boolean')         updates.is_vip = body.is_vip
  if (typeof body.is_blacklisted === 'boolean') updates.is_blacklisted = body.is_blacklisted

  const { error } = await auth.service.from('users').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
