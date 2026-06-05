// GET /api/rewards — list rewards available to current user (สมาชิก)
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service.from('users')
    .select('tier, total_points').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 404 })

  // ใช้ view v_rewards_available (active + ในช่วงเวลา + stock ยังเหลือ)
  // หมายเหตุ: view คืน columns ทั้งหมดของ rewards (ใช้ r.*) — รวม redeem_type/cash/voucher/etc.
  const { data: rewards } = await service.from('v_rewards_available').select('*')

  // ดึง models ของ rewards ที่โผล่
  const { data: models } = await service.from('reward_models')
    .select('*').eq('is_active', true).order('display_order')

  // นับ redemption ของ user ต่อ reward เพื่อโชว์ "เคยแลกกี่ครั้ง"
  const { data: myRedeems } = await service.from('redemptions')
    .select('reward_id, status')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
  const myCounts: Record<string, number> = {}
  for (const r of myRedeems || []) {
    const rid = r.reward_id as string
    myCounts[rid] = (myCounts[rid] || 0) + 1
  }

  // Annotate rewards with eligibility
  const enriched = (rewards || []).map(r => {
    const tiers = (r.allowed_tiers || []) as string[]
    const userTier = profile.tier as string
    const tierOk = tiers.includes(userTier)
    const enoughPoints = (profile.total_points as number) >= (r.points_required as number)
    const myCount = myCounts[r.id as string] || 0
    const limitOk = !r.redemption_limit_per_user || myCount < (r.redemption_limit_per_user as number)
    return {
      ...r,
      can_redeem: tierOk && enoughPoints && limitOk,
      reason_blocked:
        !tierOk        ? `เฉพาะระดับ ${tiers.join('/')}`
      : !enoughPoints  ? `ต้องการเพิ่ม ${(r.points_required as number) - (profile.total_points as number)} แต้ม`
      : !limitOk       ? 'แลกครบโควต้าแล้ว'
      :                  null,
      my_redeem_count: myCount,
    }
  })

  return NextResponse.json({
    profile: { tier: profile.tier, total_points: profile.total_points },
    rewards: enriched,
    models:  models || [],
  })
}
