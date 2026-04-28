import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logAdminAction } from '@/lib/audit'
import { uploadToSupabase } from '@/lib/upload'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: staff } = await service.from('admin_staff')
    .select('id, name').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const user_id        = formData.get('user_id') as string
  const order_sn       = (formData.get('order_sn') as string | null)?.trim() || ''
  const channel        = (formData.get('channel') as string | null) || 'STORE'
  const channel_type   = (formData.get('channel_type') as string | null) || 'ONSITE'
  const model_name     = (formData.get('model_name') as string | null)?.trim() || ''
  const sku            = (formData.get('sku') as string | null) || ''
  const serial_number  = (formData.get('serial_number') as string | null)?.trim() || ''
  const purchase_date  = formData.get('purchase_date') as string
  const total_amount   = formData.get('total_amount') as string
  const invoice_no     = formData.get('invoice_no') as string
  const status         = 'ADMIN_APPROVED'
  const receiptFile    = formData.get('receipt') as File | null

  if (!user_id || !order_sn) {
    return NextResponse.json({ error: 'user_id and order_sn required' }, { status: 400 })
  }

  let receipt_image_url: string | null = null
  if (receiptFile && receiptFile.size > 0) {
    const { url, error } = await uploadToSupabase(service, receiptFile, 'receipts', 'receipt')
    if (error) return NextResponse.json({ error }, { status: 400 })
    receipt_image_url = url ?? null
  }

  const purchaseDate = purchase_date ? new Date(purchase_date) : new Date()
  const warrantyEnd = new Date(purchaseDate)
  warrantyEnd.setMonth(warrantyEnd.getMonth() + 12)

  const { data: reg, error } = await service
    .from('purchase_registrations')
    .insert({
      user_id, order_sn, invoice_no, channel, channel_type,
      model_name, sku, serial_number,
      purchase_date: purchaseDate.toISOString().split('T')[0],
      total_amount: Number(total_amount || 0),
      receipt_image_url,
      warranty_months: 12,
      warranty_start: purchaseDate.toISOString().split('T')[0],
      warranty_end: warrantyEnd.toISOString().split('T')[0],
      bq_verified: channel_type === 'ONLINE',
      status,
      approved_by: staff.id,
      approved_at: new Date().toISOString(),
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Atomic point award via DB function
  await service.rpc('award_points_for_purchase', { p_purchase_reg_id: reg.id })

  await logAdminAction({
    staffId:    staff.id,
    action:     'PURCHASE_ADDED',
    targetType: 'purchase',
    targetId:   reg.id,
    userId:     user_id,
    detail: {
      staff_name: staff.name,
      order_sn,
      model_name,
      channel,
      total_amount: Number(total_amount || 0),
    },
  })

  return NextResponse.json({ success: true, registration: reg, staff_name: staff.name })
}
