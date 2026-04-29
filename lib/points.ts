// ============================================================
// Points System — thin wrappers around DB functions for atomicity.
// Heavy lifting lives in PostgreSQL functions (see latest migration):
//   - award_points_for_purchase(p_purchase_reg_id UUID) RETURNS INTEGER
//   - adjust_user_points(p_user_id UUID, p_delta INTEGER) RETURNS INTEGER
//
// Tier system (Migration 0005):
//   SILVER   :   0 –  79 points  · 1.0x · 200 THB/pt web · 500 THB/pt platform
//   GOLD     :  80 – 399 points  · 1.0x
//   PLATINUM : 400+      points  · 1.2x  (VIP)
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import type { UserTier, SaleChannel } from '@/types'
import {
  TIER_THRESHOLDS,
  TIER_MULTIPLIER,
  EARN_DIVISOR_BY_CHANNEL,
} from '@/types'

// Map any historical tier name to the current 3-tier system
export function normalizeTier(t: string): UserTier {
  const upper = (t || '').toUpperCase()
  if (upper === 'SILVER' || upper === 'PLUS')   return 'SILVER'
  if (upper === 'GOLD'   || upper === 'PRO')    return 'GOLD'
  if (upper === 'PLATINUM' || upper === 'ULTRA' || upper === 'MASTER') return 'PLATINUM'
  return 'SILVER'
}

// ----------------------------------------------------------------
// Earn formula (must mirror award_points_for_purchase in 0005 SQL)
// ----------------------------------------------------------------
export function calculatePoints(
  totalAmount: number,
  tier: UserTier | string,
  channel: SaleChannel | string = 'OTHER',
): number {
  const t = normalizeTier(String(tier))
  const c = String(channel).toUpperCase() as SaleChannel
  const divisor = EARN_DIVISOR_BY_CHANNEL[c] ?? 500
  const base = Math.floor(totalAmount / divisor)
  const multiplier = TIER_MULTIPLIER[t] ?? 1.0
  return Math.floor(base * multiplier)
}

export function getTierFromLifetimePoints(lifetimePoints: number): UserTier {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM'
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD)     return 'GOLD'
  return 'SILVER'
}

export function getNextTierInfo(tier: UserTier | string, lifetimePoints: number) {
  const t = normalizeTier(String(tier))
  if (t === 'PLATINUM') {
    return {
      nextTier: null,
      pointsNeeded: 0, progress: 100,
      fromPoints: TIER_THRESHOLDS.PLATINUM,
      toPoints:   TIER_THRESHOLDS.PLATINUM,
    }
  }
  if (t === 'GOLD') {
    const from = TIER_THRESHOLDS.GOLD
    const to   = TIER_THRESHOLDS.PLATINUM
    const need = Math.max(0, to - lifetimePoints)
    const progress = Math.min(100, Math.round(((lifetimePoints - from) / (to - from)) * 100))
    return { nextTier: 'PLATINUM' as UserTier, pointsNeeded: need, progress, fromPoints: from, toPoints: to }
  }
  // SILVER
  const from = TIER_THRESHOLDS.SILVER
  const to   = TIER_THRESHOLDS.GOLD
  const need = Math.max(0, to - lifetimePoints)
  const progress = Math.min(100, Math.round((lifetimePoints / to) * 100))
  return { nextTier: 'GOLD' as UserTier, pointsNeeded: need, progress, fromPoints: from, toPoints: to }
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
