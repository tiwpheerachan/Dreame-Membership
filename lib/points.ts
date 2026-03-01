// ============================================================
// Points System Logic
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import type { MemberTier } from '@/types'

const TIER_MULTIPLIER: Record<MemberTier, number> = {
  SILVER:   1.0,
  GOLD:     1.5,
  PLATINUM: 2.0,
}

const TIER_THRESHOLDS = {
  PLATINUM: 2000,
  GOLD:     500,
  SILVER:   0,
}

export function calculatePoints(totalAmount: number, tier: MemberTier): number {
  const base = Math.floor(totalAmount / 100) // 100 THB = 1 point
  const multiplier = TIER_MULTIPLIER[tier] ?? 1.0
  return Math.floor(base * multiplier)
}

export function getTierFromLifetimePoints(lifetimePoints: number): MemberTier {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM'
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD) return 'GOLD'
  return 'SILVER'
}

export function getNextTierInfo(tier: MemberTier, lifetimePoints: number) {
  if (tier === 'PLATINUM') return { nextTier: null, pointsNeeded: 0, progress: 100 }
  if (tier === 'GOLD') {
    const needed = TIER_THRESHOLDS.PLATINUM - lifetimePoints
    const progress = Math.min(100, Math.round((lifetimePoints - 500) / (2000 - 500) * 100))
    return { nextTier: 'PLATINUM' as MemberTier, pointsNeeded: Math.max(0, needed), progress }
  }
  const needed = TIER_THRESHOLDS.GOLD - lifetimePoints
  const progress = Math.min(100, Math.round(lifetimePoints / 500 * 100))
  return { nextTier: 'GOLD' as MemberTier, pointsNeeded: Math.max(0, needed), progress }
}

export async function awardPoints(purchaseRegId: string): Promise<{ points: number; error?: string }> {
  const supabase = createServiceClient()

  try {
    // Get purchase registration
    const { data: reg, error: regErr } = await supabase
      .from('purchase_registrations')
      .select('*, users!inner(tier, total_points, lifetime_points)')
      .eq('id', purchaseRegId)
      .single()

    if (regErr || !reg) return { points: 0, error: 'Purchase not found' }
    if (reg.points_awarded > 0) return { points: 0, error: 'Points already awarded' }

    const user = reg.users as { tier: MemberTier; total_points: number; lifetime_points: number }
    const points = calculatePoints(Number(reg.total_amount), user.tier)

    if (points <= 0) return { points: 0 }

    const newTotal = user.total_points + points
    const newLifetime = user.lifetime_points + points
    const newTier = getTierFromLifetimePoints(newLifetime)

    // Update user points
    await supabase.from('users').update({
      total_points: newTotal,
      lifetime_points: newLifetime,
      tier: newTier,
    }).eq('id', reg.user_id)

    // Log points
    await supabase.from('points_log').insert({
      user_id: reg.user_id,
      purchase_reg_id: purchaseRegId,
      points_delta: points,
      type: 'EARNED',
      description: `ซื้อสินค้า ${reg.model_name || reg.order_sn} ฿${Number(reg.total_amount).toLocaleString()}`,
      balance_after: newTotal,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })

    // Mark points as awarded
    await supabase.from('purchase_registrations').update({ points_awarded: points }).eq('id', purchaseRegId)

    return { points }
  } catch (err) {
    console.error('[Points] awardPoints error:', err)
    return { points: 0, error: 'Internal error' }
  }
}

export async function adjustPoints(
  userId: string,
  delta: number,
  description: string,
  adminId: string
): Promise<{ error?: string }> {
  const supabase = createServiceClient()
  try {
    const { data: user } = await supabase
      .from('users')
      .select('total_points, lifetime_points')
      .eq('id', userId)
      .single()

    if (!user) return { error: 'User not found' }

    const newTotal = Math.max(0, user.total_points + delta)
    const newLifetime = delta > 0 ? user.lifetime_points + delta : user.lifetime_points

    await supabase.from('users').update({
      total_points: newTotal,
      lifetime_points: newLifetime,
      tier: getTierFromLifetimePoints(newLifetime),
    }).eq('id', userId)

    await supabase.from('points_log').insert({
      user_id: userId,
      points_delta: delta,
      type: 'ADMIN_ADJUST',
      description,
      balance_after: newTotal,
    })

    return {}
  } catch (err) {
    return { error: 'Internal error' }
  }
}
