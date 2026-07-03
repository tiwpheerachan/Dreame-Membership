// Cron: daily — ดูแลรอบรับน้ำยาฟรี
//   1) ตัดสิทธิ (expire) รอบที่เลยหน้าต่างรับ (today > claim_close) และยังไม่ได้รับ
//   2) mark reminded_at รอบที่จะครบกำหนดในอีก 5 วัน (สำหรับเตือน / hook SMS ภายหลัง)
// Setup: pg_cron → GET /api/cron/refill-reminders  (Authorization: Bearer CRON_SECRET)
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { REMIND_DAYS_BEFORE } from '@/lib/refill'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const today = new Date().toISOString().split('T')[0]
  const remindDate = new Date()
  remindDate.setDate(remindDate.getDate() + REMIND_DAYS_BEFORE)
  const remindStr = remindDate.toISOString().split('T')[0]

  // 1) ตัดสิทธิรอบที่เลยกำหนด
  const { data: expired, error: expErr } = await service
    .from('refill_rounds')
    .update({ status: 'expired' })
    .lt('claim_close', today)
    .eq('status', 'upcoming')
    .select('id')
  if (expErr && !/does not exist|schema cache/i.test(expErr.message)) {
    return NextResponse.json({ error: expErr.message }, { status: 500 })
  }

  // 2) mark รอบที่จะครบกำหนดในอีก 5 วัน (ยังไม่เคยเตือน)
  const { data: reminded } = await service
    .from('refill_rounds')
    .update({ reminded_at: new Date().toISOString() })
    .eq('due_date', remindStr)
    .eq('status', 'upcoming')
    .is('reminded_at', null)
    .select('id, privilege_id, round_no')

  // NOTE: การส่ง SMS/push จริง hook เพิ่มตรงนี้ได้ (ยังไม่มี provider wiring)
  //       ตอนนี้ผู้ใช้เห็น banner เตือนสดในหน้า /privileges อยู่แล้ว (คำนวณจากวันที่)

  return NextResponse.json({
    ok: true,
    expired: expired?.length || 0,
    reminded: reminded?.length || 0,
    remind_date: remindStr,
  })
}
