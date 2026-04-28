import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ members: [], purchases: [], coupons: [] })

  const term = `%${q}%`

  const [{ data: members }, { data: purchases }, { data: coupons }] = await Promise.all([
    service.from('users')
      .select('id, member_id, full_name, phone, email, tier, total_points')
      .or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term},member_id.ilike.${term}`)
      .limit(8),
    service.from('purchase_registrations')
      .select('id, order_sn, model_name, serial_number, user_id, status')
      .or(`order_sn.ilike.${term},serial_number.ilike.${term},model_name.ilike.${term}`)
      .limit(8),
    service.from('coupons')
      .select('id, code, title')
      .or(`code.ilike.${term},title.ilike.${term}`)
      .limit(8),
  ])

  return NextResponse.json({
    members:   members ?? [],
    purchases: purchases ?? [],
    coupons:   coupons ?? [],
  })
}
