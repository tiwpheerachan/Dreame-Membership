import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { awardPoints } from '@/lib/points'
import type { BQOrderData } from '@/types'
import { randomUUID } from 'crypto'

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
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const order_sn = formData.get('order_sn') as string
    const channel = formData.get('channel') as string
    const channel_type = formData.get('channel_type') as string
    const serial_number = formData.get('serial_number') as string
    const invoice_no = formData.get('invoice_no') as string
    const address = formData.get('address') as string
    const bqDataStr = formData.get('bq_data') as string | null
    const receiptFile = formData.get('receipt') as File | null

    if (!order_sn || !serial_number) {
      return NextResponse.json({ error: 'order_sn and serial_number are required' }, { status: 400 })
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('purchase_registrations')
      .select('id')
      .eq('order_sn', order_sn)
      .eq('user_id', session.user.id)
      .single()

    if (existing) return NextResponse.json({ error: 'คุณลงทะเบียน Order ID นี้แล้ว' }, { status: 409 })

    // Parse BQ data if available
    let bqData: BQOrderData | null = null
    if (bqDataStr) {
      try { bqData = JSON.parse(bqDataStr) } catch {}
    }

    const serviceSupabase = createServiceClient()

    // Upload receipt image to Supabase Storage
    let receipt_image_url: string | null = null
    if (receiptFile && receiptFile.size > 0) {
      receipt_image_url = await uploadToSupabase(receiptFile, 'receipts', serviceSupabase)
    }

    // Calculate warranty end date
    const purchaseDate = bqData?.order_date ? new Date(bqData.order_date) : new Date()
    const warrantyEnd = new Date(purchaseDate)
    warrantyEnd.setMonth(warrantyEnd.getMonth() + 12)

    // Get first item info
    const firstItem = bqData?.items?.[0]

    const { data: reg, error: regError } = await serviceSupabase
      .from('purchase_registrations')
      .insert({
        user_id: session.user.id,
        order_sn: order_sn.trim(),
        invoice_no: invoice_no || null,
        channel,
        channel_type,
        sku: firstItem?.item_sku || null,
        model_name: firstItem?.item_name || null,
        serial_number: serial_number.trim(),
        purchase_date: bqData?.order_date || null,
        total_amount: bqData?.total_amount || 0,
        receipt_image_url,
        warranty_months: 12,
        warranty_start: purchaseDate.toISOString().split('T')[0],
        warranty_end: warrantyEnd.toISOString().split('T')[0],
        bq_verified: bqData !== null,
        bq_verified_at: bqData ? new Date().toISOString() : null,
        bq_raw_data: bqData || null,
        status: bqData ? 'BQ_VERIFIED' : 'PENDING',
      })
      .select()
      .single()

    if (regError) throw regError

    // Add to pending queue if not verified
    if (!bqData) {
      await serviceSupabase.from('pending_verifications').insert({
        purchase_reg_id: reg.id,
        order_sn: order_sn.trim(),
      })
    } else {
      // Award points immediately if BQ verified
      await awardPoints(reg.id)
    }

    // Update user address if provided
    if (address) {
      await serviceSupabase.from('users').update({ address }).eq('id', session.user.id)
    }

    return NextResponse.json({ success: true, registration_id: reg.id, status: reg.status })
  } catch (error) {
    console.error('[API] register error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}