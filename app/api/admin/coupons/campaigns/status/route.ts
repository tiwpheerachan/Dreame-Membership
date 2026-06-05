// ============================================================
// PATCH /api/admin/coupons/campaigns/status
//
// อัปเดต status ของ coupons ทั้งกลุ่ม (campaign)
//
// Body — ระบุกลุ่มอย่างใดอย่างหนึ่ง:
//   { coupon_ids: string[], status }            — รายตัว
//   { auto_issue_key, status }                  — ทั้งกลุ่ม native tier
//   { shopify_price_rule_id, shop_id?, status } — ทั้ง Shopify campaign
//   { title, valid_until, discount_value, discount_type, status }
//                                               — admin-created bundle
//
// status: 'active' | 'paused' | 'archived'
//   • active   = ปกติ
//   • paused   = ปิดชั่วคราว — user เห็น แต่ใช้ไม่ได้
//   • archived = ซ่อนถาวร — ไม่โชว์ใน list ปกติ
//
// Behavior:
//   • ไม่แตะ used codes — เก็บประวัติไว้
//   • Bulk update ผ่าน service role
//   • Audit log บันทึก operation
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'

type Status = 'active' | 'paused' | 'archived'

type Body = {
  status: Status
  reason?: string
  coupon_ids?: string[]
  auto_issue_key?: string
  shopify_price_rule_id?: number
  shop_id?: string
  // bundle: legacy admin-created คูปองชุดเดียวกัน (group by 4 fields)
  title?: string
  valid_until?: string
  discount_value?: number
  discount_type?: 'PERCENT' | 'FIXED'
}

export async function PATCH(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as Partial<Body>
  if (!body.status || !['active', 'paused', 'archived'].includes(body.status)) {
    return NextResponse.json({
      error: 'status ต้องเป็น active / paused / archived',
    }, { status: 400 })
  }

  // ── Build query ──
  let q = service.from('coupons').update({ status: body.status }, { count: 'exact' })

  if (Array.isArray(body.coupon_ids) && body.coupon_ids.length > 0) {
    q = q.in('id', body.coupon_ids)
  } else if (body.auto_issue_key) {
    q = q.eq('auto_issue_key', body.auto_issue_key)
  } else if (body.shopify_price_rule_id) {
    q = q.eq('shopify_price_rule_id', body.shopify_price_rule_id)
    if (body.shop_id) q = q.eq('shopify_shop_id', body.shop_id)
  } else if (body.title && body.valid_until) {
    q = q.eq('title', body.title).eq('valid_until', body.valid_until)
    if (body.discount_value !== undefined) q = q.eq('discount_value', body.discount_value)
    if (body.discount_type)               q = q.eq('discount_type', body.discount_type)
  } else {
    return NextResponse.json({
      error: 'ต้องระบุ coupon_ids, auto_issue_key, shopify_price_rule_id หรือ (title+valid_until)',
    }, { status: 400 })
  }

  // ไม่แตะ used codes — เก็บประวัติ
  q = q.is('used_at', null)

  const { count, error } = await q
  if (error) {
    // Fallback: ถ้าคอลัมน์ status ยังไม่มีในตาราง (migration 0015 ยังไม่ apply)
    if (/status.*schema cache|column .*status/i.test(error.message)) {
      return NextResponse.json({
        error: 'คอลัมน์ status ยังไม่ apply — รัน migration 0015 ก่อน',
        migration_pending: true,
      }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction({
    staffId:    staff.id,
    action:     'COUPON_SHOPIFY_BATCH_CREATED', // reuse — เพิ่ม COUPON_STATUS_CHANGED ในอนาคต
    targetType: 'coupon',
    detail: {
      staff_name: staff.name,
      operation:  'status_change',
      to_status:  body.status,
      affected:   count ?? 0,
      reason:     body.reason || null,
      filter: {
        coupon_ids:            body.coupon_ids?.length || null,
        auto_issue_key:        body.auto_issue_key || null,
        shopify_price_rule_id: body.shopify_price_rule_id || null,
        title:                 body.title || null,
      },
    },
  })

  revalidatePath('/admin/coupons')
  revalidatePath('/admin/coupons/shopify')
  revalidatePath('/coupons')

  return NextResponse.json({
    success: true,
    status: body.status,
    affected: count ?? 0,
  })
}
