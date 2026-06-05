// ============================================================
// POST /api/admin/coupons/shopify/sync
//
// Manual on-demand sync for ONE Shopify campaign — admin clicks
// "Sync now" → we call /notify → ecom platform pushes webhook to us.
//
// Body:  { price_rule_id: number, shop_id?: string }
//
// Difference from /api/cron/sync-shopify-discounts:
//   • Cron: iterates ALL open campaigns (background)
//   • This:  one campaign only, returns the snapshot inline so the UI
//            can show the latest stats immediately.
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { notify, isConfigured, DEFAULT_SHOP_ID, ShopifyDiscountError } from '@/lib/shopify-discounts'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isConfigured()) {
    return NextResponse.json({ error: 'SHOPIFY_DISCOUNT_API_KEY not configured' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as { price_rule_id?: number; shop_id?: string }
  if (!body.price_rule_id) {
    return NextResponse.json({ error: 'price_rule_id required' }, { status: 400 })
  }
  const shopId = body.shop_id || DEFAULT_SHOP_ID

  try {
    const res = await notify(shopId, body.price_rule_id)
    return NextResponse.json({
      success: true,
      title:         res.price_rule_title,
      summary:       res.summary,
      webhook_fired: res.webhook_fired,
      codes_with_usage: (res.codes || []).filter(c => Number(c.usage_count) > 0).length,
    })
  } catch (e) {
    const err = e as ShopifyDiscountError
    return NextResponse.json(
      { error: `Shopify error (${err.status}): ${err.detail || err.message}` },
      { status: 502 },
    )
  }
}
