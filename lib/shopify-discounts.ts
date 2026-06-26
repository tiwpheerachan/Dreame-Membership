// ============================================================
// Shopify Discount API client (ecom-data-platform)
//
// Wraps the external API at api-center.shd-technology.co.th.
// All calls go through this single module so we can:
//   • centralize auth (X-API-Key header)
//   • centralize error mapping (their `{ detail: "..." }` → typed Error)
//   • centralize logging (every call shows up in server logs)
//   • make the surface easy to mock in tests
//
// Env:
//   SHOPIFY_DISCOUNT_API_URL   default https://api-center.shd-technology.co.th
//   SHOPIFY_DISCOUNT_API_KEY   required at runtime — set on Render/local
//   SHOPIFY_DEFAULT_SHOP_ID    default dreame-thailand.myshopify.com
// ============================================================

const BASE_URL = process.env.SHOPIFY_DISCOUNT_API_URL || 'https://api-center.shd-technology.co.th'
const API_KEY  = process.env.SHOPIFY_DISCOUNT_API_KEY || ''
export const DEFAULT_SHOP_ID = process.env.SHOPIFY_DEFAULT_SHOP_ID || 'dreame-thailand.myshopify.com'

// Multi-shop config — comma-separated env var
// Example: SHOPIFY_SHOPS="dreame-thailand.myshopify.com:Thailand,dreame-malaysia.myshopify.com:Malaysia"
export interface ShopOption { id: string; label: string }
export function getShopOptions(): ShopOption[] {
  const raw = process.env.SHOPIFY_SHOPS || ''
  const parsed = raw.split(',').map(s => s.trim()).filter(Boolean).map(entry => {
    const [id, label] = entry.split(':').map(s => s.trim())
    return { id, label: label || id.replace('.myshopify.com', '') }
  })
  if (parsed.length > 0) return parsed
  // Fallback: default shop เท่านั้น
  return [{ id: DEFAULT_SHOP_ID, label: DEFAULT_SHOP_ID.replace('.myshopify.com', '') }]
}

export function isConfigured(): boolean {
  return Boolean(API_KEY)
}

export class ShopifyDiscountError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Shopify Discount API ${status}: ${detail}`)
    this.name = 'ShopifyDiscountError'
  }
}

async function request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  if (!API_KEY) {
    throw new ShopifyDiscountError(0, 'SHOPIFY_DISCOUNT_API_KEY not configured')
  }
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method,
    headers: {
      'X-API-Key': API_KEY,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    // External API — no Next.js caching by default
    cache: 'no-store',
  })

  // Response may be empty for DELETE etc.
  const text = await res.text()
  const json = text ? safeJson(text) : null

  if (!res.ok) {
    const detail = (json && typeof json === 'object' && 'detail' in json && typeof json.detail === 'string')
      ? json.detail
      : text || `HTTP ${res.status}`
    throw new ShopifyDiscountError(res.status, detail)
  }
  return json as T
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t) } catch { return null }
}

// ── Types ────────────────────────────────────────────────────

export interface GenerateRequest {
  shop_id: string
  title: string
  value_type: 'percentage' | 'fixed_amount'
  value: number                     // positive — e.g. 10 = 10% off, 50 = ฿50 off
  code_prefix?: string              // "DREAME" → DREAME-A1B2C3D4
  quantity?: number                 // default 1, max 500
  codes?: string[]                  // OR provide your own list
  usage_limit_per_customer?: boolean
  starts_at?: string                // ISO 8601
  ends_at?: string                  // ISO 8601
  minimum_order_amount?: number

  // Total cap (กี่ครั้งรวมทั้งหมดถึงจะ disable code) — ตัวเลขรวมข้าม customer
  usage_limit?: number

  // Combination settings — มัด Shopify behavior เดียวกับ Combinations section
  // ใน Shopify Admin ถ้าตั้ง true จะ stack กับ discount อื่น ๆ ได้
  combines_with?: {
    product_discounts?:  boolean
    order_discounts?:    boolean
    shipping_discounts?: boolean
  }

  // Customer eligibility (ปกติ "All customers")
  customer_selection?: 'all' | 'prerequisite'
}

export interface GenerateResponse {
  shop_id: string
  price_rule_id: number
  price_rule_title: string
  codes_created: number
  codes: string[]
  redirect_url_pattern: string                // "https://<shop>/discount/{code}"
  redirect_url_examples: string[]
}

export interface CodeStatus {
  shop_id: string
  code: string
  price_rule_id: number
  usage_count: number
  is_used: boolean
  created_at: string
  updated_at: string
  apply_url: string
}

export interface PerformanceSummary {
  total_codes: number
  codes_used: number
  codes_unused: number
  total_uses: number
  usage_rate_pct: number
}

export interface PerformanceCode {
  id: number
  code: string
  usage_count: number
  created_at: string
}

export interface PerformanceResponse {
  shop_id: string
  price_rule_id: number
  price_rule_title: string
  value_type: string
  value: string
  ends_at: string | null
  summary: PerformanceSummary
  codes: PerformanceCode[]
}

export interface NotifyResponse extends PerformanceResponse {
  webhook_fired: boolean
}

// ── Helper to build apply URL when we know shop + code ──
export function buildApplyUrl(shopId: string, code: string): string {
  return `https://${shopId}/discount/${encodeURIComponent(code)}`
}

