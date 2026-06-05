// ============================================================
// POST /api/admin/orders/seed-test
//
// สร้าง sample shopify_orders 3 อันสำหรับทดสอบ /track
// - 1 อัน 'processing' (paid แต่ยังไม่ส่ง)
// - 1 อัน 'in_transit' (มี tracking number)
// - 1 อัน 'delivered'
//
// ผูกกับ user_id ปัจจุบัน (admin ที่ login) → ทดสอบ /track ของตัวเองได้
// ลบด้วย DELETE /api/admin/orders/seed-test
// ============================================================

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

const SEED_PREFIX = 9999900  // กัน clash กับ Shopify order id จริง (Shopify ใช้ snowflake ใหญ่กว่า)

async function authStaff() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return { error: 'Forbidden', status: 403 as const }
  return { service, staff, userId: user.id }
}

export async function POST(req: Request) {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({})) as { target_user_id?: string; email?: string }
  // ถ้า admin ระบุ target_user_id → seed ให้ user นั้น; ไม่งั้น seed ให้ admin เอง
  const targetUserId = body.target_user_id || auth.userId
  const contactEmail = body.email || 'test@dreame.example'

  // ── ลบ sample เก่าก่อน (กัน accumulate) ──
  await auth.service.from('shopify_orders')
    .delete().gte('id', SEED_PREFIX).lt('id', SEED_PREFIX + 100)

  const now = new Date()
  const yesterday = new Date(now.getTime() - 86_400_000)
  const lastWeek = new Date(now.getTime() - 7 * 86_400_000)

  const samples = [
    {
      id: SEED_PREFIX + 1,
      shop_id: 'dreame-thailand.myshopify.com',
      order_number: '99001', name: '#99001',
      user_id: targetUserId,
      email: contactEmail, phone: '0812345678', customer_name: 'ทดสอบ ระบบ',
      total_price: 4_809.00, subtotal_price: 4_809.00,
      total_discounts: 4_191.00, currency: 'THB',
      financial_status: 'paid', fulfillment_status: null,
      order_status_url: 'https://dreame-thailand.myshopify.com/orders/test-99001',
      fulfillments: [],
      shipping_address: {
        first_name: 'ทดสอบ', last_name: 'ระบบ',
        address1: '123 ถ.สุขุมวิท', city: 'คลองเตย',
        province: 'กรุงเทพมหานคร', zip: '10110', country: 'Thailand',
      },
      line_items: [{ id: 1, name: 'Dreame F20', quantity: 1, price: '9000.00' }],
      discount_codes: [{ code: 'RDMTEST01', amount: '4191.00', type: 'fixed_amount' }],
      shopify_created_at: now.toISOString(),
    },
    {
      id: SEED_PREFIX + 2,
      shop_id: 'dreame-thailand.myshopify.com',
      order_number: '99002', name: '#99002',
      user_id: targetUserId,
      email: contactEmail, phone: '0812345678', customer_name: 'ทดสอบ ระบบ',
      total_price: 1_300.00, subtotal_price: 1_500.00,
      total_discounts: 200.00, currency: 'THB',
      financial_status: 'paid', fulfillment_status: 'partial',
      order_status_url: 'https://dreame-thailand.myshopify.com/orders/test-99002',
      tracking_company: 'Kerry Express',
      tracking_number: 'KEX1234567890TH',
      tracking_url: 'https://th.kerryexpress.com/th/track/?track=KEX1234567890TH',
      fulfillments: [{
        id: 1, status: 'success',
        tracking_company: 'Kerry Express',
        tracking_number: 'KEX1234567890TH',
        tracking_url: 'https://th.kerryexpress.com/th/track/?track=KEX1234567890TH',
        created_at: yesterday.toISOString(),
      }],
      shipping_address: {
        first_name: 'ทดสอบ', last_name: 'ระบบ',
        address1: '123 ถ.สุขุมวิท', city: 'คลองเตย',
        province: 'กรุงเทพมหานคร', zip: '10110', country: 'Thailand',
      },
      line_items: [{ id: 2, name: 'Dreame H12 Pro', quantity: 1, price: '1500.00' }],
      discount_codes: [{ code: 'RDMTEST02', amount: '200.00', type: 'fixed_amount' }],
      shopify_created_at: yesterday.toISOString(),
      shipped_at: yesterday.toISOString(),
    },
    {
      id: SEED_PREFIX + 3,
      shop_id: 'dreame-thailand.myshopify.com',
      order_number: '99003', name: '#99003',
      user_id: targetUserId,
      email: contactEmail, phone: '0812345678', customer_name: 'ทดสอบ ระบบ',
      total_price: 2_800.00, subtotal_price: 3_000.00,
      total_discounts: 200.00, currency: 'THB',
      financial_status: 'paid', fulfillment_status: 'fulfilled',
      order_status_url: 'https://dreame-thailand.myshopify.com/orders/test-99003',
      tracking_company: 'Flash Express',
      tracking_number: 'FE9999888877TH',
      tracking_url: 'https://www.flashexpress.co.th/tracking/?se=FE9999888877TH',
      fulfillments: [{
        id: 2, status: 'success',
        tracking_company: 'Flash Express',
        tracking_number: 'FE9999888877TH',
        created_at: lastWeek.toISOString(),
      }],
      shipping_address: null,
      line_items: [{ id: 3, name: 'Dreame Mini Pocket', quantity: 1, price: '3000.00' }],
      discount_codes: [{ code: 'RDMTEST03', amount: '200.00', type: 'fixed_amount' }],
      shopify_created_at: lastWeek.toISOString(),
      shipped_at: lastWeek.toISOString(),
      delivered_at: new Date(lastWeek.getTime() + 3 * 86_400_000).toISOString(),
    },
  ]

  const { error } = await auth.service.from('shopify_orders').upsert(samples, { onConflict: 'id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/track')
  revalidatePath('/home')
  revalidatePath('/profile')
  revalidatePath('/purchases')

  return NextResponse.json({
    success: true,
    seeded_for_user: targetUserId,
    orders: samples.map(s => ({
      name: s.name,
      number: s.order_number,
      status: s.fulfillment_status || 'processing',
      contact_email: s.email,
      contact_phone: s.phone,
    })),
    test_instructions: {
      visit_track_page: '/track',
      sample_numbers: ['99001', '99002', '99003'],
      contact_for_anonymous: 'test@dreame.example หรือ 0812345678',
    },
  })
}

export async function DELETE() {
  const auth = await authStaff()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { count } = await auth.service.from('shopify_orders')
    .delete({ count: 'exact' })
    .gte('id', SEED_PREFIX).lt('id', SEED_PREFIX + 100)

  revalidatePath('/track')
  return NextResponse.json({ success: true, deleted: count ?? 0 })
}
