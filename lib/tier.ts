// ============================================================
// Pure tier / points helpers — safe to import from client AND server.
// Don't put DB-touching code here (server-only).
//
// Tier system:
//   SILVER   :   0 –  79 points  · 1.0×  · 200 THB/pt web · 500 THB/pt platform
//   GOLD     :  80 – 399 points  · 1.0×
//   PLATINUM : 400+      points  · 1.2×  (VIP)
// ============================================================
import type { UserTier, SaleChannel } from '@/types'
import { TIER_THRESHOLDS, TIER_MULTIPLIER, EARN_DIVISOR_BY_CHANNEL } from '@/types'

export function normalizeTier(t: string | null | undefined): UserTier {
  const upper = (t || '').toUpperCase()
  if (upper === 'SILVER' || upper === 'PLUS')   return 'SILVER'
  if (upper === 'GOLD'   || upper === 'PRO')    return 'GOLD'
  if (upper === 'PLATINUM' || upper === 'ULTRA' || upper === 'MASTER') return 'PLATINUM'
  return 'SILVER'
}

// Earn formula (must mirror award_points_for_purchase in the 0005 SQL migration).
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
      nextTier: null as UserTier | null,
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
