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

    // Claim key priority:
    //  1) canonical BQ order_sn — a fuzzy verify means the buyer's typed order_sn
    //     (e.g. 15-digit Lazada) differs from BQ's 16-digit canonical; storing the
    //     canonical makes BOTH typed forms dedupe to a single claim.
    //  2) the typed order_sn.
    //  3) serial number — หน้าร้าน has no Order ID, so its SN is the unique key;
    //     keeps the NOT NULL + global unique index on order_sn valid.
    const claimKey = bqData?.order_sn?.trim() || order_sn || serial_number
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
    } else if (order_sn) {
      // Retroactive BQ verification: every channel that supplies a REAL Order ID
      // (online marketplaces AND Brand Shop) eventually lands in BigQuery — BQ
      // just isn't real-time. Enqueue so the cron re-checks it over the next
      // 1–2 days and auto-promotes it to BQ_VERIFIED + awards points.
      // หน้าร้าน (STORE) has no Order ID (order_sn falls back to the serial
      // number, which BQ can't match) → an admin verifies it via the receipt.
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
