// ============================================================
// BigQuery Integration — Dreame Membership
// ============================================================
import { BigQuery } from '@google-cloud/bigquery'
import type { BQOrderData } from '@/types'

let bqClient: BigQuery | null = null

const PLACEHOLDER_PATHS = new Set([
  '/path/to/service-account.json',
  './service-account.json',
])

function getBQClient(): BigQuery {
  if (bqClient) return bqClient

  const credentialsJson = process.env.BQ_CREDENTIALS_JSON
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  // Detect the .env.example placeholder being copied verbatim — without this
  // check the gcloud client tries to open `/path/to/service-account.json`,
  // throws ENOENT mid-query, and the caller sees a generic "not found".
  if (!credentialsJson && adcPath && PLACEHOLDER_PATHS.has(adcPath)) {
    throw new Error(
      `BigQuery is misconfigured: GOOGLE_APPLICATION_CREDENTIALS is the placeholder "${adcPath}". ` +
      `Set BQ_CREDENTIALS_JSON to the service-account JSON (raw or base64), ` +
      `or point GOOGLE_APPLICATION_CREDENTIALS to a real key file.`,
    )
  }

  if (credentialsJson) {
    let parsed: string = credentialsJson
    try {
      JSON.parse(credentialsJson)
    } catch {
      parsed = Buffer.from(credentialsJson, 'base64').toString('utf-8')
    }
    const credentials = JSON.parse(parsed)
    bqClient = new BigQuery({ projectId: process.env.BQ_PROJECT_ID, credentials })
  } else {
    bqClient = new BigQuery({ projectId: process.env.BQ_PROJECT_ID })
  }
  return bqClient
}

const PROJECT = process.env.BQ_PROJECT_ID ?? ''
const DATASET = process.env.BQ_DATASET ?? 'Dashboard'

// ============================================================
// Verbose verify — distinguishes between "no row in BQ" and "BQ failed".
// Used by admin endpoints so we can show the real error instead of
// silently returning "not found" on auth/config issues.
// ============================================================
export type VerifyResult =
  | { status: 'found'; data: BQOrderData }
  | { status: 'not_found' }
  | { status: 'error'; error: string; attempted: { view: string; error: string }[] }

export async function verifyOrderInBQVerbose(order_sn: string): Promise<VerifyResult> {
  let bq: BigQuery
  try {
    bq = getBQClient()
  } catch (e) {
    return { status: 'error', error: (e as Error).message, attempted: [] }
  }

  const attempted: { view: string; error: string }[] = []

  // ── Attempt 1: v_dreame_orders_new ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn, platform,
          CAST(order_create_time AS STRING) AS order_create_time,
          CAST(order_date AS STRING) AS order_date,
          total_amount, items
        FROM \`${PROJECT}.${DATASET}.v_dreame_orders_new\`
        WHERE order_sn = @order_sn
        LIMIT 1
      `,
      params: { order_sn },
    })
    if (rows && rows.length > 0) return { status: 'found', data: mapRow(rows[0]) }
  } catch (e) {
    attempted.push({ view: 'v_dreame_orders_new', error: (e as Error).message })
  }

  // ── Attempt 2: aggregate from v_dreame_order_items_new ──
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
        FROM \`${PROJECT}.${DATASET}.v_dreame_order_items_new\`
        WHERE order_sn = @order_sn
        GROUP BY order_sn
        LIMIT 1
      `,
      params: { order_sn },
    })
    if (rows && rows.length > 0) return { status: 'found', data: mapRow(rows[0]) }
  } catch (e) {
    attempted.push({ view: 'v_dreame_order_items_new', error: (e as Error).message })
  }

  // If both attempts errored, surface that — otherwise it's a real "not found"
  if (attempted.length === 2) {
    return { status: 'error', error: attempted[1].error, attempted }
  }
  return { status: 'not_found' }
}

// ============================================================
// Verify single order by order_sn (back-compat helper for user-facing code).
// Returns null on either "not found" or "error" — callers that need to
// distinguish should use verifyOrderInBQVerbose instead.
// ============================================================
export async function verifyOrderInBQ(order_sn: string): Promise<BQOrderData | null> {
  const result = await verifyOrderInBQVerbose(order_sn)
  if (result.status === 'found') return result.data
  if (result.status === 'error') {
    console.error('[BQ] verifyOrderInBQ failed:', result.error, result.attempted)
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
// Same strategy: try v_dreame_orders_new, fallback to v_dreame_order_items_new.
// ============================================================
export async function batchVerifyOrders(orderSns: string[]): Promise<BQOrderData[]> {
  if (orderSns.length === 0) return []
  let bq: BigQuery
  try {
    bq = getBQClient()
  } catch (e) {
    console.error('[BQ] batchVerifyOrders client init failed:', (e as Error).message)
    return []
  }

  // ── Attempt 1: v_dreame_orders_new ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn, platform,
          CAST(order_create_time AS STRING) AS order_create_time,
          CAST(order_date AS STRING) AS order_date,
          total_amount, items
        FROM \`${PROJECT}.${DATASET}.v_dreame_orders_new\`
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
        FROM \`${PROJECT}.${DATASET}.v_dreame_order_items_new\`
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
// Search orders by keyword (admin lookup)
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
      FROM \`${PROJECT}.${DATASET}.v_dreame_orders_new\`
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
