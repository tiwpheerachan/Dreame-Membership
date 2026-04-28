import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireStaff() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.service
    .from('member_notes')
    .select('id, body, pinned, created_at, staff_id, admin_staff(name)')
    .eq('user_id', params.id)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notes: data })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  if (!body.body) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const { data, error } = await auth.service.from('member_notes').insert({
    user_id: params.id,
    staff_id: auth.staff.id,
    body: String(body.body).trim(),
    pinned: !!body.pinned,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, note: data })
}
