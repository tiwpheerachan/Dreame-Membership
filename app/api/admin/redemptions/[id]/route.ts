// PATCH /api/admin/redemptions/[id]
// อัปเดต status, tracking, หรือสั่ง refund
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'
import {
  deletePriceRule, generateDiscounts, buildApplyUrl,
  isConfigured, DEFAULT_SHOP_ID, ShopifyDiscountError,
} from '@/lib/shopify-discounts'
import { fetchShopifyProductPrice } from '@/lib/shopify-price'

async function authStaff() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({})) as {
    status?: 'confirmed' | 'shipping' | 'delivered'
    tracking_number?: string
    tracking_carrier?: string
    admin_note?: string
    // Refund mode
    refund?: boolean
    refund_reason?: string
  }

  // ── Refund flow → ใช้ RPC + cleanup Shopify code + coupon row ──
  if (body.refund) {
    if (!body.refund_reason) return NextResponse.json({ error: 'refund_reason required' }, { status: 400 })

    // 1. ดึง redemption ก่อน — เพื่อเก็บ shopify_code/price_rule_id ไว้ cleanup
    const { data: redRow } = await auth.service
      .from('redemptions')
      .select('id, shopify_code, shopify_price_rule_id, status')
      .eq('id', params.id).single()
    if (!redRow) return NextResponse.json({ error: 'redemption not found' }, { status: 404 })

    // 2. เรียก RPC refund — คืน points + คืน stock + status='cancelled'
    const { data, error } = await auth.service.rpc('refund_redemption', {
      p_redemption_id: params.id,
      p_admin_id:      auth.staff.id,
      p_reason:        body.refund_reason,
    })
    if (error) {
      if (/function .* does not exist/i.test(error.message)) {
        return NextResponse.json({ error: 'ฟีเจอร์ยังไม่พร้อม — รัน migration 0016' }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const r = data as { error?: string; success?: true; refunded_points?: number }
    if (r?.error) return NextResponse.json({ error: r.error }, { status: 400 })

    // 3. Cleanup Shopify code + coupon row (CRITICAL — ป้องกัน user ใช้ code หลัง refund)
    const cleanup = { shopify_deleted: false, coupon_deleted: false, shopify_error: null as string | null }
    if (redRow.shopify_price_rule_id && isConfigured()) {
      try {
        await deletePriceRule(DEFAULT_SHOP_ID, Number(redRow.shopify_price_rule_id))
        cleanup.shopify_deleted = true
      } catch (e) {
        const err = e as ShopifyDiscountError
        // 404 = ลบไปแล้ว ถือว่า ok; อื่น ๆ บันทึก error
        if (err.status === 404) cleanup.shopify_deleted = true
        else cleanup.shopify_error = err.detail || err.message
      }
    }
    if (redRow.shopify_code) {
      const { count } = await auth.service.from('coupons')
        .delete({ count: 'exact' })
        .eq('code', redRow.shopify_code)
      cleanup.coupon_deleted = (count ?? 0) > 0
    }

    await logAdminAction({
      staffId: auth.staff.id, action: 'COUPON_SHOPIFY_BATCH_CREATED',
      targetType: 'redemption', targetId: params.id,
      detail: {
        staff_name: auth.staff.name, operation: 'refund',
        reason: body.refund_reason, refunded_points: r.refunded_points,
        cleanup,
      },
    })
    revalidatePath('/admin/redemptions')
    revalidatePath('/redemptions')
    revalidatePath('/coupons')
    return NextResponse.json({ ...r, cleanup })
  }

  // ── Status / tracking update ──
  const patch: Record<string, unknown> = {}
  if (body.status) {
    const allowedStatuses = ['confirmed', 'shipping', 'delivered', 'expired']
    if (!allowedStatuses.includes(body.status)) {
      return NextResponse.json({
        error: `invalid status — ใช้ได้: ${allowedStatuses.join(', ')} (refund ใช้ flag refund แทน)`,
      }, { status: 400 })
    }
    patch.status = body.status
    if (body.status === 'shipping')  patch.shipped_at = new Date().toISOString()
    if (body.status === 'delivered') patch.delivered_at = new Date().toISOString()
  }
  if (body.tracking_number !== undefined) patch.tracking_number = body.tracking_number
  if (body.tracking_carrier !== undefined) patch.tracking_carrier = body.tracking_carrier
  if (body.admin_note !== undefined) patch.admin_note = body.admin_note

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  }

  const { error } = await auth.service.from('redemptions').update(patch).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    staffId: auth.staff.id, action: 'COUPON_SHOPIFY_BATCH_CREATED',
    targetType: 'redemption', targetId: params.id,
    detail: { staff_name: auth.staff.name, operation: 'update', changes: patch },
  })
  revalidatePath('/admin/redemptions')
  revalidatePath('/redemptions')

  return NextResponse.json({ success: true })
}
