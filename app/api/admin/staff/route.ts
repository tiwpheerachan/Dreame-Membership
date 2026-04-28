import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function requireSuperAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, role').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff || staff.role !== 'SUPER_ADMIN') {
    return { error: 'SUPER_ADMIN only', status: 403 as const }
  }
  return { service, staff }
}

export async function GET() {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { data, error } = await auth.service
    .from('admin_staff')
    .select('id, name, email, role, channel_access, is_active, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ staff: data })
}

export async function POST(req: Request) {
  const auth = await requireSuperAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const { email, name, role, channel_access } = body
  if (!email || !name || !role) {
    return NextResponse.json({ error: 'email, name, role required' }, { status: 400 })
  }

  // Find auth user by email
  const { data: authUsers, error: listErr } = await auth.service.auth.admin.listUsers()
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

  const target = authUsers.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase())
  if (!target) {
    return NextResponse.json({ error: 'ไม่พบ user ตาม email — user ต้อง register/login ระบบก่อน' }, { status: 404 })
  }

  const { data, error } = await auth.service.from('admin_staff').insert({
    auth_user_id: target.id,
    email: target.email,
    name,
    role,
    channel_access: channel_access || ['ONLINE'],
    is_active: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, staff: data })
}
