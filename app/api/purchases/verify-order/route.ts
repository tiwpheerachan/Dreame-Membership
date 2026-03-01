import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyOrderInBQ } from '@/lib/bigquery'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
        message: 'ยังไม่พบข้อมูลใน BigQuery ระบบจะตรวจสอบอัตโนมัติทุก 1 ชั่วโมง',
      })
    }
  } catch (error) {
    console.error('[API] verify-order error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
