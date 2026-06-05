// ============================================================
// GET /api/redemptions/[id]/live-price
//
// เร็ว / read-only — แค่ fetch ราคาปัจจุบันจาก Shopify product JSON
// ใช้บน /coupons ตอน render เพื่อแสดง "ราคาตอนนี้ + จ่ายเท่าไหร่"
//
// ไม่ regenerate code (ทำตอน user กด ใช้ เท่านั้น → endpoint refresh-code)
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { fetchShopifyProductPrice } from '@/lib/shopify-price'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: red } = await supabase
    .from('redemptions')
    .select('id, user_id, status, reward_id, reward_snapshot')
    .eq('id', params.id).single()
  if (!red || red.user_id !== user.id) {
    return NextResponse.json({ error: 'redemption not found' }, { status: 404 })
  }

  const snap = (red.reward_snapshot || {}) as {
    redeem_type?: string;
    shopify_product_url?: string;
    cash_top_up_thb?: number;
    original_price_thb?: number;
  }

  // ── Fallback: ถ้า snapshot ไม่ครบ (เคส redeemed ก่อน migration 0018) ──
  // ดึงจาก rewards table โดยตรง
  let redeemType        = snap.redeem_type
  let productUrl        = snap.shopify_product_url
  let cashTopUp         = snap.cash_top_up_thb
  let originalPrice     = snap.original_price_thb

  if (!redeemType || !productUrl || cashTopUp == null) {
    const service = createServiceClient()
    const { data: reward } = await service
      .from('rewards')
      .select('redeem_type, shopify_product_url, cash_top_up_thb, original_price_thb')
      .eq('id', red.reward_id as string).single()
    if (reward) {
      redeemType    = redeemType    || (reward.redeem_type as string)
      productUrl    = productUrl    || (reward.shopify_product_url as string | null) || undefined
      cashTopUp     = cashTopUp     ?? (reward.cash_top_up_thb as number | null) ?? undefined
      originalPrice = originalPrice ?? (reward.original_price_thb as number | null) ?? undefined
    }
  }

  if (redeemType !== 'POINTS_CASH') {
    return NextResponse.json({ error: 'รองรับเฉพาะ POINTS_CASH', redeem_type: redeemType }, { status: 400 })
  }
  if (!productUrl) {
    return NextResponse.json({ error: 'no product URL', cash_top_up: cashTopUp || 0 }, { status: 400 })
  }
  if (cashTopUp == null) {
    return NextResponse.json({ error: 'no cash_top_up configured' }, { status: 400 })
  }

  const live = await fetchShopifyProductPrice(productUrl)
  if (!live) {
    return NextResponse.json({
      success: false,
      fallback_price: originalPrice || null,
      cash_top_up:    cashTopUp,
      note: 'fetch fail — fallback to original',
    })
  }

  return NextResponse.json({
    success:           true,
    current_price:     live.current_price_thb,
    compare_at_price:  live.compare_at_price_thb,
    available:         live.available,
    cash_top_up:       cashTopUp,
  })
}
