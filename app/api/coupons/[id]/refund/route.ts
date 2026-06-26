// POST /api/coupons/[id]/refund
//
// User แลกคืน reward coupon ที่ยังไม่ใช้ → คืนแต้ม + archive coupon
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { rateLimit, getRateKey } from '@/lib/rate-limit'
import { deletePriceRule, isConfigured, DEFAULT_SHOP_ID } from '@/lib/shopify-discounts'

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

  // ── Revoke the Shopify discount code FIRST ──
  // The refund RPC returns points + archives the coupon, but the code lives in
  // Shopify independently. If we don't delete the price rule, a user could
  // refund for points AND still redeem the code at checkout (double-dip).
  // Delete before refunding: if revoke fails we abort so points aren't returned
  // while the code is still usable. (RLS lets a user read only their own coupon.)
  const { data: coupon } = await supabase
    .from('coupons')
    .select('used_at, auto_issue_key, shopify_price_rule_id, shopify_shop_id')
    .eq('id', params.id)
    .maybeSingle()

  if (coupon && !coupon.used_at && coupon.shopify_price_rule_id && isConfigured()) {
    try {
      await deletePriceRule(coupon.shopify_shop_id || DEFAULT_SHOP_ID, coupon.shopify_price_rule_id)
    } catch (e) {
      console.error('[refund] deletePriceRule failed:', e)
      return NextResponse.json(
        { error: 'ยกเลิกรหัสส่วนลดที่ Shopify ไม่สำเร็จ — กรุณาลองใหม่อีกครั้ง' },
        { status: 502 },
      )
    }
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
