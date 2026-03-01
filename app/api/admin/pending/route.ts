import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase.from('admin_staff')
    .select('role, channel_access').eq('auth_user_id', session.user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user')

  let query = serviceSupabase
    .from('purchase_registrations')
    .select('*, users!inner(full_name, phone, member_id)')
    .eq('status', 'PENDING')

  if (userId) query = query.eq('user_id', userId)

  // Filter by channel_access if not super admin
  if (staff.role !== 'SUPER_ADMIN') {
    const channelTypes = (staff.channel_access as string[]) || ['ONLINE']
    query = query.in('channel_type', channelTypes)
  }

  const { data } = await query.order('created_at', { ascending: false })
  return NextResponse.json({ pending: data })
}
