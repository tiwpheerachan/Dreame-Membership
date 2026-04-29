// ============================================================
// Admin: ad-hoc BigQuery lookup by order_sn.
// Read-only — does not modify any registrations. Surfaces the
// underlying BQ error when the query fails so admins can tell
// "row truly missing" apart from "BQ misconfigured".
// ============================================================
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyOrderInBQVerbose } from '@/lib/bigquery'
import { logAdminAction } from '@/lib/audit'

export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const order_sn = (searchParams.get('order_sn') || '').trim()
  if (!order_sn) {
    return NextResponse.json({ error: 'order_sn required' }, { status: 400 })
  }

  const result = await verifyOrderInBQVerbose(order_sn)

  // Audit so we can see who looked up what. target_id is a UUID column, and
  // order_sn isn't one — keep order_sn in detail and leave target_id null.
  await logAdminAction({
    staffId: staff.id,
    action: 'BQ_LOOKUP',
    targetType: 'purchase',
    detail: {
      staff_name: staff.name,
      order_sn,
      result_status: result.status,
    },
  })

  if (result.status === 'found') {
    return NextResponse.json({ found: true, order: result.data })
  }
  if (result.status === 'not_found') {
    return NextResponse.json({
      found: false,
      message: 'ไม่พบ order_sn นี้ใน BigQuery (อัปเดตทุก 6 ชั่วโมง)',
    })
  }
  // BQ failed — return 200 so the UI can render the diagnostic, but with bq_error set
  return NextResponse.json({
    found: false,
    bq_error: result.error,
    attempted: result.attempted,
    message: 'BigQuery ดึงข้อมูลไม่สำเร็จ — ตรวจ env / credentials',
  })
}
