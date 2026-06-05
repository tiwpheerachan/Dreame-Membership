// POST /api/rewards/[id]/redeem
//
// 3 modes handled here:
//   • POINTS_CASH → generate Shopify code = (original - cash_top_up) off, single use
//   • VOUCHER     → generate Shopify code = voucher_value fixed off, single use
//   • PREMIUM     → no code, admin ships directly

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { rateLimit, getRateKey } from '@/lib/rate-limit'
import {
  generateDiscounts, buildApplyUrl, isConfigured,
  DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'
import { fetchShopifyProductPrice } from '@/lib/shopify-price'

export const dynamic = 'force-dynamic'

interface Body {
  shipping_name:         string
  shipping_phone:        string
  shipping_address:      string
  shipping_subdistrict?: string
  shipping_district:     string
  shipping_province:     string
  shipping_postcode:     string
  shipping_note?:        string
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // กัน spam — 5/min
  const rl = rateLimit({ key: getRateKey(req, user.id), limit: 5, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited — รอ 1 นาที' },
      { status: 429, headers: rl.headers })
  }

  const body = await req.json().catch(() => ({})) as Partial<Body>

  const service = createServiceClient()

  // ── 1. Call RPC ──
  const { data, error } = await service.rpc('redeem_reward', {
    p_user_id:              user.id,
    p_reward_id:            params.id,
    p_shipping_name:        body.shipping_name || '',
    p_shipping_phone:       body.shipping_phone || '',
    p_shipping_address:     body.shipping_address || '',
    p_shipping_subdistrict: body.shipping_subdistrict || '',
    p_shipping_district:    body.shipping_district || '',
    p_shipping_province:    body.shipping_province || '',
    p_shipping_postcode:    body.shipping_postcode || '',
    p_shipping_note:        body.shipping_note || null,
  })
  if (error) {
    if (/redeem_reward.*does not exist/i.test(error.message)) {
      return NextResponse.json({
        error: 'ฟีเจอร์ยังไม่พร้อม — รัน migration 0016 + 0018',
      }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const result = data as {
    error?: string; success?: true; redemption_id?: string; points_after?: number;
    redeem_type?: 'POINTS_CASH' | 'VOUCHER' | 'PREMIUM';
    cash_top_up_thb?: number; voucher_value_thb?: number;
    shopify_product_url?: string; reward_name?: string;
    needs_code_generation?: boolean;
  }
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 400 })

  // ── 2. Generate Shopify code ถ้าจำเป็น ──
  let codeInfo: { code: string; apply_url: string; price_rule_id: number; expires_at: string } | null = null
  let codeError: string | null = null

  let priceInfo: { current: number; original_used: number; sale_detected: boolean } | null = null

  if (result.needs_code_generation && result.redemption_id && isConfigured()) {
    try {
      // ดึง reward เพื่อหา discount value
      const { data: reward } = await service.from('rewards')
        .select('redeem_type, original_price_thb, cash_top_up_thb, voucher_value_thb, voucher_min_purchase_thb, code_validity_days, shopify_product_id, shopify_product_url')
        .eq('id', params.id).single()
      if (!reward) throw new Error('reward not found after redeem')

      const validityDays = (reward.code_validity_days as number) || 30
      const endsAt = new Date(Date.now() + validityDays * 86_400_000).toISOString()

      const memberCode = `RDM${(result.redemption_id as string).slice(0, 6).toUpperCase()}`
      const userPrefix = (user.email?.split('@')[0] || 'M').toUpperCase().slice(0, 6)

      let discountValue: number
      let minPurchase: number | undefined

      if (reward.redeem_type === 'POINTS_CASH') {
        // ── Realtime price sync ──
        // ดึงราคาปัจจุบันจาก Shopify (กันราคาเปลี่ยนจากตอน admin ตั้ง reward)
        // ถ้า fetch ไม่ได้ → fallback ใช้ original_price_thb ที่ admin ตั้ง
        const cash = Number(reward.cash_top_up_thb || 0)
        const fallbackOriginal = Number(reward.original_price_thb || 0)
        let effectivePrice = fallbackOriginal
        if (reward.shopify_product_url) {
          const live = await fetchShopifyProductPrice(reward.shopify_product_url as string)
          if (live && live.current_price_thb > 0) {
            effectivePrice = live.current_price_thb
            priceInfo = {
              current:       live.current_price_thb,
              original_used: fallbackOriginal,
              sale_detected: live.current_price_thb < fallbackOriginal,
            }
          }
        }

        if (effectivePrice <= cash) {
          throw new Error(
            `ราคาสินค้าปัจจุบัน (฿${effectivePrice.toLocaleString()}) ต่ำกว่าหรือเท่ากับยอดที่ต้องจ่าย (฿${cash.toLocaleString()}) — ไม่ต้องใช้ code`
          )
        }
        discountValue = effectivePrice - cash  // realtime — user จ่ายเท่า cash เป๊ะเสมอ
        minPurchase = cash
      } else {
        // VOUCHER
        discountValue = Number(reward.voucher_value_thb || 0)
        minPurchase = Number(reward.voucher_min_purchase_thb || 0) || undefined
      }

      if (discountValue <= 0) throw new Error('discount value invalid')

      const shopifyResult = await generateDiscounts({
        shop_id: DEFAULT_SHOP_ID,
        title: `Reward: ${result.reward_name || 'redeem'} · ${userPrefix}`,
        value_type: 'fixed_amount',
        value: discountValue,
        codes: [memberCode],
        quantity: 1,
        starts_at: new Date().toISOString(),
        ends_at: endsAt,
        minimum_order_amount: minPurchase,
        usage_limit_per_customer: true,
        usage_limit: 1,
        combines_with: {
          order_discounts:    true,
          product_discounts:  false,
          shipping_discounts: false,
        },
      })

      const applyUrl = buildApplyUrl(DEFAULT_SHOP_ID, memberCode)

      // ดึง image_url + reward_name ปัจจุบัน เผื่อ admin แก้ทีหลัง
      const { data: rewardFull } = await service.from('rewards')
        .select('image_url, name').eq('id', params.id).single()

      // อัปเดต redemption row + insert coupon row ผูกกับ user
      await service.from('redemptions').update({
        shopify_code:         memberCode,
        shopify_apply_url:    applyUrl,
        shopify_price_rule_id: shopifyResult.price_rule_id,
        code_expires_at:      endsAt,
        // VOUCHER auto-confirmed; POINTS_CASH ก็ confirm หลังออก code
        status:               'confirmed',
      }).eq('id', result.redemption_id)

      // เก็บใน coupons table ทั้ง 2 type — user จะเห็นทั้งใน /coupons + /redemptions
      // เมื่อ user ใช้ที่ Shopify checkout → webhook orders/paid จะ mark used_at
      // → cascade trigger (migration 0019) จะ flag redemption เป็น 'delivered' อัตโนมัติ
      const today = new Date().toISOString().split('T')[0]
      const couponTitle = reward.redeem_type === 'POINTS_CASH'
        ? `🎁 ${result.reward_name || 'reward'}`
        : `🎟️ ${result.reward_name || 'voucher'}`
      const couponDesc = reward.redeem_type === 'POINTS_CASH'
        ? `ส่วนลดสำหรับสินค้าที่แลกไว้ — จ่ายเพิ่ม ฿${Number(reward.cash_top_up_thb || 0).toLocaleString()} ที่ Shopify`
        : `ส่วนลด ฿${discountValue.toLocaleString()}${minPurchase ? ` ขั้นต่ำ ฿${minPurchase.toLocaleString()}` : ''}`
      const { error: couponErr } = await service.from('coupons').insert({
        user_id:        user.id,
        code:           memberCode,
        title:          couponTitle,
        description:    couponDesc,
        discount_type:  'FIXED',
        discount_value: discountValue,
        min_purchase:   minPurchase || 0,
        valid_from:     today,
        valid_until:    endsAt.split('T')[0],
        theme:          reward.redeem_type === 'POINTS_CASH' ? 'gold' : 'rose',
        image_url:      rewardFull?.image_url || null,    // โชว์รูปสินค้าบน coupon card
        shopify_shop_id:       DEFAULT_SHOP_ID,
        shopify_price_rule_id: shopifyResult.price_rule_id,
        apply_url:             reward.redeem_type === 'POINTS_CASH'
                                 ? (reward.shopify_product_url as string | null) || applyUrl
                                 : applyUrl,
        shopify_synced_at:     new Date().toISOString(),
        auto_issue_key:        `REWARD_${params.id}_${result.redemption_id}`,
      })
      // ถ้า column image_url ยังไม่ apply (migration 0022) → retry ไม่ใส่ image_url
      if (couponErr && /image_url.*schema cache|column.*image_url/i.test(couponErr.message)) {
        await service.from('coupons').insert({
          user_id: user.id, code: memberCode, title: couponTitle, description: couponDesc,
          discount_type: 'FIXED', discount_value: discountValue, min_purchase: minPurchase || 0,
          valid_from: today, valid_until: endsAt.split('T')[0],
          theme: reward.redeem_type === 'POINTS_CASH' ? 'gold' : 'rose',
          shopify_shop_id: DEFAULT_SHOP_ID,
          shopify_price_rule_id: shopifyResult.price_rule_id,
          apply_url: reward.redeem_type === 'POINTS_CASH'
            ? (reward.shopify_product_url as string | null) || applyUrl : applyUrl,
          shopify_synced_at: new Date().toISOString(),
          auto_issue_key: `REWARD_${params.id}_${result.redemption_id}`,
        })
      }

      codeInfo = {
        code:          memberCode,
        apply_url:     applyUrl,
        price_rule_id: shopifyResult.price_rule_id,
        expires_at:    endsAt,
      }
    } catch (e) {
      const err = e as ShopifyDiscountError | Error
      codeError = ('detail' in err && err.detail) ? err.detail : err.message
      console.error('[redeem] code generation failed:', codeError)
      // ไม่ rollback — redemption สำเร็จไปแล้ว
      // mark generation_failed_at เพื่อให้ admin filter เจอ + regenerate ได้
      await service.from('redemptions').update({
        generation_failed_at:  new Date().toISOString(),
        last_generation_error: codeError,
        admin_note:            `[Auto] Code generation failed: ${codeError}. Admin to retry.`,
      }).eq('id', result.redemption_id)
    }
  }

  revalidatePath('/rewards')
  revalidatePath('/redemptions')
  revalidatePath('/coupons')
  revalidatePath('/points')

  return NextResponse.json({
    ...result,
    code:             codeInfo?.code || null,
    apply_url:        codeInfo?.apply_url || null,
    code_expires_at:  codeInfo?.expires_at || null,
    code_error:       codeError,
    // ── Realtime price info (POINTS_CASH only) ──
    live_price:        priceInfo?.current ?? null,
    sale_detected:     priceInfo?.sale_detected ?? false,
    discount_applied:  priceInfo ? priceInfo.current - (Number(result.cash_top_up_thb) || 0) : null,
  }, { headers: rl.headers })
}
