import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyOrderInBQVerbose } from '@/lib/bigquery'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { order_sn, channel } = await req.json()
    if (!order_sn) return NextResponse.json({ error: 'order_sn required' }, { status: 400 })

    // For STORE channel, skip BQ verification
    if (channel === 'STORE') {
      return NextResponse.json({ status: 'PENDING', message: 'คำสั่งซื้อหน้าร้านจะได้รับการตรวจสอบโดย Admin' })
    }

    const result = await verifyOrderInBQVerbose(order_sn.trim())

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
      message: 'ยังไม่พบข้อมูลใน BigQuery (ระบบอัปเดตทุก 6 ชั่วโมง) ลงทะเบียนต่อได้เลย ระบบจะตรวจสอบให้อัตโนมัติ',
    })
  } catch (error) {
    console.error('[API] verify-order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
