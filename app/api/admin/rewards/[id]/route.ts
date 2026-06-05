// PATCH / DELETE /api/admin/rewards/[id]
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'

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

  const body = await req.json().catch(() => ({}))
  const allowed = [
    'model_id', 'name', 'short_description', 'description', 'image_url', 'images',
    'points_required', 'stock', 'stock_remaining', 'allowed_tiers',
    'terms', 'redemption_limit_per_user', 'starts_at', 'ends_at',
    'status', 'is_featured', 'display_order',
    // 3 redemption modes
    'redeem_type', 'cash_top_up_thb', 'original_price_thb',
    'voucher_value_thb', 'voucher_min_purchase_thb',
    'shopify_product_url', 'code_validity_days',
  ]
  const patch: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]

  // ถ้าเปลี่ยน stock → reset stock_remaining (admin restock)
  if ('stock' in body && body.stock !== null && !('stock_remaining' in body)) {
    patch.stock_remaining = body.stock
  }

  const { data, error } = await auth.service.from('rewards')
    .update(patch).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    staffId: auth.staff.id,
    action: 'COUPON_SHOPIFY_BATCH_CREATED',
    targetType: 'reward', targetId: params.id,
    detail: { staff_name: auth.staff.name, operation: 'reward_update', changes: Object.keys(patch) },
  })
  revalidatePath('/admin/rewards')
  revalidatePath('/rewards')

  return NextResponse.json({ success: true, reward: data })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // soft-delete = archive (มี FK จาก redemptions)
  const { error } = await auth.service.from('rewards')
    .update({ status: 'archived' }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    staffId: auth.staff.id,
    action: 'COUPON_SHOPIFY_BATCH_CREATED',
    targetType: 'reward', targetId: params.id,
    detail: { staff_name: auth.staff.name, operation: 'reward_archive' },
  })
  revalidatePath('/admin/rewards')
  revalidatePath('/rewards')

  return NextResponse.json({ success: true })
}
