// ============================================================
// Admin: generate a one-time magic login link for a customer.
// SUPER_ADMIN only. Audited. The admin can open the link (in a PRIVATE window,
// so it doesn't replace their admin session) to access the account, or hand it
// to the customer. Requires the customer to have an email (magic links are
// email-based) — add one via the edit form first if missing.
// ============================================================
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logAdminAction } from '@/lib/audit'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name, role').eq('auth_user_id', authUser.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (staff.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'เฉพาะ Super Admin เท่านั้นที่สร้างลิงก์เข้าระบบได้' }, { status: 403 })
  }

  const { data: u } = await service.from('users').select('email, full_name').eq('id', params.id).single()
  if (!u) return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 })
  if (!u.email) {
    return NextResponse.json({ error: 'ลูกค้ายังไม่มีอีเมล — กรุณาเพิ่มอีเมลก่อน (magic link ต้องใช้อีเมล)' }, { status: 400 })
  }

  // Build the post-login redirect from the incoming request origin so it lands
  // on this same deployment's /home. Falls back to NEXT_PUBLIC_SITE_URL.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(_req.url).origin
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: u.email,
    options: { redirectTo: `${origin}/auth/callback?next=/home` },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const link = data?.properties?.action_link
  if (!link) return NextResponse.json({ error: 'สร้างลิงก์ไม่สำเร็จ' }, { status: 500 })

  await logAdminAction({
    staffId: staff.id, action: 'MEMBER_LOGIN_LINK', targetType: 'user',
    targetId: params.id, userId: params.id,
    detail: { staff_name: staff.name, email: u.email },
  })

  return NextResponse.json({ success: true, link, email: u.email })
}
