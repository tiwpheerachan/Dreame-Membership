// ============================================================
// POST /api/admin/coupons/[id]/reassign
//
// Reassign coupon row หนึ่งใบไปยัง user คนใหม่
// ใช้กรณี: user เปลี่ยน account, ทำคูปองหาย, ขอใหม่
//
// Body:
//   {
//     to_user_id:  string  (required)
//     reason?:     string  // audit note
//   }
//
// Guard:
//   • coupon ต้องยังไม่ถูกใช้ (used_at IS NULL AND used_count = 0)
//   • ต้อง active staff
//   • ถ้ามี auto_issue_key ที่ unique ต่อ user — เช็คก่อนว่า user ใหม่
//     ยังไม่เคยได้รับ key เดียวกัน (จะเข้า unique constraint)
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { to_user_id?: string; reason?: string }
  if (!body.to_user_id) {
    return NextResponse.json({ error: 'to_user_id required' }, { status: 400 })
  }

  // ── ดึง coupon เดิม ──
  const { data: coupon, error: cErr } = await service
    .from('coupons')
    .select('id, code, user_id, used_at, used_count, auto_issue_key, title')
    .eq('id', params.id)
    .single()
  if (cErr || !coupon) return NextResponse.json({ error: 'coupon not found' }, { status: 404 })
  if (coupon.used_at || Number(coupon.used_count) > 0) {
    return NextResponse.json({ error: 'coupon ใช้ไปแล้ว — reassign ไม่ได้' }, { status: 409 })
  }

  // ── ตรวจ user ใหม่ ──
  const { data: target } = await service.from('users')
    .select('id, full_name, tier').eq('id', body.to_user_id).single()
  if (!target) return NextResponse.json({ error: 'user ปลายทางไม่พบ' }, { status: 404 })

  // ── กัน unique constraint ชน (auto_issue_key + new user) ──
  if (coupon.auto_issue_key) {
    const { data: dup } = await service.from('coupons')
      .select('id').eq('user_id', body.to_user_id)
      .eq('auto_issue_key', coupon.auto_issue_key).maybeSingle()
    if (dup) {
      return NextResponse.json({
        error: `user ปลายทางได้รับคูปองชนิดเดียวกันแล้ว (key=${coupon.auto_issue_key})`,
      }, { status: 409 })
    }
  }

  const previousUserId = coupon.user_id as string | null

  // ── ย้ายเจ้าของ ──
  const { error: updErr } = await service.from('coupons')
    .update({ user_id: body.to_user_id })
    .eq('id', params.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  await logAdminAction({
    staffId:    staff.id,
    action:     'COUPON_SHOPIFY_BATCH_CREATED', // reuse — ภายหลังเพิ่ม COUPON_REASSIGNED ได้
    targetType: 'coupon',
    targetId:   params.id,
    userId:     body.to_user_id,
    detail: {
      staff_name:  staff.name,
      operation:   'reassign',
      from_user:   previousUserId,
      to_user:     body.to_user_id,
      to_name:     target.full_name,
      to_tier:     target.tier,
      code:        coupon.code,
      title:       coupon.title,
      reason:      body.reason || null,
    },
  })

  // Invalidate ทั้งสองฝั่ง
  if (previousUserId) revalidatePath(`/admin/members/${previousUserId}`)
  revalidatePath(`/admin/members/${body.to_user_id}`)
  revalidatePath('/admin/coupons')
  revalidatePath('/coupons')

  return NextResponse.json({
    success: true,
    coupon_id: params.id,
    from: previousUserId,
    to: body.to_user_id,
  })
}
