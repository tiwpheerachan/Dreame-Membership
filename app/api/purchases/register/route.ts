import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { uploadToSupabase } from '@/lib/upload'
import { mainWarrantyMonths } from '@/lib/warranty'
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

    // Parse BQ data early — we dedupe & store on the CANONICAL order_sn.
    let bqData: BQOrderData | null = null
    if (bqDataStr) {
      try { bqData = JSON.parse(bqDataStr) } catch { /* ignore malformed */ }
    }

    // BQ found → auto-award ONLY for online marketplaces. Brand Shop & หน้าร้าน
    // may match BQ (we show the product) but an admin must confirm them, so we
    // store the BQ data as reference yet keep the registration PENDING.
    const autoVerify = bqData !== null && channel_type === 'ONLINE'

    // Claim key priority:
    //  - หน้าร้าน (STORE): the Serial Number IS the identity (BQ match returns a
    //    marketplace order_sn that must NOT become the claim key, or two different
    //    units from the same order would collide). Always dedupe on the SN.
    //  - everyone else: canonical BQ order_sn (fuzzy verify may differ from the
    //    typed one, e.g. 15- vs 16-digit Lazada) → falls back to typed order_sn.
    const claimKey = channel === 'STORE'
      ? serial_number
      : (bqData?.order_sn?.trim() || order_sn || serial_number)
    if (!claimKey) {
      return NextResponse.json({ error: 'ต้องมี Order ID หรือ Serial Number อย่างน้อยหนึ่งอย่าง' }, { status: 400 })
    }

    const service = createServiceClient()

    // ── Global duplicate guard: 1 order = 1 claim across the WHOLE system ──
    // The old check filtered .eq('user_id') so a DIFFERENT user could re-claim
    // the same order_sn and earn points twice. We now block any non-REJECTED
    // registration of this order_sn (REJECTED excluded so a wrongly-rejected
    // order can be re-registered).
    // NOTE: must use the service client — RLS hides other users' rows, so a
    // user-scoped query would never see someone else's duplicate.
    const { data: existing } = await service
      .from('purchase_registrations')
      .select('id, user_id, status')
      .eq('order_sn', claimKey)
      .neq('status', 'REJECTED')
      .limit(1)
      .maybeSingle()

    if (existing) {
      const mine = existing.user_id === user.id
      const isStore = !order_sn
      return NextResponse.json({
        error: mine
          ? (isStore ? 'คุณลงทะเบียน Serial Number นี้แล้ว' : 'คุณลงทะเบียน Order ID นี้แล้ว')
          : (isStore ? 'Serial Number นี้ถูกลงทะเบียนไปแล้ว ไม่สามารถใช้ซ้ำได้' : 'ออเดอร์นี้ถูกลงทะเบียนไปแล้ว ไม่สามารถใช้ซ้ำได้'),
      }, { status: 409 })
    }

    // Upload receipt with validation
    let receipt_image_url: string | null = null
    if (receiptFile && receiptFile.size > 0) {
      const { url, error } = await uploadToSupabase(service, receiptFile, 'receipts', 'receipt')
      if (error) return NextResponse.json({ error }, { status: 400 })
      receipt_image_url = url ?? null
    }

    // First item from BQ
    const firstItem = bqData?.items?.[0]

    // Warranty end date — main-body length depends on the product type.
    const purchaseDate = bqData?.order_date ? new Date(bqData.order_date) : new Date()
    const warrantyMonths = mainWarrantyMonths(firstItem?.item_name)
    const warrantyEnd = new Date(purchaseDate)
    warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths)

    const { data: reg, error: regError } = await service
      .from('purchase_registrations')
      .insert({
        user_id: user.id,
        order_sn: claimKey,
        invoice_no: invoice_no || null,
        channel,
        channel_type,
        sku: firstItem?.item_sku || null,
        model_name: firstItem?.item_name || null,
        serial_number: serial_number || null,
        purchase_date: bqData?.order_date || null,
        total_amount: bqData?.total_amount || 0,
        receipt_image_url,
        warranty_months: warrantyMonths,
        warranty_start: purchaseDate.toISOString().split('T')[0],
        warranty_end: warrantyEnd.toISOString().split('T')[0],
        // Store BQ data as reference even for Brand Shop/หน้าร้าน (admin sees the
        // product), but only ONLINE auto-verifies — ONSITE stays PENDING for admin.
        bq_verified: autoVerify,
        bq_verified_at: autoVerify ? new Date().toISOString() : null,
        bq_raw_data: bqData || null,
        status: autoVerify ? 'BQ_VERIFIED' : 'PENDING',
      })
      .select()
      .single()

    if (regError) throw regError

    // Award points only for ONLINE BQ-verified registrations. Brand Shop &
    // หน้าร้าน are never auto-awarded — an admin confirms them (even when found
    // in BQ), so they get NO points here and are NOT enqueued for the cron.
    if (autoVerify) {
      // Award immediately. CHECK the result — a swallowed RPC error here is how
      // a BQ-verified registration ends up with 0 points and no recovery path.
      // On failure, enqueue so the cron sweep re-awards it (award fn is idempotent).
      const { error: awardErr } = await service.rpc('award_points_for_purchase', { p_purchase_reg_id: reg.id })
      if (awardErr) {
        console.error('[register] award_points_for_purchase failed — enqueueing for retry:', awardErr)
        await service.from('pending_verifications')
          .insert({ purchase_reg_id: reg.id, order_sn: claimKey })
          .then(() => {}, () => {})
      }
    } else if (channel_type === 'ONLINE') {
      // ONLINE order not yet in BQ → enqueue for the cron to re-check & auto-award
      // over the next 1–2 days (BQ isn't real-time). Brand Shop/หน้าร้าน are
      // excluded on purpose — they always route through admin confirmation.
      await service.from('pending_verifications').insert({
        purchase_reg_id: reg.id,
        order_sn: claimKey,
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

    // Invalidate the user's own pages too — points/tier/registration list all
    // change on a successful (BQ-verified) registration. Without this the user
    // lands back on a cached /purchases or /home showing the OLD point balance.
    revalidatePath('/home')
    revalidatePath('/points')
    revalidatePath('/purchases')
    revalidatePath('/profile')
    revalidatePath('/rewards')
    revalidatePath('/(user)', 'layout')

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
