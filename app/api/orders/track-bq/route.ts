// GET /api/orders/track-bq?order_sn=<sn>
//
// Lookup ออเดอร์ + shipping status ผ่าน BQ — ครอบคลุมทุก platform
// Public ใช้ rate-limit ป้องกัน scraping

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { rateLimit, getRateKey } from '@/lib/rate-limit'
import { getShippingByOrderSn, verifyOrderInBQVerbose } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const orderSn = (url.searchParams.get('order_sn') || url.searchParams.get('number') || '')
    .trim().replace(/^#/, '')
  if (!orderSn) return NextResponse.json({ error: 'order_sn required' }, { status: 400 })

  // Rate limit
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const rl = rateLimit({ key: getRateKey(req, user?.id), limit: 30, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429, headers: rl.headers })
  }

  // Parallel: lookup order + shipping
  const [orderRes, shipments] = await Promise.all([
    verifyOrderInBQVerbose(orderSn),
    getShippingByOrderSn(orderSn),
  ])

  if (orderRes.status === 'not_found' && shipments.length === 0) {
    return NextResponse.json({ error: 'ไม่พบออเดอร์นี้ในระบบ' }, { status: 404 })
  }
  if (orderRes.status === 'error' && shipments.length === 0) {
    return NextResponse.json({ error: orderRes.error, debug: orderRes.attempted }, { status: 502 })
  }

  return NextResponse.json({
    order:     orderRes.status === 'found' ? orderRes.data : null,
    shipments,
    has_tracking: shipments.some(s => s.tracking_numbers.length > 0),
  }, { headers: rl.headers })
}
