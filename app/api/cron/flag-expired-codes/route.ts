// ============================================================
// POST /api/cron/flag-expired-codes
//
// เรียก flag_expired_redemption_codes() ให้ flag redemption ที่ code
// หมดอายุ (code_expires_at < now) เป็น status 'expired'
//
// แนะนำตั้งใน Render Cron: daily at 03:00 (Asia/Bangkok)
// ============================================================

import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function checkSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const qs = new URL(req.url).searchParams.get('secret')
  if (qs && qs === expected) return true
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  return Boolean(bearer && bearer === expected)
}

export async function POST(req: Request) {
  if (!checkSecret(req)) {
    return NextResponse.json({ error: 'invalid secret' }, { status: 401 })
  }
  const service = createServiceClient()

  // 1. Flag expired codes
  const { data: flagged, error } = await service.rpc('flag_expired_redemption_codes')
  if (error) {
    if (/function .* does not exist/i.test(error.message)) {
      return NextResponse.json({ error: 'ฟีเจอร์ยังไม่พร้อม — รัน migration 0019' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 2. Cleanup webhook events เก่ากว่า 90 วัน (กัน table บวม)
  const { data: cleaned } = await service.rpc('cleanup_old_webhook_events')

  revalidatePath('/admin/redemptions')
  revalidatePath('/redemptions')

  return NextResponse.json({
    success: true,
    flagged_count: flagged,
    cleaned_webhook_events: cleaned ?? 0,
    ran_at: new Date().toISOString(),
  })
}

export async function GET(req: Request) { return POST(req) }
