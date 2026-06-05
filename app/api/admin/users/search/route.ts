// ============================================================
// GET /api/admin/users/search?q=...
//
// Lightweight user search สำหรับ admin pickers
// (reassign coupon, tag user เป็น recipient ฯลฯ)
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ users: [] })

  // PostgREST OR query — escape * และ , เพื่อกัน abuse
  const safe = q.replace(/[%_,*]/g, '')
  const pattern = `%${safe}%`

  const { data, error } = await service
    .from('users')
    .select('id, member_id, full_name, email, phone, tier')
    .or(`full_name.ilike.${pattern},member_id.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
    .eq('is_active', true)
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data || [] })
}
