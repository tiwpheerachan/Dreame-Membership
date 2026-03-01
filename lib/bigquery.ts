// ============================================================
// BigQuery Integration — Dreame Membership
// ============================================================
import { BigQuery } from '@google-cloud/bigquery'
import type { BQOrderData } from '@/types'

let bqClient: BigQuery | null = null

function getBQClient(): BigQuery {
  if (!bqClient) {
    // Support both file path and inline JSON credentials
    const credentialsJson = process.env.BQ_CREDENTIALS_JSON
    if (credentialsJson) {
      const credentials = JSON.parse(credentialsJson)
      bqClient = new BigQuery({ projectId: process.env.BQ_PROJECT_ID, credentials })
    } else {
      bqClient = new BigQuery({ projectId: process.env.BQ_PROJECT_ID })
    }
  }
  return bqClient
}

const PROJECT = process.env.BQ_PROJECT_ID ?? 'elated-channel-468406-t4'
const DATASET = process.env.BQ_DATASET ?? 'Dashboard'

// ============================================================
// Verify single order by order_sn
// ============================================================
export async function verifyOrderInBQ(order_sn: string): Promise<BQOrderData | null> {
  try {
    const bq = getBQClient()
    const query = `
      SELECT
        order_sn,
        platform,
        CAST(order_create_time AS STRING) AS order_create_time,
        CAST(order_date AS STRING) AS order_date,
        total_amount,
        items
      FROM \`${PROJECT}.${DATASET}.v_dreame_orders\`
      WHERE order_sn = @order_sn
      LIMIT 1
    `
    const [rows] = await bq.query({ query, params: { order_sn } })
    if (!rows || rows.length === 0) return null

    const row = rows[0]
    return {
      order_sn: row.order_sn,
      platform: row.platform,
      order_create_time: row.order_create_time,
      order_date: row.order_date,
      total_amount: Number(row.total_amount),
      items: Array.isArray(row.items) ? row.items.map((item: Record<string, unknown>) => ({
        item_id: item.item_id,
        model_id: item.model_id,
        item_name: item.item_name,
        item_sku: item.item_sku,
        model_name: item.model_name,
        model_sku: item.model_sku,
        quantity: Number(item.quantity),
        price: Number(item.price),
      })) : [],
    }
  } catch (error) {
    console.error('[BQ] verifyOrderInBQ error:', error)
    return null
  }
}

// ============================================================
// Batch verify pending orders (for cron job)
// ============================================================
export async function batchVerifyOrders(orderSns: string[]): Promise<BQOrderData[]> {
  if (orderSns.length === 0) return []
  try {
    const bq = getBQClient()
    const query = `
      SELECT
        order_sn,
        platform,
        CAST(order_create_time AS STRING) AS order_create_time,
        CAST(order_date AS STRING) AS order_date,
        total_amount,
        items
      FROM \`${PROJECT}.${DATASET}.v_dreame_orders\`
      WHERE order_sn IN UNNEST(@sns)
    `
    const [rows] = await bq.query({ query, params: { sns: orderSns } })
    return (rows || []).map((row: Record<string, unknown>) => ({
      order_sn: row.order_sn as string,
      platform: row.platform as string,
      order_create_time: row.order_create_time as string,
      order_date: row.order_date as string,
      total_amount: Number(row.total_amount),
      items: Array.isArray(row.items) ? (row.items as Record<string, unknown>[]).map(item => ({
        item_id: item.item_id as string,
        model_id: item.model_id as string,
        item_name: item.item_name as string,
        item_sku: item.item_sku as string,
        model_name: item.model_name as string,
        model_sku: item.model_sku as string,
        quantity: Number(item.quantity),
        price: Number(item.price),
      })) : [],
    }))
  } catch (error) {
    console.error('[BQ] batchVerifyOrders error:', error)
    return []
  }
}

// ============================================================
// Search orders by user info (optional - for admin lookup)
// ============================================================
export async function searchOrdersByKeyword(keyword: string, limit = 20): Promise<BQOrderData[]> {
  try {
    const bq = getBQClient()
    const query = `
      SELECT
        order_sn,
        platform,
        CAST(order_create_time AS STRING) AS order_create_time,
        CAST(order_date AS STRING) AS order_date,
        total_amount,
        items
      FROM \`${PROJECT}.${DATASET}.v_dreame_orders\`
      WHERE LOWER(order_sn) LIKE @keyword
      LIMIT @limit
    `
    const [rows] = await bq.query({
      query,
      params: { keyword: `%${keyword.toLowerCase()}%`, limit },
    })
    return rows || []
  } catch (error) {
    console.error('[BQ] searchOrders error:', error)
    return []
  }
}
