import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 1000

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, role').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const all: unknown[] = []
  let from = 0
  const HARD_CAP = 100_000

  while (from < HARD_CAP) {
    const { data, error } = await service
      .from('purchase_registrations')
      .select(`
        order_sn, channel, status, total_amount, points_awarded,
        purchase_date, warranty_end, serial_number, model_name, created_at,
        users!inner(member_id, full_name)
      `)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return NextResponse.json({ purchases: all, count: all.length })
}
