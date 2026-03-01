import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function checkAdmin(req?: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase.from('admin_staff').select('*')
    .eq('auth_user_id', session.user.id).eq('is_active', true).single()
  return staff
}

export async function GET(req: Request) {
  const staff = await checkAdmin()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const tier = searchParams.get('tier') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 20

  const supabase = createServiceClient()
  let query = supabase.from('users').select('*', { count: 'exact' })
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,member_id.ilike.%${q}%`)
  if (tier) query = query.eq('tier', tier)
  const { data: users, count, error } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users, total: count, page, pageSize })
}
