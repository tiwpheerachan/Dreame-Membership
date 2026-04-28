import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateCouponCode } from '@/lib/utils'

interface Body {
  // segment criteria
  tier?: string
  min_lifetime?: number
  max_lifetime?: number
  no_purchase_days?: number   // last purchase older than X days (or never)
  has_tag?: string
  is_vip?: boolean
  // coupon spec
  title: string
  description?: string
  discount_type: 'PERCENT' | 'FIXED'
  discount_value: number
  min_purchase?: number
  valid_until: string
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: Body = await req.json().catch(() => ({}))
  if (!body.title || !body.discount_value || !body.valid_until) {
    return NextResponse.json({ error: 'title, discount_value, valid_until required' }, { status: 400 })
  }

  // Build user query
  let q = service.from('users').select('id, lifetime_points').eq('is_active', true)
  if (body.tier)         q = q.eq('tier', body.tier)
  if (body.min_lifetime !== undefined) q = q.gte('lifetime_points', body.min_lifetime)
  if (body.max_lifetime !== undefined) q = q.lte('lifetime_points', body.max_lifetime)
  if (body.has_tag)      q = q.contains('tags', [body.has_tag])
  if (body.is_vip)       q = q.eq('is_vip', true)

  const { data: targets, error: qErr } = await q
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

  let users = targets || []

  // Filter by recency if requested
  if (body.no_purchase_days != null) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - Number(body.no_purchase_days))
    const { data: recentBuyers } = await service.from('purchase_registrations')
      .select('user_id').gte('purchase_date', cutoff.toISOString().split('T')[0])
    const recentSet = new Set((recentBuyers || []).map(r => r.user_id))
    users = users.filter(u => !recentSet.has(u.id))
  }

  if (users.length === 0) {
    return NextResponse.json({ message: 'ไม่พบ user ตรงเงื่อนไข', count: 0 })
  }

  const today = new Date().toISOString().split('T')[0]
  const inserts = users.map(u => ({
    user_id: u.id,
    code: generateCouponCode(),
    title: body.title,
    description: body.description || null,
    discount_type: body.discount_type,
    discount_value: Number(body.discount_value),
    min_purchase: Number(body.min_purchase || 0),
    valid_from: today,
    valid_until: body.valid_until,
    created_by: staff.id,
  }))

  const { error: insErr } = await service.from('coupons').insert(inserts)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    target_count: users.length,
  })
}

// Preview only (no insert)
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  let q = service.from('users').select('id, lifetime_points', { count: 'exact', head: true }).eq('is_active', true)
  if (searchParams.get('tier'))         q = q.eq('tier', searchParams.get('tier'))
  if (searchParams.get('min_lifetime')) q = q.gte('lifetime_points', Number(searchParams.get('min_lifetime')))
  if (searchParams.get('max_lifetime')) q = q.lte('lifetime_points', Number(searchParams.get('max_lifetime')))
  if (searchParams.get('has_tag'))      q = q.contains('tags', [searchParams.get('has_tag')])
  if (searchParams.get('is_vip') === 'true') q = q.eq('is_vip', true)

  const { count } = await q
  return NextResponse.json({ estimated: count ?? 0 })
}
