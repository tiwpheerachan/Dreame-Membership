// ============================================================
// BigQuery Integration — Dreame Membership
// ============================================================
import { BigQuery } from '@google-cloud/bigquery'
import type { BQOrderData } from '@/types'

let bqClient: BigQuery | null = null

function getBQClient(): BigQuery {
  if (!bqClient) {
    const credentialsJson = process.env.BQ_CREDENTIALS_JSON
    if (credentialsJson) {
      // รองรับทั้ง raw JSON และ base64
      let parsed: string = credentialsJson
      try {
        // ลอง parse ตรงๆ ก่อน
        JSON.parse(credentialsJson)
      } catch {
        // ถ้า parse ไม่ได้ แสดงว่าเป็น base64
        parsed = Buffer.from(credentialsJson, 'base64').toString('utf-8')
      }
      const credentials = JSON.parse(parsed)
      bqClient = new BigQuery({ projectId: process.env.BQ_PROJECT_ID, credentials })
    } else {
      bqClient = new BigQuery({ projectId: process.env.BQ_PROJECT_ID })
    }
  }
  return bqClient
}

const PROJECT = process.env.BQ_PROJECT_ID ?? ''
const DATASET = process.env.BQ_DATASET ?? 'Dashboard'

// ============================================================
// Verify single order by order_sn
// Strategy:
//   1) Try v_dreame_orders (pre-aggregated view, may not exist on all setups)
//   2) Fallback to v_dreame_order_items aggregated on the fly
// ============================================================
export async function verifyOrderInBQ(order_sn: string): Promise<BQOrderData | null> {
  const bq = getBQClient()

  // ── Attempt 1: v_dreame_orders ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn, platform,
          CAST(order_create_time AS STRING) AS order_create_time,
          CAST(order_date AS STRING) AS order_date,
          total_amount, items
        FROM \`${PROJECT}.${DATASET}.v_dreame_orders\`
        WHERE order_sn = @order_sn
        LIMIT 1
      `,
      params: { order_sn },
    })
    if (rows && rows.length > 0) return mapRow(rows[0])
  } catch (e) {
    // table not found / permission / view doesn't exist — try fallback
    console.warn('[BQ] v_dreame_orders unavailable, falling back to v_dreame_order_items', (e as Error).message)
  }

  // ── Attempt 2: aggregate from v_dreame_order_items ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn,
          ANY_VALUE(platform) AS platform,
          CAST(ANY_VALUE(order_create_time) AS STRING) AS order_create_time,
          CAST(ANY_VALUE(order_date) AS STRING) AS order_date,
          SUM(price * quantity) AS total_amount,
          ARRAY_AGG(STRUCT(
            item_id, model_id, item_name, item_sku,
            model_name, model_sku, quantity, price
          )) AS items
        FROM \`${PROJECT}.${DATASET}.v_dreame_order_items\`
        WHERE order_sn = @order_sn
        GROUP BY order_sn
        LIMIT 1
      `,
      params: { order_sn },
    })
    if (rows && rows.length > 0) return mapRow(rows[0])
  } catch (e) {
    console.error('[BQ] verifyOrderInBQ fallback error:', e)
  }

  return null
}

// Shared mapper: BQ row → BQOrderData
function mapRow(row: Record<string, unknown>): BQOrderData {
  return {
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
  }
}

// ============================================================
// Batch verify pending orders (for cron job)
// Same strategy: try v_dreame_orders, fallback to v_dreame_order_items.
// ============================================================
export async function batchVerifyOrders(orderSns: string[]): Promise<BQOrderData[]> {
  if (orderSns.length === 0) return []
  const bq = getBQClient()

  // ── Attempt 1: v_dreame_orders ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn, platform,
          CAST(order_create_time AS STRING) AS order_create_time,
          CAST(order_date AS STRING) AS order_date,
          total_amount, items
        FROM \`${PROJECT}.${DATASET}.v_dreame_orders\`
        WHERE order_sn IN UNNEST(@sns)
      `,
      params: { sns: orderSns },
    })
    if (rows && rows.length > 0) return rows.map(mapRow)
  } catch (e) {
    console.warn('[BQ] batchVerifyOrders fallback', (e as Error).message)
  }

  // ── Attempt 2: aggregate from items ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn,
          ANY_VALUE(platform) AS platform,
          CAST(ANY_VALUE(order_create_time) AS STRING) AS order_create_time,
          CAST(ANY_VALUE(order_date) AS STRING) AS order_date,
          SUM(price * quantity) AS total_amount,
          ARRAY_AGG(STRUCT(
            item_id, model_id, item_name, item_sku,
            model_name, model_sku, quantity, price
          )) AS items
        FROM \`${PROJECT}.${DATASET}.v_dreame_order_items\`
        WHERE order_sn IN UNNEST(@sns)
        GROUP BY order_sn
      `,
      params: { sns: orderSns },
    })
    return (rows || []).map(mapRow)
  } catch (e) {
    console.error('[BQ] batchVerifyOrders error:', e)
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