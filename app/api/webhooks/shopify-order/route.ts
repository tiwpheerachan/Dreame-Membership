// ============================================================
// POST /api/webhooks/shopify-order
//
// Receives Shopify `orders/paid` (or `orders/create`) webhook.
// Matches discount_codes in the order against our coupons table
// and stores revenue + order_id + channel.
//
// Webhook subscription:
//   Shopify Admin → Settings → Notifications → Webhooks
//     Topic:    Order payment
//     Format:   JSON
//     URL:      https://<host>/api/webhooks/shopify-order?secret=$SHOPIFY_WEBHOOK_SECRET
//     OR HMAC validation via SHOPIFY_WEBHOOK_SECRET env (preferred)
//
// Security:
//   • Try HMAC-SHA256 first (X-Shopify-Hmac-Sha256 header)
//   • Fallback to ?secret= query (less secure but easier)
//
// Idempotency:
//   Match by (shop_id, code). If already redeemed (used_at set), only
//   update revenue fields if not yet populated → safe to replay.
// ============================================================

import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ShopifyOrderPayload {
  id: number
  order_number?: number | string
  name: string                 // "#1001"
  order_status_url?: string
  currency: string
  total_price: string
  subtotal_price?: string
  total_discounts: string
  source_name?: string         // 'web' | 'pos' | 'mobile_app' | 'draft_orders' etc.
  email?: string
  phone?: string
  customer?: { first_name?: string; last_name?: string; email?: string; phone?: string }
  financial_status?: string
  fulfillment_status?: string | null
  cancel_reason?: string | null
  cancelled_at?: string | null
  closed_at?: string | null
  created_at?: string
  fulfillments?: Array<{
    id: number; status: string; tracking_company?: string | null;
    tracking_number?: string | null; tracking_url?: string | null;
    tracking_numbers?: string[]; created_at?: string;
  }>
  shipping_address?: Record<string, unknown> | null
  line_items?: Array<{ id: number; name: string; quantity: number; price: string }>
  discount_codes?: Array<{
    code: string
    amount: string
    type: 'percentage' | 'fixed_amount' | 'shipping'
  }>
}

function verifyHmac(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) return false
  try {
    const hmac = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
    const a = Buffer.from(hmac)
    const b = Buffer.from(hmacHeader)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch { return false }
}

