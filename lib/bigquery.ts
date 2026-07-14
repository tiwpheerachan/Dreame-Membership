// ============================================================
// BigQuery Integration — Dreame Membership
// ============================================================
import { BigQuery } from '@google-cloud/bigquery'
import type { BQOrderData, BQOrderItem } from '@/types'

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
const DATASET = process.env.BQ_DATASET ?? 'Membership'

// Tables (พาร์ทิชันด้วย order_date — query ต้องใส่ filter เสมอ ไม่งั้นค่าใช้จ่ายพุ่ง)
const T_ITEMS  = 'order_items'  // 1 row / SKU / order — มี buyer_paid + image_url
const T_ORDERS = 'orders'       // 1 row / order — มี items[] aggregated แล้ว

// ⚠️ Time window for TIME-RELEVANT scans only (shipping status, keyword search).
// DO NOT use this on exact order_sn lookups (verify / batch / getOrdersByOrderSns):
// order_sn is the exact key, so any order_date is valid, and a lower bound just
// silently hides real orders. Bug found 2026-07-14: dataset went back to
// 2023-01-03 while this window cut off at 24mo → 876 real orders (older than 2yr)
// became "not found" on register even though they were in BQ. Neither order_items
// nor orders has require_partition_filter, and order_items is clustered on
// brand_id/platform (NOT order_sn), so pruning by order_date saved nothing on
// exact lookups anyway. Exact-key queries now scan the full table (small: ~480k rows).
const PARTITION_RANGE = `order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 24 MONTH)`

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
  let viewsQueried = 0

  // Normalize: trim whitespace + uppercase. BQ comparison is normalized symmetrically
  // (TRIM + UPPER on column side) so leading spaces / case mismatch / pasted-from-email
  // order_sn don't slip through as "not found".
  const normalized = order_sn.trim().toUpperCase()

  // ── Attempt 1: Membership.order_items (raw, มี image_url + buyer_paid) ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn,
          ANY_VALUE(platform)     AS platform,
          ANY_VALUE(order_status) AS order_status,
          CAST(ANY_VALUE(order_create_time) AS STRING) AS order_create_time,
          CAST(ANY_VALUE(order_date)        AS STRING) AS order_date,
          SUM(buyer_paid) AS total_amount,
          ARRAY_AGG(STRUCT(
            item_id, model_id, item_name, item_sku,
            model_name, model_sku, quantity, price, buyer_paid, image_url
          )) AS items
        FROM \`${PROJECT}.${DATASET}.${T_ITEMS}\`
        WHERE UPPER(TRIM(order_sn)) = @order_sn
        GROUP BY order_sn
        LIMIT 1
      `,
      params: { order_sn: normalized },
    })
    viewsQueried += 1
    if (rows && rows.length > 0) return { status: 'found', data: mapRow(rows[0]) }
  } catch (e) {
    attempted.push({ view: T_ITEMS, error: (e as Error).message })
  }

  // ── Attempt 2: Membership.orders (pre-aggregated fallback) ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn, platform, order_status,
          CAST(order_create_time AS STRING) AS order_create_time,
          CAST(order_date        AS STRING) AS order_date,
          total_amount, items
        FROM \`${PROJECT}.${DATASET}.${T_ORDERS}\`
        WHERE UPPER(TRIM(order_sn)) = @order_sn
        LIMIT 1
      `,
      params: { order_sn: normalized },
    })
    viewsQueried += 1
    if (rows && rows.length > 0) return { status: 'found', data: mapRow(rows[0]) }
  } catch (e) {
    attempted.push({ view: T_ORDERS, error: (e as Error).message })
  }

  // ── Attempt 3: fuzzy fallback — ±1 trailing digit, must resolve to ONE order ──
  // บาง Lazada order (source "jst") เก็บ order_sn ที่มีเลขต่อท้ายเกินมา 1 หลัก
  // จากเลขที่ลูกค้าเห็นบน Lazada (เช่น พิมพ์ 110558584858342 แต่ BQ = 1105585848583422).
  // พิสูจน์แล้ว (2026-07-14) ว่าตัด 1 หลักท้ายของ order 16 หลักไม่ชนกันเลย
  // (94,852 orders → 94,852 prefixes ไม่ซ้ำ) → prefix match ที่ได้ "ออเดอร์เดียว"
  // ปลอดภัยพอจะรับได้. ถ้าเจอมากกว่า 1 = กำกวม → ไม่ match (กันให้แต้มผิดออเดอร์).
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn,
          ANY_VALUE(platform)     AS platform,
          ANY_VALUE(order_status) AS order_status,
          CAST(ANY_VALUE(order_create_time) AS STRING) AS order_create_time,
          CAST(ANY_VALUE(order_date)        AS STRING) AS order_date,
          SUM(buyer_paid) AS total_amount,
          ARRAY_AGG(STRUCT(
            item_id, model_id, item_name, item_sku,
            model_name, model_sku, quantity, price, buyer_paid, image_url
          )) AS items
        FROM \`${PROJECT}.${DATASET}.${T_ITEMS}\`
        WHERE ABS(LENGTH(TRIM(order_sn)) - @len) = 1
          AND ( STARTS_WITH(UPPER(TRIM(order_sn)), @order_sn)
             OR STARTS_WITH(@order_sn, UPPER(TRIM(order_sn))) )
        GROUP BY order_sn
        LIMIT 2
      `,
      params: { order_sn: normalized, len: normalized.length },
    })
    viewsQueried += 1
    if (rows && rows.length === 1) {
      console.warn(`[BQ] fuzzy order_sn match: "${normalized}" → "${rows[0].order_sn}" (±1 trailing digit)`)
      return { status: 'found', data: mapRow(rows[0]) }
    }
    if (rows && rows.length > 1) {
      console.warn(`[BQ] fuzzy order_sn "${normalized}" ambiguous — ${rows.length}+ candidates, not matching`)
    }
  } catch (e) {
    attempted.push({ view: `${T_ITEMS} (fuzzy)`, error: (e as Error).message })
  }

  // ถ้า "ไม่มี view ไหน return rows สำเร็จเลย" = ไม่ทราบจริงๆ ว่ามีหรือไม่
  //  → คืน error เพื่อให้ caller รู้ว่าเป็น infra/auth ปัญหา ไม่ใช่ "not found จริง"
  // (กรณีเดิม: partial error 1 view + อีก view คืน 0 rows → ตอบ not_found เงียบๆ
  //  ทำให้ user เห็น "ยังไม่พบใน BigQuery" ทั้งที่จริงๆ query fail บางส่วน)
  if (viewsQueried === 0 && attempted.length > 0) {
    return { status: 'error', error: attempted[attempted.length - 1].error, attempted }
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
    order_status: (row.order_status as string | null) ?? null,
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
      buyer_paid: item.buyer_paid != null ? Number(item.buyer_paid) : undefined,
      image_url: (item.image_url as string | null) ?? null,
    })) : [],
  }
}

