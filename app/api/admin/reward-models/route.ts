// GET / POST /api/admin/reward-models
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

export async function GET() {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { data, error } = await auth.service.from('reward_models')
    .select('*').order('display_order', { ascending: true }).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ models: data || [] })
}

export async function POST(req: Request) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await req.json().catch(() => ({}))
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const insert = {
    name:          String(body.name).trim(),
    slug:          body.slug || String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80),
    description:   body.description || null,
    image_url:     body.image_url || null,
    display_order: body.display_order ?? 0,
    is_active:     body.is_active ?? true,
    created_by:    auth.staff.id,
  }
  const { data, error } = await auth.service.from('reward_models').insert(insert).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/admin/rewards')
  return NextResponse.json({ success: true, model: data })
}
