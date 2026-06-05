// ============================================================
// POST /api/cron/tier-batch?type=quarterly|monthly
//
// เรียก batch functions ที่กำหนดใน 0011_auto_tier_coupons.sql:
//   • quarterly → run_quarterly_gift_batch()   (Gold + Platinum)
//   • monthly   → run_monthly_shipping_batch() (Gold เท่านั้น)
//
// แนะนำตั้งใน Render Cron:
//   • Quarterly: ทุก 1 ของเดือน (Jan/Apr/Jul/Oct) — ฟังก์ชัน idempotent
//   • Monthly:   ทุก 1 ของเดือน
//
// Auth: ?secret=$CRON_SECRET หรือ Authorization: Bearer
// ============================================================

import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0
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

  const type = new URL(req.url).searchParams.get('type')
  const service = createServiceClient()

  let fnName: string
  if (type === 'quarterly')      fnName = 'run_quarterly_gift_batch'
  else if (type === 'monthly')   fnName = 'run_monthly_shipping_batch'
  else return NextResponse.json({ error: 'type must be "quarterly" or "monthly"' }, { status: 400 })

  const { data, error } = await service.rpc(fnName)
  if (error) {
    return NextResponse.json({ error: error.message, fn: fnName }, { status: 500 })
  }

  revalidatePath('/admin/coupons')
  revalidatePath('/coupons')

  return NextResponse.json({
    success: true,
    type,
    issued_count: data,
    ran_at: new Date().toISOString(),
  })
}

export async function GET(req: Request) {
  return POST(req)
}
