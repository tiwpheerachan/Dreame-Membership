// Shared validation for reward configs.
//
// PREMIUM / POINTS_CASH rewards need a real Shopify PRODUCT page (path
// /products/...) so the redeem flow can read the price + build an apply URL that
// lands on the product. Reject cart/checkout links, image URLs, etc.
// Returns an error string, or null if OK.
export function validateProductUrl(redeemType: string, url: unknown): string | null {
  const needsProduct = redeemType === 'PREMIUM' || redeemType === 'POINTS_CASH'
  if (!needsProduct || !url) return null
  let path: string
  try { path = new URL(String(url)).pathname } catch {
    return 'LINK สินค้า Shopify ไม่ใช่ URL ที่ถูกต้อง'
  }
  if (!/^\/products\//.test(path)) {
    return 'LINK สินค้า Shopify ต้องเป็น "หน้าสินค้า" (URL มี /products/) — ไม่ใช่ลิงก์ตะกร้า/checkout หรือรูปภาพ'
  }
  return null
}
