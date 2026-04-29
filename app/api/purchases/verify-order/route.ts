import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyOrderInBQ } from '@/lib/bigquery'

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

    // Try BigQuery verification
    const order = await verifyOrderInBQ(order_sn.trim())

    if (order) {
      return NextResponse.json({ status: 'VERIFIED', order })
    } else {
      return NextResponse.json({
        status: 'PENDING',
        message: 'ยังไม่พบข้อมูลใน BigQuery (ระบบอัปเดตทุก 6 ชั่วโมง) ลงทะเบียนต่อได้เลย ระบบจะตรวจสอบให้อัตโนมัติ',
      })
    }
  } catch (error) {
    console.error('[API] verify-order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
