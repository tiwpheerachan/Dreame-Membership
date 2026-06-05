// ============================================================
// POST /api/admin/coupons/shopify/campaigns/[priceRuleId]/distribute
//
// แจก codes จาก pool (user_id IS NULL) ไปยัง users ตามเงื่อนไข
// ใช้สำหรับ campaign ที่ import แล้วยังไม่แจก หรือ pool top-up ที่ค้าง
//
// Body:
//   {
//     mode:        'tier' | 'all_active' | 'vip' | 'user_ids'
//     tier?:       'SILVER' | 'GOLD' | 'PLATINUM'  (mode = 'tier')
//     user_ids?:   string[]                         (mode = 'user_ids')
//     limit?:      number                           // max codes to distribute
//   }
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'
import { DEFAULT_SHOP_ID } from '@/lib/shopify-discounts'

type Body = {
  mode:      'tier' | 'all_active' | 'vip' | 'user_ids'
  tier?:     'SILVER' | 'GOLD' | 'PLATINUM'
  user_ids?: string[]
  limit?:    number
}

export async function POST(
  req: Request,
  { params }: { params: { priceRuleId: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const priceRuleId = Number(params.priceRuleId)
  if (!priceRuleId) return NextResponse.json({ error: 'invalid priceRuleId' }, { status: 400 })
  const shopId = new URL(req.url).searchParams.get('shop_id') || DEFAULT_SHOP_ID

  const body = (await req.json().catch(() => ({}))) as Partial<Body>
  if (!body.mode) return NextResponse.json({ error: 'mode required' }, { status: 400 })

  // ── หา recipients ──
  let candidates: string[] = []
  if (body.mode === 'user_ids') {
    candidates = body.user_ids || []
  } else if (body.mode === 'tier') {
    if (!body.tier) return NextResponse.json({ error: 'tier required' }, { status: 400 })
    const { data } = await service.from('users').select('id').eq('is_active', true).eq('tier', body.tier)
    candidates = (data || []).map(r => r.id as string)
  } else if (body.mode === 'all_active') {
    const { data } = await service.from('users').select('id').eq('is_active', true)
    candidates = (data || []).map(r => r.id as string)
  } else if (body.mode === 'vip') {
    const { data } = await service.from('users').select('id').eq('is_active', true).eq('is_vip', true)
    candidates = (data || []).map(r => r.id as string)
  }
  const initialCount = candidates.length

  if (initialCount === 0) {
    return NextResponse.json({
      error: body.mode === 'tier'
        ? `ไม่มีสมาชิก tier ${body.tier} ที่ active`
        : body.mode === 'vip'
          ? 'ไม่มีสมาชิก VIP'
          : 'ไม่มีสมาชิก active',
      target_count: 0,
    }, { status: 400 })
  }

  // ── ตัด user ที่มีคูปองจาก campaign นี้แล้ว ──
  const { data: alreadyHas } = await service
    .from('coupons')
    .select('user_id')
    .eq('shopify_shop_id', shopId)
    .eq('shopify_price_rule_id', priceRuleId)
    .in('user_id', candidates)
    .not('user_id', 'is', null)
  const skip = new Set((alreadyHas || []).map(r => r.user_id as string))
  const recipients = candidates.filter(id => !skip.has(id))

  if (recipients.length === 0) {
    return NextResponse.json({
      error: `สมาชิกทั้ง ${initialCount} คนได้รับคูปองนี้ครบหมดแล้ว`,
      target_count:        initialCount,
      skipped_already_has: skip.size,
    }, { status: 409 })
  }

  // ── ดึง pool codes (user_id NULL, ยังไม่ใช้) ──
  const cap = Math.max(1, body.limit
    ? Math.min(body.limit, recipients.length)
    : recipients.length)
  const { data: pool, error: poolErr } = await service
    .from('coupons')
    .select('id, code')
    .eq('shopify_shop_id', shopId)
    .eq('shopify_price_rule_id', priceRuleId)
    .is('user_id', null)
    .is('used_at', null)
    .order('created_at', { ascending: true })
    .limit(cap)

  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 })

  if (!pool || pool.length === 0) {
    return NextResponse.json({
      error: 'pool ว่างไม่พอ — กรุณา top-up ก่อน',
      pool_free: 0,
      target_count: recipients.length,
    }, { status: 409 })
  }

  // ── จับคู่ 1:1 (เอา min ของ pool/recipients) ──
  const pairCount = Math.min(pool.length, recipients.length)
  const pairs = Array.from({ length: pairCount }, (_, i) => ({
    coupon_id: pool[i].id as string,
    user_id:   recipients[i],
    code:      pool[i].code as string,
  }))

  // ── Bulk update ──
  // ใช้ auto_issue_key เพื่อกันออกซ้ำ — แต่ DB ที่ยังไม่ apply migration 0011
  // จะไม่มีคอลัมน์นี้ → fallback ไป update เฉพาะ user_id
  const issueKey = `SHOPIFY_CAMP_${priceRuleId}`
  let schemaMissingAutoIssueKey = false
  const results = await Promise.all(pairs.map(async p => {
    // ถ้ารู้ว่า schema ไม่มี col แล้ว ข้ามไปยัง simple path เลย
    if (schemaMissingAutoIssueKey) {
      const { error } = await service.from('coupons')
        .update({ user_id: p.user_id })
        .eq('id', p.coupon_id)
      return { ...p, ok: !error, error: error?.message }
    }
    const { error } = await service.from('coupons')
      .update({ user_id: p.user_id, auto_issue_key: issueKey })
      .eq('id', p.coupon_id)
    if (error && /auto_issue_key.*schema cache/i.test(error.message)) {
      // ─ Fallback: schema เก่า — ลองใหม่ไม่ใส่ auto_issue_key ─
      schemaMissingAutoIssueKey = true
      const { error: e2 } = await service.from('coupons')
        .update({ user_id: p.user_id })
        .eq('id', p.coupon_id)
      return { ...p, ok: !e2, error: e2?.message }
    }
    return { ...p, ok: !error, error: error?.message }
  }))

  const okCount  = results.filter(r => r.ok).length
  const failures = results.filter(r => !r.ok)
  const firstError = failures[0]?.error
  const warning = schemaMissingAutoIssueKey
    ? 'auto_issue_key ยังไม่ได้ migrate — แจกสำเร็จแต่ไม่มีกันออกซ้ำอัตโนมัติ (run migration 0011)'
    : null

  await logAdminAction({
    staffId:    staff.id,
    action:     'COUPON_SHOPIFY_BATCH_CREATED',
    targetType: 'coupon',
    detail: {
      staff_name:    staff.name,
      operation:     'distribute',
      shop_id:       shopId,
      price_rule_id: priceRuleId,
      mode:          body.mode,
      tier:          body.tier,
      candidates:    initialCount,
      eligible:      recipients.length,
      pool_pulled:   pool.length,
      distributed:   okCount,
      failures:      failures.length,
      first_error:   firstError || null,
    },
  })

  revalidatePath('/admin/coupons')
  revalidatePath(`/admin/coupons/campaign/${priceRuleId}`)
  revalidatePath('/coupons')

  return NextResponse.json({
    success: true,
    distributed:         okCount,
    pool_used:           pool.length,
    skipped_already_has: skip.size,
    candidates:          initialCount,
    eligible:            recipients.length,
    failures:            failures.length,
    error_sample:        firstError || null,
    pool_exhausted:      pool.length < recipients.length,
    warning,
  })
}
