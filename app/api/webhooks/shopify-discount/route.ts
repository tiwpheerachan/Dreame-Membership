// ============================================================
// POST /api/webhooks/shopify-discount
//
// Receives push from ecom-data-platform when codes get used.
// Body shape (per their docs):
//   {
//     shop_id: string
//     price_rule_id: number
//     price_rule_title: string
//     summary: { ... }
//     codes: [{ code: string, usage_count: number }]   // only codes with usage > 0
//   }
//
// Behavior:
//   • For each code with usage_count > 0:
//     - find matching coupon row (same shop + price_rule + code)
//     - mark used_at = now() if not already used
//     - increment used_count
//   • Idempotent — safe to be called multiple times
//
// Security:
//   The ecom platform doesn't sign payloads (per their docs). To avoid
//   anyone hitting this endpoint and zeroing out coupons, we require a
//   shared `?secret=` query param that matches CRON_SECRET (we re-use it
//   to avoid yet another env var).
// ============================================================

import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface IncomingBody {
  shop_id?: string
  price_rule_id?: number
  price_rule_title?: string
  codes?: Array<{ code: string; usage_count: number }>
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret') || req.headers.get('x-webhook-secret')
  const expected = process.env.CRON_SECRET || process.env.SHOPIFY_DISCOUNT_WEBHOOK_SECRET
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as IncomingBody
  const service = createServiceClient()

  // ── ทุก payload เก็บใน shopify_webhook_events (debug aid) ──
  // เก็บก่อน validate เพื่อให้เห็น payload เสีย ๆ ด้วย
  let eventId: string | null = null
  try {
    const { data: evt } = await service
      .from('shopify_webhook_events')
      .insert({
        shop_id:       body.shop_id || null,
        price_rule_id: body.price_rule_id || null,
        code:          body.codes?.[0]?.code || null,
        payload:       body as unknown as Record<string, unknown>,
        processing_status: 'received',
      })
      .select('id')
      .single()
    eventId = (evt as { id: string } | null)?.id || null
  } catch { /* table might not exist yet on stale DB — non-fatal */ }

  if (!body.shop_id || !body.price_rule_id) {
    if (eventId) {
      await service.from('shopify_webhook_events')
        .update({ processing_status: 'error', error_message: 'missing shop_id or price_rule_id' })
        .eq('id', eventId)
    }
    return NextResponse.json({ error: 'shop_id + price_rule_id required' }, { status: 400 })
  }

  const used = (body.codes || []).filter(c => Number(c.usage_count) > 0)
  if (used.length === 0) {
    if (eventId) {
      await service.from('shopify_webhook_events')
        .update({ processing_status: 'skipped', error_message: 'no used codes' })
        .eq('id', eventId)
    }
    return NextResponse.json({ success: true, updated: 0, note: 'no used codes in payload' })
  }

  const now = new Date().toISOString()
  const codeStrings = used.map(c => c.code)

  // ── Find unredeemed coupon rows that match ──
  const { data: rows, error: selErr } = await service
    .from('coupons')
    .select('id, code, used_at, user_id')
    .eq('shopify_shop_id', body.shop_id)
    .eq('shopify_price_rule_id', body.price_rule_id)
    .in('code', codeStrings)
    .is('used_at', null)

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    // All already marked — still 200 (idempotent)
    return NextResponse.json({ success: true, updated: 0, already_used: codeStrings.length })
  }

  const ids = rows.map(r => r.id as string)
  const { error: updErr } = await service
    .from('coupons')
    .update({
      used_at: now,
      used_count: 1,
      shopify_synced_at: now,
    })
    .in('id', ids)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  // Touch all matching codes' synced_at even if already used (diagnostics)
  await service.from('coupons')
    .update({ shopify_synced_at: now })
    .eq('shopify_shop_id', body.shop_id)
    .eq('shopify_price_rule_id', body.price_rule_id)
    .in('code', codeStrings)

  // ── Audit log per redeemed coupon ──
  // Find a "system" staff for attribution. If none, leave staff_id null —
  // logAdminAction will handle gracefully (admin_audit_log.staff_id is nullable).
  const { data: systemStaff } = await service.from('admin_staff')
    .select('id').eq('role', 'SUPER_ADMIN').eq('is_active', true).limit(1).single()
  const systemStaffId = systemStaff?.id

  if (systemStaffId) {
    for (const row of rows) {
      await logAdminAction({
        staffId: systemStaffId,
        action: 'COUPON_SHOPIFY_REDEEMED',
        targetType: 'coupon',
        targetId: row.id,
        userId: row.user_id || undefined,
        detail: {
          staff_name: 'System (Shopify webhook)',
          code: row.code,
          shop_id: body.shop_id,
          price_rule_id: body.price_rule_id,
        },
      })
    }
  }

  // Invalidate caches so user/admin views update
  revalidatePath('/admin/coupons')
  revalidatePath('/coupons')
  // Invalidate each affected user's member-detail page
  const uniqueUsers = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean) as string[]))
  for (const uid of uniqueUsers) {
    revalidatePath(`/admin/members/${uid}`)
  }

  if (eventId) {
    await service.from('shopify_webhook_events')
      .update({
        processing_status: 'applied',
        matched_coupon_id: rows[0].id as string,
      })
      .eq('id', eventId)
  }

  return NextResponse.json({
    success: true,
    updated: rows.length,
    affected_users: uniqueUsers.length,
    event_id: eventId,
  })
}

// Allow ecom-platform to send GET to discover endpoint exists (some senders ping first)
export async function GET() {
  return NextResponse.json({ status: 'ok', method: 'POST expected', endpoint: 'shopify-discount-webhook' })
}
