// GET /api/orders/me-bq
//
// ออเดอร์ทั้งหมดที่ user เคยลงทะเบียน + ดึง order info + shipping จาก BQ
// 1 user → 2 BQ query (orders + shipping) แทน N queries

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getShippingByOrderSns, getOrdersByOrderSns } from '@/lib/bigquery'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. หา registered order_sn ของ user (180 วัน — กว้างขึ้นกัน user track ของเก่า)
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString()
  const { data: regs } = await supabase
    .from('purchase_registrations')
    .select('id, order_sn, platform, item_name, status, total_amount, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(80)

  const orderSns = Array.from(new Set((regs || []).map(r => r.order_sn).filter(Boolean) as string[]))
  if (orderSns.length === 0) {
    return NextResponse.json({ items: [] })
  }

  // 2. Parallel: fetch orders (items + image) + shipping
  const [orders, shipments] = await Promise.all([
    getOrdersByOrderSns(orderSns),
    getShippingByOrderSns(orderSns),
  ])

  const orderBySn = new Map(orders.map(o => [o.order_sn, o]))
  const shipBySn = new Map<string, typeof shipments>()
  for (const s of shipments) {
    const arr = shipBySn.get(s.order_sn) || []
    arr.push(s)
    shipBySn.set(s.order_sn, arr)
  }

  // 3. Merge — registration ↔ BQ data
  const items = (regs || []).map(r => ({
    registration: r,
    order:        orderBySn.get(r.order_sn as string) || null,
    shipments:    shipBySn.get(r.order_sn as string) || [],
  }))

  return NextResponse.json({
    user_id: user.id,
    count: items.length,
    items,
  })
}
