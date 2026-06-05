// ============================================================
// POST /api/admin/redemptions/[id]/regenerate-code
//
// Admin regenerate Shopify code สำหรับ redemption ที่ code gen ล้มเหลว
// (POINTS_CASH / VOUCHER เท่านั้น) — ใช้ logic เดียวกับ user redeem flow
// แต่ไม่หัก points ใหม่ (points หักไปแล้วตอน user กด)
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'
import {
  generateDiscounts, buildApplyUrl, isConfigured,
  DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'
import { fetchShopifyProductPrice } from '@/lib/shopify-price'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Shopify ไม่พร้อม' }, { status: 503 })
  }

  const { data: red } = await service
    .from('redemptions')
    .select('id, user_id, status, reward_id, shopify_code, reward_snapshot')
    .eq('id', params.id).single()
  if (!red) return NextResponse.json({ error: 'redemption not found' }, { status: 404 })
  if (red.shopify_code) {
    return NextResponse.json({ error: 'มี code อยู่แล้ว — ใช้ refresh แทน' }, { status: 409 })
  }

  const snapshot = red.reward_snapshot as {
    redeem_type?: 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM';
    cash_top_up_thb?: number; voucher_value_thb?: number;
    voucher_min_purchase_thb?: number;
    shopify_product_url?: string; code_validity_days?: number; original_price_thb?: number;
  } | null
  if (!snapshot || (snapshot.redeem_type !== 'POINTS_CASH' && snapshot.redeem_type !== 'VOUCHER')) {
    return NextResponse.json({ error: 'รองรับเฉพาะ POINTS_CASH / VOUCHER' }, { status: 400 })
  }

  try {
    const validityDays = snapshot.code_validity_days || 30
    const endsAt = new Date(Date.now() + validityDays * 86_400_000).toISOString()
    const memberCode = `RDM${red.id.slice(0, 6).toUpperCase()}R${Date.now().toString(36).slice(-2).toUpperCase()}`

    // หา discount value
    let discountValue: number
    let minPurchase: number | undefined
    let productUrl: string | null = null

    if (snapshot.redeem_type === 'POINTS_CASH') {
      const cash = Number(snapshot.cash_top_up_thb || 0)
      let effective = Number(snapshot.original_price_thb || 0)
      if (snapshot.shopify_product_url) {
        const live = await fetchShopifyProductPrice(snapshot.shopify_product_url)
        if (live && live.current_price_thb > 0) effective = live.current_price_thb
      }
      if (effective <= cash) throw new Error(`ราคาปัจจุบัน (฿${effective.toLocaleString()}) ≤ cash top-up`)
      discountValue = effective - cash
      minPurchase = cash
      productUrl = snapshot.shopify_product_url || null
    } else {
      discountValue = Number(snapshot.voucher_value_thb || 0)
      minPurchase = Number(snapshot.voucher_min_purchase_thb || 0) || undefined
    }
    if (discountValue <= 0) throw new Error('discount value invalid')

    const gen = await generateDiscounts({
      shop_id: DEFAULT_SHOP_ID,
      title: `Reward regen: ${red.id.slice(0, 8)}`,
      value_type: 'fixed_amount',
      value: discountValue,
      codes: [memberCode],
      quantity: 1,
      starts_at: new Date().toISOString(),
      ends_at: endsAt,
      minimum_order_amount: minPurchase,
      usage_limit_per_customer: true,
      usage_limit: 1,
      combines_with: { order_discounts: true, product_discounts: false, shipping_discounts: false },
    })
    const applyUrl = buildApplyUrl(DEFAULT_SHOP_ID, memberCode)

    await service.from('redemptions').update({
      shopify_code:          memberCode,
      shopify_apply_url:     applyUrl,
      shopify_price_rule_id: gen.price_rule_id,
      code_expires_at:       endsAt,
      generation_failed_at:  null,
      last_generation_error: null,
      status:                'redeemed',
    }).eq('id', red.id)

    // เพิ่ม coupon row ให้ user เห็นที่ /coupons (ถ้ายังไม่มี)
    const today = new Date().toISOString().split('T')[0]
    await service.from('coupons').insert({
      user_id: red.user_id,
      code: memberCode,
      title: `🎁 ${(snapshot as { name?: string }).name || 'reward'} (regen)`,
      discount_type: 'FIXED',
      discount_value: discountValue,
      min_purchase: minPurchase || 0,
      valid_from: today,
      valid_until: endsAt.split('T')[0],
      theme: snapshot.redeem_type === 'POINTS_CASH' ? 'gold' : 'rose',
      shopify_shop_id: DEFAULT_SHOP_ID,
      shopify_price_rule_id: gen.price_rule_id,
      apply_url: productUrl || applyUrl,
      shopify_synced_at: new Date().toISOString(),
      auto_issue_key: `REWARD_REGEN_${red.id}`,
    })

    await logAdminAction({
      staffId: staff.id, action: 'COUPON_SHOPIFY_BATCH_CREATED',
      targetType: 'redemption', targetId: red.id,
      detail: { staff_name: staff.name, operation: 'regenerate_code', code: memberCode },
    })

    revalidatePath('/admin/redemptions')
    revalidatePath('/redemptions')
    revalidatePath('/coupons')

    return NextResponse.json({
      success: true,
      code: memberCode,
      apply_url: applyUrl,
      discount_value: discountValue,
      expires_at: endsAt,
    })
  } catch (e) {
    const err = e as ShopifyDiscountError | Error
    const msg = ('detail' in err && err.detail) ? err.detail : err.message
    await service.from('redemptions').update({
      generation_failed_at:  new Date().toISOString(),
      last_generation_error: msg,
    }).eq('id', red.id)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
