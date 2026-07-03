// PATCH /api/admin/privileges/[roundId]
//   { action: 'claim' | 'unclaim', note?: string }
// ติ๊กว่ารับน้ำยาแล้ว/ยกเลิกการติ๊ก สำหรับ 1 รอบ — ไม่หักแต้ม (เป็นสิทธิฟรี)
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/audit'
import { effectiveStatus, type StoredRoundStatus } from '@/lib/refill'

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

export async function PATCH(req: Request, { params }: { params: { roundId: string } }) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({})) as { action?: 'claim' | 'unclaim'; note?: string }
  const action = body.action
  if (action !== 'claim' && action !== 'unclaim') {
    return NextResponse.json({ error: 'action must be claim | unclaim' }, { status: 400 })
  }

  const { data: round } = await auth.service
    .from('refill_rounds')
    .select('id, privilege_id, round_no, status, claim_open, claim_close, claimed_at')
    .eq('id', params.roundId).single()
  if (!round) return NextResponse.json({ error: 'round not found' }, { status: 404 })

  let patch: Record<string, unknown>

  if (action === 'claim') {
    if (round.status === 'claimed') {
      return NextResponse.json({ error: 'รอบนี้ติ๊กรับไปแล้ว' }, { status: 409 })
    }
    patch = {
      status: 'claimed' as StoredRoundStatus,
      claimed_at: new Date().toISOString(),
      claimed_by: auth.staff.id,
      claim_note: body.note || null,
    }
  } else {
    // unclaim → กลับไปคำนวณสถานะตามวันที่ (upcoming/expired)
    const back: StoredRoundStatus =
      effectiveStatus({ status: 'upcoming', claim_open: round.claim_open as string, claim_close: round.claim_close as string }) === 'expired'
        ? 'expired' : 'upcoming'
    patch = { status: back, claimed_at: null, claimed_by: null, claim_note: null }
  }

  const { error } = await auth.service.from('refill_rounds').update(patch).eq('id', params.roundId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction({
    staffId: auth.staff.id,
    action: 'REFILL_ROUND_UPDATED',
    targetType: 'refill_round',
    targetId: params.roundId,
    detail: { staff_name: auth.staff.name, operation: action, round_no: round.round_no, privilege_id: round.privilege_id },
  })

  revalidatePath('/admin/privileges')
  revalidatePath('/privileges')
  return NextResponse.json({ success: true, status: patch.status })
}
