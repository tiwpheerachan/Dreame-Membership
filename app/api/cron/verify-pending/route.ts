// ============================================================
// CRON JOB: Batch verify pending BigQuery orders
// Schedule: Every 1 hour
// Setup in Vercel: Settings → Cron Jobs → /api/cron/verify-pending
// Or use Google Cloud Scheduler to POST this endpoint
// ============================================================
import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { batchVerifyOrders } from '@/lib/bigquery'

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
    // Only retry ONLINE orders. STORE/ONSITE rows can never appear in BQ and
    // must be admin-approved instead. The register endpoint already gates
    // inserts by channel_type, but the inner join here also protects against
    // legacy rows from before that gate existed.
    const { data: pendingQueue } = await supabase
      .from('pending_verifications')
      .select('id, purchase_reg_id, order_sn, retry_count, purchase_registrations!inner(channel_type)')
      .eq('purchase_registrations.channel_type', 'ONLINE')
      .lt('retry_count', 48)  // 48 × 1h cron = 2 days; BQ refresh is 6h so ~8 real chances
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
        const warrantyEnd = new Date(purchaseDate)
        warrantyEnd.setMonth(warrantyEnd.getMonth() + 24)  // 2-year warranty

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

    console.log(`[CRON] Done: ${verified} verified, ${failed} still pending`)
    return NextResponse.json({ message: 'Cron completed', verified, still_pending: failed })

  } catch (error) {
    console.error('[CRON] Error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}

// Also support POST for Google Cloud Scheduler
export const POST = GET
