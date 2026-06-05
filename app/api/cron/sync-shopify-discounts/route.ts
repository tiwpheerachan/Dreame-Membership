// ============================================================
// POST /api/cron/sync-shopify-discounts
//
// Why this exists:
//   The ecom-data-platform docs say "automatic push is not yet
//   implemented" — webhook fires only when *we* call /notify.
//
// What this does:
//   1) Find all distinct (shop_id, price_rule_id) pairs in our
//      coupons table that still have UNUSED codes.
//   2) For each pair, call Shopify /notify — that updates usage in
//      their DB AND POSTs to our webhook_url (configured per API key).
//   3) Our webhook handler updates coupons.used_at idempotently.
//
// Schedule: hit this every 5–15 minutes via Render Cron (or any
// external cron). Auth via ?secret=$CRON_SECRET or
// Authorization: Bearer $CRON_SECRET (Vercel-style).
// ============================================================

import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  notify, generateDiscounts, buildApplyUrl, isConfigured,
  ShopifyDiscountError,
} from '@/lib/shopify-discounts'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

function checkSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const url = new URL(req.url)
  const qs = url.searchParams.get('secret')
  if (qs && qs === expected) return true
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (bearer && bearer === expected) return true
  return false
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: 'SHOPIFY_DISCOUNT_API_KEY not set' }, { status: 503 })
  }

  const service = createServiceClient()

  // Pull all (shop_id, price_rule_id) pairs from unredeemed coupons.
  // We only sync rules where there's still at least one unused code —
  // there's no point asking Shopify about fully-redeemed batches.
  const { data: pending, error } = await service
    .from('coupons')
    .select('shopify_shop_id, shopify_price_rule_id')
    .not('shopify_price_rule_id', 'is', null)
    .is('used_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const pairs = new Map<string, { shop_id: string; price_rule_id: number }>()
  for (const r of pending || []) {
    const shop = r.shopify_shop_id as string | null
    const pr   = r.shopify_price_rule_id as number | null
    if (!shop || !pr) continue
    pairs.set(`${shop}|${pr}`, { shop_id: shop, price_rule_id: pr })
  }

  const results: Array<{ shop_id: string; price_rule_id: number; ok: boolean; detail?: string; updated?: number }> = []

  // Small delay between calls so we don't hammer Shopify or the platform.
  // 200ms × 50 rules = 10s — well under serverless 60s timeout.
  const DELAY_MS = 200
  for (const { shop_id, price_rule_id } of pairs.values()) {
    try {
      const res = await notify(shop_id, price_rule_id)
      const usedCount = (res.codes || []).filter(c => Number(c.usage_count) > 0).length
      results.push({ shop_id, price_rule_id, ok: true, updated: usedCount })
    } catch (e) {
      const err = e as ShopifyDiscountError
      results.push({
        shop_id, price_rule_id, ok: false,
        detail: err.detail || err.message,
      })
    }
    if (pairs.size > 1) await new Promise(r => setTimeout(r, DELAY_MS))
  }

  // ============================================================
  // Phase 2 — Auto pool top-up
  //
  // หา campaign ที่ตั้ง low_pool_threshold ไว้และ pool ว่าง < threshold
  // → generate batch ใหม่ + insert เป็น pool (user_id NULL) + ดัน fan-out
  //   ให้ user ที่ถูก tier-link รออยู่ (claim_shopify_code_for_user)
  // ============================================================
  const topup: Array<{
    price_rule_id: number; shop_id: string; ok: boolean;
    generated?: number; reason?: string; assigned?: number;
  }> = []

  // ดึงรายการที่ enable + ใกล้หมด — โดย view v_shopify_campaign_pool ทำ JOIN ให้แล้ว
  const { data: pools, error: poolErr } = await service
    .from('v_shopify_campaign_pool')
    .select('config_id, shop_id, price_rule_id, low_pool_threshold, topup_batch_size, topup_paused, last_topup_at, pool_free, default_value_type, default_value, default_min_purchase, default_code_prefix, default_ends_at, title, auto_assign_tier')
    .not('low_pool_threshold', 'is', null)
    .eq('topup_paused', false)

  if (poolErr) {
    return NextResponse.json({
      success: true, pairs_synced: pairs.size, results,
      topup_error: poolErr.message,
    })
  }

  for (const p of pools || []) {
    const threshold = Number(p.low_pool_threshold)
    const free = Number(p.pool_free) || 0
    if (free >= threshold) continue

    const batchSize = Number(p.topup_batch_size) || 100
    const need = Math.max(batchSize, threshold - free)
    const quantity = Math.min(need, 500)   // Shopify cap

    // ต้องมีค่าค่าส่วนลด default ก่อนถึงจะ top-up ได้
    if (!p.default_value_type || !p.default_value) {
      topup.push({
        price_rule_id: Number(p.price_rule_id),
        shop_id: String(p.shop_id),
        ok: false,
        reason: 'default_value missing — config ยังไม่สมบูรณ์',
      })
      continue
    }

    // กัน double-topup รัวด้วยช่วง 60 วินาที — ถ้าเพิ่ง top-up ไป ข้ามรอบนี้
    if (p.last_topup_at) {
      const since = Date.now() - new Date(p.last_topup_at as string).getTime()
      if (since < 60_000) {
        topup.push({
          price_rule_id: Number(p.price_rule_id),
          shop_id: String(p.shop_id),
          ok: false,
          reason: `recently topped up ${Math.round(since / 1000)}s ago — skipping`,
        })
        continue
      }
    }

    try {
      const gen = await generateDiscounts({
        shop_id: String(p.shop_id),
        title: String(p.title || `Top-up ${p.price_rule_id}`),
        value_type: p.default_value_type as 'percentage' | 'fixed_amount',
        value: Number(p.default_value),
        code_prefix: (p.default_code_prefix as string) || 'DREAME',
        quantity,
        starts_at: new Date().toISOString(),
        ends_at: (p.default_ends_at as string | null) || new Date(Date.now() + 365 * 86_400_000).toISOString(),
        minimum_order_amount: p.default_min_purchase ? Number(p.default_min_purchase) : undefined,
        usage_limit_per_customer: true,
      })

      // Top-up อาจสร้าง price_rule ใหม่ — เก็บโค้ดไว้ใน pool ผูกกับ price_rule ที่ Shopify คืนมา
      const today = new Date().toISOString().split('T')[0]
      const validUntil = ((p.default_ends_at as string | null) || new Date(Date.now() + 365 * 86_400_000).toISOString()).split('T')[0]
      const inserts = gen.codes.map(code => ({
        user_id:        null,
        code,
        title:          String(p.title || 'Auto top-up'),
        discount_type:  p.default_value_type === 'percentage' ? 'PERCENT' : 'FIXED',
        discount_value: Number(p.default_value),
        min_purchase:   p.default_min_purchase ? Number(p.default_min_purchase) : 0,
        valid_from:     today,
        valid_until:    validUntil,
        theme:          'gold',
        shopify_shop_id:       String(p.shop_id),
        shopify_price_rule_id: gen.price_rule_id,
        apply_url:             buildApplyUrl(String(p.shop_id), code),
        shopify_synced_at:     new Date().toISOString(),
      }))

      const { error: insErr } = await service.from('coupons').insert(inserts)
      if (insErr) {
        topup.push({
          price_rule_id: Number(p.price_rule_id),
          shop_id: String(p.shop_id),
          ok: false,
          reason: `db insert failed: ${insErr.message}`,
        })
        continue
      }

      // อัปเดต config: บันทึก top-up + ถ้า Shopify ออก price_rule ใหม่ตามอนุสนธิ ก็เลื่อน config มา point ที่ rule ใหม่
      await service
        .from('shopify_campaign_config')
        .update({
          last_topup_at:    new Date().toISOString(),
          last_topup_count: inserts.length,
          last_topup_error: null,
          // ถ้า Shopify generate ออก price_rule ใหม่ → ย้าย config มาคุม rule ใหม่
          // (ไม่งั้น top-up รอบหน้าจะดู pool ของ rule เก่าซึ่งว่างหมดแล้ว)
          price_rule_id:    gen.price_rule_id,
        })
        .eq('id', p.config_id as string)

      // ── Auto-assign ให้ user ที่ tier match แต่ยังไม่ได้รับ ──
      let assignedCount = 0
      if (p.auto_assign_tier) {
        const { data: users } = await service
          .from('users')
          .select('id')
          .eq('is_active', true)
          .eq('tier', p.auto_assign_tier as string)
          .limit(inserts.length)
        for (const u of users || []) {
          const { data: claimedId } = await service.rpc('claim_shopify_code_for_user', {
            p_user_id: u.id,
            p_shop_id: String(p.shop_id),
            p_price_rule_id: gen.price_rule_id,
            p_issue_key: `SHOPIFY_CAMP_${p.price_rule_id}`,
          })
          if (claimedId) assignedCount++
        }
      }

      topup.push({
        price_rule_id: Number(p.price_rule_id),
        shop_id: String(p.shop_id),
        ok: true,
        generated: inserts.length,
        assigned: assignedCount,
      })
    } catch (e) {
      const err = e as ShopifyDiscountError
      // เก็บ error ลง config เพื่อให้ admin เห็น
      await service
        .from('shopify_campaign_config')
        .update({ last_topup_error: err.detail || err.message })
        .eq('id', p.config_id as string)
      topup.push({
        price_rule_id: Number(p.price_rule_id),
        shop_id: String(p.shop_id),
        ok: false,
        reason: err.detail || err.message,
      })
    }
    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  return NextResponse.json({
    success: true,
    pairs_synced: pairs.size,
    sync_results: results,
    topup_results: topup,
    topup_count: topup.filter(t => t.ok).length,
  })
}

// Allow GET for quick manual trigger from browser (still requires secret)
export async function GET(req: Request) {
  return POST(req)
}
