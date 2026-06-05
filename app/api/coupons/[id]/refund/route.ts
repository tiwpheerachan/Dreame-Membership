// POST /api/coupons/[id]/refund
//
// User แลกคืน reward coupon ที่ยังไม่ใช้ → คืนแต้ม + archive coupon
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { rateLimit, getRateKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit — 10 ครั้งต่อชั่วโมงต่อ user
  const rl = rateLimit({
    key: getRateKey(req, user.id) + ':refund',
    limit: 10, windowMs: 3_600_000,
  })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'พยายามแลกคืนถี่เกินไป กรุณารอสักครู่' },
      { status: 429, headers: rl.headers },
    )
  }

  if (!params.id) {
    return NextResponse.json({ error: 'coupon id required' }, { status: 400 })
  }

  // เรียก RPC — RPC เช็คเจ้าของผ่าน auth.uid() เอง
  const { data, error } = await supabase.rpc('self_refund_coupon', {
    p_coupon_id: params.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (data?.error) {
    return NextResponse.json({ error: data.error }, { status: 400 })
  }

  // Audit log — ใช้ตาราง admin_audit_log แม้จะเป็น self action เพื่อ trace ได้
  try {
    const service = createServiceClient()
    await service.from('admin_audit_log').insert({
      staff_id:    null,           // user action, ไม่ใช่ admin
      user_id:     user.id,
      action_type: 'COUPON_SELF_REFUND',
      target_type: 'coupon',
      target_id:   params.id,
      detail: {
        coupon_id:       params.id,
        refunded_points: data.refunded_points,
        new_balance:     data.new_balance,
        reward_name:     data.reward_name,
        coupon_code:     data.coupon_code,
      },
    })
  } catch { /* audit not blocker */ }

  revalidatePath('/coupons')
  revalidatePath('/points')
  revalidatePath('/redemptions')
  revalidatePath('/home')
  revalidatePath('/profile')
  revalidatePath('/(user)', 'layout')

  return NextResponse.json({
    success: true,
    refunded_points: data.refunded_points,
    new_balance:     data.new_balance,
    reward_name:     data.reward_name,
  })
}
