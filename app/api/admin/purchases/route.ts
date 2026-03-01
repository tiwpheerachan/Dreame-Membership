import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { awardPoints } from '@/lib/points'
import { randomUUID } from 'crypto'
import { logAdminAction } from '@/lib/audit'

async function uploadToSupabase(file: File, folder: string, serviceClient: ReturnType<typeof createServiceClient>): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${folder}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await serviceClient.storage
      .from('dreame-files')
      .upload(path, buffer, { contentType: file.type, upsert: true })
    if (error) { console.error('[Upload]', error); return null }
    const { data: { publicUrl } } = serviceClient.storage.from('dreame-files').getPublicUrl(path)
    return publicUrl
  } catch (e) { console.error('[Upload]', e); return null }
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const { data: staff } = await serviceSupabase.from('admin_staff')
    .select('id, name').eq('auth_user_id', session.user.id).eq('is_active', true).single()
  if (!staff) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await req.formData()
  const user_id = formData.get('user_id') as string
  const order_sn = formData.get('order_sn') as string
  const channel = formData.get('channel') as string || 'STORE'
  const channel_type = formData.get('channel_type') as string || 'ONSITE'
  const model_name = formData.get('model_name') as string
  const sku = formData.get('sku') as string
  const serial_number = formData.get('serial_number') as string
  const purchase_date = formData.get('purchase_date') as string
  const total_amount = formData.get('total_amount') as string
  const invoice_no = formData.get('invoice_no') as string
  const status = 'ADMIN_APPROVED'
  const receiptFile = formData.get('receipt') as File | null

  if (!user_id || !order_sn) {
    return NextResponse.json({ error: 'user_id and order_sn required' }, { status: 400 })
  }

  let receipt_image_url: string | null = null
  if (receiptFile && receiptFile.size > 0) {
    receipt_image_url = await uploadToSupabase(receiptFile, 'receipts', serviceSupabase)
  }

  const purchaseDate = purchase_date ? new Date(purchase_date) : new Date()
  const warrantyEnd = new Date(purchaseDate)
  warrantyEnd.setMonth(warrantyEnd.getMonth() + 12)

  const { data: reg, error } = await serviceSupabase
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
  await awardPoints(reg.id)

  // Log audit
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