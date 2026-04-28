// ============================================================
// Points System — thin wrappers around DB functions for atomicity.
// Heavy lifting lives in PostgreSQL functions (see supabase/schema.sql):
//   - award_points_for_purchase(p_purchase_reg_id UUID) RETURNS INTEGER
//   - adjust_user_points(p_user_id UUID, p_delta INTEGER) RETURNS INTEGER
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import type { UserTier } from '@/types'

const TIER_MULTIPLIER: Record<UserTier, number> = {
  PLUS:   1.0,
  PRO:    1.25,
  ULTRA:  1.5,
  MASTER: 2.0,
}

const TIER_THRESHOLDS = {
  MASTER: 3501,
  ULTRA:  1501,
  PRO:    501,
  PLUS:   0,
}

// Map legacy enum values to new tiers (DB still accepts both)
function normalizeTier(t: string): UserTier {
  const upper = (t || '').toUpperCase()
  if (upper === 'PLATINUM') return 'MASTER'
  if (upper === 'GOLD')     return 'PRO'
  if (upper === 'SILVER')   return 'PLUS'
  if (['PLUS','PRO','ULTRA','MASTER'].includes(upper)) return upper as UserTier
  return 'PLUS'
}

export function calculatePoints(totalAmount: number, tier: UserTier | string): number {
  const t = normalizeTier(String(tier))
  const base = Math.floor(totalAmount / 100) // 100 THB = 1 point
  const multiplier = TIER_MULTIPLIER[t] ?? 1.0
  return Math.floor(base * multiplier)
}

export function getTierFromLifetimePoints(lifetimePoints: number): UserTier {
  if (lifetimePoints >= TIER_THRESHOLDS.MASTER) return 'MASTER'
  if (lifetimePoints >= TIER_THRESHOLDS.ULTRA)  return 'ULTRA'
  if (lifetimePoints >= TIER_THRESHOLDS.PRO)    return 'PRO'
  return 'PLUS'
}

export function getNextTierInfo(tier: UserTier | string, lifetimePoints: number) {
  const t = normalizeTier(String(tier))
  if (t === 'MASTER') return { nextTier: null, pointsNeeded: 0, progress: 100, fromPoints: 3500, toPoints: 3500 }
  if (t === 'ULTRA') {
    const from = TIER_THRESHOLDS.ULTRA
    const to   = TIER_THRESHOLDS.MASTER
    const need = Math.max(0, to - lifetimePoints)
    const progress = Math.min(100, Math.round(((lifetimePoints - from) / (to - from)) * 100))
    return { nextTier: 'MASTER' as UserTier, pointsNeeded: need, progress, fromPoints: from, toPoints: to }
  }
  if (t === 'PRO') {
    const from = TIER_THRESHOLDS.PRO
    const to   = TIER_THRESHOLDS.ULTRA
    const need = Math.max(0, to - lifetimePoints)
    const progress = Math.min(100, Math.round(((lifetimePoints - from) / (to - from)) * 100))
    return { nextTier: 'ULTRA' as UserTier, pointsNeeded: need, progress, fromPoints: from, toPoints: to }
  }
  // PLUS
  const from = TIER_THRESHOLDS.PLUS
  const to   = TIER_THRESHOLDS.PRO
  const need = Math.max(0, to - lifetimePoints)
  const progress = Math.min(100, Math.round((lifetimePoints / to) * 100))
  return { nextTier: 'PRO' as UserTier, pointsNeeded: need, progress, fromPoints: from, toPoints: to }
}

// Atomic, idempotent. Returns awarded points (0 if already awarded).
export async function awardPoints(purchaseRegId: string): Promise<{ points: number; error?: string }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('award_points_for_purchase', {
    p_purchase_reg_id: purchaseRegId,
  })
  if (error) {
    console.error('[Points] awardPoints rpc error:', error)
    return { points: 0, error: error.message }
  }
  return { points: Number(data) || 0 }
}

// Atomic admin point adjustment. Returns updated total_points.
export async function adjustPoints(
  userId: string,
  delta: number,
  description: string,
  adminId: string,
): Promise<{ error?: string }> {
  if (!Number.isFinite(delta) || delta === 0) return { error: 'invalid delta' }
  const supabase = createServiceClient()

  const { data: newTotal, error: rpcError } = await supabase.rpc('adjust_user_points', {
    p_user_id: userId,
    p_delta:   Math.trunc(delta),
  })
  if (rpcError) {
    console.error('[Points] adjustPoints rpc error:', rpcError)
    return { error: rpcError.message }
  }
  if (newTotal === null) return { error: 'User not found' }

  const { error: logError } = await supabase.from('points_log').insert({
    user_id:       userId,
    points_delta:  Math.trunc(delta),
    type:          'ADMIN_ADJUST',
    description,
    balance_after: newTotal,
    adjusted_by:   adminId,
  })
  if (logError) {
    console.error('[Points] points_log insert error:', logError)
  }
  return {}
}
