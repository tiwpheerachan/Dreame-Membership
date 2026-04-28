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
    // Get all pending online orders (created within last 7 days, not yet BQ verified)
    const { data: pendingQueue } = await supabase
      .from('pending_verifications')
      .select('id, purchase_reg_id, order_sn, retry_count')
      .lt('retry_count', 48)  // max 48 retries = 2 days
      .order('created_at', { ascending: true })
      .limit(200)

    if (!pendingQueue || pendingQueue.length === 0) {
      return NextResponse.json({ message: 'No pending orders', processed: 0 })
    }

    const orderSns = pendingQueue.map((p: Record<string, string>) => p.order_sn)
    console.log(`[CRON] Checking ${orderSns.length} pending orders...`)

    // Batch query BigQuery
    const bqResults = await batchVerifyOrders(orderSns)
    const foundMap = new Map(bqResults.map(r => [r.order_sn, r]))

    let verified = 0, failed = 0

    for (const pending of pendingQueue as Record<string, unknown>[]) {
      const bqData = foundMap.get(pending.order_sn as string)

      if (bqData) {
        // Found in BQ → update registration
        const firstItem = bqData.items?.[0]
        const purchaseDate = bqData.order_date ? new Date(bqData.order_date) : new Date()
        const warrantyEnd = new Date(purchaseDate)
        warrantyEnd.setMonth(warrantyEnd.getMonth() + 12)

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
          .eq('id', pending.purchase_reg_id as string)

        if (!error) {
          // Award points atomically via DB function
          await supabase.rpc('award_points_for_purchase', {
            p_purchase_reg_id: pending.purchase_reg_id as string,
          })
          // Remove from pending queue
          await supabase.from('pending_verifications').delete().eq('id', pending.id as string)
          verified++
        }
      } else {
        // Not found yet → increment retry count
        await supabase
          .from('pending_verifications')
          .update({ retry_count: Number(pending.retry_count) + 1, last_retry_at: new Date().toISOString() })
          .eq('id', pending.id as string)
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
