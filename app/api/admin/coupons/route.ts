import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateCouponCode } from '@/lib/utils'

export async function GET() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const { data: coupons } = await serviceSupabase
    .from('coupons').select('*, users(full_name, member_id)').order('created_at', { ascending: false })
  return NextResponse.json({ coupons })
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase.from('admin_staff')
    .select('id').eq('auth_user_id', session.user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { user_id, title, description, discount_type, discount_value, valid_until, min_purchase } = body

  if (!title || !discount_value || !valid_until) {
    return NextResponse.json({ error: 'title, discount_value, valid_until required' }, { status: 400 })
  }

  // If no user_id, send to all active users
  if (!user_id) {
    const { data: allUsers } = await serviceSupabase.from('users').select('id').eq('is_active', true)
    const inserts = (allUsers || []).map(u => ({
      user_id: u.id, code: generateCouponCode(), title, description,
      discount_type, discount_value: Number(discount_value),
      min_purchase: Number(min_purchase || 0), valid_from: new Date().toISOString().split('T')[0],
      valid_until, created_by: staff.id,
    }))
    const { error } = await serviceSupabase.from('coupons').insert(inserts)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, count: inserts.length })
  }

  const { error } = await serviceSupabase.from('coupons').insert({
    user_id, code: generateCouponCode(), title, description,
    discount_type, discount_value: Number(discount_value),
    min_purchase: Number(min_purchase || 0), valid_from: new Date().toISOString().split('T')[0],
    valid_until, created_by: staff.id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
