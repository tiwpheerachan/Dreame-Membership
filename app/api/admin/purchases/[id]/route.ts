import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { awardPoints } from '@/lib/points'
import { logAdminAction } from '@/lib/audit'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', session.user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status, admin_note } = await req.json()
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const { data: reg, error } = await serviceSupabase
    .from('purchase_registrations')
    .update({ status, admin_note, approved_by: staff.id, approved_at: new Date().toISOString() })
    .eq('id', params.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (status === 'ADMIN_APPROVED' && reg && reg.points_awarded === 0) await awardPoints(reg.id)

  await logAdminAction({
    staffId: staff.id,
    action: status === 'ADMIN_APPROVED' ? 'PURCHASE_APPROVED' : 'PURCHASE_REJECTED',
    targetType: 'purchase', targetId: params.id, userId: reg?.user_id,
    detail: { staff_name: staff.name, status, admin_note: admin_note || null, order_sn: reg?.order_sn, model_name: reg?.model_name },
  })

  return NextResponse.json({ success: true, purchase: reg, staff_name: staff.name })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', session.user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ดึงข้อมูลก่อนลบ เพื่อ log
  const { data: reg } = await serviceSupabase
    .from('purchase_registrations').select('*').eq('id', params.id).single()

  if (!reg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ลบ points_log ที่เกี่ยวข้องก่อน (ถ้ามี)
  await serviceSupabase.from('points_log').delete().eq('purchase_reg_id', params.id)

  // ลบ pending_verifications ที่เกี่ยวข้อง
  await serviceSupabase.from('pending_verifications').delete().eq('purchase_reg_id', params.id)

  // ลบ purchase
  const { error } = await serviceSupabase.from('purchase_registrations').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // คืนแต้ม ถ้าเคยได้รับแต้มไปแล้ว
  const pointsToRevert = Number(reg.points_awarded) || 0
  if (pointsToRevert > 0 && reg.user_id) {
    await serviceSupabase.rpc('adjust_user_points', {
      p_user_id: reg.user_id,
      p_delta: -pointsToRevert,
    }).catch(() => {
      // fallback: update directly
      serviceSupabase.from('users')
        .select('total_points, lifetime_points').eq('id', reg.user_id).single()
        .then(({ data: u }) => {
          if (u) serviceSupabase.from('users').update({
            total_points: Math.max(0, u.total_points - pointsToRevert),
            lifetime_points: Math.max(0, u.lifetime_points - pointsToRevert),
          }).eq('id', reg.user_id)
        })
    })
  }

  await logAdminAction({
    staffId: staff.id, action: 'PURCHASE_ADDED', targetType: 'purchase',
    targetId: params.id, userId: reg.user_id,
    detail: { staff_name: staff.name, action: 'DELETED', order_sn: reg.order_sn, model_name: reg.model_name, points_reverted: pointsToRevert },
  })

  return NextResponse.json({ success: true, points_reverted: pointsToRevert, staff_name: staff.name })
}