// ============================================================
// Batch verify pending orders (for cron job)
// Query BOTH tables and merge. If we early-returned after attempt 1
// matched even one order, any queued order that exists *only* in
// `order_items` would never be verified — the cron would retry
// forever and the customer's PENDING registration would never
// auto-promote despite the row being live in BQ.
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

  // Normalize input SNs once; map normalized → original so we can return rows
  // keyed by what the caller passed in (callers may match against
  // purchase_registrations.order_sn that's stored un-normalized).
  const origBySn = new Map<string, string>()
  const normalizedSns: string[] = []
  for (const sn of orderSns) {
    const norm = sn.trim().toUpperCase()
    if (!origBySn.has(norm)) origBySn.set(norm, sn)
    normalizedSns.push(norm)
  }
  const merged = new Map<string, BQOrderData>()

  // ── Membership.order_items (raw — มี image_url + buyer_paid) ──
  try {
    const [rows] = await bq.query({
      query: `
        SELECT
          order_sn,
          ANY_VALUE(platform)     AS platform,
          ANY_VALUE(order_status) AS order_status,
          CAST(ANY_VALUE(order_create_time) AS STRING) AS order_create_time,
          CAST(ANY_VALUE(order_date)        AS STRING) AS order_date,
          SUM(buyer_paid) AS total_amount,
          ARRAY_AGG(STRUCT(
            item_id, model_id, item_name, item_sku,
            model_name, model_sku, quantity, price, buyer_paid, image_url
          )) AS items
        FROM \`${PROJECT}.${DATASET}.${T_ITEMS}\`
        WHERE UPPER(TRIM(order_sn)) IN UNNEST(@sns)
        GROUP BY order_sn
      `,
      params: { sns: normalizedSns },
    })
    for (const r of rows || []) {
      const data = mapRow(r as Record<string, unknown>)
      const norm = data.order_sn.trim().toUpperCase()
      merged.set(origBySn.get(norm) ?? data.order_sn, data)
    }
  } catch (e) {
    console.warn(`[BQ] batchVerifyOrders ${T_ITEMS} failed:`, (e as Error).message)
  }

  // ── Membership.orders — fallback for any order_sn the items table missed ──
  const missing = orderSns.filter(sn => !merged.has(sn))
  if (missing.length > 0) {
    const missingNorm = missing.map(sn => sn.trim().toUpperCase())
    try {
      const [rows] = await bq.query({
        query: `
          SELECT
            order_sn, platform, order_status,
            CAST(order_create_time AS STRING) AS order_create_time,
            CAST(order_date        AS STRING) AS order_date,
            total_amount, items
          FROM \`${PROJECT}.${DATASET}.${T_ORDERS}\`
          WHERE ${PARTITION_RANGE}
            AND UPPER(TRIM(order_sn)) IN UNNEST(@sns)
        `,
        params: { sns: missingNorm },
      })
      for (const r of rows || []) {
        const data = mapRow(r as Record<string, unknown>)
        const norm = data.order_sn.trim().toUpperCase()
        merged.set(origBySn.get(norm) ?? data.order_sn, data)
      }
    } catch (e) {
      console.error(`[BQ] batchVerifyOrders ${T_ORDERS} failed:`, (e as Error).message)
    }
  }

  return Array.from(merged.values())
}

