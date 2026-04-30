import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { uploadToSupabase } from '@/lib/upload'
import type { BQOrderData } from '@/types'

export async function POST(req: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const order_sn      = (formData.get('order_sn') as string | null)?.trim() || ''
    const channel       = (formData.get('channel') as string | null) || 'OTHER'
    const channel_type  = (formData.get('channel_type') as string | null) || 'ONLINE'
    const serial_number = (formData.get('serial_number') as string | null)?.trim() || ''
    const invoice_no    = (formData.get('invoice_no') as string | null)?.trim() || ''
    const address       = (formData.get('address') as string | null)?.trim() || ''
    const bqDataStr     = formData.get('bq_data') as string | null
    const receiptFile   = formData.get('receipt') as File | null

    if (!order_sn) {
      return NextResponse.json({ error: 'order_sn is required' }, { status: 400 })
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('purchase_registrations')
      .select('id')
      .eq('order_sn', order_sn)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'คุณลงทะเบียน Order ID นี้แล้ว' }, { status: 409 })

    // Parse BQ data if available
    let bqData: BQOrderData | null = null
    if (bqDataStr) {
      try { bqData = JSON.parse(bqDataStr) } catch { /* ignore malformed */ }
    }

    const service = createServiceClient()

    // Upload receipt with validation
    let receipt_image_url: string | null = null
    if (receiptFile && receiptFile.size > 0) {
      const { url, error } = await uploadToSupabase(service, receiptFile, 'receipts', 'receipt')
      if (error) return NextResponse.json({ error }, { status: 400 })
      receipt_image_url = url ?? null
    }

    // Calculate warranty end date — 2-year warranty from delivery/order date
    const purchaseDate = bqData?.order_date ? new Date(bqData.order_date) : new Date()
    const warrantyEnd = new Date(purchaseDate)
    warrantyEnd.setMonth(warrantyEnd.getMonth() + 24)

    // First item from BQ
    const firstItem = bqData?.items?.[0]

    const { data: reg, error: regError } = await service
      .from('purchase_registrations')
      .insert({
        user_id: user.id,
        order_sn,
        invoice_no: invoice_no || null,
        channel,
        channel_type,
        sku: firstItem?.item_sku || null,
        model_name: firstItem?.item_name || null,
        serial_number: serial_number || null,
        purchase_date: bqData?.order_date || null,
        total_amount: bqData?.total_amount || 0,
        receipt_image_url,
        warranty_months: 24,
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

    // Award points atomically if BQ-verified at registration time.
    // Only enqueue for cron retry when the channel is ONLINE — STORE/ONSITE
    // orders will never appear in BigQuery and must be approved by an admin,
    // so adding them to pending_verifications wastes BQ quota and retry slots.
    if (bqData) {
      await service.rpc('award_points_for_purchase', { p_purchase_reg_id: reg.id })
    } else if (channel_type === 'ONLINE') {
      await service.from('pending_verifications').insert({
        purchase_reg_id: reg.id,
        order_sn,
      })
    }

    // Only update profile address if user *typed* one in the form AND
    // their profile address is currently empty (don't clobber existing data).
    if (address) {
      const { data: prof } = await service
        .from('users').select('address').eq('id', user.id).single()
      if (!prof?.address) {
        await service.from('users').update({ address }).eq('id', user.id)
      }
    }

    // Invalidate admin pages so newly-registered purchases show up
    // immediately without waiting for the polling interval.
    revalidatePath('/admin/pending')
    revalidatePath('/admin/purchases')
    revalidatePath(`/admin/members/${user.id}`)

    return NextResponse.json({ success: true, registration_id: reg.id, status: reg.status })
  } catch (error) {
    // Surface the underlying message so the UI can show something actionable.
    // Generic "Internal server error" hides Postgres constraint hits, RLS
    // blocks, malformed BQ payloads, etc. — which makes triage impossible.
    console.error('[API] register error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
