// ============================================================
// GET /api/admin/insights/tier-up?window=20
//
// คืน user ที่ใกล้เลื่อน tier ภายใน N คะแนน (default 20)
// ใช้ v_tier_up_forecast view ที่สร้างใน migration 0014
//
// Response:
//   {
//     window: 20,
//     buckets: { critical: [...<5], close: [5-10], soon: [11-20] },
//     totals: { silver_to_gold: N, gold_to_platinum: N }
//   }
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

  const url = new URL(req.url)
  const win = Math.max(1, Math.min(100, Number(url.searchParams.get('window') || 20)))

  const { data, error } = await service
    .from('v_tier_up_forecast')
    .select('id, member_id, full_name, email, phone, current_tier, lifetime_points, next_tier, points_to_next, next_threshold')
    .lte('points_to_next', win)
    .gt('points_to_next', 0)
    .order('points_to_next', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const all = data || []
  const critical = all.filter(u => Number(u.points_to_next) <= 5)
  const close    = all.filter(u => Number(u.points_to_next) > 5  && Number(u.points_to_next) <= 10)
  const soon     = all.filter(u => Number(u.points_to_next) > 10 && Number(u.points_to_next) <= win)

  return NextResponse.json({
    window: win,
    total: all.length,
    buckets: { critical, close, soon },
    totals: {
      silver_to_gold:    all.filter(u => u.current_tier === 'SILVER').length,
      gold_to_platinum:  all.filter(u => u.current_tier === 'GOLD').length,
    },
  })
}
