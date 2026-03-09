import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { adjustPoints } from '@/lib/points'
import { logAdminAction } from '@/lib/audit'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', user!.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, delta, description } = await req.json()
  if (!user_id || !delta || !description) {
    return NextResponse.json({ error: 'user_id, delta, description required' }, { status: 400 })
  }

  // ใส่ชื่อ admin ใน description อัตโนมัติ
  const fullDescription = `[${staff.name}] ${description}`

  const { error } = await adjustPoints(user_id, Number(delta), fullDescription, staff.id)
  if (error) return NextResponse.json({ error }, { status: 400 })

  // Log audit
  await logAdminAction({
    staffId:    staff.id,
    action:     'POINTS_ADJUSTED',
    targetType: 'points',
    targetId:   user_id,
    userId:     user_id,
    detail: {
      staff_name: staff.name,
      delta: Number(delta),
      description,
    },
  })

  return NextResponse.json({ success: true, staff_name: staff.name })
}