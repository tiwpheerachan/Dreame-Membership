import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, getRateKey } from '@/lib/rate-limit'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 60 req/min per user — กัน UI poll หรือ abuse
  const rl = rateLimit({ key: getRateKey(req, user.id), limit: 60, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429, headers: rl.headers })
  }

  // Self-heal: ถ้า user ยังไม่มีคูปองเลย (เคสบัญชีเก่าก่อน migration)
  // ลองออกคูปองที่สมควรมีก่อน — idempotent ผ่าน auto_issue_key
  const { count: existingCount } = await supabase
    .from('coupons')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (existingCount === 0) {
    try {
      const service = createServiceClient()
      await service.rpc('self_heal_user_coupons', { p_user_id: user.id })
    } catch {
      // self_heal function might not exist on stale DB — fall through
    }
  }

  const { data: coupons } = await supabase
    .from('coupons').select('*')
    .eq('user_id', user.id)
    .order('valid_until', { ascending: true })

  // ── Enrich reward-linked coupons with redemption snapshot (สำหรับ realtime price)
  const rewardCodes = (coupons || [])
    .filter(c => c.auto_issue_key?.startsWith?.('REWARD_'))
    .map(c => c.code as string)

  let redemptionByCode: Record<string, {
    redemption_id: string;
    redeem_type: 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM';
    cash_top_up_thb: number | null;
    shopify_product_url: string | null;
    code_expires_at: string | null;
  }> = {}

  if (rewardCodes.length > 0) {
    const service = createServiceClient()
    const { data: reds } = await service
      .from('redemptions')
      .select('id, shopify_code, reward_id, code_expires_at, reward_snapshot')
      .in('shopify_code', rewardCodes)
      .eq('user_id', user.id)

    // Fallback: snapshot incomplete → bulk fetch rewards
    const incompleteRewardIds: string[] = []
    for (const r of reds || []) {
      const snap = (r.reward_snapshot || {}) as { redeem_type?: string; cash_top_up_thb?: number; shopify_product_url?: string }
      if (!snap.redeem_type || snap.cash_top_up_thb == null || !snap.shopify_product_url) {
        if (r.reward_id) incompleteRewardIds.push(r.reward_id as string)
      }
    }
    let rewardLookup: Record<string, { redeem_type: string; cash_top_up_thb: number | null; shopify_product_url: string | null }> = {}
    if (incompleteRewardIds.length > 0) {
      const { data: rewards } = await service.from('rewards')
        .select('id, redeem_type, cash_top_up_thb, shopify_product_url')
        .in('id', incompleteRewardIds)
      for (const rw of rewards || []) {
        rewardLookup[rw.id as string] = {
          redeem_type:         rw.redeem_type as string,
          cash_top_up_thb:     rw.cash_top_up_thb as number | null,
          shopify_product_url: rw.shopify_product_url as string | null,
        }
      }
    }

    for (const r of reds || []) {
      const code = r.shopify_code as string
      const snap = (r.reward_snapshot || {}) as {
        redeem_type?: 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM';
        cash_top_up_thb?: number;
        shopify_product_url?: string;
      }
      const fallback = r.reward_id ? rewardLookup[r.reward_id as string] : undefined
      redemptionByCode[code] = {
        redemption_id:        r.id as string,
        redeem_type:          (snap.redeem_type || fallback?.redeem_type || 'VOUCHER') as 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM',
        cash_top_up_thb:      snap.cash_top_up_thb ?? fallback?.cash_top_up_thb ?? null,
        shopify_product_url:  snap.shopify_product_url ?? fallback?.shopify_product_url ?? null,
        code_expires_at:      (r.code_expires_at as string | null) ?? null,
      }
    }
  }

  const enriched = (coupons || []).map(c => ({
    ...c,
    reward_meta: redemptionByCode[c.code as string] || null,
  }))

  return NextResponse.json({ coupons: enriched }, { headers: rl.headers })
}
