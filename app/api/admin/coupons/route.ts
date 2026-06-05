import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { generateCouponCode } from '@/lib/utils'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  // Cap page size 500 — กัน admin โหลดทั้ง table โดยบังเอิญ
  const pageSize = Math.min(500, Math.max(20, Number(url.searchParams.get('pageSize') || 200)))
  const offset = (page - 1) * pageSize

  const service = createServiceClient()
  const { data: coupons, count } = await service
    .from('coupons')
    .select('*, users(full_name, member_id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)
  return NextResponse.json({
    coupons: coupons || [],
    page, pageSize,
    total: count ?? 0,
    has_more: (count ?? 0) > offset + pageSize,
  })
}

// Generate code that's not already in DB. Retries up to 8 times before giving up.
async function uniqueCode(service: ReturnType<typeof createServiceClient>): Promise<string | null> {
  for (let i = 0; i < 8; i++) {
    const code = generateCouponCode()
    const { data } = await service.from('coupons').select('id').eq('code', code).maybeSingle()
    if (!data) return code
  }
  return null
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { user_id, title, description, discount_type, discount_value, valid_until, min_purchase, theme } = body

  if (!title || !discount_value || !valid_until) {
    return NextResponse.json({ error: 'title, discount_value, valid_until required' }, { status: 400 })
  }
  if (!['PERCENT', 'FIXED'].includes(discount_type)) {
    return NextResponse.json({ error: 'invalid discount_type' }, { status: 400 })
  }
  const value = Number(discount_value)
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: 'discount_value must be positive' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]
  const base = {
    title, description: description || null,
    discount_type,
    discount_value: value,
    min_purchase: Number(min_purchase || 0),
    valid_from: today, valid_until,
    theme: theme || 'black',
    created_by: staff.id,
  }

  // Bulk send to all active users
  if (!user_id) {
    const { data: allUsers } = await service.from('users').select('id').eq('is_active', true)
    const inserts: Array<typeof base & { user_id: string; code: string }> = []
    for (const u of allUsers || []) {
      const code = await uniqueCode(service)
      if (!code) return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 })
      inserts.push({ ...base, user_id: u.id, code })
    }
    const { error } = await service.from('coupons').insert(inserts)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    revalidatePath('/admin/coupons')
    revalidatePath('/admin/members')
    return NextResponse.json({ success: true, count: inserts.length })
  }

  // Single recipient
  const code = await uniqueCode(service)
  if (!code) return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 })
  const { error } = await service.from('coupons').insert({ ...base, user_id, code })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  revalidatePath('/admin/coupons')
  revalidatePath(`/admin/members/${user_id}`)
  return NextResponse.json({ success: true })
}