// Apply the code AND land the user on the specific product page, on the SAME
// storefront domain the product lives on (e.g. th.dreametech.com). Shopify's
// /discount/<code>?redirect=<path> activates the code in the session then
// redirects — so it carries through to checkout. Using the product's own
// origin (not the myshopify.com domain) keeps the discount session on the
// domain the customer actually checks out on.
//
// ⚠️ Without this, linking straight to the product URL leaves the code
// un-applied → only Shopify's automatic site discounts show at checkout.
// Best one-click UX: add the exact variant to the cart, apply the discount code,
// and land the user on checkout — all in one URL. Shopify cart permalink format:
//   https://<storefront>/cart/<variantId>:<qty>?discount=<code>
// This is what makes the discount "appear already applied" at checkout.
export function buildCartApplyUrl(productUrl: string, variantId: number, code: string): string {
  try {
    const u = new URL(productUrl)
    return `${u.origin}/cart/${variantId}:1?discount=${encodeURIComponent(code)}`
  } catch {
    return ''
  }
}

export function buildProductApplyUrl(productUrl: string, code: string): string {
  try {
    const u = new URL(productUrl)
    // Only redirect to real product pages. If the stored URL is a cart/checkout
    // link or anything else, applying the code on that path is broken — fall back
    // to /discount/<code> on the same storefront origin (code still carries to
    // checkout), landing on the store home.
    const redirect = /^\/products\//.test(u.pathname)
      ? `?redirect=${encodeURIComponent(u.pathname)}`
      : ''
    return `${u.origin}/discount/${encodeURIComponent(code)}${redirect}`
  } catch {
    return ''
  }
}

// ── Endpoints ────────────────────────────────────────────────

export async function generateDiscounts(req: GenerateRequest): Promise<GenerateResponse> {
  return request<GenerateResponse>('POST', '/api/shopify/discounts/generate', req)
}

export async function checkCode(shopId: string, code: string): Promise<CodeStatus> {
  const qs = new URLSearchParams({ shop_id: shopId, code }).toString()
  return request<CodeStatus>('GET', `/api/shopify/discounts/code?${qs}`)
}

export async function getPerformance(shopId: string, priceRuleId: number): Promise<PerformanceResponse> {
  const qs = new URLSearchParams({ shop_id: shopId, price_rule_id: String(priceRuleId) }).toString()
  return request<PerformanceResponse>('GET', `/api/shopify/discounts/performance?${qs}`)
}

/**
 * Trigger Shopify to refresh code-usage from upstream + push to your webhook_url.
 * Returns the same snapshot as performance() with an extra `webhook_fired` flag.
 */
export async function notify(shopId: string, priceRuleId: number): Promise<NotifyResponse> {
  const qs = new URLSearchParams({ shop_id: shopId }).toString()
  return request<NotifyResponse>('POST', `/api/shopify/discounts/notify/${priceRuleId}?${qs}`)
}

export interface PriceRuleListItem {
  id: number
  title: string
  value_type: 'percentage' | 'fixed_amount'
  value: string
  starts_at: string | null
  ends_at: string | null
  usage_limit: number | null
  once_per_customer: boolean
  created_at: string
  updated_at: string
  customer_selection: string
  target_type: string
  prerequisite_subtotal_range: { greater_than_or_equal_to: string } | null
}

export interface PriceRulesListResponse {
  shop_id: string
  total: number
  price_rules: PriceRuleListItem[]
}

export async function listPriceRules(shopId: string): Promise<PriceRulesListResponse> {
  const qs = new URLSearchParams({ shop_id: shopId }).toString()
  return request<PriceRulesListResponse>('GET', `/api/shopify/discounts/price-rules?${qs}`)
}

export async function deletePriceRule(shopId: string, priceRuleId: number): Promise<void> {
  const qs = new URLSearchParams({ shop_id: shopId }).toString()
  await request('DELETE', `/api/shopify/discounts/price-rules/${priceRuleId}?${qs}`)
}
