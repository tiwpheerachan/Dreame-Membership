// ============================================================
// Admin: set/change a customer's password.
// SUPER_ADMIN only. Audited (the password itself is NEVER logged).
// Note: customers normally log in passwordless (phone OTP / email magic-link);
// setting a password enables email+password login for support scenarios.
// ============================================================
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logAdminAction } from '@/lib/audit'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', authUser.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (staff.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้นที่ตั้งรหัสผ่านลูกค้าได้' }, { status: 403 })
  }

  const { password } = await req.json().catch(() => ({}))
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' }, { status: 400 })
  }

  // users.id IS the auth user id (users.id REFERENCES auth.users(id)).
  const { error } = await service.auth.admin.updateUserById(params.id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Audit — record WHO/WHEN, never the password value.
  await logAdminAction({
    staffId: staff.id, action: 'MEMBER_PASSWORD_SET', targetType: 'user',
    targetId: params.id, userId: params.id,
    detail: { staff_name: staff.name },
  })

  return NextResponse.json({ success: true, staff_name: staff.name })
}
