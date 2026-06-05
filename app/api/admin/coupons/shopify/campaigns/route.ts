// ============================================================
// GET /api/admin/coupons/shopify/campaigns
//
// Returns ALL Shopify price rules merged with what we have locally.
// One row per price_rule_id with a flag whether we've imported it.
//
// Response:
//   {
//     campaigns: [{
//       price_rule_id, title, value_type, value, starts_at, ends_at,
//       shopify_only,   // true = exists on Shopify but not in our DB
//       local_count,    // # of rows in our coupons table linked
//       used_count,     // # of redeemed in our DB
//       last_synced_at, // most recent shopify_synced_at on linked rows
//     }]
//   }
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  listPriceRules, isConfigured, DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!isConfigured()) {
    return NextResponse.json({ error: 'SHOPIFY_DISCOUNT_API_KEY not configured', campaigns: [] }, { status: 503 })
  }

  const shopId = new URL(req.url).searchParams.get('shop_id') || DEFAULT_SHOP_ID

  // ── Fetch from Shopify ──
  let shopifyList
  try {
    shopifyList = await listPriceRules(shopId)
  } catch (e) {
    const err = e as ShopifyDiscountError
    return NextResponse.json(
      { error: `Shopify fetch failed (${err.status}): ${err.detail || err.message}`, campaigns: [] },
      { status: 502 },
    )
  }

  // ── Fetch local linkage + revenue ──
  const ids = shopifyList.price_rules.map(r => r.id)
  let localByRule: Record<number, {
    total: number; used: number; last_sync: string | null;
    revenue: number; orders: number; top_channel: string | null
  }> = {}
  if (ids.length > 0) {
    // 1) basic linkage + revenue (one query — pull only what we need)
    const { data: rows } = await service.from('coupons')
      .select('shopify_price_rule_id, used_at, shopify_synced_at, redeemed_revenue_thb, redeemed_channel')
      .eq('shopify_shop_id', shopId)
      .in('shopify_price_rule_id', ids)
    for (const r of rows || []) {
      const pid = Number(r.shopify_price_rule_id)
      if (!pid) continue
      if (!localByRule[pid]) localByRule[pid] = {
        total: 0, used: 0, last_sync: null, revenue: 0, orders: 0, top_channel: null,
      }
      const b = localByRule[pid]
      b.total++
      if (r.used_at) b.used++
      const rev = Number(r.redeemed_revenue_thb)
      if (!isNaN(rev) && rev > 0) {
        b.revenue += rev
        b.orders++
      }
      // Most frequent channel — count and pick top later. Keep last seen for now.
      if (r.redeemed_channel) b.top_channel = r.redeemed_channel as string
      const sync = r.shopify_synced_at as string | null
      if (sync && (!b.last_sync || sync > b.last_sync!)) {
        b.last_sync = sync
      }
    }
  }

  const today = new Date().toISOString()
  const campaigns = shopifyList.price_rules.map(r => {
    const local = localByRule[r.id]
    const expired = r.ends_at ? r.ends_at < today : false
    return {
      price_rule_id: r.id,
      title:         r.title,
      value_type:    r.value_type,
      value:         r.value,          // raw "-10.0"
      starts_at:     r.starts_at,
      ends_at:       r.ends_at,
      usage_limit:   r.usage_limit,
      once_per_customer: r.once_per_customer,
      shopify_created_at: r.created_at,
      expired,
      // Local linkage
      local_count:   local?.total ?? 0,
      used_count:    local?.used  ?? 0,
      last_synced_at: local?.last_sync ?? null,
      shopify_only:  !local,
      // Revenue
      revenue_thb:   local?.revenue ?? 0,
      orders_count:  local?.orders  ?? 0,
      aov_thb:       (local && local.orders > 0)
        ? Math.round((local.revenue / local.orders) * 100) / 100
        : null,
      top_channel:   local?.top_channel ?? null,
    }
  })

  return NextResponse.json({
    shop_id: shopId,
    total: campaigns.length,
    campaigns,
  })
}
