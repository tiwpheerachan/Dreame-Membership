// ============================================================
// Points System — server-side DB wrappers (atomic, idempotent).
// Pure tier / points math lives in lib/tier.ts so client components
// can use it without dragging next/headers into the bundle.
//
// Heavy lifting lives in PostgreSQL functions (see latest migration):
//   - award_points_for_purchase(p_purchase_reg_id UUID) RETURNS INTEGER
//   - adjust_user_points(p_user_id UUID, p_delta INTEGER) RETURNS INTEGER
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'

// Re-export the pure helpers so existing server-side import sites
// (`from '@/lib/points'`) keep working unchanged.
export {
  normalizeTier,
  calculatePoints,
  getTierFromLifetimePoints,
  getNextTierInfo,
} from '@/lib/tier'

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
