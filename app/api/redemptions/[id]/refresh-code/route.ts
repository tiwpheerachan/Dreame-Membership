// ============================================================
// POST /api/redemptions/[id]/refresh-code
//
// User clicks "use code" after some time — Shopify product price
// may have changed since redeem. Regenerate code with current price
// so user pays EXACTLY cash_top_up_thb.
//
// Flow:
//   1. Fetch redemption + verify owner
//   2. Skip if already used (status = delivered) or cancelled
//   3. Skip if not POINTS_CASH type
//   4. Fetch current Shopify price
//   5. If price changed → delete old code in Shopify + generate new
//   6. Return latest code + apply_url
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  generateDiscounts, deletePriceRule, buildApplyUrl, buildProductApplyUrl, buildCartApplyUrl, isConfigured,
  DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'
import { fetchShopifyProductPrice } from '@/lib/shopify-price'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // ── 1. Fetch redemption + verify owner ──
  const { data: red } = await service
    .from('redemptions')
    .select('id, user_id, status, reward_id, shopify_code, shopify_apply_url, shopify_price_rule_id, code_expires_at, reward_snapshot')
    .eq('id', params.id)
    .single()
  if (!red || red.user_id !== user.id) {
    return NextResponse.json({ error: 'redemption not found' }, { status: 404 })
  }
  // อนุญาตเฉพาะ 'redeemed' (code ออกแล้วแต่ยังไม่ใช้)
  if (red.status !== 'redeemed') {
    return NextResponse.json({
      error: red.status === 'delivered' ? 'ใช้ code ไปแล้ว' :
             red.status === 'cancelled' ? 'redemption ถูกยกเลิก' :
             red.status === 'expired'   ? 'code หมดอายุแล้ว' :
                                          `redemption status = ${red.status} — refresh ไม่ได้`,
    }, { status: 409 })
  }

  const snapshot = red.reward_snapshot as {
    redeem_type?: string; cash_top_up_thb?: number;
    shopify_product_url?: string; code_validity_days?: number;
  } | null
  if (snapshot?.redeem_type !== 'POINTS_CASH') {
    return NextResponse.json({ error: 'รองรับเฉพาะ Points + Cash' }, { status: 400 })
  }
  if (!snapshot.shopify_product_url) {
    return NextResponse.json({ error: 'ไม่มี product URL' }, { status: 400 })
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Shopify ไม่พร้อม' }, { status: 503 })
  }

  // ── 2. Fetch current price ──
  const live = await fetchShopifyProductPrice(snapshot.shopify_product_url)
  if (!live || live.current_price_thb <= 0) {
    return NextResponse.json({
      error: 'ดึงราคาปัจจุบันไม่ได้ — ใช้ code เดิมก่อน',
      code: red.shopify_code,
      apply_url: red.shopify_apply_url,
    }, { status: 502 })
  }

  const cash = Number(snapshot.cash_top_up_thb || 0)
  if (live.current_price_thb <= cash) {
    return NextResponse.json({
      error: `ราคาปัจจุบัน (฿${live.current_price_thb.toLocaleString()}) ต่ำกว่ายอดที่ต้องจ่าย — ซื้อตรงๆ ดีกว่าใช้ code`,
      live_price: live.current_price_thb,
    }, { status: 400 })
  }

  const newDiscount = live.current_price_thb - cash

  // ── 3. Check ถ้า discount ต่างจาก code เดิม → regenerate ──
  // เก็บ campaign title เดิมแบบ snapshot — ไม่จำเป็นต้อง parse title
  // เราเทียบจาก expires_at — ถ้า code เก่ายังใช้ได้ + discount ตรง → ส่ง code เดิม
  // (ตอนนี้ skip optimization: regenerate เสมอเพื่อความง่าย แต่ผ่อนลงได้ถ้า scale)

  try {
    // ลบ price_rule เก่าใน Shopify (กัน user เผลอใช้)
    if (red.shopify_price_rule_id) {
      try {
        await deletePriceRule(DEFAULT_SHOP_ID, Number(red.shopify_price_rule_id))
      } catch (e) {
        // ถ้าลบไม่ได้ก็ไม่เป็นไร — ตัวใหม่ override
        console.warn('[refresh-code] delete old failed:', (e as Error).message)
      }
    }

    // Generate code ใหม่
    const validityDays = snapshot.code_validity_days || 30
    const endsAt = new Date(Date.now() + validityDays * 86_400_000).toISOString()
    const newCode = `RDM${red.id.slice(0, 6).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`

    const gen = await generateDiscounts({
      shop_id: DEFAULT_SHOP_ID,
      title: `Reward refresh: ${red.id.slice(0, 8)}`,
      value_type: 'fixed_amount',
      value: newDiscount,
      codes: [newCode],
      quantity: 1,
      starts_at: new Date().toISOString(),
      ends_at: endsAt,
      minimum_order_amount: cash,
      usage_limit_per_customer: true,
      usage_limit: 1,
      combines_with: {
        order_discounts: true, product_discounts: false, shipping_discounts: false,
      },
    })

    // Cart permalink (add product + apply code + checkout in one click) when we
    // have the variant; otherwise fall back to /discount/<code>?redirect=product.
    const applyUrl =
      (live.variant_id ? buildCartApplyUrl(snapshot.shopify_product_url, live.variant_id, newCode) : '')
      || buildProductApplyUrl(snapshot.shopify_product_url, newCode)
      || buildApplyUrl(DEFAULT_SHOP_ID, newCode)

    const oldCode = red.shopify_code

    await service.from('redemptions').update({
      shopify_code:          newCode,
      shopify_apply_url:     applyUrl,
      shopify_price_rule_id: gen.price_rule_id,
      code_expires_at:       endsAt,
    }).eq('id', red.id)

    // Keep the coupon in sync — without this the coupon card still shows the OLD
    // code while checkout uses the new one ("โค้ดไม่ตรงกัน"). Update code +
    // apply_url + discount value + expiry so the displayed code == applied code.
    if (oldCode) {
      await service.from('coupons').update({
        code:           newCode,
        apply_url:      applyUrl,
        discount_value: newDiscount,
        valid_until:    endsAt.split('T')[0],
      }).eq('code', oldCode).eq('user_id', user.id)
    }

    return NextResponse.json({
      success:           true,
      code:              newCode,
      apply_url:         applyUrl,
      live_price:        live.current_price_thb,
      cash_top_up:       cash,
      discount_applied:  newDiscount,
      sale_detected:     live.compare_at_price_thb && live.compare_at_price_thb > live.current_price_thb,
      code_expires_at:   endsAt,
    })
  } catch (e) {
    const err = e as ShopifyDiscountError | Error
    return NextResponse.json({
      error: ('detail' in err && err.detail) ? err.detail : err.message,
    }, { status: 500 })
  }
}