// ============================================================
// Search orders by keyword (admin lookup)
// ============================================================
export async function searchOrdersByKeyword(keyword: string, limit = 20): Promise<BQOrderData[]> {
  try {
    const bq = getBQClient()
    // Admin search ใช้ window กว้างกว่า verify (24 เดือน) เผื่อค้นออเดอร์เก่า
    const query = `
      SELECT
        order_sn, platform, order_status,
        CAST(order_create_time AS STRING) AS order_create_time,
        CAST(order_date        AS STRING) AS order_date,
        total_amount, items
      FROM \`${PROJECT}.${DATASET}.${T_ORDERS}\`
      WHERE order_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 24 MONTH)
        AND LOWER(order_sn) LIKE @keyword
      LIMIT @limit
    `
    const [rows] = await bq.query({
      query,
      params: { keyword: `%${keyword.toLowerCase()}%`, limit },
    })
    return (rows || []).map(r => mapRow(r as Record<string, unknown>))
  } catch (error) {
    console.error('[BQ] searchOrders error:', error)
    return []
  }
}

// ============================================================
// SHIPPING STATUS — Membership.shipping_status (cross-platform)
//
// Schema: 1 row per fulfillment (Shopee/TikTok = order; Shopify = can be many per order)
// Normalized status: label_printed | in_transit | out_for_delivery | delivered | failure | cancelled
// ============================================================

const T_SHIPPING = 'shipping_status'
const T_DISCOUNT = 'discount_code_status'

export interface BQShippingRow {
  platform:           string
  brand_id:           string
  brand_name:         string
  shop_id:            string
  order_sn:           string
  fulfillment_id:     string
  fulfillment_status: string | null
  shipment_status:    'label_printed' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failure' | 'cancelled' | string | null
  carrier:            string | null
  tracking_numbers:   string[]
  tracking_urls:      string[]
  shipped_at:         string | null
  delivered_at:       string | null
  last_event_status:  string | null
  last_event_at:      string | null
  last_event_location: string | null
  order_date:         string
}

function mapShipping(r: Record<string, unknown>): BQShippingRow {
  const arr = (k: string): string[] => {
    const v = r[k]
    if (Array.isArray(v)) return v.map(x => String(x))
    return []
  }
  const ts = (k: string): string | null => {
    const v = r[k]
    if (!v) return null
    if (typeof v === 'object' && 'value' in v) return String((v as { value: unknown }).value)
    return String(v)
  }
  return {
    platform:            String(r.platform || ''),
    brand_id:            String(r.brand_id || ''),
    brand_name:          String(r.brand_name || ''),
    shop_id:             String(r.shop_id || ''),
    order_sn:            String(r.order_sn || ''),
    fulfillment_id:      String(r.fulfillment_id || ''),
    fulfillment_status:  r.fulfillment_status ? String(r.fulfillment_status) : null,
    shipment_status:     r.shipment_status ? String(r.shipment_status) : null,
    carrier:             r.carrier ? String(r.carrier) : null,
    tracking_numbers:    arr('tracking_numbers'),
    tracking_urls:       arr('tracking_urls'),
    shipped_at:          ts('shipped_at'),
    delivered_at:        ts('delivered_at'),
    last_event_status:   r.last_event_status ? String(r.last_event_status) : null,
    last_event_at:       ts('last_event_at'),
    last_event_location: r.last_event_location ? String(r.last_event_location) : null,
    order_date:          ts('order_date') || '',
  }
}

/**
 * ดึง shipping status ของ order_sn เดียว (ทุก fulfillment ที่มี)
 * เร็ว — ใช้ partition + cluster pruning
 */
