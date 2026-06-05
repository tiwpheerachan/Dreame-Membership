// ============================================================
// POST /api/admin/coupons/shopify/import
//
// Pull an EXISTING Shopify discount campaign (price rule + codes)
// into the Dreame Membership DB. Use when the campaign was created
// outside our admin (e.g. directly in Shopify or via another app).
//
// Body:
//   {
//     price_rule_id:   number       // required — campaign id at Shopify
//     shop_id?:        string       // defaults to DEFAULT_SHOP_ID
//     // assignment (optional — leave both blank for "unassigned pool"):
//     assign_tier?:    'SILVER'|'GOLD'|'PLATINUM'
//     assign_segment?: 'all_active'|'vip'
//   }
//
// Behavior:
//   • Fetch performance() from ecom platform → get title/value/codes
//   • For each code in the response:
//       - skip if (shop_id, shopify_code_id) already in our DB
//       - insert new row, copy title/value/dates/code/apply_url
//   • If assign_tier/segment given:
//       - distribute newly-imported codes (where user_id IS NULL) to users
//         in that audience, one code per user, until codes run out OR
//         audience runs out (whichever first)
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'
import {
  getPerformance, buildApplyUrl, isConfigured,
  DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'

type Body = {
  price_rule_id: number
  shop_id?: string
  assign_tier?: 'SILVER' | 'GOLD' | 'PLATINUM'
  assign_segment?: 'all_active' | 'vip'
}

export async function POST(req: Request) {
  // ── Auth ──
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isConfigured()) {
    return NextResponse.json({ error: 'SHOPIFY_DISCOUNT_API_KEY not configured' }, { status: 503 })
  }

  // ── Validate body ──
  const body = (await req.json().catch(() => ({}))) as Partial<Body>
  if (!body.price_rule_id || typeof body.price_rule_id !== 'number') {
    return NextResponse.json({ error: 'price_rule_id (number) required' }, { status: 400 })
  }
  const shopId = body.shop_id || DEFAULT_SHOP_ID

  // ── Fetch campaign details from Shopify ──
  let perf
  try {
    perf = await getPerformance(shopId, body.price_rule_id)
  } catch (e) {
    const err = e as ShopifyDiscountError
    return NextResponse.json(
      { error: `Shopify fetch failed (${err.status}): ${err.detail || err.message}` },
      { status: 502 },
    )
  }
  if (!perf.codes || perf.codes.length === 0) {
    return NextResponse.json({ error: 'Campaign exists but has 0 codes' }, { status: 400 })
  }

  // ── Find codes that aren't already in our DB ──
  // Idempotency: dedup by (shopify_shop_id, shopify_code_id)
  const existingIds = new Set<number>()
  {
    const { data } = await service
      .from('coupons')
      .select('shopify_code_id')
      .eq('shopify_shop_id', shopId)
      .eq('shopify_price_rule_id', body.price_rule_id)
    for (const r of data || []) {
      if (r.shopify_code_id) existingIds.add(Number(r.shopify_code_id))
    }
  }

  const newCodes = perf.codes.filter(c => !existingIds.has(c.id))
  if (newCodes.length === 0) {
    return NextResponse.json({
      success: true,
      imported: 0,
      already_present: perf.codes.length,
      message: 'All codes already imported',
      price_rule_id: body.price_rule_id,
      title: perf.price_rule_title,
    })
  }

  // ── Resolve assignment ──
  let recipients: string[] = []
  if (body.assign_tier) {
    const { data } = await service.from('users')
      .select('id').eq('is_active', true).eq('tier', body.assign_tier)
    recipients = (data || []).map(r => r.id as string)
  } else if (body.assign_segment === 'all_active') {
    const { data } = await service.from('users').select('id').eq('is_active', true)
    recipients = (data || []).map(r => r.id as string)
  } else if (body.assign_segment === 'vip') {
    const { data } = await service.from('users').select('id').eq('is_active', true).eq('is_vip', true)
    recipients = (data || []).map(r => r.id as string)
  }

  // Skip users who already have a code in this campaign (avoid double-assignment)
  if (recipients.length > 0) {
    const { data: alreadyHas } = await service
      .from('coupons')
      .select('user_id')
      .eq('shopify_price_rule_id', body.price_rule_id)
      .in('user_id', recipients)
    const skip = new Set((alreadyHas || []).map(r => r.user_id as string))
    recipients = recipients.filter(id => !skip.has(id))
  }

  // ── Build inserts ──
  const today = new Date().toISOString().split('T')[0]
  const validUntil = perf.ends_at ? perf.ends_at.split('T')[0] : new Date(Date.now() + 365 * 86_400_000).toISOString().split('T')[0]

  // Derive discount_type / discount_value from Shopify's response.
  // Shopify uses negative numbers ("-10.0" = 10% off / ฿10 off depending on type).
  const discountValue = Math.abs(parseFloat(String(perf.value)) || 0)
  const discountType = perf.value_type === 'percentage' ? 'PERCENT' : 'FIXED'

  const inserts = newCodes.map((c, i) => ({
    user_id:        recipients[i] || null,
    code:           c.code,
    title:          perf.price_rule_title,
    discount_type:  discountType,
    discount_value: discountValue,
    min_purchase:   0,
    valid_from:     today,
    valid_until:    validUntil,
    theme:          'gold',
    created_by:     staff.id,
    shopify_shop_id:       shopId,
    shopify_price_rule_id: body.price_rule_id,
    shopify_code_id:       c.id,
    apply_url:             buildApplyUrl(shopId, c.code),
    shopify_synced_at:     new Date().toISOString(),
    used_at:               c.usage_count > 0 ? new Date().toISOString() : null,
    used_count:            c.usage_count,
  }))

  const { error: insErr } = await service.from('coupons').insert(inserts)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  await logAdminAction({
    staffId: staff.id,
    action: 'COUPON_SHOPIFY_BATCH_CREATED',
    targetType: 'coupon',
    detail: {
      staff_name:      staff.name,
      operation:       'import',
      shop_id:         shopId,
      price_rule_id:   body.price_rule_id,
      title:           perf.price_rule_title,
      imported:        inserts.length,
      assigned:        inserts.filter(i => i.user_id).length,
      unassigned:      inserts.filter(i => !i.user_id).length,
    },
  })

  revalidatePath('/admin/coupons')
  revalidatePath('/admin/members')

  return NextResponse.json({
    success: true,
    imported: inserts.length,
    assigned: inserts.filter(i => i.user_id).length,
    unassigned: inserts.filter(i => !i.user_id).length,
    already_present: existingIds.size,
    price_rule_id: body.price_rule_id,
    title: perf.price_rule_title,
    sample_codes: inserts.slice(0, 5).map(r => r.code),
  })
}