export async function POST(req: Request) {
  const raw = await req.text()
  const url = new URL(req.url)

  // ── Auth ──
  // Mode 1: Shopify HMAC validation (preferred)
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
  const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET || ''
  const hmacOk = shopifySecret ? verifyHmac(raw, hmacHeader, shopifySecret) : false

  // Mode 2: simple shared secret (fallback for quick setup)
  const sharedSecret = process.env.CRON_SECRET || ''
  const qsSecret = url.searchParams.get('secret')
  const sharedOk = Boolean(sharedSecret && qsSecret === sharedSecret)

  if (!hmacOk && !sharedOk) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  // ── Parse ──
  let order: ShopifyOrderPayload
  try { order = JSON.parse(raw) }
  catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const shopDomain = req.headers.get('x-shopify-shop-domain') || ''
  const codes = (order.discount_codes || []).filter(d => d.code)

  const service = createServiceClient()

  // ── Log event ──
  let eventId: string | null = null
  try {
    const { data: evt } = await service.from('shopify_webhook_events').insert({
      event_type:    'order_paid',
      shop_id:       shopDomain || null,
      order_id:      order.id,
      order_total:   Number(order.total_price) || null,
      code:          codes[0]?.code || null,
      payload:       order as unknown as Record<string, unknown>,
      processing_status: 'received',
    }).select('id').single()
    eventId = (evt as { id: string } | null)?.id || null
  } catch { /* table อาจยังไม่ migrate */ }

  // ── Upsert shopify_orders row (สำหรับ user track สถานะ) ──
  // ทำก่อน match codes — เก็บไว้ทุก order แม้ไม่มี code ของเรา
  // (Auto-link user เกิดเฉพาะเมื่อ match code ของเราใน step ถัดไป)
  const fmt = order.fulfillments?.[0]
  const shippedAt = fmt?.tracking_number ? (fmt.created_at || null) : null
  try {
    await service.from('shopify_orders').upsert({
      id:                 order.id,
      shop_id:            shopDomain || '',
      order_number:       String(order.order_number ?? order.name?.replace(/^#/, '') ?? order.id),
      name:               order.name,
      email:              order.email || order.customer?.email || null,
      phone:              order.phone || order.customer?.phone || null,
      customer_name:      [order.customer?.first_name, order.customer?.last_name]
                            .filter(Boolean).join(' ') || null,
      total_price:        Number(order.total_price) || 0,
      subtotal_price:     Number(order.subtotal_price) || null,
      total_discounts:    Number(order.total_discounts) || 0,
      currency:           order.currency || 'THB',
      financial_status:   order.financial_status || null,
      fulfillment_status: order.fulfillment_status || null,
      cancel_reason:      order.cancel_reason || null,
      cancelled_at:       order.cancelled_at || null,
      closed_at:          order.closed_at || null,
      order_status_url:   order.order_status_url || null,
      tracking_company:   fmt?.tracking_company || null,
      tracking_number:    fmt?.tracking_number || null,
      tracking_url:       fmt?.tracking_url || null,
      fulfillments:       order.fulfillments || [],
      shipping_address:   order.shipping_address || null,
      line_items:         order.line_items || [],
      discount_codes:     order.discount_codes || [],
      shopify_created_at: order.created_at || null,
      shipped_at:         shippedAt,
      synced_at:          new Date().toISOString(),
    }, { onConflict: 'id' })
  } catch (e) {
    console.warn('[shopify-order] upsert order failed:', (e as Error).message)
    // ไม่ block — coupon update ยังควรทำงาน
  }

  if (codes.length === 0) {
    if (eventId) {
      await service.from('shopify_webhook_events')
        .update({ processing_status: 'skipped', error_message: 'no discount codes' })
        .eq('id', eventId)
    }
    return NextResponse.json({ success: true, skipped: 'no discount codes', order_upserted: true })
  }

  // ── Match แต่ละ code กับ coupons ของเรา ──
  const total       = Number(order.total_price) || 0
  const discount    = Number(order.total_discounts) || 0
  const codeStrings = codes.map(c => c.code)

  // ค้นแถว coupons ที่ตรง (shop + code) — แม้จะ used_at ไม่ null ก็อัปเดต revenue
  let q = service.from('coupons')
    .select('id, code, user_id, used_at, redeemed_revenue_thb, shopify_shop_id')
    .in('code', codeStrings)
  if (shopDomain) q = q.eq('shopify_shop_id', shopDomain)
  const { data: rows, error: selErr } = await q

  if (selErr) {
    if (eventId) {
      await service.from('shopify_webhook_events')
        .update({ processing_status: 'error', error_message: selErr.message }).eq('id', eventId)
    }
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    if (eventId) {
      await service.from('shopify_webhook_events')
        .update({ processing_status: 'skipped', error_message: 'no matching coupons' }).eq('id', eventId)
    }
    return NextResponse.json({ success: true, matched: 0, note: 'no codes matched in DB' })
  }

  // อัปเดต — กระจาย revenue ตามสัดส่วน (ถ้ามีหลาย code ใน order เดียว)
  // กรณีปกติคือ 1 code / order → ทั้งหมดให้ code นั้น
  const perCodeRevenue = rows.length > 0 ? total / rows.length : total
  const perCodeDiscount = rows.length > 0 ? discount / rows.length : discount
  const now = new Date().toISOString()
  const channel = (order.source_name || 'web').toLowerCase()

  // ── Bulk update: 1 SQL แทน N (เก่าเป็น loop sequential await) ──
  const allIds       = rows.map(r => r.id as string)
  const needRevenue  = rows.filter(r => !(r.redeemed_revenue_thb && Number(r.redeemed_revenue_thb) > 0))
                          .map(r => r.id as string)

  let updatedCount = 0

  // Patch 1: ทุก row ที่ match — เปลี่ยน used_at + order metadata
  const basePatch = {
    used_at: now, used_count: 1,
    redeemed_order_id:   order.id,
    redeemed_order_name: order.name,
    redeemed_channel:    channel,
    redeemed_currency:   order.currency || 'THB',
    shopify_synced_at:   now,
  }
  const { error: e1, count: c1 } = await service.from('coupons')
    .update(basePatch, { count: 'exact' }).in('id', allIds)
  if (!e1) {
    updatedCount = c1 ?? allIds.length
  } else if (/redeemed_order|redeemed_channel|redeemed_revenue/.test(e1.message)) {
    // Fallback: schema ยังไม่ apply migration 0017
    const { count: c2 } = await service.from('coupons')
      .update({ used_at: now, used_count: 1, shopify_synced_at: now }, { count: 'exact' })
      .in('id', allIds)
    updatedCount = c2 ?? 0
  }

  // Patch 2: เฉพาะ rows ที่ยังไม่มี revenue → set revenue + discount
  if (needRevenue.length > 0) {
    await service.from('coupons').update({
      redeemed_revenue_thb:  perCodeRevenue,
      redeemed_discount_thb: perCodeDiscount,
    }).in('id', needRevenue)
    // ignore error (column might not exist on legacy DB)
  }

  if (eventId) {
    await service.from('shopify_webhook_events').update({
      processing_status: 'applied',
      matched_coupon_id: rows[0].id as string,
    }).eq('id', eventId)
  }

  // ── Auto-link user_id ใน shopify_orders ผ่าน coupon match ──
  // ถ้า code ที่ใช้ผูกกับ user ในระบบเรา → set user_id ของ order
  const linkedUserId = rows.find(r => r.user_id)?.user_id as string | null
  if (linkedUserId) {
    await service.from('shopify_orders').update({
      user_id: linkedUserId,
    }).eq('id', order.id).is('user_id', null)
  }

  // Revalidate caches
  revalidatePath('/admin/coupons')
  revalidatePath('/admin/coupons/shopify')
  if (linkedUserId) {
    revalidatePath('/home')
    revalidatePath('/track')
    revalidatePath('/purchases')
  }

  return NextResponse.json({
    success: true,
    matched:   rows.length,
    updated:   updatedCount,
    order_id:  order.id,
    revenue:   total,
    channel,
    codes:     codeStrings,
    linked_user: !!linkedUserId,
  })
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    method: 'POST expected',
    docs: 'Subscribe Shopify Admin → Settings → Notifications → Webhooks → Order payment',
  })
}
