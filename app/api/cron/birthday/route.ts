import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateCouponCode } from '@/lib/utils'

// Cron: daily at 8am — send birthday coupon to members with DOB = today
// Setup: vercel.json or external cron → GET /api/cron/birthday with Authorization: Bearer CRON_SECRET
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[CRON] CRON_SECRET not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: birthdays } = await supabase.from('v_birthdays_today').select('*')
  if (!birthdays || birthdays.length === 0) {
    return NextResponse.json({ message: 'No birthdays today', count: 0 })
  }

  const today = new Date().toISOString().split('T')[0]
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + 30)
  const validUntilStr = validUntil.toISOString().split('T')[0]

  const inserts = birthdays.map(b => ({
    user_id: b.id,
    code: generateCouponCode(),
    title: '🎂 Happy Birthday!',
    description: 'ของขวัญวันเกิดจาก Dreame · ใช้ได้ภายใน 30 วัน',
    discount_type: 'PERCENT',
    discount_value: 15,
    min_purchase: 0,
    valid_from: today,
    valid_until: validUntilStr,
  }))

  const { error } = await supabase.from('coupons').insert(inserts)
  if (error) {
    console.error('[CRON birthday] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Birthday coupons sent',
    count: birthdays.length,
    members: birthdays.map(b => ({ id: b.id, member_id: b.member_id, name: b.full_name })),
  })
}
