// ============================================================
// POST /api/admin/coupons/shopify
//
// Admin-only: generate a Shopify discount batch and insert one
// `coupons` row per code, linked to the selected recipients.
//
// Body:
//   {
//     title:            string        // campaign title (visible in Shopify)
//     value_type:       'percentage' | 'fixed_amount'
//     value:            number        // 10 = 10% off, 50 = ฿50 off
//     min_purchase?:    number
//     ends_at?:         string        // ISO; defaults to +90d
//     code_prefix?:     string        // default "DREAME"
//     description?:     string
//     theme?:           string        // visual theme key
//
//     // Audience — choose ONE strategy:
//     recipient_user_ids?: string[]   // explicit list
//     recipient_tier?:     'SILVER'|'GOLD'|'PLATINUM'
//     recipient_segment?:  'all_active' | 'vip'
//     quantity_override?:  number     // for non-user-bound batches (rare)
//   }
//
// Behavior:
//   • Resolves target users → N
//   • Calls Shopify /generate with quantity=N (or quantity_override)
//   • Inserts N rows into `coupons` table, one per code, linked to user
//   • Logs COUPON_SHOPIFY_BATCH_CREATED audit
//   • Returns { count, price_rule_id, sample }
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'
import {
  generateDiscounts, buildApplyUrl, isConfigured,
  DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'

type Body = {
  title: string
  value_type: 'percentage' | 'fixed_amount'
  value: number
  min_purchase?: number
  starts_at?: string
  ends_at?: string
  code_prefix?: string
  code_suffix?: string          // เช่น "TH" → VIP-A1B2-TH
  code_length?: number          // ความยาว random กลาง (4-12)
  description?: string
  theme?: string
  shop_id?: string
  recipient_user_ids?: string[]
  recipient_tier?: 'SILVER' | 'GOLD' | 'PLATINUM'
  recipient_segment?: 'all_active' | 'vip'
  quantity_override?: number
  // ── Advanced Shopify settings ──
  usage_limit?: number
  one_use_per_customer?: boolean
  combines_with?: {
    product_discounts?:  boolean
    order_discounts?:    boolean
    shipping_discounts?: boolean
  }
}

// Generate code: <prefix>-<random>-<suffix> (skip empty parts)
function generateCustomCodes(prefix: string, suffix: string, length: number, count: number): string[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // ตัด I/O/0/1 ที่อ่านผิด
  const seen = new Set<string>()
  const codes: string[] = []
  while (codes.length < count && seen.size < count * 4) {
    let mid = ''
    for (let i = 0; i < length; i++) {
      mid += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    const parts = [prefix, mid, suffix].filter(p => p && p.length > 0)
    const code = parts.join('-').toUpperCase()
    if (seen.has(code)) continue
    seen.add(code)
    codes.push(code)
  }
  return codes
}

export async function POST(req: Request) {
  // ── 1. Auth ──
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Shopify Discount API not configured — set SHOPIFY_DISCOUNT_API_KEY in env' },
      { status: 503 },
    )
  }

  // ── 2. Validate body ──
  const body = (await req.json().catch(() => ({}))) as Partial<Body>
  if (!body.title)       return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!body.value_type)  return NextResponse.json({ error: 'value_type required' }, { status: 400 })
  if (!body.value || body.value <= 0)
    return NextResponse.json({ error: 'value must be positive' }, { status: 400 })
  if (!['percentage', 'fixed_amount'].includes(body.value_type))
    return NextResponse.json({ error: 'value_type must be "percentage" or "fixed_amount"' }, { status: 400 })

  const shopId   = body.shop_id || DEFAULT_SHOP_ID
  // Shopify requires starts_at — even if the doc marks it optional.
  // Default to "now" so the code is usable immediately.
  const startsAt = body.starts_at || new Date().toISOString()
  const endsAt   = body.ends_at || new Date(Date.now() + 90 * 86_400_000).toISOString()
  const prefix   = body.code_prefix || 'DREAME'
  const validUntilDate = endsAt.split('T')[0]

  // ── 3. Resolve recipients ──
  let recipients: string[] = []
  if (Array.isArray(body.recipient_user_ids) && body.recipient_user_ids.length > 0) {
    recipients = body.recipient_user_ids
  } else if (body.recipient_tier) {
    const { data } = await service.from('users')
      .select('id').eq('is_active', true).eq('tier', body.recipient_tier)
    recipients = (data || []).map(r => r.id as string)
  } else if (body.recipient_segment === 'all_active') {
    const { data } = await service.from('users').select('id').eq('is_active', true)
    recipients = (data || []).map(r => r.id as string)
  } else if (body.recipient_segment === 'vip') {
    const { data } = await service.from('users').select('id').eq('is_active', true).eq('is_vip', true)
    recipients = (data || []).map(r => r.id as string)
  }

  const quantity = body.quantity_override ?? recipients.length
  if (quantity <= 0) {
    return NextResponse.json({ error: 'no recipients matched — refine filters' }, { status: 400 })
  }
  if (quantity > 500) {
    return NextResponse.json({ error: 'Shopify allows max 500 codes per batch' }, { status: 400 })
  }

  // ── 4. Generate codes at Shopify ──
  let shopifyResult
  try {
    // ถ้าระบุ suffix → generate codes เอง (เพราะ ecom-data-platform ไม่รับ suffix)
    // ส่งเป็น array codes[] แทน prefix → API จะใช้ตามที่เราระบุ
    const customCodes = body.code_suffix && body.code_suffix.trim() !== ''
      ? generateCustomCodes(
          prefix,
          body.code_suffix.trim(),
          body.code_length || 6,
          quantity,
        )
      : undefined

    shopifyResult = await generateDiscounts({
      shop_id: shopId,
      title: body.title,
      value_type: body.value_type,
      value: body.value,
      // ใช้ codes[] ถ้าระบุ suffix, ไม่งั้นใช้ prefix-only mode
      ...(customCodes ? { codes: customCodes } : { code_prefix: prefix }),
      quantity,
      starts_at: startsAt,
      ends_at: endsAt,
      minimum_order_amount: body.min_purchase ? Number(body.min_purchase) : undefined,
      usage_limit_per_customer: body.one_use_per_customer ?? true,
      usage_limit: body.usage_limit,
      combines_with: body.combines_with,
    })
  } catch (e) {
    const err = e as ShopifyDiscountError
    return NextResponse.json(
      { error: `Shopify error (${err.status || 'network'}): ${err.detail || err.message}` },
      { status: 502 },
    )
  }

  // ── 5. Build coupon rows ──
  // Cap to actual generated count in case Shopify produced fewer
  const codes = shopifyResult.codes.slice(0, quantity)
  const assigned = recipients.slice(0, codes.length)

  const today = new Date().toISOString().split('T')[0]
  const inserts = codes.map((code, i) => ({
    user_id:        assigned[i] || null,
    code,
    title:          body.title,
    description:    body.description || null,
    discount_type:  body.value_type === 'percentage' ? 'PERCENT' : 'FIXED',
    discount_value: body.value,
    min_purchase:   body.min_purchase ? Number(body.min_purchase) : 0,
    valid_from:     today,
    valid_until:    validUntilDate,
    theme:          body.theme || 'gold',
    created_by:     staff.id,
    shopify_shop_id:       shopId,
    shopify_price_rule_id: shopifyResult.price_rule_id,
    apply_url:             buildApplyUrl(shopId, code),
    shopify_synced_at:     new Date().toISOString(),
  }))

  const { error: insErr } = await service.from('coupons').insert(inserts)
  if (insErr) {
    // Shopify already created — DB failed. Surface so admin can recover.
    return NextResponse.json(
      {
        error: `Shopify codes created but DB insert failed: ${insErr.message}`,
        recovery: {
          price_rule_id: shopifyResult.price_rule_id,
          codes,
          message: 'Shopify codes exist — re-insert manually or delete via API',
        },
      },
      { status: 500 },
    )
  }

  // ── 6. Audit ──
  await logAdminAction({
    staffId:    staff.id,
    action:     'COUPON_SHOPIFY_BATCH_CREATED',
    targetType: 'coupon',
    detail: {
      staff_name:      staff.name,
      shop_id:         shopId,
      price_rule_id:   shopifyResult.price_rule_id,
      title:           body.title,
      value_type:      body.value_type,
      value:           body.value,
      quantity:        codes.length,
      recipients:      assigned.length,
      segment:         body.recipient_tier || body.recipient_segment || (body.recipient_user_ids ? 'explicit' : 'none'),
      one_use_per_customer: body.one_use_per_customer ?? true,
      usage_limit:     body.usage_limit ?? null,
      combines_with:   body.combines_with ?? null,
    },
  })

  revalidatePath('/admin/coupons')
  revalidatePath('/admin/members')

  return NextResponse.json({
    success: true,
    count:           codes.length,
    price_rule_id:   shopifyResult.price_rule_id,
    title:           shopifyResult.price_rule_title,
    sample_codes:    codes.slice(0, 5),
    apply_url_pattern: shopifyResult.redirect_url_pattern,
  })
}
