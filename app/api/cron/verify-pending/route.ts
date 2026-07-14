// ============================================================
// CRON JOB: Batch verify pending BigQuery orders
// Schedule: Every 1 hour
// Setup in Vercel: Settings → Cron Jobs → /api/cron/verify-pending
// Or use Google Cloud Scheduler to POST this endpoint
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { batchVerifyOrders } from '@/lib/bigquery'
import { mainWarrantyMonths } from '@/lib/warranty'

export async function GET(req: Request) {
  // Security check — bail loudly if the secret isn't configured at all
  // (otherwise the comparison `Bearer undefined` would let attackers in).
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[CRON] CRON_SECRET is not set — refusing to run')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    // Self-heal: any PENDING+ONLINE registration missing from the queue (legacy
    // rows, or an insert that raced with a queue failure) would never get
    // re-checked. Backfill them before reading the queue.
    // ONLY ONLINE auto-verifies. Brand Shop & หน้าร้าน (ONSITE) always go through
    // admin confirmation — even when their order/SN exists in BQ — so the cron
    // must never auto-promote them.
    const { data: orphans } = await supabase
      .from('purchase_registrations')
      .select('id, order_sn')
      .eq('status', 'PENDING')
      .eq('channel_type', 'ONLINE')
      .limit(500)
    if (orphans && orphans.length > 0) {
      const orphanIds = orphans.map(o => o.id)
      const { data: queued } = await supabase
        .from('pending_verifications')
        .select('purchase_reg_id')
        .in('purchase_reg_id', orphanIds)
      const queuedSet = new Set((queued || []).map(q => q.purchase_reg_id))
      const toInsert = orphans
        .filter(o => !queuedSet.has(o.id))
        .map(o => ({ purchase_reg_id: o.id, order_sn: o.order_sn }))
      if (toInsert.length > 0) {
        await supabase.from('pending_verifications').insert(toInsert)
        console.log(`[CRON] Backfilled ${toInsert.length} orphan PENDING orders into queue`)
      }
    }

    // Retry ONLINE orders only. Brand Shop & หน้าร้าน (ONSITE) are admin-confirmed
    // and must never auto-promote — the register endpoint already keeps them out
    // of the queue, and this inner join also guards against legacy queue rows.
    const { data: pendingQueue } = await supabase
      .from('pending_verifications')
      .select('id, purchase_reg_id, order_sn, retry_count, purchase_registrations!inner(channel_type)')
      .eq('purchase_registrations.channel_type', 'ONLINE')
      .lt('retry_count', 168)  // 168 × 1h = 7 days; BQ refresh is ~6h so ~28 real chances
      .order('created_at', { ascending: true })
      .limit(200)

    if (!pendingQueue || pendingQueue.length === 0) {
      return NextResponse.json({ message: 'No pending orders', processed: 0 })
    }

    type PendingRow = {
      id: string
      purchase_reg_id: string
      order_sn: string
      retry_count: number
    }
    const queue = pendingQueue as unknown as PendingRow[]
    const orderSns = queue.map(p => p.order_sn)
    console.log(`[CRON] Checking ${orderSns.length} pending orders...`)

    // Batch query BigQuery
    const bqResults = await batchVerifyOrders(orderSns)
    const foundMap = new Map(bqResults.map(r => [r.order_sn, r]))

    let verified = 0, failed = 0

    for (const pending of queue) {
      const bqData = foundMap.get(pending.order_sn)

      if (bqData) {
        // Found in BQ → update registration
        const firstItem = bqData.items?.[0]
        const purchaseDate = bqData.order_date ? new Date(bqData.order_date) : new Date()
        // Warranty length depends on the product type — match the register route
        // (was hardcoded 24mo here, which under/over-stated non-standard products).
        const warrantyMonths = mainWarrantyMonths(firstItem?.item_name)
        const warrantyEnd = new Date(purchaseDate)
        warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyMonths)

        const { error } = await supabase
          .from('purchase_registrations')
          .update({
            bq_verified: true,
            bq_verified_at: new Date().toISOString(),
            bq_raw_data: bqData,
            status: 'BQ_VERIFIED',
            sku: firstItem?.item_sku || null,
            model_name: firstItem?.item_name || null,
            purchase_date: bqData.order_date || null,
            total_amount: bqData.total_amount,
            warranty_months: warrantyMonths,
            warranty_start: purchaseDate.toISOString().split('T')[0],
            warranty_end: warrantyEnd.toISOString().split('T')[0],
          })
          .eq('id', pending.purchase_reg_id)

        if (!error) {
          // Award points atomically via DB function
          await supabase.rpc('award_points_for_purchase', {
            p_purchase_reg_id: pending.purchase_reg_id,
          })
          // Remove from pending queue
          await supabase.from('pending_verifications').delete().eq('id', pending.id)
          verified++
        }
      } else {
        // Not found yet → increment retry count
        await supabase
          .from('pending_verifications')
          .update({ retry_count: pending.retry_count + 1, last_retry_at: new Date().toISOString() })
          .eq('id', pending.id)
        failed++
      }
    }

    // ── Self-heal: award any BQ_VERIFIED / ADMIN_APPROVED registration that
    // somehow still has points_awarded = 0 (e.g. an award RPC that errored at
    // registration time). award_points_for_purchase is idempotent, so this is
    // safe to run every cycle and guarantees no verified order stays unawarded.
    let healed = 0
    const { data: unawarded } = await supabase
      .from('purchase_registrations')
      .select('id')
      .in('status', ['BQ_VERIFIED', 'ADMIN_APPROVED'])
      .eq('points_awarded', 0)
      .limit(500)
    for (const r of unawarded || []) {
      const { data: pts } = await supabase.rpc('award_points_for_purchase', { p_purchase_reg_id: r.id })
      if ((pts as number) > 0) healed++
    }
    if (healed > 0) console.log(`[CRON] Self-healed ${healed} unawarded verified registrations`)

    console.log(`[CRON] Done: ${verified} verified, ${failed} still pending, ${healed} healed`)
    return NextResponse.json({ message: 'Cron completed', verified, still_pending: failed, healed })

  } catch (error) {
    console.error('[CRON] Error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}

// Also support POST for Google Cloud Scheduler
export const POST = GET
