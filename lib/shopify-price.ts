// ============================================================
// Fetch current price of a Shopify product (no auth needed)
//
// Shopify exposes a public JSON endpoint for every storefront product:
//   https://<shop-domain>/products/<handle>.json
//
// We use this to compute discount dynamically — so the user always
// pays exactly `cash_top_up_thb` regardless of sale/promo on Shopify.
//
// Returns the lowest-variant price (most reward products = single variant)
// or null if not fetchable.
// ============================================================

export interface ProductPriceInfo {
  current_price_thb: number
  compare_at_price_thb: number | null   // price before sale (ถ้ามี)
  variant_id: number | null
  product_id: number | null
  title: string
  available: boolean
  source_url: string
}

/**
 * Extract product handle from various URL formats:
 *   https://dreame-thailand.com/products/dreame-f20            → dreame-f20
 *   https://dreame-thailand.myshopify.com/products/dreame-f20  → dreame-f20
 *   https://dreame-thailand.com/products/dreame-f20?variant=X  → dreame-f20
 */
export function extractProductHandle(productUrl: string): { shop: string; handle: string } | null {
  try {
    const url = new URL(productUrl)
    const match = url.pathname.match(/\/products\/([^/?]+)/)
    if (!match) return null
    return { shop: url.hostname, handle: match[1] }
  } catch { return null }
}

/**
 * Fetch product info from Shopify's public JSON endpoint.
 * Returns null if product is hidden, deleted, or shop unreachable.
 */
export async function fetchShopifyProductPrice(productUrl: string): Promise<ProductPriceInfo | null> {
  const parts = extractProductHandle(productUrl)
  if (!parts) return null

  // Shopify allows any custom domain to forward to the storefront JSON, but
  // .myshopify.com is most reliable. Try both.
  const candidates = [
    `https://${parts.shop}/products/${parts.handle}.js`,        // .js = lighter (no metafields)
    `https://${parts.shop}/products/${parts.handle}.json`,
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'accept': 'application/json' },
        // Timeout via AbortSignal — 5s is plenty for public JSON
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue

      const data = await res.json()
      const product = data?.product || data   // .json wraps, .js doesn't

      // Shopify prices are in cents (.js) or as string THB (.json)
      // .js: price = 900000 (cents)
      // .json: variants[0].price = "9000.00"
      const isJsFormat = typeof product.price === 'number' && product.price > 1000
      const variants = product.variants || []
      if (variants.length === 0 && !isJsFormat) continue

      let priceVal: number
      let comparePriceVal: number | null = null
      let variantId: number | null = null

      if (isJsFormat) {
        // .js format: price/compare_at_price in cents
        priceVal = product.price / 100
        comparePriceVal = product.compare_at_price ? product.compare_at_price / 100 : null
        variantId = variants[0]?.id ?? null
      } else {
        // .json format: price/compare_at_price as string
        const v = variants[0]
        priceVal = Number(v.price)
        comparePriceVal = v.compare_at_price ? Number(v.compare_at_price) : null
        variantId = v.id
      }

      if (!priceVal || isNaN(priceVal)) continue

      return {
        current_price_thb:    priceVal,
        compare_at_price_thb: comparePriceVal,
        variant_id:           variantId,
        product_id:           product.id ?? null,
        title:                product.title || '',
        available:            product.available !== false,
        source_url:           url,
      }
    } catch (e) {
      // Try next URL format
      continue
    }
  }
  return null
}
