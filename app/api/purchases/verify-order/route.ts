import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyOrderInBQVerbose, verifyBySerialInBQVerbose } from '@/lib/bigquery'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const order_sn = (body.order_sn as string | undefined)?.trim() || ''
    const serial_number = (body.serial_number as string | undefined)?.trim() || ''
    const channel = body.channel as string | undefined

    // หน้าร้าน (STORE) has no Order ID → look up BQ by Serial Number instead.
    // The SN is also its claim key (stored in order_sn), so dedupe on it too.
    const bySerial = channel === 'STORE' || (!order_sn && !!serial_number)
    const claimKey = bySerial ? serial_number : order_sn
    if (!claimKey) return NextResponse.json({ error: 'order_sn or serial_number required' }, { status: 400 })

    // ── Already claimed? 1 order/unit = 1 claim across the whole system ──
    // Block early (before BQ) if this key already has a non-REJECTED
    // registration by anyone. Service client needed — RLS hides other users.
    const service = createServiceClient()
    const { data: claimed } = await service
      .from('purchase_registrations')
      .select('user_id, status')
      .eq('order_sn', claimKey)
      .neq('status', 'REJECTED')
      .limit(1)
      .maybeSingle()
    if (claimed) {
      const mine = claimed.user_id === user.id
      return NextResponse.json({
        status: 'ALREADY_CLAIMED',
        message: bySerial
          ? (mine ? 'คุณลงทะเบียน Serial Number นี้ไปแล้ว' : 'Serial Number นี้ถูกใช้ลงทะเบียนไปแล้ว ไม่สามารถใช้ซ้ำได้')
          : (mine ? 'คุณลงทะเบียนออเดอร์นี้ไปแล้ว' : 'ออเดอร์นี้ถูกใช้ลงทะเบียนไปแล้ว ไม่สามารถใช้ซ้ำได้'),
      })
    }

    const result = bySerial
      ? await verifyBySerialInBQVerbose(serial_number)
      : await verifyOrderInBQVerbose(order_sn)

    if (result.status === 'found') {
      return NextResponse.json({ status: 'VERIFIED', order: result.data })
    }
    if (result.status === 'error') {
      // ทำให้ user เห็นความต่าง: query fail ≠ ออเดอร์ไม่มีอยู่ใน BQ
      // ลงทะเบียนต่อได้อยู่ (admin จะ verify เอง) แต่บอกตรงๆ ว่าระบบตรวจไม่ได้
      console.error('[API] verify-order BQ error:', result.error, result.attempted)
      return NextResponse.json({
        status: 'BQ_ERROR',
        message: 'ตรวจสอบกับ BigQuery ไม่สำเร็จ ลงทะเบียนต่อได้ — แอดมินจะ verify ให้',
      })
    }
    return NextResponse.json({
      status: 'PENDING',
      message: 'ยังไม่พบข้อมูลออเดอร์ กรุณาตรวจสอบความถูกต้องของข้อมูล — สถานะการสั่งซื้อจะได้รับการตรวจสอบภายใน 1-2 วัน ลงทะเบียนต่อได้เลย',
    })
  } catch (error) {
    console.error('[API] verify-order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
