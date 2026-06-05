// GET /api/orders/me — user's recent Shopify orders + tracking
//
// ใช้ใน /track page (logged-in user) + auto banner บน home

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Active (กำลังส่ง / ยังไม่ส่ง / ส่งล่าสุดใน 30 วัน)
  const { data: active } = await supabase
    .from('v_user_active_orders')
    .select('*')
    .eq('user_id', user.id)
    .order('shopify_created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    active: active || [],
  })
}
