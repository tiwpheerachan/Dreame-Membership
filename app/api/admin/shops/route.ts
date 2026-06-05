// GET /api/admin/shops — list Shopify shops ที่ระบบรู้จัก
// อ่านจาก SHOPIFY_SHOPS env (comma-separated "<id>:<label>")
// fallback เป็น SHOPIFY_DEFAULT_SHOP_ID

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getShopOptions } from '@/lib/shopify-discounts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ shops: getShopOptions() })
}
