// PATCH / DELETE /api/admin/reward-models/[id]
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

async function authStaff() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  for (const k of ['name', 'slug', 'description', 'image_url', 'display_order', 'is_active']) {
    if (k in body) patch[k] = body[k]
  }
  const { error } = await auth.service.from('reward_models').update(patch).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/admin/rewards')
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  // Soft = is_active false (rewards FK SET NULL on delete แต่เราเลี่ยง destructive)
  const { error } = await auth.service.from('reward_models').update({ is_active: false }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/admin/rewards')
  return NextResponse.json({ success: true })
}
