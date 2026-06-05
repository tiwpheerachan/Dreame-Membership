// GET /api/admin/redemptions — list all + join user + reward
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

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const pageSize = Math.min(500, Math.max(20, Number(url.searchParams.get('pageSize') || 100)))
  const offset = (page - 1) * pageSize

  let q = service.from('redemptions')
    .select('*, users(id, full_name, member_id, tier, phone), rewards(id, name, image_url)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)
  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    redemptions: data || [],
    page, pageSize,
    total: count ?? 0,
    has_more: (count ?? 0) > offset + pageSize,
  })
}
