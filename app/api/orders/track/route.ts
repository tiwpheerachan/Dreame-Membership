// GET /api/orders/track?number=1234&contact=08X-XXX-XXXX
//
// Public lookup — user กรอก order number + phone/email หรือ login แล้ว
// query เฉพาะของตัวเอง
//
// Anti-enum protection: ต้องใส่ contact (phone/email) match ถึงจะคืนข้อมูล
// (ป้องกัน scraper ไล่ order number)

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, getRateKey } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const number  = (url.searchParams.get('number') || '').trim().replace(/^#/, '')
  const contact = (url.searchParams.get('contact') || '').trim().toLowerCase()

  if (!number) return NextResponse.json({ error: 'กรุณาระบุเลขออเดอร์' }, { status: 400 })

  // Rate limit — 20/min ต่อ IP/user (กัน scrape order numbers)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const rl = rateLimit({ key: getRateKey(req, user?.id), limit: 20, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429, headers: rl.headers })
  }

  const service = createServiceClient()

  // หา order — match ทั้ง number พร้อม "#" และ raw
  let q = service.from('v_user_active_orders').select('*').or(`order_number.eq.${number},name.eq.#${number},name.eq.${number}`)

  const { data: orderRows, error } = await q.limit(5)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!orderRows || orderRows.length === 0) {
    // Try outside the view (cancelled / very old)
    const { data: legacy } = await service
      .from('shopify_orders')
      .select('id, order_number, name, user_id, email, phone, fulfillment_status, financial_status, cancelled_at')
      .or(`order_number.eq.${number},name.eq.#${number},name.eq.${number}`)
      .limit(5)
    if (!legacy || legacy.length === 0) {
      return NextResponse.json({ error: 'ไม่พบออเดอร์นี้' }, { status: 404 })
    }
    return NextResponse.json({
      error: 'ออเดอร์นี้ยกเลิกแล้ว หรือเก่าเกินไป', archived: true,
    }, { status: 410 })
  }

  // ─ Authorization ─
  // 1. ถ้า login → ออเดอร์ต้องเป็นของ user
  // 2. ถ้าไม่ login → ต้องใส่ contact ที่ตรง (phone/email)
  const order = orderRows[0]
  if (user) {
    if (order.user_id !== user.id) {
      // อาจจะเป็น order ที่ยังไม่ link → ลองใช้ contact match
      if (!contact) {
        return NextResponse.json({
          error: 'กรุณายืนยันตัวตน — ใส่ email หรือเบอร์โทรของออเดอร์',
        }, { status: 403 })
      }
      // Fall through to contact check
    } else {
      return NextResponse.json({ order, authorized: 'self' }, { headers: rl.headers })
    }
  }

  if (!contact) {
    return NextResponse.json({
      error: 'กรุณาใส่ email หรือเบอร์โทรที่ใช้สั่งซื้อ',
    }, { status: 403 })
  }

  // Fetch contact info for verification
  const { data: full } = await service
    .from('shopify_orders').select('email, phone')
    .eq('id', order.id).single()

  const emailMatch = full?.email?.toLowerCase() === contact
  const phoneMatch = full?.phone?.replace(/[^0-9]/g, '') === contact.replace(/[^0-9]/g, '')
  if (!emailMatch && !phoneMatch) {
    return NextResponse.json({ error: 'ข้อมูลยืนยันไม่ตรง' }, { status: 403 })
  }

  return NextResponse.json({ order, authorized: 'contact' }, { headers: rl.headers })
}
