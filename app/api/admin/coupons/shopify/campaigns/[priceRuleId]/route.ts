// ============================================================
// GET    /api/admin/coupons/shopify/campaigns/[priceRuleId]
// DELETE /api/admin/coupons/shopify/campaigns/[priceRuleId]
//
// GET: Merges Shopify performance() data with our local coupons rows
//      so we can show full breakdown (per-code usage + assigned user)
//      from a single endpoint.
//
// DELETE: Removes the price rule from Shopify + soft-removes our local
//         coupons rows (sets used_at = now() if unused, so they don't
//         keep showing as "available" to users).
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'
import {
  getPerformance, deletePriceRule, isConfigured,
  DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function authStaff(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff }
}

export async function GET(
  req: Request,
  { params }: { params: { priceRuleId: string } },
) {
  const auth = await authStaff(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!isConfigured()) {
    return NextResponse.json({ error: 'SHOPIFY_DISCOUNT_API_KEY not configured' }, { status: 503 })
  }

  const priceRuleId = Number(params.priceRuleId)
  if (!priceRuleId) return NextResponse.json({ error: 'invalid priceRuleId' }, { status: 400 })
  const shopId = new URL(req.url).searchParams.get('shop_id') || DEFAULT_SHOP_ID

  // ── Fetch Shopify perf ──
  let perf
  try {
    perf = await getPerformance(shopId, priceRuleId)
  } catch (e) {
    const err = e as ShopifyDiscountError
    return NextResponse.json(
      { error: `Shopify fetch failed (${err.status}): ${err.detail || err.message}` },
      { status: 502 },
    )
  }

  // ── Fetch our local rows linked to this rule ──
  const { data: localRows } = await auth.service
    .from('coupons')
    .select('id, code, user_id, used_at, used_count, shopify_code_id, shopify_synced_at, created_at, redeemed_revenue_thb, redeemed_order_id, redeemed_order_name, redeemed_channel')
    .eq('shopify_shop_id', shopId)
    .eq('shopify_price_rule_id', priceRuleId)

  // Build lookup by code (Shopify is authoritative on usage_count)
  type Local = NonNullable<typeof localRows>[number]
  const byCode = new Map<string, Local>()
  for (const r of localRows || []) {
    byCode.set(r.code as string, r)
  }

  // ── Lookup user info for assigned codes ──
  const userIds = Array.from(
    new Set(((localRows || []).map(r => r.user_id).filter(Boolean) as string[])),
  )
  const userInfo: Record<string, { full_name: string | null; member_id: string | null; tier: string | null; phone: string | null }> = {}
  if (userIds.length > 0) {
    const { data: users } = await auth.service.from('users')
      .select('id, full_name, member_id, tier, phone').in('id', userIds)
    for (const u of users || []) {
      userInfo[u.id as string] = {
        full_name: u.full_name as string | null,
        member_id: u.member_id as string | null,
        tier: u.tier as string | null,
        phone: u.phone as string | null,
      }
    }
  }

  // ── Build code rows: union of Shopify codes + any local codes not in Shopify response ──
  type UserInfo = typeof userInfo[string]
  type CodeRow = {
    code: string
    shopify_code_id: number | null
    usage_count: number             // from Shopify (authoritative)
    created_at: string
    apply_url: string
    in_local: boolean
    local_id: string | null
    user: UserInfo | null
    used_at: string | null
    last_synced_at: string | null
  }
  const codes: CodeRow[] = []
  for (const c of perf.codes || []) {
    const local = byCode.get(c.code)
    codes.push({
      code: c.code,
      shopify_code_id: c.id,
      usage_count: c.usage_count,
      created_at: c.created_at,
      apply_url: `https://${shopId}/discount/${encodeURIComponent(c.code)}`,
      in_local: !!local,
      local_id: local ? (local.id as string) : null,
      user: local?.user_id ? userInfo[local.user_id as string] || null : null,
      used_at: local?.used_at as string | null ?? null,
      last_synced_at: local?.shopify_synced_at as string | null ?? null,
    })
  }

  // Local rows not in Shopify response (shouldn't happen often — orphans)
  const shopifyCodes = new Set(perf.codes.map(c => c.code))
  for (const r of localRows || []) {
    if (shopifyCodes.has(r.code as string)) continue
    codes.push({
      code: r.code as string,
      shopify_code_id: r.shopify_code_id as number | null,
      usage_count: r.used_count as number || 0,
      created_at: r.created_at as string,
      apply_url: `https://${shopId}/discount/${encodeURIComponent(r.code as string)}`,
      in_local: true,
      local_id: r.id as string,
      user: r.user_id ? userInfo[r.user_id as string] || null : null,
      used_at: r.used_at as string | null,
      last_synced_at: r.shopify_synced_at as string | null,
    })
  }

  // ── Revenue aggregation จาก local rows ──
  let revenueTotal = 0
  let ordersCount = 0
  const channelCount: Record<string, number> = {}
  for (const r of localRows || []) {
    const rev = Number(r.redeemed_revenue_thb)
    if (!isNaN(rev) && rev > 0) {
      revenueTotal += rev
      ordersCount++
    }
    if (r.redeemed_channel) {
      const ch = r.redeemed_channel as string
      channelCount[ch] = (channelCount[ch] || 0) + 1
    }
  }
  const topChannel = Object.entries(channelCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  return NextResponse.json({
    price_rule_id: priceRuleId,
    shop_id: shopId,
    title: perf.price_rule_title,
    value_type: perf.value_type,
    value: perf.value,
    ends_at: perf.ends_at,
    summary: perf.summary,
    local_imported: byCode.size,
    local_used: codes.filter(c => c.used_at).length,
    assigned: codes.filter(c => c.user !== null).length,
    unassigned: codes.filter(c => c.in_local && !c.user).length,
    shopify_only: codes.filter(c => !c.in_local).length,
    revenue: {
      total_thb:    Math.round(revenueTotal * 100) / 100,
      orders_count: ordersCount,
      aov_thb:      ordersCount > 0 ? Math.round((revenueTotal / ordersCount) * 100) / 100 : null,
      top_channel:  topChannel,
      by_channel:   channelCount,
    },
    codes,
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: { priceRuleId: string } },
) {
  const auth = await authStaff(req)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!isConfigured()) {
    return NextResponse.json({ error: 'SHOPIFY_DISCOUNT_API_KEY not configured' }, { status: 503 })
  }

  const priceRuleId = Number(params.priceRuleId)
  if (!priceRuleId) return NextResponse.json({ error: 'invalid priceRuleId' }, { status: 400 })
  const shopId = new URL(req.url).searchParams.get('shop_id') || DEFAULT_SHOP_ID

  // 1) Delete at Shopify
  try {
    await deletePriceRule(shopId, priceRuleId)
  } catch (e) {
    const err = e as ShopifyDiscountError
    // Continue even if Shopify delete fails (404 = already gone) but bubble other errors
    if (err.status !== 404) {
      return NextResponse.json({ error: `Shopify delete failed: ${err.detail}` }, { status: 502 })
    }
  }

  // 2) Mark our local rows as deleted (soft) — set used_at to hide from users
  const { count } = await auth.service
    .from('coupons')
    .delete({ count: 'exact' })
    .eq('shopify_shop_id', shopId)
    .eq('shopify_price_rule_id', priceRuleId)

  await logAdminAction({
    staffId: auth.staff.id,
    action: 'COUPON_SHOPIFY_BATCH_CREATED', // reuse — could add a new action type later
    targetType: 'coupon',
    detail: {
      staff_name: auth.staff.name,
      operation: 'delete',
      shop_id: shopId,
      price_rule_id: priceRuleId,
      local_rows_removed: count ?? 0,
    },
  })

  revalidatePath('/admin/coupons')
  revalidatePath('/admin/coupons/shopify')

  return NextResponse.json({ success: true, local_rows_removed: count ?? 0 })
}
