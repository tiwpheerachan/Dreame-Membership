// ============================================================
// Admin: re-check a single PENDING purchase against BigQuery on demand.
// If BQ now has the row, promote to BQ_VERIFIED, fill metadata, award
// points, and remove from pending_verifications. Otherwise, bump
// retry_count so the admin sees the attempt was made.
// ============================================================
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { verifyOrderInBQ } from '@/lib/bigquery'
import { logAdminAction } from '@/lib/audit'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: reg } = await service
    .from('purchase_registrations')
    .select('id, user_id, order_sn, status, channel_type, points_awarded')
    .eq('id', params.id)
    .single()

  if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (reg.channel_type !== 'ONLINE') {
    return NextResponse.json({
      status: 'SKIPPED',
      message: 'คำสั่งซื้อช่องทางหน้าร้านไม่ตรวจสอบกับ BigQuery — กรุณาอนุมัติด้วยตนเอง',
    })
  }

  const bqData = await verifyOrderInBQ(reg.order_sn)

  if (!bqData) {
    // Bump retry_count so the queue reflects the attempt
    await service.rpc('increment_pending_retry', { p_purchase_reg_id: reg.id }).then(
      () => undefined,
      async () => {
        // Fallback: do it inline if RPC isn't installed
        const { data: pv } = await service
          .from('pending_verifications')
          .select('retry_count')
          .eq('purchase_reg_id', reg.id)
          .single()
        if (pv) {
          await service
            .from('pending_verifications')
            .update({
              retry_count: Number(pv.retry_count) + 1,
              last_retry_at: new Date().toISOString(),
            })
            .eq('purchase_reg_id', reg.id)
        }
      },
    )

    return NextResponse.json({
      status: 'NOT_FOUND',
      message: 'ยังไม่พบใน BigQuery (อัปเดตทุก 6 ชั่วโมง)',
    })
  }

  // Found — promote to BQ_VERIFIED
  const firstItem = bqData.items?.[0]
  const purchaseDate = bqData.order_date ? new Date(bqData.order_date) : new Date()
  const warrantyEnd = new Date(purchaseDate)
  warrantyEnd.setMonth(warrantyEnd.getMonth() + 24)  // 2-year warranty

  const { error: updErr } = await service
    .from('purchase_registrations')
    .update({
      bq_verified: true,
      bq_verified_at: new Date().toISOString(),
      bq_raw_data: bqData,
      status: 'BQ_VERIFIED',
      sku: firstItem?.item_sku || null,
      model_name: firstItem?.item_name || null,
      purchase_date: bqData.order_date || null,
      total_amount: bqData.total_amount,
      warranty_start: purchaseDate.toISOString().split('T')[0],
      warranty_end: warrantyEnd.toISOString().split('T')[0],
    })
    .eq('id', reg.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  // Award points only if not already awarded
  if (!reg.points_awarded || reg.points_awarded === 0) {
    await service.rpc('award_points_for_purchase', { p_purchase_reg_id: reg.id })
  }

  await service.from('pending_verifications').delete().eq('purchase_reg_id', reg.id)

  await logAdminAction({
    staffId: staff.id,
    action: 'PURCHASE_BQ_RECHECKED',
    targetType: 'purchase',
    targetId: reg.id,
    userId: reg.user_id,
    detail: {
      staff_name: staff.name,
      order_sn: reg.order_sn,
      total_amount: bqData.total_amount,
      platform: bqData.platform,
    },
  })

  revalidatePath('/admin/pending')
  revalidatePath('/admin/purchases')
  if (reg.user_id) revalidatePath(`/admin/members/${reg.user_id}`)

  return NextResponse.json({ status: 'VERIFIED', order: bqData, staff_name: staff.name })
}