export async function getShippingByOrderSn(order_sn: string): Promise<BQShippingRow[]> {
  try {
    const bq = getBQClient()
    const query = `
      SELECT * FROM \`${PROJECT}.${DATASET}.${T_SHIPPING}\`
      WHERE ${PARTITION_RANGE}
        AND brand_id = 'dreame'
        AND order_sn = @order_sn
      ORDER BY shipped_at DESC NULLS LAST, last_event_at DESC NULLS LAST
    `
    const [rows] = await bq.query({ query, params: { order_sn } })
    return (rows || []).map(r => mapShipping(r as Record<string, unknown>))
  } catch (e) {
    console.error('[BQ] getShippingByOrderSn:', (e as Error).message)
    return []
  }
}

/**
 * ดึง shipping ของหลาย order_sn พร้อมกัน (สำหรับ /api/orders/me)
 */
export async function getShippingByOrderSns(order_sns: string[]): Promise<BQShippingRow[]> {
  if (order_sns.length === 0) return []
  try {
    const bq = getBQClient()
    const query = `
      SELECT * FROM \`${PROJECT}.${DATASET}.${T_SHIPPING}\`
      WHERE ${PARTITION_RANGE}
        AND brand_id = 'dreame'
        AND order_sn IN UNNEST(@order_sns)
      ORDER BY shipped_at DESC NULLS LAST, last_event_at DESC NULLS LAST
    `
    const [rows] = await bq.query({ query, params: { order_sns } })
    return (rows || []).map(r => mapShipping(r as Record<string, unknown>))
  } catch (e) {
    console.error('[BQ] getShippingByOrderSns:', (e as Error).message)
    return []
  }
}

/**
 * Recent shipping ของ brand dreame (active = ยังไม่ delivered)
 * Admin dashboard / overview
 */
export async function getRecentActiveShipments(daysBack = 30, limit = 100): Promise<BQShippingRow[]> {
  try {
    const bq = getBQClient()
    const query = `
      SELECT * FROM \`${PROJECT}.${DATASET}.${T_SHIPPING}\`
      WHERE order_date >= DATE_SUB(CURRENT_DATE('Asia/Bangkok'), INTERVAL @days DAY)
        AND brand_id = 'dreame'
        AND shipment_status IN ('label_printed','in_transit','out_for_delivery')
      ORDER BY last_event_at DESC NULLS LAST
      LIMIT @limit
    `
    const [rows] = await bq.query({ query, params: { days: daysBack, limit } })
    return (rows || []).map(r => mapShipping(r as Record<string, unknown>))
  } catch (e) {
    console.error('[BQ] getRecentActive:', (e as Error).message)
    return []
  }
}

/**
 * Bulk fetch order info (items + platform + total) for many order_sns at once
 * ใช้ใน /api/orders/me-bq → 1 query แทน N queries
 */
export interface BQOrderInfo {
  platform: string
  order_sn: string
  brand_name: string | null
  order_create_time: string | null
  total_amount: number | null
  items: BQOrderItem[]
}

export async function getOrdersByOrderSns(order_sns: string[]): Promise<BQOrderInfo[]> {
  if (order_sns.length === 0) return []
  try {
    const bq = getBQClient()
    const query = `
      SELECT
        platform, order_sn, brand_name,
        CAST(order_create_time AS STRING) AS order_create_time,
        total_amount, items
      FROM \`${PROJECT}.${DATASET}.${T_ORDERS}\`
      WHERE brand_id = 'dreame'
        AND order_sn IN UNNEST(@order_sns)
    `
    const [rows] = await bq.query({ query, params: { order_sns } })
    return (rows || []).map(r => {
      const obj = r as Record<string, unknown>
      const itemsRaw = (obj.items as unknown[]) || []
      const items: BQOrderItem[] = itemsRaw.map(it => {
        const item = it as Record<string, unknown>
        return {
          item_id:    String(item.item_id    ?? ''),
          model_id:   String(item.model_id   ?? ''),
          item_name:  String(item.item_name  ?? ''),
          item_sku:   String(item.item_sku   ?? ''),
          model_name: String(item.model_name ?? ''),
          model_sku:  String(item.model_sku  ?? ''),
          quantity:   Number(item.quantity || 0),
          price:      Number(item.price || 0),
          buyer_paid: item.buyer_paid != null ? Number(item.buyer_paid) : undefined,
          image_url:  (item.image_url as string | null) ?? null,
        }
      })
      return {
        platform:          String(obj.platform || ''),
        order_sn:          String(obj.order_sn || ''),
        brand_name:        obj.brand_name ? String(obj.brand_name) : null,
        order_create_time: obj.order_create_time as string | null,
        total_amount:      Number(obj.total_amount || 0),
        items,
      }
    })
  } catch (e) {
    console.error('[BQ] getOrdersByOrderSns:', (e as Error).message)
    return []
  }
}
